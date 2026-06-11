import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CategoryAdminService } from '@app/admin/categories/category-admin.service';
import { CategoryDto } from '@app/models/product.model';

/**
 * Datos que el componente padre inyecta al abrir el dialog.
 * Si `category` está presente el dialog opera en modo edición; de lo contrario, en modo creación.
 */
export interface CategoryFormDialogData {
  category?: CategoryDto;
}

/**
 * @description
 * Dialog de formulario compartido para crear y editar categorías.
 *
 * El modo (creación vs edición) se determina en la inicialización a partir de la presencia
 * de `data.category`. En modo edición los campos se precargan con los valores actuales
 * para que el usuario solo modifique lo necesario.
 *
 * El dialog cierra con `true` al guardar exitosamente y con `false` al cancelar,
 * de forma que el componente padre pueda decidir si recargar la lista y mostrar feedback.
 */
@Component({
  selector: 'app-category-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './category-form-dialog.component.html',
  styleUrl: './category-form-dialog.component.scss',
})
export class CategoryFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CategoryAdminService);
  private readonly dialogRef = inject(MatDialogRef<CategoryFormDialogComponent>);

  /** Datos inyectados por el padre; contiene la categoría a editar o está vacío en creación. */
  readonly data = inject<CategoryFormDialogData>(MAT_DIALOG_DATA);

  /** `true` si el dialog fue abierto con una categoría existente; determina la rama de guardado. */
  readonly isEdit = !!this.data.category;

  /** Indica si hay una petición de guardado en curso; bloquea el botón de submit en el template. */
  readonly saving = signal(false);

  /**
   * Mensaje de error de la última operación de guardado fallida, o `null` si no hubo errores.
   * Se resetea a `null` al iniciar un nuevo intento de guardado.
   */
  readonly saveError = signal<string | null>(null);

  /**
   * Formulario reactivo con los campos editables de la categoría.
   * Se usa `nonNullable` para evitar que los controles puedan ser `null` al resetear.
   */
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    isActive: [true],
  });

  /**
   * @description
   * Precarga el formulario con los valores de la categoría existente cuando el dialog
   * opera en modo edición. En modo creación no se hace nada y el formulario usa sus valores por defecto.
   */
  ngOnInit(): void {
    if (this.data.category) {
      this.form.setValue({
        name: this.data.category.name,
        isActive: this.data.category.isActive,
      });
    }
  }

  /**
   * @description
   * Valida el formulario y dispara la petición de creación o actualización según el modo activo.
   * Si la validación falla, marca todos los controles como tocados para que el template
   * muestre los mensajes de error sin necesidad de que el usuario interactúe con cada campo.
   * Al completar exitosamente cierra el dialog con `true` para que el padre recargue la lista.
   */
  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);

    const payload = this.form.getRawValue();

    if (this.isEdit) {
      this.service.updateCategory(this.data.category!.id, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set('Ocurrió un error al guardar. Verificá los datos e intentá de nuevo.');
        },
      });
    } else {
      this.service.createCategory(payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set('Ocurrió un error al guardar. Verificá los datos e intentá de nuevo.');
        },
      });
    }
  }

  /**
   * @description
   * Cierra el dialog con `false` para indicar al padre que no hubo cambios
   * y que no debe recargar la lista ni mostrar snackbar.
   */
  cancel(): void {
    this.dialogRef.close(false);
  }
}
