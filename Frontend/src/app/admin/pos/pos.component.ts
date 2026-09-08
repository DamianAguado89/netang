import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  TrackByFunction,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CustomerAdminService } from '@app/admin/customers/customer-admin.service';
import { CustomerFormDialogComponent } from '@app/admin/customers/customer-form-dialog/customer-form-dialog.component';
import { ProductAdminService } from '@app/admin/products/product-admin.service';
import { OrderAdminService } from '@app/admin/orders/order-admin.service';
import { CustomerDto } from '@app/models/customer.model';
import { ProductDto } from '@app/models/product.model';

/** Línea del carrito de venta: un producto con la cantidad elegida por el vendedor. */
interface CartLine {
  product: ProductDto;
  quantity: number;
}

/**
 * @description
 * Calcula el subtotal de una línea del carrito replicando exactamente la fórmula
 * del backend (`SoldByWeight ? Round(Price * quantity / 1000, 2) : Price * quantity`).
 *
 * Para productos por peso, `product.price` es el precio por **kilogramo** y
 * `quantity` son los **gramos** cargados (ej: lo que marca la balanza), por eso
 * se divide por 1000 antes de redondear a centavos. Duplicar la fórmula acá
 * (en vez de solo confiar en el total que devuelve el backend al crear la venta)
 * permite mostrarle el subtotal correcto al vendedor mientras arma el carrito,
 * antes de enviar nada al servidor.
 *
 * @param product Producto de la línea, con su `price` y flag `soldByWeight`.
 * @param quantity Unidades del producto, o gramos si `soldByWeight` es `true`.
 * @returns El subtotal de la línea en pesos, redondeado a 2 decimales.
 */
function lineSubtotal(product: ProductDto, quantity: number): number {
  if (!product.soldByWeight) return product.price * quantity;
  return Math.round((product.price * quantity / 1000 + Number.EPSILON) * 100) / 100;
}

/**
 * @description
 * Bloquea en el `keydown` cualquier tecla que no sea un dígito o una tecla de
 * control (borrar, flechas, tab, copiar/pegar, etc.), para que el campo de
 * Cantidad no permita escribir letras ni el signo negativo directamente —
 * mismo criterio que los campos de precio del formulario de producto.
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
 * Pantalla de facturación en el local (punto de venta), accedida por la ruta `/admin/pos`.
 *
 * Guía al vendedor a través de dos pasos, gobernados por el signal `selectedCustomer`:
 *
 * 1. **Selección de cliente**: busca en la lista ya cargada por nombre o teléfono, o da de
 *    alta uno nuevo con `CustomerFormDialogComponent` sin abandonar la pantalla.
 * 2. **Armado del carrito**: busca productos activos, ajusta cantidades y genera la venta.
 *
 * Al generar la venta navega al comprobante existente (`/admin/billing/:id`) en lugar de
 * renderizar un ticket propio: esa pantalla ya resuelve la impresión y la confirmación.
 *
 * Ambas búsquedas usan el mismo patrón que `ProductListComponent`: un `FormControl` cuyo
 * `valueChanges` alimenta un signal, porque `computed()` solo puede depender de signals.
 */
@Component({
  selector: 'app-pos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.scss',
})
export class PosComponent implements OnInit {
  private readonly customerService = inject(CustomerAdminService);
  private readonly productService = inject(ProductAdminService);
  private readonly orderService = inject(OrderAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  /** Control del campo de búsqueda de clientes del paso 1. */
  readonly customerSearchControl = new FormControl('');
  /** Término activo de búsqueda de clientes, alimentado desde `customerSearchControl`. */
  readonly customerSearchTerm = signal('');

  /** Control del campo de búsqueda de productos del paso 2. */
  readonly productSearchControl = new FormControl('');
  /** Término activo de búsqueda de productos, alimentado desde `productSearchControl`. */
  readonly productSearchTerm = signal('');

  /**
   * Cliente elegido para la venta, o `null` mientras el vendedor está en el paso 1.
   * Actúa como interruptor entre los dos pasos de la pantalla.
   */
  readonly selectedCustomer = signal<CustomerDto | null>(null);

  /** Líneas del carrito de la venta en curso. */
  readonly cartLines = signal<CartLine[]>([]);

  /** `true` mientras la venta se está registrando; bloquea el botón para evitar doble envío. */
  readonly creating = signal(false);

  /** Mensaje de error del último intento de generar la venta, o `null` si no hubo error. */
  readonly createError = signal<string | null>(null);

  /** Alias al signal de carga de clientes, para mostrar el spinner del paso 1. */
  readonly loadingCustomers = this.customerService.loading;

  /** Columnas de la tabla del carrito. */
  readonly cartColumns = ['name', 'price', 'quantity', 'subtotal', 'actions'];

  /**
   * Identifica cada fila de la tabla por el id del producto, no por la identidad del
   * objeto `CartLine`. `updateQuantity` reemplaza la línea editada por un objeto nuevo
   * (`{...l, quantity}`, patrón inmutable) en cada tecla; sin `trackBy`, `mat-table`
   * asume que es una fila distinta y destruye y recrea el `<td>` completo, tirando el
   * foco del input de Cantidad afuera después de cada carácter. Con `trackBy` la tabla
   * reconoce que sigue siendo la misma fila y solo actualiza el valor en el lugar.
   */
  readonly trackCartLine: TrackByFunction<CartLine> = (_, line) => line.product.id;

  /** Bloquea teclas no numéricas en el campo de Cantidad (ver `guardQuantityKey`). */
  readonly guardQuantityKey = guardQuantityKey;

  /**
   * Clientes que coinciden con el término de búsqueda por nombre o teléfono.
   *
   * Devuelve una lista vacía cuando no hay término en lugar de la lista completa:
   * volcar todos los clientes al abrir la pantalla no ayuda a encontrar a uno,
   * y el paso 1 muestra en su lugar una invitación a buscar.
   */
  readonly filteredCustomers = computed(() => {
    const term = this.customerSearchTerm().toLowerCase().trim();
    if (!term) return [];
    return this.customerService
      .customers()
      .filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.phone?.toLowerCase().includes(term) ?? false)
      );
  });

  /**
   * Productos activos que coinciden con el término de búsqueda por nombre.
   *
   * Filtra por `isActive` porque un producto dado de baja no debe poder venderse,
   * aunque siga existiendo en la lista del panel de administración.
   */
  readonly filteredProducts = computed(() => {
    const term = this.productSearchTerm().toLowerCase().trim();
    if (!term) return [];
    return this.productService
      .products()
      .filter((p) => p.isActive && p.name.toLowerCase().includes(term));
  });

  /** Importe total de la venta en curso, recalculado ante cualquier cambio del carrito. */
  readonly cartTotal = computed(() =>
    this.cartLines().reduce((sum, line) => sum + lineSubtotal(line.product, line.quantity), 0)
  );

  /**
   * @description
   * Carga clientes y productos al montar el componente y establece los puentes
   * Observable→Signal de ambos campos de búsqueda.
   */
  ngOnInit(): void {
    this.customerService.loadCustomers();
    this.productService.loadProducts();

    this.customerSearchControl.valueChanges.subscribe((val) =>
      this.customerSearchTerm.set(val ?? '')
    );
    this.productSearchControl.valueChanges.subscribe((val) =>
      this.productSearchTerm.set(val ?? '')
    );
  }

  /**
   * @description Fija el cliente de la venta y avanza al paso de armado del carrito.
   * @param customer Cliente elegido de la lista de resultados.
   */
  selectCustomer(customer: CustomerDto): void {
    this.selectedCustomer.set(customer);
  }

  /**
   * @description
   * Abre el dialog de alta rápida de cliente. Si el alta se concreta, refresca la lista
   * cacheada (para que el cliente aparezca en búsquedas posteriores) y lo selecciona
   * de inmediato con el DTO que devuelve el dialog, evitando una segunda búsqueda.
   */
  openNewCustomerDialog(): void {
    const ref = this.dialog.open<CustomerFormDialogComponent, unknown, CustomerDto | null>(
      CustomerFormDialogComponent,
      { width: '480px', data: {} }
    );
    ref.afterClosed().subscribe((created) => {
      if (created) {
        this.customerService.loadCustomers();
        this.selectedCustomer.set(created);
      }
    });
  }

  /**
   * @description
   * Vuelve al paso de selección de cliente y descarta el carrito.
   *
   * Se vacía el carrito de forma deliberada: cambiar de cliente a mitad de una venta
   * es un caso de borde, y conservar líneas de otra operación es más peligroso
   * (facturarle productos equivocados a alguien) que rehacer la carga.
   */
  changeCustomer(): void {
    this.selectedCustomer.set(null);
    this.cartLines.set([]);
    this.createError.set(null);
    this.productSearchControl.setValue('');
  }

  /**
   * @description
   * Agrega un producto al carrito. Si ya está cargado, incrementa su cantidad en lugar
   * de duplicar la fila, para que el total y el comprobante muestren una única línea
   * por producto.
   *
   * El incremento (y la cantidad inicial) es de 100 para productos por peso, porque
   * ahí la cantidad se mide en gramos: partir de 1g o sumar de a 1g no tiene uso
   * práctico en el mostrador, mientras que 100g es un paso razonable para ajustar
   * después con lo que marca la balanza.
   *
   * @param product Producto elegido de los resultados de búsqueda.
   */
  addProduct(product: ProductDto): void {
    const step = product.soldByWeight ? 100 : 1;
    this.cartLines.update((lines) => {
      const existing = lines.find((l) => l.product.id === product.id);
      if (existing) {
        return lines.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + step } : l
        );
      }
      return [...lines, { product, quantity: step }];
    });
  }

  /**
   * @description
   * Actualiza la cantidad de una línea a partir del texto crudo del input de texto.
   *
   * Un valor vacío, no numérico o menor a 1 se ignora en lugar de eliminar la línea:
   * el vendedor puede borrar el campo para reescribirlo (ej: al corregir lo que marcó
   * la balanza) sin perder el producto del carrito. La única forma de quitar una línea
   * es el botón de borrar (`removeLine`).
   *
   * @param productId Identificador del producto cuya línea se está editando.
   * @param rawValue Texto crudo del input, tal como lo emite el DOM.
   */
  updateQuantity(productId: number, rawValue: string): void {
    const quantity = parseInt(rawValue, 10);
    if (!Number.isFinite(quantity) || quantity < 1) return;
    this.cartLines.update((lines) =>
      lines.map((l) => (l.product.id === productId ? { ...l, quantity } : l))
    );
  }

  /**
   * @description Quita una línea del carrito.
   * @param productId Identificador del producto a quitar.
   */
  removeLine(productId: number): void {
    this.cartLines.update((lines) => lines.filter((l) => l.product.id !== productId));
  }

  /**
   * @description Expone `lineSubtotal` como método del componente para que el
   * template pueda invocarlo directamente sobre cada fila de la tabla del carrito.
   * @param line Línea del carrito a calcular.
   * @returns El subtotal de la línea en pesos.
   */
  lineSubtotal(line: CartLine): number {
    return lineSubtotal(line.product, line.quantity);
  }

  /**
   * @description
   * Registra la venta y navega al comprobante recién generado.
   *
   * `paymentType` y `notes` van en `null`: la venta de mostrador no los pide, y el
   * comprobante permite completarlos después si hiciera falta.
   */
  createSale(): void {
    const customer = this.selectedCustomer();
    const lines = this.cartLines();
    if (!customer || lines.length === 0 || this.creating()) return;

    this.creating.set(true);
    this.createError.set(null);

    this.orderService
      .createSale({
        customerId: customer.id,
        paymentType: null,
        notes: null,
        saleDetails: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      })
      .subscribe({
        next: (sale) => {
          this.creating.set(false);
          this.router.navigate(['/admin/billing', sale.id]);
        },
        error: () => {
          this.creating.set(false);
          this.createError.set('No se pudo generar la venta. Revisá los datos e intentá de nuevo.');
        },
      });
  }
}
