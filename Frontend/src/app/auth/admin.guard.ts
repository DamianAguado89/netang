import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * @description Guard funcional que protege las rutas de administración.
 * Permite el acceso solo si el usuario está autenticado y tiene rol Admin.
 * En caso contrario redirige al login.
 */
export const adminGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.isAdmin()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
