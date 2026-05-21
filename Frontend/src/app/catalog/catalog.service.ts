import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  CartItem,
  CatalogProduct,
  PlaceOrderRequest,
  PlaceOrderResponse,
} from '@app/models/catalog.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  readonly products = signal<CatalogProduct[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly _cart = signal<CartItem[]>([]);
  readonly cart = this._cart.asReadonly();

  readonly cartCount = computed(() =>
    this._cart().reduce((sum, item) => sum + item.quantity, 0)
  );

  readonly cartTotal = computed(() =>
    this._cart().reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  );

  readonly cartQuantities = computed<Map<number, number>>(() => {
    const map = new Map<number, number>();
    for (const item of this._cart()) {
      map.set(item.product.id, item.quantity);
    }
    return map;
  });

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

  addToCart(product: CatalogProduct): void {
    this._cart.update((cart) => {
      const existing = cart.find((i) => i.product.id === product.id);
      if (existing) {
        return cart.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...cart, { product, quantity: 1 }];
    });
  }

  updateQuantity(productId: number, delta: number): void {
    this._cart.update((cart) =>
      cart
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  removeFromCart(productId: number): void {
    this._cart.update((cart) => cart.filter((i) => i.product.id !== productId));
  }

  clearCart(): void {
    this._cart.set([]);
  }

  placeOrder(request: PlaceOrderRequest): Observable<PlaceOrderResponse> {
    return this.http.post<PlaceOrderResponse>(`${this.api}/orders`, request);
  }
}
