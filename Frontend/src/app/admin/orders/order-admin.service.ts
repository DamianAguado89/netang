import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { SaleDto } from '@app/models/order.model';

/**
 * @description
 * Servicio de estado y acceso a datos para el panel de administración de pedidos.
 *
 * Implementa el mismo patrón dual que `CategoryAdminService`:
 * - **`loadOrders()`**: fire-and-forget — realiza la petición HTTP y muta los signals
 *   internamente. El componente no se suscribe; reacciona a `orders`, `loading` y `error`
 *   directamente desde el template.
 * - **Métodos de consulta y mutación** (`getOrder`, `confirmOrder`): devuelven `Observable`
 *   sin suscribirse. El componente decide cuándo suscribirse y qué feedback mostrar
 *   al usuario (spinner local, mensaje de error, redirección, etc.).
 */
@Injectable({ providedIn: 'root' })
export class OrderAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /**
   * Signal mutable interno: solo el servicio puede escribir en él.
   * Se expone al exterior únicamente a través de `orders` (readonly) para evitar
   * que cualquier consumidor externo altere la lista sin pasar por la capa HTTP.
   */
  private readonly _orders = signal<SaleDto[]>([]);
  /** Lista de pedidos cargada desde el backend. Solo se actualiza a través de `loadOrders()`. */
  readonly orders = this._orders.asReadonly();
  /** Indica si hay una petición de carga en curso. Se usa para mostrar el spinner en el listado. */
  readonly loading = signal(false);
  /** Mensaje de error del último `loadOrders()` fallido, o `null` si no hubo errores. */
  readonly error = signal<string | null>(null);

  /**
   * @description
   * Carga la lista completa de pedidos y actualiza el signal `orders`.
   * Es fire-and-forget: se suscribe internamente y muta los signals de estado.
   * El componente no necesita suscribirse; reacciona a los signals desde el template.
   */
  loadOrders(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<SaleDto[]>(`${this.api}/sales`).subscribe({
      next: (orders) => {
        this._orders.set(orders);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la lista de pedidos.');
        this.loading.set(false);
      },
    });
  }

  /**
   * @description
   * Devuelve el detalle completo de un pedido sin suscribirse.
   * El componente que lo invoca controla el ciclo de vida de la suscripción
   * y decide cómo presentar el resultado (dialog de detalle, spinner local, etc.).
   * @param id Identificador del pedido a consultar.
   * @returns Observable que emite el `SaleDto` con todos sus ítems y datos del cliente.
   */
  getOrder(id: number): Observable<SaleDto> {
    return this.http.get<SaleDto>(`${this.api}/sales/${id}`);
  }

  /**
   * @description
   * Envía la confirmación de un pedido al backend.
   * El body vacío `{}` es intencional: el backend solo necesita el `id` en la ruta
   * para realizar la transición de estado; no requiere payload adicional.
   * Devuelve el Observable sin suscribirse para que el componente gestione
   * el feedback (snackbar de éxito/error, recarga de lista, etc.).
   * @param id Identificador del pedido a confirmar.
   * @returns Observable que completa sin valor al confirmar exitosamente.
   */
  confirmOrder(id: number): Observable<void> {
    return this.http.post<void>(`${this.api}/sales/${id}/confirm`, {});
  }
}
