import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OrderAdminService } from '@app/admin/orders/order-admin.service';
import { OrderDetailDialogComponent } from '@app/admin/orders/order-detail-dialog/order-detail-dialog.component';
import { SaleDto } from '@app/models/order.model';
import { sortData } from '@app/shared/sort.util';

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
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSortModule,
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

  /** Control reactivo del campo de búsqueda por cliente; su valor se sincroniza con `searchTerm`. */
  readonly searchControl = new FormControl('');

  /** Término de búsqueda activo (nombre de cliente), alimentado desde `searchControl.valueChanges`. */
  readonly searchTerm = signal('');

  /**
   * Estado de ordenamiento activo, capturado desde `(matSortChange)`.
   * Arranca en `registrationDate` descendente para mostrar los pedidos más
   * recientes primero, que es el orden que se pidió por defecto.
   */
  readonly sortState = signal<Sort>({ active: 'registrationDate', direction: 'desc' });

  /** Alias directo del signal del servicio; controla la visibilidad del spinner en el template. */
  readonly loading = this.service.loading;
  /** Alias directo del signal del servicio; controla la visibilidad del mensaje de error en el template. */
  readonly error = this.service.error;

  /**
   * Pedidos filtrados por nombre de cliente. Permite ver rápidamente qué le
   * compró un cliente puntual sin depender de un endpoint de búsqueda dedicado.
   */
  readonly filteredOrders = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.service.orders();
    return this.service.orders().filter((o) =>
      o.customerName.toLowerCase().includes(term)
    );
  });

  /** Pedidos filtrados y ordenados según `sortState`, listos para el `mat-table`. */
  readonly orders = computed(() =>
    sortData(this.filteredOrders(), this.sortState(), this.sortAccessor)
  );

  /**
   * @description Dispara la carga inicial de pedidos al montar el componente
   * y conecta el control de búsqueda al signal `searchTerm`.
   */
  ngOnInit(): void {
    this.service.loadOrders();
    this.searchControl.valueChanges.subscribe((val) =>
      this.searchTerm.set(val ?? '')
    );
  }

  /**
   * @description Extrae el valor comparable de un pedido para la columna de
   * ordenamiento activa. Usado por `sortData` (ver `shared/sort.util.ts`).
   */
  private readonly sortAccessor = (order: SaleDto, column: string) => {
    switch (column) {
      case 'documentNumber':
        return order.documentNumber;
      case 'customerName':
        return order.customerName;
      case 'customerPhone':
        return order.customerPhone ?? '';
      case 'total':
        return order.total;
      case 'registrationDate':
        return new Date(order.registrationDate);
      default:
        return null;
    }
  };

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
