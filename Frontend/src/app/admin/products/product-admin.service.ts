import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  CategoryDto,
  CreateProductRequest,
  ProductDto,
  UpdateProductRequest,
} from '@app/models/product.model';

/**
 * @description
 * Servicio de estado y acceso a datos para el panel de administración de productos.
 *
 * Implementa un patrón dual de operaciones:
 * - **Métodos `load*()`**: fire-and-forget — realizan la petición HTTP y mutan los signals
 *   internamente. El componente no se suscribe; simplemente llama al método y reacciona
 *   a los signals `products`, `loading` y `error` a través del template.
 * - **Métodos de mutación** (`createProduct`, `updateProduct`, `deleteProduct`, `uploadImage`):
 *   devuelven `Observable` sin suscribirse. El componente decide cuándo suscribirse,
 *   qué encadenar con `switchMap` (por ejemplo, crear producto y luego subir imagen) y
 *   qué feedback mostrar al usuario (snackbar, recarga de lista, etc.).
 *
 * Los signals `products` y `categories` son públicos y mutables porque solo el componente
 * admin accede a ellos y no existe riesgo de mutación externa no deseada en este contexto.
 */
@Injectable({ providedIn: 'root' })
export class ProductAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /**
   * Lista de productos cargada desde el backend.
   * Se actualiza al completar `loadProducts()`.
   */
  readonly products = signal<ProductDto[]>([]);

  /**
   * Lista de categorías disponibles para el selector del formulario de producto.
   * Se actualiza al completar `loadCategories()`.
   */
  readonly categories = signal<CategoryDto[]>([]);

  /**
   * Indica si hay una petición de carga de productos en curso.
   * Solo refleja el estado de `loadProducts()`; las categorías son un dato auxiliar
   * y no requieren indicador de carga propio.
   */
  readonly loading = signal(false);

  /**
   * Mensaje de error del último `load*()` fallido, o `null` si no hubo errores.
   * Se resetea a `null` al iniciar una nueva llamada a `loadProducts()`.
   */
  readonly error = signal<string | null>(null);

  /**
   * @description
   * Carga la lista completa de productos desde el backend y actualiza el signal `products`.
   * Gestiona los signals `loading` y `error` durante el ciclo de vida de la petición.
   */
  loadProducts(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<ProductDto[]>(`${this.api}/products`).subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la lista de productos.');
        this.loading.set(false);
      },
    });
  }

  /**
   * @description
   * Carga las categorías disponibles y actualiza el signal `categories`.
   * No gestiona `loading` porque las categorías son un dato auxiliar usado únicamente
   * en el select del formulario de producto; su carga no bloquea la UI principal.
   */
  loadCategories(): void {
    this.http.get<CategoryDto[]>(`${this.api}/categories`).subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => this.error.set('No se pudo cargar las categorías.'),
    });
  }

  /**
   * @description
   * Envía una petición para crear un nuevo producto.
   * Devuelve el `Observable` sin suscribirse para que el componente pueda encadenar
   * la subida de imagen con `switchMap` usando el `id` del producto recién creado.
   *
   * @param body Datos del producto a crear.
   * @returns Observable que emite el `ProductDto` creado con su `id` asignado por el backend.
   */
  createProduct(body: CreateProductRequest): Observable<ProductDto> {
    return this.http.post<ProductDto>(`${this.api}/products`, body);
  }

  /**
   * @description
   * Envía una petición para actualizar un producto existente.
   * El backend responde con 204 No Content, por lo que el Observable emite `void`.
   *
   * @param id Identificador del producto a actualizar.
   * @param body Campos del producto con los nuevos valores.
   * @returns Observable que completa sin valor al confirmar la actualización.
   */
  updateProduct(id: number, body: UpdateProductRequest): Observable<void> {
    return this.http.put<void>(`${this.api}/products/${id}`, body);
  }

  /**
   * @description
   * Sube una imagen para un producto existente usando `multipart/form-data`.
   * Se envía como `FormData` porque el backend expone un endpoint con `IFormFile` en .NET;
   * encodificar la imagen en base64 dentro de JSON sería ineficiente para archivos grandes.
   *
   * Esta operación es el segundo paso del flujo de creación de producto:
   * primero se llama a `createProduct` para obtener el `id`, y luego se llama a `uploadImage`
   * con ese `id`. El componente encadena ambas llamadas con `switchMap`.
   *
   * @param productId Identificador del producto al que pertenece la imagen.
   * @param file Archivo de imagen seleccionado por el usuario.
   * @returns Observable que completa sin valor al confirmar la subida.
   */
  uploadImage(productId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return this.http.post<void>(`${this.api}/products/${productId}/image`, formData);
  }

  /**
   * @description
   * Envía una petición para eliminar un producto.
   * El componente decide si recargar la lista llamando a `loadProducts()` tras completar.
   *
   * @param id Identificador del producto a eliminar.
   * @returns Observable que completa sin valor al confirmar la eliminación.
   */
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/products/${id}`);
  }
}
