import { Routes } from '@angular/router';

import { authGuard } from './auth/auth.guard';
import { adminGuard } from './auth/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./catalog/catalog.component').then((m) => m.CatalogComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./auth/register/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./auth/profile/profile.component').then(
        (m) => m.ProfileComponent
      ),
  },
  {
    path: 'admin/products',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin/products/products-admin.component').then(
        (m) => m.ProductsAdminComponent
      ),
  },
  {
    path: 'admin/categories',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin/categories/categories-admin.component').then(
        (m) => m.CategoriesAdminComponent
      ),
  },
  {
    path: 'admin/orders',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin/orders/orders-admin.component').then(
        (m) => m.OrdersAdminComponent
      ),
  },
  {
    path: 'admin/billing/:id',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin/billing/billing.component').then(
        (m) => m.BillingComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
