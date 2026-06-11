import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { OrderAdminService } from '@app/admin/orders/order-admin.service';
import { SaleDto } from '@app/models/order.model';

/**
 * @description
 * Pantalla de facturación de un pedido específico, accedida por ruta (`/admin/billing/:id`).
 * A diferencia del dialog de detalle, es una página completa que permite confirmar
 * la venta e imprimir el comprobante.
 *
 * Recibe el `id` del pedido como parámetro de ruta a través de `input.required<string>()`;
 * el valor llega como string porque Angular siempre convierte los params de ruta a string
 * y se parsea a número en `loadSale()` antes de pasarlo al servicio.
 */
@Component({
  selector: 'app-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss',
})
export class BillingComponent implements OnInit {
  private readonly service = inject(OrderAdminService);
  private readonly router = inject(Router);

  /** Parámetro de ruta con el id del pedido. Llega como string; se convierte a número en `loadSale()`. */
  readonly id = input.required<string>();

  /** Pedido cargado desde el backend, o `null` mientras carga o si la petición falló. */
  readonly sale = signal<SaleDto | null>(null);
  /**
   * Inicia en `true` porque la pantalla se monta directamente en estado de carga
   * sin que el usuario deba hacer una acción explícita para disparar la petición.
   */
  readonly loading = signal(true);
  /** Mensaje de error de la última operación fallida, o `null` si no hubo errores. */
  readonly error = signal<string | null>(null);
  /** `true` mientras la petición de confirmación está en vuelo; bloquea el botón para evitar doble envío. */
  readonly confirming = signal(false);
  /** `true` cuando la venta ya está confirmada, ya sea porque se acaba de confirmar o porque llegó así del backend. */
  readonly confirmed = signal(false);

  /** Columnas de la tabla de ítems del pedido. */
  readonly detailColumns = ['productName', 'quantity', 'price', 'total'];

  /**
   * @description Delega la carga inicial del pedido a `loadSale()`.
   * Se extrae en un método privado para poder reutilizarlo después de confirmar.
   */
  ngOnInit(): void {
    this.loadSale();
  }

  /**
   * @description Carga el pedido desde el backend y sincroniza el estado de confirmación.
   * Es privado y se llama dos veces: al inicializar y tras confirmar exitosamente,
   * para reflejar el estado actualizado que devuelve el backend (`isConfirmed = true`).
   */
  private loadSale(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getOrder(parseInt(this.id(), 10)).subscribe({
      next: (sale) => {
        this.sale.set(sale);
        this.loading.set(false);
        // Si el pedido ya estaba confirmado al cargar, mostrar estado confirmado
        if (sale.isConfirmed) {
          this.confirmed.set(true);
        }
      },
      error: () => {
        this.error.set('No se pudo cargar el pedido.');
        this.loading.set(false);
      },
    });
  }

  /**
   * @description Confirma la venta actual llamando al servicio.
   * La guard clause `!sale || this.confirming()` previene doble envío si el usuario
   * pulsa el botón mientras ya hay una petición en vuelo.
   * Tras el éxito llama a `loadSale()` para sincronizar el estado completo del pedido
   * con lo que devuelve el backend, en lugar de asumir el nuevo estado localmente.
   */
  confirm(): void {
    const sale = this.sale();
    if (!sale || this.confirming()) return;

    this.confirming.set(true);
    this.service.confirmOrder(sale.id).subscribe({
      next: () => {
        this.confirmed.set(true);
        this.confirming.set(false);
        this.loadSale();
      },
      error: () => {
        this.error.set('No se pudo confirmar la venta. Intentá de nuevo.');
        this.confirming.set(false);
      },
    });
  }

  /** @description Abre el diálogo de impresión nativo del navegador para imprimir el comprobante. */
  print(): void {
    window.print();
  }

  /** @description Navega de vuelta al listado de pedidos. */
  goBack(): void {
    this.router.navigate(['/admin/orders']);
  }
}
