import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoryAdminService } from '@app/admin/categories/category-admin.service';
import { CategoryFormDialogComponent } from '@app/admin/categories/category-form-dialog/category-form-dialog.component';
import { CategoryDeleteDialogComponent } from '@app/admin/categories/category-delete-dialog/category-delete-dialog.component';
import { CategoryDto } from '@app/models/product.model';

@Component({
  selector: 'app-category-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.scss',
})
export class CategoryListComponent implements OnInit {
  private readonly service = inject(CategoryAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly searchControl = new FormControl('');
  readonly searchTerm = signal('');

  readonly displayedColumns = ['name', 'status', 'registrationDate', 'actions'];

  readonly loading = this.service.loading;
  readonly error = this.service.error;

  readonly filteredCategories = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.service.categories();
    return this.service.categories().filter((c) =>
      c.name.toLowerCase().includes(term)
    );
  });

  ngOnInit(): void {
    this.service.loadCategories();
    this.searchControl.valueChanges.subscribe((val) =>
      this.searchTerm.set(val ?? '')
    );
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(CategoryFormDialogComponent, {
      width: '480px',
      data: {},
    });
    ref.afterClosed().subscribe((created) => {
      if (created) {
        this.service.loadCategories();
        this.snackBar.open('Categoría creada correctamente.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  openEditDialog(category: CategoryDto): void {
    const ref = this.dialog.open(CategoryFormDialogComponent, {
      width: '480px',
      data: { category },
    });
    ref.afterClosed().subscribe((updated) => {
      if (updated) {
        this.service.loadCategories();
        this.snackBar.open('Categoría actualizada.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  openDeleteDialog(category: CategoryDto): void {
    const ref = this.dialog.open(CategoryDeleteDialogComponent, {
      width: '400px',
      data: { category },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.service.deleteCategory(category.id).subscribe({
          next: () => {
            this.service.loadCategories();
            this.snackBar.open('Categoría eliminada.', 'Cerrar', { duration: 3000 });
          },
          error: (err) => {
            const msg =
              err.status === 409
                ? 'No se puede eliminar: la categoría tiene productos asociados.'
                : 'Error al eliminar la categoría.';
            this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
          },
        });
      }
    });
  }
}
