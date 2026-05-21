import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { CategoryListComponent } from '@app/admin/categories/category-list/category-list.component';

@Component({
  selector: 'app-categories-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink, CategoryListComponent],
  templateUrl: './categories-admin.component.html',
  styleUrl: './categories-admin.component.scss',
})
export class CategoriesAdminComponent {}
