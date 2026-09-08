import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * @description Guard funcional que protege las rutas exclusivas del super admin
 * (por ahora, `/admin/users`). Permite el acceso solo si el usuario está
 * autenticado y tiene rol SuperAdmin — un Admin normal no pasa este guard,
 * aunque sí pasa `adminGuard`. En caso contrario redirige al login.
 */
export const superAdminGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.isSuperAdmin()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
