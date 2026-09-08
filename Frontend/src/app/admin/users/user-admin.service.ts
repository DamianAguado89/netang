import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { UpdateUserRoleRequest, UserDto } from '@app/models/user.model';

/**
 * @description
 * Servicio de estado y acceso a datos para el panel de administración de usuarios
 * (`/admin/users`), exclusivo del super admin — el backend rechaza estas rutas con
 * 403 para cualquier otro rol (`SuperAdminPolicy`).
 *
 * Mismo patrón dual que el resto de los servicios admin (`CategoryAdminService`,
 * `ProductAdminService`): `loadUsers()` es fire-and-forget y muta los signals
 * internamente; `updateRole()` devuelve el `Observable` sin suscribirse para que
 * el componente decida el feedback (snackbar) y actualice la fila localmente.
 */
@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Lista de cuentas registradas cargada desde el backend. */
  readonly users = signal<UserDto[]>([]);

  /** Indica si hay una petición de carga en curso. */
  readonly loading = signal(false);

  /** Mensaje de error del último `loadUsers()` fallido, o `null` si no hubo errores. */
  readonly error = signal<string | null>(null);

  /**
   * @description
   * Carga la lista completa de cuentas registradas (con su rol actual) desde el
   * backend y actualiza el signal `users`.
   */
  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<UserDto[]>(`${this.api}/users`).subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la lista de usuarios.');
        this.loading.set(false);
      },
    });
  }

  /**
   * @description
   * Envía una petición para otorgar o revocar el rol Admin de una cuenta.
   * El backend rechaza el cambio (400) si el destino es el propio super admin
   * o si `role` no es "Admin" ni "Customer" — el componente traduce ese error
   * a un mensaje legible en el snackbar.
   *
   * @param id Identificador (`AspNetUsers.Id`) de la cuenta a modificar.
   * @param body Nuevo rol a asignar.
   * @returns Observable que emite el `UserDto` con el rol ya actualizado.
   */
  updateRole(id: string, body: UpdateUserRoleRequest): Observable<UserDto> {
    return this.http.put<UserDto>(`${this.api}/users/${id}/role`, body);
  }
}
