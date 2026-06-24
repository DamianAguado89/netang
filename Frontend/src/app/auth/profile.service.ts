import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { ProfileData, UpdateProfileRequest } from '@app/models/auth.model';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

/**
 * @description Servicio singleton para gestionar el perfil del usuario autenticado.
 *
 * Carga automáticamente el perfil cuando el usuario inicia sesión,
 * y lo limpia cuando cierra sesión, mediante un `effect` que observa
 * `AuthService.isLoggedIn()`. Esto evita la dependencia circular que
 * surgiría si `AuthService` inyectara a `ProfileService`.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly api = environment.apiUrl;

  private readonly _profile = signal<ProfileData | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  /** Perfil del usuario autenticado. Null si no hay sesión o aún no se cargó. */
  readonly profile = this._profile.asReadonly();

  /** Indica si hay una petición de perfil en curso. */
  readonly loading = this._loading.asReadonly();

  /** Mensaje de error de la última operación fallida, o null. */
  readonly error = this._error.asReadonly();

  /**
   * URL base de la aplicación (sin el sufijo `/api`) derivada desde `environment`.
   * Se usa para construir la URL absoluta de la imagen del avatar.
   */
  readonly baseUrl = computed(() => this.api.replace('/api', ''));

  constructor() {
    // Reacciona al cambio de sesión sin acoplar AuthService a ProfileService
    effect(() => {
      if (this.authService.isLoggedIn()) {
        this.loadProfile();
      } else {
        this._profile.set(null);
        this._error.set(null);
      }
    });
  }

  /**
   * @description Carga el perfil del usuario autenticado desde `/api/profile`.
   * Actualiza los signals `profile`, `loading` y `error`.
   */
  loadProfile(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http.get<ProfileData>(`${this.api}/profile`).subscribe({
      next: (data) => {
        this._profile.set(data);
        this._loading.set(false);
      },
      error: () => {
        this._error.set('No se pudo cargar el perfil.');
        this._loading.set(false);
      },
    });
  }

  /**
   * @description Actualiza los datos editables del perfil (nombre, teléfono, dirección).
   * @param req Datos a actualizar.
   * @returns Observable con el perfil actualizado devuelto por el backend.
   */
  updateProfile(req: UpdateProfileRequest): Observable<ProfileData> {
    return this.http.put<ProfileData>(`${this.api}/profile`, req).pipe(
      tap((updated) => this._profile.set(updated))
    );
  }

  /**
   * @description Sube una nueva imagen de avatar para el usuario autenticado.
   * Recarga el perfil tras una subida exitosa para reflejar la nueva URL de imagen.
   * @param file Archivo de imagen seleccionado por el usuario.
   * @returns Observable vacío que completa cuando el servidor confirma la subida.
   */
  uploadAvatar(file: File): Observable<void> {
    const form = new FormData();
    form.append('image', file);

    return this.http.post<void>(`${this.api}/profile/image`, form).pipe(
      tap(() => this.loadProfile())
    );
  }
}
