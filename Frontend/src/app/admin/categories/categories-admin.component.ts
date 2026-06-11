import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { CategoryListComponent } from '@app/admin/categories/category-list/category-list.component';

/**
 * @description
 * Componente shell de la sección de administración de categorías.
 * Actúa como punto de entrada de la ruta `/admin/categories` y delega
 * toda la lógica y presentación al componente hijo `CategoryListComponent`.
 */
@Component({
  selector: 'app-categories-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink, CategoryListComponent],
  templateUrl: './categories-admin.component.html',
  styleUrl: './categories-admin.component.scss',
})
export class CategoriesAdminComponent {}
