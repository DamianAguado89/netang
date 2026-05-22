import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { SaleDto } from '@app/models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  private readonly _orders = signal<SaleDto[]>([]);
  readonly orders = this._orders.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

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

  getOrder(id: number): Observable<SaleDto> {
    return this.http.get<SaleDto>(`${this.api}/sales/${id}`);
  }
}
