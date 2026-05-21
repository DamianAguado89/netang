import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
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
import { ProductAdminService } from '@app/admin/products/product-admin.service';
import { ProductFormDialogComponent } from '@app/admin/products/product-form-dialog/product-form-dialog.component';
import { ProductDeleteDialogComponent } from '@app/admin/products/product-delete-dialog/product-delete-dialog.component';
import { ProductDto } from '@app/models/product.model';
import { environment } from '@env/environment';

@Component({
  selector: 'app-product-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
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
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent implements OnInit {
  private readonly service = inject(ProductAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly apiBase = environment.apiUrl.replace('/api', '');

  readonly searchControl = new FormControl('');
  readonly searchTerm = signal('');

  readonly displayedColumns = ['image', 'name', 'category', 'price', 'stock', 'status', 'actions'];

  readonly loading = this.service.loading;
  readonly error = this.service.error;

  readonly filteredProducts = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.service.products();
    return this.service.products().filter((p) =>
      p.name.toLowerCase().includes(term)
    );
  });

  ngOnInit(): void {
    this.service.loadProducts();
    this.service.loadCategories();

    this.searchControl.valueChanges.subscribe((val) =>
      this.searchTerm.set(val ?? '')
    );
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(ProductFormDialogComponent, {
      width: '560px',
      data: {},
    });
    ref.afterClosed().subscribe((created) => {
      if (created) {
        this.service.loadProducts();
        this.snackBar.open('Producto creado correctamente.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  openEditDialog(product: ProductDto): void {
    const ref = this.dialog.open(ProductFormDialogComponent, {
      width: '560px',
      data: { product },
    });
    ref.afterClosed().subscribe((updated) => {
      if (updated) {
        this.service.loadProducts();
        this.snackBar.open('Producto actualizado.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  openDeleteDialog(product: ProductDto): void {
    const ref = this.dialog.open(ProductDeleteDialogComponent, {
      width: '400px',
      data: { product },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.service.deleteProduct(product.id).subscribe({
          next: () => {
            this.service.loadProducts();
            this.snackBar.open('Producto eliminado.', 'Cerrar', { duration: 3000 });
          },
          error: (err) => {
            const msg =
              err.status === 409
                ? 'No se puede eliminar: el producto tiene ventas asociadas.'
                : 'Error al eliminar el producto.';
            this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
          },
        });
      }
    });
  }
}
