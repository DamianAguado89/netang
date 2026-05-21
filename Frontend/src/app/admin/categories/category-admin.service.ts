import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { CategoryDto } from '@app/models/product.model';

@Injectable({ providedIn: 'root' })
export class CategoryAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  readonly categories = signal<CategoryDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

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

  createCategory(body: { name: string; isActive: boolean }): Observable<CategoryDto> {
    return this.http.post<CategoryDto>(`${this.api}/categories`, body);
  }

  updateCategory(id: number, body: { name: string; isActive: boolean }): Observable<void> {
    return this.http.put<void>(`${this.api}/categories/${id}`, body);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/categories/${id}`);
  }
}
