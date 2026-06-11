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

/**
 * @description Contrato público del dialog de producto.
 * Se define en el mismo archivo que el componente de forma intencional:
 * quien abra el dialog importa esta interface junto con el componente,
 * manteniendo el acoplamiento explícito y localizado.
 */
export interface ProductFormDialogData {
  /** Producto a editar. Si está ausente, el dialog opera en modo creación. */
  product?: ProductDto;
}

/**
 * @description Dialog reutilizable para **crear** o **editar** un producto del catálogo.
 *
 * El modo se determina una única vez al instanciar la clase a través de `isEdit`.
 * En modo edición carga los valores actuales del producto en el formulario y
 * muestra la imagen existente como preview. En modo creación el formulario
 * comienza vacío.
 *
 * Al guardar, el flujo RxJS difiere según el modo para respetar las
 * dependencias entre el endpoint de imagen y el de datos del producto
 * (ver `save()`).
 */
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

  /** Datos inyectados por `MatDialog.open()`. Tipados con `ProductFormDialogData`. */
  readonly data = inject<ProductFormDialogData>(MAT_DIALOG_DATA);

  /**
   * Indica si el dialog opera en modo edición.
   * Se calcula en la instanciación — no en `ngOnInit` — porque `data` ya está
   * disponible antes del ciclo de vida de Angular. Al ser derivado de `data`
   * y nunca mutar, se declara como propiedad de clase inmutable.
   */
  readonly isEdit = !!this.data.product;

  /** `true` mientras la operación de guardado está en curso. Deshabilita el botón de guardar. */
  readonly saving = signal(false);

  /** Mensaje de error del último intento de guardado fallido, o `null` si no hubo error. */
  readonly saveError = signal<string | null>(null);

  /**
   * Archivo de imagen seleccionado por el usuario pero aún no subido.
   * El upload ocurre recién al llamar `save()`, no al seleccionar el archivo.
   */
  readonly selectedFile = signal<File | null>(null);

  /**
   * URL o data URL que se muestra como preview de la imagen.
   * - En modo edición se inicializa con la URL absoluta del servidor.
   * - Al seleccionar un archivo nuevo, `FileReader` la reemplaza con un
   *   data URL en base64 generado localmente, sin necesidad de hacer upload.
   */
  readonly imagePreview = signal<string | null>(null);

  /** Lista de categorías disponibles expuesta como signal de solo lectura desde el servicio. */
  readonly categories = this.service.categories;

  /**
   * Formulario reactivo del producto.
   *
   * `price` y `stock` se tipan como `string` porque `MatInput` siempre emite
   * cadenas de texto. La conversión a número ocurre en `save()` justo antes de
   * construir el payload. El patrón de `price` acepta tanto punto como coma
   * como separador decimal para adaptarse al formato argentino.
   */
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    price: ['', [Validators.required, Validators.pattern(/^\d+([.,]\d{1,2})?$/)]],
    stock: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    isActive: [true],
  });

  /**
   * @description Carga los valores del producto en el formulario cuando el dialog
   * opera en modo edición, e inicializa el preview de imagen con la URL del servidor.
   */
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

  /**
   * @description Maneja la selección de un archivo de imagen desde el input de tipo `file`.
   *
   * Usa `FileReader.readAsDataURL()` para generar un preview en base64 en el
   * browser de forma síncrona con respecto al usuario. El archivo real se
   * almacena en `selectedFile` y solo se sube al servidor cuando el usuario
   * confirma con `save()`.
   *
   * @param event Evento `change` del `<input type="file">`.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.imagePreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  /**
   * @description Valida el formulario y persiste el producto en el backend.
   *
   * El flujo RxJS difiere según el modo para respetar las dependencias entre
   * los endpoints:
   *
   * - **Creación**: `createProduct` → `switchMap` → `uploadImage` (con el `id`
   *   del producto recién creado). El `id` no existe hasta que el primero
   *   completa, por eso el upload va después.
   * - **Edición**: `uploadImage` (si hay archivo nuevo) → `switchMap` →
   *   `updateProduct`. El orden es inverso al de creación porque el `id` ya
   *   existe; subir la imagen primero evita dejar el producto actualizado con
   *   una imagen desincronizada si el upload falla.
   *
   * En ambos casos, `of(undefined)` actúa como Observable vacío cuando no hay
   * imagen que subir, permitiendo que el `pipe(switchMap(...))` continúe sin
   * bifurcar el flujo con un `if` externo.
   */
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

  /**
   * @description Cierra el dialog sin persistir cambios.
   * Devuelve `false` para que el componente que lo abrió sepa que no hubo modificaciones.
   */
  cancel(): void {
    this.dialogRef.close(false);
  }

  /**
   * @description Cierra el dialog y navega a la pantalla de gestión de categorías.
   *
   * Es un atajo para cuando el usuario necesita crear una categoría antes de
   * crear el producto. El dialog se cierra con `false` para no disparar una
   * recarga innecesaria de la lista de productos.
   */
  goToCategories(): void {
    this.dialogRef.close(false);
    this.router.navigate(['/admin/categories']);
  }
}
