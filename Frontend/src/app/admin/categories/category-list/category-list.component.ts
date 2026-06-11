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

/**
 * @description
 * Componente de listado y gestión de categorías para el panel de administración.
 *
 * Responsabilidades:
 * - Mostrar la tabla de categorías con búsqueda en tiempo real (filtrado del lado cliente).
 * - Abrir los dialogs de creación, edición y confirmación de eliminación.
 * - Recargar la lista y mostrar feedback (snackbar) tras cada operación exitosa.
 *
 * El filtrado se realiza en el cliente sobre los datos ya cargados en el signal del servicio,
 * evitando peticiones HTTP por cada keystroke dado el volumen reducido de categorías esperado.
 */
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

  /** Control reactivo del campo de búsqueda; su valor se sincroniza con `searchTerm`. */
  readonly searchControl = new FormControl('');

  /**
   * Término de búsqueda activo, actualizado desde `searchControl.valueChanges`.
   * Se usa como señal de entrada para el computed `filteredCategories`.
   */
  readonly searchTerm = signal('');

  /** Columnas que renderiza `mat-table`; el orden refleja la disposición visual en el template. */
  readonly displayedColumns = ['name', 'status', 'registrationDate', 'actions'];

  /** Alias del signal del servicio para exponerlo directamente al template sin intermediario. */
  readonly loading = this.service.loading;

  /** Alias del signal del servicio; el template muestra el mensaje de error si no es `null`. */
  readonly error = this.service.error;

  /**
   * Lista de categorías filtradas por el término de búsqueda actual.
   * Se recalcula automáticamente cada vez que cambia `searchTerm` o `service.categories`.
   */
  readonly filteredCategories = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.service.categories();
    return this.service.categories().filter((c) =>
      c.name.toLowerCase().includes(term)
    );
  });

  /**
   * @description
   * Carga el listado inicial de categorías y conecta el control de búsqueda al signal
   * `searchTerm` para que el computed `filteredCategories` reaccione a cada cambio.
   */
  ngOnInit(): void {
    this.service.loadCategories();
    this.searchControl.valueChanges.subscribe((val) =>
      this.searchTerm.set(val ?? '')
    );
  }

  /**
   * @description
   * Abre el dialog de formulario en modo creación (sin datos previos).
   * Recarga la lista y muestra un snackbar solo si el dialog se cierra con `true`,
   * lo que indica que el guardado fue exitoso.
   */
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

  /**
   * @description
   * Abre el dialog de formulario en modo edición, pasando la categoría seleccionada
   * como dato inicial del formulario.
   * Recarga la lista y muestra un snackbar solo si el dialog se cierra con `true`.
   *
   * @param category Categoría a editar, inyectada como dato en el dialog.
   */
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

  /**
   * @description
   * Abre el dialog de confirmación de eliminación.
   * Solo si el usuario confirma (`true`), se llama al servicio para eliminar la categoría.
   * El error 409 Conflict se trata de forma especial: indica que la categoría tiene
   * productos asociados y no puede eliminarse, por lo que se muestra un mensaje descriptivo
   * en lugar del genérico.
   *
   * @param category Categoría cuya eliminación se quiere confirmar.
   */
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
