import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./catalog/catalog.component').then((m) => m.CatalogComponent),
  },
  {
    path: 'admin/products',
    loadComponent: () =>
      import('./admin/products/products-admin.component').then(
        (m) => m.ProductsAdminComponent
      ),
  },
  {
    path: 'admin/categories',
    loadComponent: () =>
      import('./admin/categories/categories-admin.component').then(
        (m) => m.CategoriesAdminComponent
      ),
  },
  {
    path: 'admin/orders',
    loadComponent: () =>
      import('./admin/orders/orders-admin.component').then(
        (m) => m.OrdersAdminComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
