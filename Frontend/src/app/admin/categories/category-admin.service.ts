import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { CategoryDto } from '@app/models/product.model';

/**
 * @description
 * Servicio de estado y acceso a datos para el panel de administración de categorías.
 *
 * Implementa el mismo patrón dual que `ProductAdminService`:
 * - **`loadCategories()`**: fire-and-forget — realiza la petición HTTP y muta los signals
 *   internamente. El componente no se suscribe; reacciona a `categories`, `loading` y `error`
 *   directamente desde el template.
 * - **Métodos de mutación** (`createCategory`, `updateCategory`, `deleteCategory`):
 *   devuelven `Observable` sin suscribirse. El componente decide cuándo suscribirse y
 *   qué feedback mostrar al usuario (snackbar, recarga de lista, cierre de dialog, etc.).
 *
 * Las categorías son el clasificador raíz del catálogo; cualquier cambio aquí impacta
 * en la visibilidad de los productos en la tienda pública.
 */
@Injectable({ providedIn: 'root' })
export class CategoryAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /**
   * Lista de categorías cargada desde el backend.
   * Se actualiza al completar `loadCategories()`.
   */
  readonly categories = signal<CategoryDto[]>([]);

  /**
   * Indica si hay una petición de carga en curso.
   * Se usa para mostrar el spinner de carga en el listado.
   */
  readonly loading = signal(false);

  /**
   * Mensaje de error del último `loadCategories()` fallido, o `null` si no hubo errores.
   * Se resetea a `null` al iniciar una nueva llamada a `loadCategories()`.
   */
  readonly error = signal<string | null>(null);

  /**
   * @description
   * Carga la lista completa de categorías desde el backend y actualiza el signal `categories`.
   * Gestiona los signals `loading` y `error` durante el ciclo de vida de la petición.
   */
  loadCategories(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<CategoryDto[]>(`${this.api}/categories`).subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la lista de categorías.');
        this.loading.set(false);
      },
    });
  }

  /**
   * @description
   * Envía una petición para crear una nueva categoría.
   * Devuelve el `Observable` sin suscribirse para que el componente (dialog de formulario)
   * pueda controlar el feedback visual y cerrar el dialog solo al confirmar el éxito.
   *
   * @param body Nombre y estado activo de la categoría a crear.
   * @returns Observable que emite el `CategoryDto` creado con su `id` asignado por el backend.
   */
  createCategory(body: { name: string; isActive: boolean }): Observable<CategoryDto> {
    return this.http.post<CategoryDto>(`${this.api}/categories`, body);
  }

  /**
   * @description
   * Envía una petición para actualizar una categoría existente.
   * El backend responde con 204 No Content, por lo que el Observable emite `void`.
   *
   * @param id Identificador de la categoría a actualizar.
   * @param body Campos de la categoría con los nuevos valores.
   * @returns Observable que completa sin valor al confirmar la actualización.
   */
  updateCategory(id: number, body: { name: string; isActive: boolean }): Observable<void> {
    return this.http.put<void>(`${this.api}/categories/${id}`, body);
  }

  /**
   * @description
   * Envía una petición para eliminar una categoría.
   * El backend puede rechazar la operación con 409 Conflict si la categoría tiene
   * productos asociados; el componente lista maneja ese caso con un mensaje específico.
   *
   * @param id Identificador de la categoría a eliminar.
   * @returns Observable que completa sin valor al confirmar la eliminación.
   */
  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/categories/${id}`);
  }
}
