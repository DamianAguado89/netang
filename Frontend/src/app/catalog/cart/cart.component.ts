import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { CatalogService } from '@app/catalog/catalog.service';

/**
 * @description
 * Panel lateral del carrito de compras. Es un componente puramente presentacional:
 * no gestiona estado propio ni controla el sidenav que lo contiene. Toda la lógica
 * del carrito (agregar, quitar, calcular totales) reside en `CatalogService`.
 *
 * La separación es intencional: este componente solo muestra los datos expuestos
 * por el servicio y emite eventos hacia el padre (`CatalogComponent`), quien decide
 * si cerrar el sidenav o abrir el diálogo de confirmación de pedido.
 */
@Component({
  selector: 'app-cart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatDividerModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent {
  /**
   * Servicio inyectado para acceder al estado del carrito (ítems, cantidad y total).
   * El template consume directamente las signals `cart`, `cartCount` y `cartTotal`
   * sin necesidad de propiedades intermedias en este componente.
   */
  readonly catalogService = inject(CatalogService);

  /**
   * Se emite cuando el usuario presiona el botón de cerrar el panel del carrito.
   * El padre (`CatalogComponent`) escucha este evento para cerrar el `MatSidenav`,
   * ya que el sidenav vive en el padre y no es responsabilidad de este componente controlarlo.
   */
  readonly close = output<void>();

  /**
   * Se emite cuando el usuario confirma que desea proceder al pago.
   * El padre (`CatalogComponent`) escucha este evento para abrir el `OrderDialogComponent`,
   * manteniendo la lógica de navegación y diálogos fuera de este componente presentacional.
   */
  readonly checkout = output<void>();
}
