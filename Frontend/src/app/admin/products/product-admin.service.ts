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

@Injectable({ providedIn: 'root' })
export class ProductAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  readonly products = signal<ProductDto[]>([]);
  readonly categories = signal<CategoryDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

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

  loadCategories(): void {
    this.http.get<CategoryDto[]>(`${this.api}/categories`).subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => this.error.set('No se pudo cargar las categorías.'),
    });
  }

  createProduct(body: CreateProductRequest): Observable<ProductDto> {
    return this.http.post<ProductDto>(`${this.api}/products`, body);
  }

  updateProduct(id: number, body: UpdateProductRequest): Observable<void> {
    return this.http.put<void>(`${this.api}/products/${id}`, body);
  }

  uploadImage(productId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return this.http.post<void>(`${this.api}/products/${productId}/image`, formData);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/products/${id}`);
  }
}
