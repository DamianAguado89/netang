import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OrderAdminService } from '@app/admin/orders/order-admin.service';
import { OrderDetailDialogComponent } from '@app/admin/orders/order-detail-dialog/order-detail-dialog.component';

/**
 * @description
 * Componente de tabla para el listado de pedidos en el panel de administración.
 * Inicia la carga de datos al inicializarse y delega el detalle de cada pedido
 * a `OrderDetailDialogComponent` sin necesidad de recargar la lista al cerrarlo.
 */
@Component({
  selector: 'app-order-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.scss',
})
export class OrderListComponent implements OnInit {
  private readonly service = inject(OrderAdminService);
  private readonly dialog = inject(MatDialog);

  /** Columnas que renderiza el `mat-table`. El orden aquí determina el orden visual. */
  readonly displayedColumns = [
    'documentNumber',
    'customerName',
    'customerPhone',
    'total',
    'registrationDate',
    'actions',
  ];

  /** Alias directo del signal del servicio; el template lo consume sin suscripción explícita. */
  readonly orders = this.service.orders;
  /** Alias directo del signal del servicio; controla la visibilidad del spinner en el template. */
  readonly loading = this.service.loading;
  /** Alias directo del signal del servicio; controla la visibilidad del mensaje de error en el template. */
  readonly error = this.service.error;

  /**
   * @description Dispara la carga inicial de pedidos al montar el componente.
   * Se delega en el servicio para mantener el componente libre de lógica HTTP.
   */
  ngOnInit(): void {
    this.service.loadOrders();
  }

  /**
   * @description Abre el dialog de detalle para el pedido indicado.
   * No se suscribe a `afterClosed()` porque el dialog de detalle es de solo lectura:
   * no realiza mutaciones que obliguen a refrescar la lista al cerrarse.
   * @param saleId Identificador del pedido cuyo detalle se quiere mostrar.
   */
  openDetail(saleId: number): void {
    this.dialog.open(OrderDetailDialogComponent, {
      width: '640px',
      data: { saleId },
    });
  }
}
