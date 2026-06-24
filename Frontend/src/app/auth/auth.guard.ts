import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * @description Guard funcional que protege rutas que requieren sesión iniciada.
 * Permite el acceso a cualquier usuario autenticado, independientemente del rol.
 * En caso contrario redirige al login.
 */
export const authGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
