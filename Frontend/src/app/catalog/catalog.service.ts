import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  CartItem,
  CatalogProduct,
  PlaceOrderRequest,
  PlaceOrderResponse,
  catalogItemTotal,
} from '@app/models/catalog.model';

/**
 * @description
 * Store central del módulo público de Doña Pierina.
 * Gestiona dos responsabilidades relacionadas: el catálogo de productos obtenido
 * desde la API y el carrito de compras en memoria del cliente.
 *
 * El carrito no se persiste entre sesiones; se vacía automáticamente al confirmar
 * un pedido (el componente llama a `clearCart()` tras suscribirse a `placeOrder()`).
 *
 * Todos los signals de estado son de solo lectura hacia el exterior; la mutación
 * ocurre exclusivamente a través de los métodos públicos del servicio.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /**
   * Lista de productos activos devuelta por `GET /api/catalog`.
   * Se actualiza al llamar a `loadProducts()`.
   */
  readonly products = signal<CatalogProduct[]>([]);

  /**
   * Indica si hay una petición HTTP en curso hacia el catálogo.
   * Útil para mostrar un spinner mientras se cargan los productos.
   */
  readonly loading = signal(false);

  /**
   * Mensaje de error legible por el usuario cuando la carga del catálogo falla.
   * Vale `null` mientras no hay error activo.
   */
  readonly error = signal<string | null>(null);

  /** Signal mutable interno del carrito; expuesto como solo lectura a través de `cart`. */
  private readonly _cart = signal<CartItem[]>([]);

  /**
   * Vista de solo lectura del carrito actual.
   * Usar `addToCart`, `updateQuantity` o `removeFromCart` para modificarlo.
   */
  readonly cart = this._cart.asReadonly();

  /**
   * Cantidad total de "productos" en el carrito, usada para el badge sobre el
   * ícono del carrito. Para productos por unidad suma `quantity` (unidades);
   * para productos por peso cada línea cuenta como 1, sin importar los gramos
   * cargados — 500g de Garrapiñada son una sola bolsa, no 500 productos.
   */
  readonly cartCount = computed(() =>
    this._cart().reduce((sum, item) => sum + (item.product.soldByWeight ? 1 : item.quantity), 0)
  );

  /**
   * Importe total del carrito en pesos, sumando el importe de cada ítem
   * (ver `catalogItemTotal` para el detalle del cálculo por peso vs. por unidad).
   */
  readonly cartTotal = computed(() =>
    this._cart().reduce((sum, item) => sum + catalogItemTotal(item.product, item.quantity), 0)
  );

  /**
   * Índice de acceso rápido: mapea `productId → quantity` para que
   * `ProductCardComponent` pueda leer la cantidad de un producto concreto
   * en O(1) sin recorrer el array del carrito.
   */
  readonly cartQuantities = computed<Map<number, number>>(() => {
    const map = new Map<number, number>();
    for (const item of this._cart()) {
      map.set(item.product.id, item.quantity);
    }
    return map;
  });

  /**
   * @description
   * Obtiene el catálogo de productos activos desde la API y actualiza los signals
   * `products`, `loading` y `error`. Maneja su propio ciclo de carga/error
   * sin necesidad de que el componente gestione la suscripción.
   */
  loadProducts(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<CatalogProduct[]>(`${this.api}/catalog`).subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo. Intentá de nuevo.');
        this.loading.set(false);
      },
    });
  }

  /**
   * @description
   * Agrega un producto al carrito. Si el producto ya existe, incrementa su cantidad
   * en lugar de duplicar el ítem.
   *
   * La cantidad inicial (y el incremento) es de 100 para productos que se venden
   * por peso, porque ahí la cantidad se mide en gramos: partir de 1g no tiene uso
   * práctico para el cliente, mientras que 100g es un punto de partida razonable
   * que después puede afinar a mano.
   *
   * @param product - Producto del catálogo a agregar al carrito.
   */
  addToCart(product: CatalogProduct): void {
    const step = product.soldByWeight ? 100 : 1;
    this._cart.update((cart) => {
      const existing = cart.find((i) => i.product.id === product.id);
      if (existing) {
        return cart.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + step } : i
        );
      }
      return [...cart, { product, quantity: step }];
    });
  }

  /**
   * @description
   * Modifica la cantidad de un ítem en el carrito aplicando un delta.
   * Si la cantidad resultante llega a cero o menos, el ítem se elimina
   * automáticamente, evitando la necesidad de un método separado de "quitar".
   *
   * @param productId - ID del producto cuya cantidad se quiere ajustar.
   * @param delta - Valor a sumar a la cantidad actual (positivo para aumentar,
   *   negativo para disminuir; ±100 para productos por peso, ±1 para el resto).
   */
  updateQuantity(productId: number, delta: number): void {
    this._cart.update((cart) =>
      cart
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  /**
   * @description
   * Fija la cantidad absoluta de un ítem del carrito, en lugar de aplicar un delta.
   * Se usa desde el input de gramos de `ProductCardComponent`, donde el cliente
   * tipea directamente lo que quiere (ej: "300") en vez de ir tocando +/-.
   *
   * Un valor inválido (`NaN`) o menor a 1 se ignora en lugar de eliminar el ítem:
   * igual que en el POS admin, el cliente puede borrar el campo para reescribirlo
   * sin perder el producto del carrito.
   *
   * @param productId - ID del producto cuya cantidad se quiere fijar.
   * @param quantity - Nueva cantidad absoluta (gramos para productos por peso).
   */
  setQuantity(productId: number, quantity: number): void {
    if (!Number.isFinite(quantity) || quantity < 1) return;
    this._cart.update((cart) =>
      cart.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  }

  /**
   * @description Calcula el importe de un ítem del carrito (ver `catalogItemTotal`).
   * Expuesto como método para que los templates de `CartComponent` y
   * `OrderDialogComponent` lo invoquen directamente sobre cada ítem.
   * @param item Ítem del carrito a calcular.
   * @returns El importe del ítem en pesos.
   */
  itemTotal(item: CartItem): number {
    return catalogItemTotal(item.product, item.quantity);
  }

  /**
   * @description
   * Elimina un ítem del carrito de forma incondicional, independientemente
   * de su cantidad. Para decrementos graduales usar `updateQuantity`.
   *
   * @param productId - ID del producto a eliminar del carrito.
   */
  removeFromCart(productId: number): void {
    this._cart.update((cart) => cart.filter((i) => i.product.id !== productId));
  }

  /**
   * @description
   * Vacía el carrito por completo. Se invoca desde el componente de pedido
   * una vez que `placeOrder()` completa con éxito.
   */
  clearCart(): void {
    this._cart.set([]);
  }

  /**
   * @description
   * Envía el pedido al backend (`POST /api/orders`) y devuelve el Observable
   * resultante sin modificar ningún signal. El componente es responsable de
   * suscribirse, manejar errores y llamar a `clearCart()` si el pedido fue exitoso.
   *
   * @param request - Datos del pedido: información del cliente e ítems seleccionados.
   * @returns Observable que emite la respuesta del servidor con el ID y estado del pedido.
   */
  placeOrder(request: PlaceOrderRequest): Observable<PlaceOrderResponse> {
    return this.http.post<PlaceOrderResponse>(`${this.api}/orders`, request);
  }
}
