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

/**
 * @description
 * Componente inteligente (smart component) de la sección de administración de productos.
 * Centraliza toda la lógica de la pantalla: tabla con paginación, búsqueda en tiempo real
 * y coordinación de los dialogs de creación, edición y eliminación.
 *
 * Es hijo directo de `ProductsAdminComponent`, que actúa como shell de la sección.
 * No expone ningún `input()` ni `output()` porque toda la comunicación ocurre a través
 * de `ProductAdminService` y los dialogs de Angular Material.
 */
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

  /**
   * URL base del servidor sin el segmento `/api`, utilizada para construir
   * las URLs absolutas de las imágenes de productos que se sirven desde la raíz del servidor.
   */
  readonly apiBase = environment.apiUrl.replace('/api', '');

  /**
   * Control reactivo vinculado al campo de texto de búsqueda en el template.
   * Sus emisiones se puenean hacia `searchTerm` (un Signal) mediante `valueChanges.subscribe()`
   * porque `computed()` solo puede depender de Signals, no de Observables.
   */
  readonly searchControl = new FormControl('');

  /**
   * Signal que almacena el término de búsqueda activo.
   * Se actualiza desde `valueChanges` de `searchControl` para que `filteredProducts`
   * pueda reaccionar reactivamente al cambio sin depender del Observable directamente.
   */
  readonly searchTerm = signal('');

  /**
   * Lista estática de identificadores de columna para el `MatTable`.
   * No es un Signal porque el conjunto de columnas nunca varía en tiempo de ejecución.
   */
  readonly displayedColumns = ['image', 'name', 'category', 'price', 'stock', 'status', 'actions'];

  /**
   * Alias local al Signal de carga del servicio.
   * Evita exponer el servicio completo en el template y simplifica el binding.
   */
  readonly loading = this.service.loading;

  /**
   * Alias local al Signal de error del servicio.
   * Permite mostrar mensajes de error en el template sin acceder al servicio directamente.
   */
  readonly error = this.service.error;

  /**
   * Signal computado que filtra en memoria los productos ya cargados según `searchTerm`.
   * La búsqueda es local: no realiza llamadas HTTP adicionales.
   * Devuelve la lista completa cuando el término está vacío.
   */
  readonly filteredProducts = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.service.products();
    return this.service.products().filter((p) =>
      p.name.toLowerCase().includes(term)
    );
  });

  /**
   * @description
   * Carga inicial de productos y categorías al montar el componente,
   * y establece el puente Observable→Signal para el campo de búsqueda.
   */
  ngOnInit(): void {
    this.service.loadProducts();
    this.service.loadCategories();

    this.searchControl.valueChanges.subscribe((val) =>
      this.searchTerm.set(val ?? '')
    );
  }

  /**
   * @description
   * Abre el dialog de creación de producto pasando `data: {}` (vacío) para indicarle
   * al `ProductFormDialogComponent` que opera en modo creación.
   * Si el dialog se cierra con un resultado truthy, recarga la lista y confirma con snackbar.
   */
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

  /**
   * @description
   * Abre el dialog de edición pasando el producto seleccionado en `data: { product }`.
   * El `ProductFormDialogComponent` detecta el modo edición por la presencia de `product` en `data`.
   * Si el dialog se cierra con un resultado truthy, recarga la lista y confirma con snackbar.
   *
   * @param product Producto a editar, provisto por la fila de la tabla.
   */
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

  /**
   * @description
   * Abre el dialog de confirmación de eliminación. Si el usuario confirma, llama al servicio
   * para eliminar el producto y recarga la lista.
   *
   * Maneja específicamente el error HTTP 409 (Conflict), que el backend devuelve cuando
   * el producto no puede eliminarse por tener ventas asociadas, mostrando un mensaje
   * diferenciado al error genérico.
   *
   * @param product Producto a eliminar, provisto por la fila de la tabla.
   */
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
