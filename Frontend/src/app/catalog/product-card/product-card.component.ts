import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { CatalogProduct } from '@app/models/catalog.model';
import { environment } from '@env/environment';

/**
 * @description
 * Tarjeta presentacional de un producto del catálogo público de Doña Pierina.
 *
 * Componente puramente presentacional: no inyecta servicios ni gestiona estado propio.
 * Recibe los datos del producto y la cantidad actual en el carrito desde el componente
 * padre (`CatalogComponent`), y delega hacia arriba cualquier intención del usuario
 * mediante outputs tipados.
 *
 * Flujo de interacción:
 * - Si `quantity` es 0, muestra el botón "Agregar" y emite `add` al pulsarlo.
 * - Si `quantity` > 0, muestra controles +/− y emite `changeQty` con delta +1 o −1.
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  /**
   * Base de la URL del servidor, sin el segmento `/api`.
   * Las imágenes se sirven desde la raíz del servidor (p. ej. `/uploads/...`),
   * no bajo el prefijo `/api`, por lo que se extrae antes de construir la URL absoluta.
   */
  private readonly apiBase = environment.apiUrl.replace('/api', '');

  /**
   * Producto a mostrar. Input requerido: el componente no puede renderizarse sin él.
   * Proviene del listado devuelto por `GET /api/catalog`.
   */
  readonly product = input.required<CatalogProduct>();

  /**
   * Cantidad de este producto actualmente en el carrito.
   * El padre lo resuelve en O(1) usando `catalogService.cartQuantities()`,
   * un `Map<productId, quantity>` derivado de las líneas del carrito.
   * El valor por defecto es 0, lo que indica que el producto aún no fue agregado.
   */
  readonly quantity = input(0);

  /**
   * Emitido cuando el usuario pulsa "Agregar" por primera vez para este producto
   * (es decir, cuando `quantity` es 0). El padre añade una unidad al carrito.
   */
  readonly add = output<void>();

  /**
   * Emitido con un delta (+1 o −1) cuando el usuario incrementa o decrementa
   * la cantidad de un producto que ya está en el carrito (`quantity` > 0).
   * Usar un delta en lugar del valor absoluto permite que el padre aplique
   * la lógica de negocio (p. ej. no bajar de 0) sin que este componente
   * necesite conocerla.
   */
  readonly changeQty = output<number>();

  /**
   * URL absoluta de la imagen del producto, o `null` si el producto no tiene imagen.
   * Se construye concatenando `apiBase` con la ruta relativa almacenada en el modelo,
   * porque el backend expone las imágenes fuera del prefijo `/api`.
   * El template muestra un placeholder visual cuando el valor es `null`.
   */
  readonly imageUrl = computed(() => {
    const url = this.product().imageUrl;
    return url ? this.apiBase + url : null;
  });
}
