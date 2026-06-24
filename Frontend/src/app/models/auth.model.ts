/**
 * @description Modelos de datos para el módulo de autenticación.
 * Representan las estructuras de request y response del backend de auth.
 */

/** Datos necesarios para iniciar sesión con email y contraseña. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Datos necesarios para registrar un nuevo usuario. */
export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

/** Datos necesarios para iniciar sesión con Google mediante el token GIS. */
export interface GoogleLoginRequest {
  credential: string;
}

/** Respuesta del backend al autenticar exitosamente. */
export interface AuthResponse {
  token: string;
  email: string;
  fullName: string;
  role: string;
}

/** Representación del usuario autenticado en el estado del cliente. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

/** Datos del perfil del cliente asociado al usuario autenticado. */
export interface ProfileData {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  imageUrl: string | null;
}

/** Payload para actualizar los datos editables del perfil. */
export interface UpdateProfileRequest {
  name: string;
  phone: string | null;
  address: string | null;
}
