import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

import {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from '@app/models/auth.model';
import { environment } from '@env/environment';

/** Clave usada en localStorage para persistir el JWT. */
const TOKEN_KEY = 'auth_token';

/** Claim de ASP.NET Core Identity para el rol del usuario. */
const ROLE_CLAIM =
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

/**
 * @description Servicio singleton de autenticación.
 * Gestiona el estado del usuario autenticado mediante signals,
 * persiste el JWT en localStorage y expone métodos para
 * login, registro, login con Google y logout.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = environment.apiUrl;

  private readonly _currentUser = signal<AuthUser | null>(null);

  /** Usuario autenticado actualmente. Null si no hay sesión activa. */
  readonly currentUser = this._currentUser.asReadonly();

  /** Indica si hay un usuario con sesión iniciada. */
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  /** Indica si el usuario autenticado tiene rol de administrador. */
  readonly isAdmin = computed(() => this._currentUser()?.role === 'Admin');

  constructor() {
    this.loadUserFromStorage();
  }

  /**
   * @description Inicia sesión con email y contraseña.
   * Persiste el token JWT en localStorage y actualiza el estado del usuario.
   * @param req Credenciales del usuario.
   * @returns Observable con la respuesta de autenticación del backend.
   */
  login(req: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.api}/auth/login`, req)
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  /**
   * @description Registra un nuevo usuario.
   * Persiste el token JWT en localStorage y actualiza el estado del usuario.
   * @param req Datos del nuevo usuario.
   * @returns Observable con la respuesta de autenticación del backend.
   */
  register(req: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.api}/auth/register`, req)
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  /**
   * @description Inicia sesión con una credencial de Google (GIS).
   * Persiste el token JWT en localStorage y actualiza el estado del usuario.
   * @param credential Token de credencial emitido por Google Identity Services.
   * @returns Observable con la respuesta de autenticación del backend.
   */
  loginWithGoogle(credential: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.api}/auth/google`, { credential })
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  /**
   * @description Cierra la sesión del usuario actual.
   * Elimina el token de localStorage, limpia el estado y redirige al login.
   */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }

  /**
   * @description Devuelve el JWT almacenado en localStorage, o null si no existe.
   * @returns El token JWT o null.
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * @description Persiste el token y actualiza el estado del usuario tras una
   * autenticación exitosa.
   * @param res Respuesta del backend con token y datos del usuario.
   */
  private handleAuthResponse(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    this.decodeAndSetUser(res.token);
  }

  /**
   * @description Decodifica el payload del JWT (sin librería externa) y actualiza
   * el signal `_currentUser` con los claims extraídos.
   * Se usa atob() sobre la segunda parte del token (payload en base64url).
   * @param token JWT recibido del backend.
   */
  private decodeAndSetUser(token: string): void {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return;

      // El payload está en base64url — reemplazamos caracteres no estándar para atob
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('')
      );

      const payload = JSON.parse(jsonPayload) as Record<string, unknown>;

      const user: AuthUser = {
        id: (payload['sub'] as string) ?? '',
        email: (payload['email'] as string) ?? '',
        fullName: (payload['fullName'] as string) ?? '',
        role: (payload[ROLE_CLAIM] as string) ?? '',
      };

      this._currentUser.set(user);
    } catch {
      // Si el token está malformado no actualizamos el estado
    }
  }

  /**
   * @description Intenta restaurar la sesión desde el token persistido en
   * localStorage al iniciar la aplicación. Si el token expiró, lo elimina.
   */
  private loadUserFromStorage(): void {
    const token = this.getToken();
    if (!token) return;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        localStorage.removeItem(TOKEN_KEY);
        return;
      }

      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64)) as Record<string, unknown>;
      const exp = payload['exp'] as number | undefined;

      // exp está en segundos Unix; Date.now() en milisegundos
      if (exp !== undefined && exp * 1000 < Date.now()) {
        localStorage.removeItem(TOKEN_KEY);
        return;
      }

      this.decodeAndSetUser(token);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}
