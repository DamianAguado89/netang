import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { of, startWith, switchMap } from 'rxjs';
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

/** Patrón decimal argentino para precios: acepta punto o coma, hasta 2 decimales. */
const DECIMAL_PATTERN = /^\d+([.,]\d{1,2})?$/;

/**
 * Patrón decimal para el % de Aumento: igual al de precios pero hasta 4 decimales.
 * El aumento se recalcula solo cuando el usuario edita el Precio de Venta a mano
 * (ver `syncMarkupFromSalePrice`), y necesita esa precisión extra para poder
 * reproducir el precio exacto que se tipeó al redondear en el backend — con solo
 * 2 decimales el aumento guardado puede perder unos centavos.
 */
const MARKUP_PATTERN = /^\d+([.,]\d{1,4})?$/;

/**
 * @description Convierte el texto crudo de un `MatInput` decimal a número.
 * Normaliza la coma argentina a punto antes de parsear. A propósito no exige un
 * máximo de decimales (a diferencia de `DECIMAL_PATTERN`/`MARKUP_PATTERN`, que sí
 * gobiernan qué se considera válido para mostrar/enviar): esta función solo se usa
 * para cálculos internos, y el % de Aumento recalculado necesita más precisión de
 * la que el usuario tipearía a mano.
 *
 * @param value Texto ingresado por el usuario, posiblemente vacío o inválido.
 * @returns El número parseado, o `null` si el texto no representa un decimal.
 */
function parseDecimal(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @description Formatea un número para volver a cargarlo en un input decimal del
 * formulario (coma como separador, sin separador de miles, sin ceros de más),
 * el mismo criterio que ya usa `ngOnInit` al precargar `listPrice`.
 *
 * @param value Número a formatear.
 * @param decimals Cantidad máxima de decimales a conservar (2 para precios, 4 para
 * el % de Aumento recalculado).
 * @returns El texto listo para `setValue` en un control decimal.
 */
function formatDecimalForInput(value: number, decimals = 2): string {
  const factor = 10 ** decimals;
  return (Math.round((value + Number.EPSILON) * factor) / factor).toString().replace('.', ',');
}

/**
 * @description Bloquea en el `keydown` cualquier tecla que no sea un dígito, una
 * tecla de control (borrar, flechas, tab, copiar/pegar, etc.) o —si
 * `allowSeparator` es `true`— el primer separador decimal (coma o punto).
 * Se usa en los campos de precio para que directamente no se puedan escribir
 * letras ni el signo negativo, en vez de solo marcarlos inválidos después.
 *
 * @param event Evento de teclado del input.
 * @param allowSeparator Si el campo acepta un separador decimal (coma o punto).
 */
function guardDecimalKey(event: KeyboardEvent, allowSeparator: boolean): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'];
  if (controlKeys.includes(event.key)) return;
  if (/^\d$/.test(event.key)) return;
  if (allowSeparator && (event.key === ',' || event.key === '.')) {
    const input = event.target as HTMLInputElement;
    if (!input.value.includes(',') && !input.value.includes('.')) return;
  }
  event.preventDefault();
}

/**
 * @description Igual que `guardDecimalKey` pero sin separador decimal, para
 * campos de cantidades enteras (ej: Stock).
 *
 * @param event Evento de teclado del input.
 */
function guardIntegerKey(event: KeyboardEvent): void {
  guardDecimalKey(event, false);
}

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
   * `listPrice`, `markupPercentage` y `stock` se tipan como `string` porque
   * `MatInput` siempre emite cadenas de texto. La conversión a número ocurre en
   * `save()` justo antes de construir el payload. Los patrones decimales aceptan
   * tanto punto como coma como separador para adaptarse al formato argentino.
   *
   * El precio de venta (`salePrice`) sí es un control editable: por defecto refleja
   * `listPrice * (1 + markup / 100)`, pero el usuario puede pisarlo a mano (ej: redondear
   * $5.850 a $6.000 para no lidiar con vuelto). Ver el sincronizado bidireccional en el
   * constructor: editar `listPrice`/`markupPercentage` recalcula `salePrice`, y editar
   * `salePrice` recalcula `markupPercentage` en sentido inverso (con `listPrice` fijo),
   * que es lo que finalmente se envía al backend — el backend sigue siendo la única
   * fuente de verdad del `Price` final, solo que ahora a partir de un margen "ajustado".
   */
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    listPrice: ['', [Validators.required, Validators.pattern(DECIMAL_PATTERN)]],
    markupPercentage: ['', [Validators.required, Validators.pattern(MARKUP_PATTERN)]],
    salePrice: ['', [Validators.required, Validators.pattern(DECIMAL_PATTERN)]],
    stock: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    soldByWeight: [false],
    isActive: [true],
  });

  /** Bloquea teclas no numéricas en los campos de precio (ver `guardDecimalKey`). */
  readonly guardDecimalKey = guardDecimalKey;

  /** Bloquea teclas no numéricas en el campo de Stock (ver `guardIntegerKey`). */
  readonly guardIntegerKey = guardIntegerKey;

  /**
   * Espeja `form.controls.soldByWeight` como signal para que el template pueda
   * reaccionar (label de stock, sufijo "/kg" del preview) sin suscribirse a mano.
   * `toSignal` requiere un valor inicial explícito porque `valueChanges` no emite
   * hasta el primer cambio del control.
   */
  readonly isSoldByWeight = toSignal(
    this.form.controls.soldByWeight.valueChanges.pipe(
      startWith(this.form.controls.soldByWeight.value)
    ),
    { initialValue: false }
  );

  /**
   * @description
   * Sincroniza `listPrice`/`markupPercentage` con `salePrice` en ambos sentidos:
   *
   * - Editar `listPrice` o `markupPercentage` recalcula `salePrice` (mantiene el
   *   margen elegido y deja flotar el precio final, el comportamiento de siempre).
   * - Editar `salePrice` directamente recalcula `markupPercentage` en sentido
   *   inverso, manteniendo `listPrice` fijo — así el usuario puede redondear el
   *   precio final (ej: $5.850 → $6.000) sin tener que calcular a mano qué
   *   porcentaje de aumento da ese número.
   *
   * Cada `setValue` programático usa `{ emitEvent: false }` para no disparar de
   * nuevo el otro lado y generar un loop — el único disparo real es el del
   * campo que el usuario efectivamente tipeó.
   */
  constructor() {
    this.form.controls.listPrice.valueChanges.subscribe(() => this.syncSalePriceFromMarkup());
    this.form.controls.markupPercentage.valueChanges.subscribe(() => this.syncSalePriceFromMarkup());
    this.form.controls.salePrice.valueChanges.subscribe(() => this.syncMarkupFromSalePrice());
  }

  private syncSalePriceFromMarkup(): void {
    const listPrice = parseDecimal(this.form.controls.listPrice.value);
    const markup = parseDecimal(this.form.controls.markupPercentage.value);
    if (listPrice === null || markup === null) return;
    const price = listPrice * (1 + markup / 100);
    this.form.controls.salePrice.setValue(formatDecimalForInput(price), { emitEvent: false });
  }

  private syncMarkupFromSalePrice(): void {
    const listPrice = parseDecimal(this.form.controls.listPrice.value);
    const salePrice = parseDecimal(this.form.controls.salePrice.value);
    if (listPrice === null || listPrice === 0 || salePrice === null) return;
    const markup = (salePrice / listPrice - 1) * 100;
    this.form.controls.markupPercentage.setValue(formatDecimalForInput(markup, 4), { emitEvent: false });
  }

  /**
   * @description Carga los valores del producto en el formulario cuando el dialog
   * opera en modo edición, e inicializa el preview de imagen con la URL del servidor.
   *
   * Los productos creados antes de que existiera el esquema lista + aumento no
   * tienen `listPrice`/`markupPercentage`. Para esos se usa el precio de venta ya
   * almacenado como precio de lista con 0% de aumento, de modo que el preview
   * coincida con el precio actual del producto y editar otro campo no lo altere.
   */
  ngOnInit(): void {
    if (this.data.product) {
      const p = this.data.product;
      const hasListPrice = p.listPrice !== null;
      this.form.setValue({
        name: p.name,
        description: p.description ?? '',
        listPrice: (hasListPrice ? p.listPrice! : p.price).toString().replace('.', ','),
        markupPercentage: hasListPrice
          ? (p.markupPercentage ?? 0).toString().replace('.', ',')
          : '0',
        salePrice: formatDecimalForInput(p.price),
        stock: p.stock.toString(),
        categoryId: p.categoryId,
        soldByWeight: p.soldByWeight,
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
      listPrice: parseFloat((raw.listPrice as string).replace(',', '.')),
      markupPercentage: parseFloat((raw.markupPercentage as string).replace(',', '.')),
      stock: parseInt(raw.stock as string, 10),
      categoryId: raw.categoryId,
      soldByWeight: raw.soldByWeight,
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
