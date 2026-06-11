import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CategoryDto } from '@app/models/product.model';

/**
 * Datos que el componente padre inyecta al abrir el dialog.
 * Contiene la categoría cuya eliminación se quiere confirmar.
 */
export interface CategoryDeleteDialogData {
  category: CategoryDto;
}

/**
 * @description
 * Dialog de confirmación de eliminación de categoría.
 *
 * Es un componente de presentación puro: no llama al servicio por sí mismo.
 * Cierra el dialog con un booleano que el padre interpreta para decidir si
 * ejecutar la eliminación (`true`) o descartarla (`false`).
 * De esta forma el componente padre mantiene el control del flujo HTTP y
 * del feedback al usuario.
 */
@Component({
  selector: 'app-category-delete-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './category-delete-dialog.component.html',
})
export class CategoryDeleteDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CategoryDeleteDialogComponent>);

  /** Datos inyectados por el padre; expone la categoría para mostrar su nombre en el template. */
  readonly data = inject<CategoryDeleteDialogData>(MAT_DIALOG_DATA);

  /**
   * @description
   * Cierra el dialog con `true` para indicar al padre que el usuario confirmó
   * la eliminación y que debe proceder con la petición HTTP al servicio.
   */
  confirm(): void {
    this.dialogRef.close(true);
  }

  /**
   * @description
   * Cierra el dialog con `false` para indicar al padre que el usuario canceló,
   * de modo que no se ejecute ninguna operación de eliminación ni se recargue la lista.
   */
  cancel(): void {
    this.dialogRef.close(false);
  }
}
