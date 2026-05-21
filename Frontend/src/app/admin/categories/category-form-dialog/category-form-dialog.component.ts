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

export interface CategoryFormDialogData {
  category?: CategoryDto;
}

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
  readonly data = inject<CategoryFormDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data.category;
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    isActive: [true],
  });

  ngOnInit(): void {
    if (this.data.category) {
      this.form.setValue({
        name: this.data.category.name,
        isActive: this.data.category.isActive,
      });
    }
  }

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

  cancel(): void {
    this.dialogRef.close(false);
  }
}
