import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { OrderAdminService } from '@app/admin/orders/order-admin.service';
import { SaleDto } from '@app/models/order.model';

/**
 * @description
 * Datos que el componente padre inyecta al abrir el dialog.
 * Solo se pasa el `saleId` en lugar del objeto completo porque el dialog
 * resuelve el detalle por su cuenta vía `OrderAdminService.getOrder()`.
 * Esto evita acoplar el dialog al estado de la lista y garantiza que siempre
 * muestre datos frescos del backend, independientemente de lo que haya en memoria.
 */
interface DialogData {
  saleId: number;
}

@Component({
  selector: 'app-order-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  templateUrl: './order-detail-dialog.component.html',
  styleUrl: './order-detail-dialog.component.scss',
})
/**
 * @description
 * Dialog de solo lectura que muestra el detalle completo de un pedido,
 * incluyendo datos del cliente, ítems y totales.
 * Al abrirse solicita inmediatamente los datos al backend y ofrece
 * un acceso directo al flujo de facturación del pedido.
 */
export class OrderDetailDialogComponent implements OnInit {
  private readonly service = inject(OrderAdminService);
  private readonly router = inject(Router);
  private readonly dialogRef = inject(MatDialogRef<OrderDetailDialogComponent>);
  /** Datos inyectados por `MatDialog.open()`. Contiene el id necesario para cargar el detalle. */
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  /** Detalle del pedido una vez resuelta la petición HTTP, o `null` mientras carga o si falló. */
  readonly sale = signal<SaleDto | null>(null);
  /**
   * Inicia en `true` porque el dialog se abre directamente en estado de carga:
   * no hay interacción previa del usuario que indique "ahora sí, carga los datos".
   */
  readonly loading = signal(true);
  /** Mensaje de error si la petición de detalle falló, o `null` en caso contrario. */
  readonly error = signal<string | null>(null);

  /** Columnas de la tabla de ítems del pedido. */
  readonly detailColumns = ['productName', 'quantity', 'price', 'total'];

  /**
   * @description Carga el detalle del pedido en cuanto el componente se inicializa.
   * Se suscribe aquí (y no en el servicio) porque el ciclo de vida del dialog
   * es el responsable de cancelar implícitamente la suscripción al destruirse.
   */
  ngOnInit(): void {
    this.service.getOrder(this.data.saleId).subscribe({
      next: (sale) => {
        this.sale.set(sale);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle del pedido.');
        this.loading.set(false);
      },
    });
  }

  /**
   * @description Cierra el dialog y navega a la pantalla de facturación del pedido.
   * El cierre ocurre antes de la navegación para que el dialog se desmonte limpiamente
   * del DOM; si se navegara primero, el dialog quedaría como overlay huérfano
   * sobre la nueva ruta hasta que Angular lo destruyera en el siguiente ciclo.
   * El operador `!` es seguro porque este método solo se habilita en el template
   * cuando `sale()` ya no es `null`.
   */
  goToBilling(): void {
    this.dialogRef.close();
    this.router.navigate(['/admin/billing', this.sale()!.id]);
  }
}
