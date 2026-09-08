import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { CreateCustomerRequest, CustomerDto } from '@app/models/customer.model';

/**
 * @description
 * Servicio de estado y acceso a datos de clientes para el panel de administración.
 *
 * Sigue el mismo patrón dual que `ProductAdminService`:
 * - **`loadCustomers()`**: fire-and-forget — se suscribe internamente y muta los signals
 *   `customers`, `loading` y `error`. El componente solo reacciona a esos signals.
 * - **`createCustomer()`**: devuelve el `Observable` sin suscribirse, para que el componente
 *   que lo invoca decida qué hacer con el `CustomerDto` creado (por ejemplo, seleccionarlo
 *   inmediatamente en la pantalla de facturación).
 *
 * Solo expone lectura y alta: la edición y baja de clientes se gestionan fuera de este flujo.
 */
@Injectable({ providedIn: 'root' })
export class CustomerAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /**
   * Lista de clientes cargada desde el backend.
   * Es un signal público y mutable porque solo lo consumen componentes del panel admin,
   * igual que en `ProductAdminService`.
   */
  readonly customers = signal<CustomerDto[]>([]);

  /** Indica si hay una petición de carga de clientes en curso. */
  readonly loading = signal(false);

  /** Mensaje de error del último `loadCustomers()` fallido, o `null` si no hubo errores. */
  readonly error = signal<string | null>(null);

  /**
   * @description
   * Carga la lista completa de clientes y actualiza el signal `customers`.
   * Gestiona `loading` y `error` durante todo el ciclo de vida de la petición.
   */
  loadCustomers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<CustomerDto[]>(`${this.api}/customers`).subscribe({
      next: (customers) => {
        this.customers.set(customers);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la lista de clientes.');
        this.loading.set(false);
      },
    });
  }

  /**
   * @description
   * Envía una petición para dar de alta un nuevo cliente.
   * Devuelve el `Observable` sin suscribirse porque el consumidor necesita el
   * `CustomerDto` resultante (con su `id` asignado por el backend) para seleccionarlo
   * sin tener que volver a buscarlo en la lista.
   *
   * @param body Datos del cliente a crear.
   * @returns Observable que emite el `CustomerDto` creado.
   */
  createCustomer(body: CreateCustomerRequest): Observable<CustomerDto> {
    return this.http.post<CustomerDto>(`${this.api}/customers`, body);
  }
}
