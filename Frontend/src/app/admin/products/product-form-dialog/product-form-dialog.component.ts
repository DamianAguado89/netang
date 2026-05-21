import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { of, switchMap } from 'rxjs';
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
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { ProductAdminService } from '@app/admin/products/product-admin.service';
import { ProductDto } from '@app/models/product.model';
import { environment } from '@env/environment';

export interface ProductFormDialogData {
  product?: ProductDto;
}

@Component({
  selector: 'app-product-form-dialog',
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
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './product-form-dialog.component.html',
  styleUrl: './product-form-dialog.component.scss',
})
export class ProductFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProductAdminService);
  private readonly dialogRef = inject(MatDialogRef<ProductFormDialogComponent>);
  private readonly router = inject(Router);
  readonly data = inject<ProductFormDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data.product;
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly selectedFile = signal<File | null>(null);
  readonly imagePreview = signal<string | null>(null);

  readonly categories = this.service.categories;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    price: ['', [Validators.required, Validators.pattern(/^\d+([.,]\d{1,2})?$/)]],
    stock: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    isActive: [true],
  });

  ngOnInit(): void {
    if (this.data.product) {
      const p = this.data.product;
      this.form.setValue({
        name: p.name,
        description: p.description ?? '',
        price: p.price.toString().replace('.', ','),
        stock: p.stock.toString(),
        categoryId: p.categoryId,
        isActive: p.isActive,
      });
      if (p.imageUrl) {
        this.imagePreview.set(`${environment.apiUrl}${p.imageUrl.replace('/api', '')}`);
      }
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.imagePreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
      description: raw.description || null,
      price: parseFloat((raw.price as string).replace(',', '.')),
      stock: parseInt(raw.stock as string, 10),
      categoryId: raw.categoryId,
      isActive: raw.isActive,
    };

    if (this.isEdit) {
      const file = this.selectedFile();
      const upload$ = file
        ? this.service.uploadImage(this.data.product!.id, file)
        : of(undefined);

      upload$.pipe(
        switchMap(() => this.service.updateProduct(this.data.product!.id, payload))
      ).subscribe({
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
      this.service.createProduct(payload).pipe(
        switchMap((newProduct) => {
          const file = this.selectedFile();
          if (file) return this.service.uploadImage(newProduct.id, file);
          return of(undefined);
        })
      ).subscribe({
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

  goToCategories(): void {
    this.dialogRef.close(false);
    this.router.navigate(['/admin/categories']);
  }
}
