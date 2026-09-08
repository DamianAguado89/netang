import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CatalogProduct } from '@app/models/catalog.model';
import { environment } from '@env/environment';

/**
 * @description
 * Bloquea en el `keydown` cualquier tecla que no sea un dígito o una tecla de
 * control (borrar, flechas, tab, copiar/pegar, etc.), para que el input de
 * gramos no permita escribir letras ni el signo negativo directamente —
 * mismo criterio que el campo Cantidad del POS admin.
 *
 * @param event Evento de teclado del input.
 */
function guardQuantityKey(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'];
  if (controlKeys.includes(event.key)) return;
  if (/^\d$/.test(event.key)) return;
  event.preventDefault();
}

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
  imports: [
    DecimalPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
  ],
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
   * Emitido con la cantidad absoluta (en gramos) cuando el usuario tipea directamente
   * en el input de un producto que se vende por peso, en vez de usar los botones +/-.
   * A diferencia de `changeQty`, este valor reemplaza la cantidad actual en lugar de
   * sumarle un delta.
   */
  readonly setQty = output<number>();

  /** Bloquea teclas no numéricas en el input de gramos (ver `guardQuantityKey`). */
  readonly guardQuantityKey = guardQuantityKey;

  /**
   * @description Parsea el texto crudo del input de gramos y lo reenvía como `setQty`.
   * Un valor vacío o inválido no emite nada — el padre simplemente no actualiza la
   * cantidad hasta que el cliente termine de escribir un número válido, igual que en
   * el campo Cantidad del POS admin (así no se pierde la línea del carrito al borrar).
   * @param event Evento `input` del campo de texto.
   */
  onQuantityInput(event: Event): void {
    const rawValue = (event.target as HTMLInputElement).value;
    const quantity = parseInt(rawValue, 10);
    if (!Number.isFinite(quantity) || quantity < 1) return;
    this.setQty.emit(quantity);
  }

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
