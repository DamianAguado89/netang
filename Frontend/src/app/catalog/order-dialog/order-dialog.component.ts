import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PlaceOrderResponse } from '@app/models/catalog.model';
import { CatalogService } from '@app/catalog/catalog.service';

/**
 * @description
 * Diálogo de confirmación y envío de pedido. Se abre desde `CatalogComponent`
 * vía `MatDialog.open()` cuando el cliente decide finalizar su carrito.
 *
 * El componente maneja dos estados visuales mutuamente excluyentes:
 * - **Formulario**: visible mientras `orderResponse` es `null`. El cliente
 *   completa sus datos y envía el pedido.
 * - **Confirmación**: visible cuando `orderResponse` tiene valor tras un envío
 *   exitoso. Muestra el número de pedido generado por el backend (ej: `DP-0042`).
 *
 * El ciclo de vida de un envío es: validación del formulario → llamada HTTP
 * vía `CatalogService.placeOrder()` → actualización de signals de estado →
 * limpieza del carrito en caso de éxito.
 */
@Component({
  selector: 'app-order-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './order-dialog.component.html',
  styleUrl: './order-dialog.component.scss',
})
export class OrderDialogComponent {
  /**
   * @description
   * Servicio del catálogo expuesto como `readonly` para que el template pueda
   * acceder a `cart()` y mostrar el resumen del pedido sin necesidad de
   * duplicar el estado en el componente.
   */
  readonly catalogService = inject(CatalogService);

  /**
   * @description
   * Referencia al diálogo actual. Se usa exclusivamente para cerrarlo de forma
   * programática desde `close()`, sin necesidad de que el padre lo gestione.
   */
  private readonly dialogRef = inject(MatDialogRef<OrderDialogComponent>);

  /**
   * @description
   * Constructor de formularios reactivos. Se utiliza con `nonNullable` para
   * garantizar que `getRawValue()` devuelva `string` en lugar de `string | null`,
   * simplificando la conversión manual de campos opcionales vacíos a `null`.
   */
  private readonly fb = inject(FormBuilder);

  /**
   * @description
   * Indica si hay una llamada HTTP en curso. Mientras es `true` el template
   * deshabilita el botón de envío y muestra el spinner, evitando envíos
   * duplicados por clics repetidos.
   */
  readonly submitting = signal(false);

  /**
   * @description
   * Mensaje de error a mostrar cuando el envío del pedido falla. Se resetea a
   * `null` al inicio de cada intento de envío para no acumular mensajes de
   * intentos anteriores.
   */
  readonly submitError = signal<string | null>(null);

  /**
   * @description
   * Respuesta del backend tras un envío exitoso. Actúa como flag de estado:
   * mientras sea `null` el template muestra el formulario; cuando tiene valor
   * cambia a la vista de confirmación con el número de pedido generado.
   */
  readonly orderResponse = signal<PlaceOrderResponse | null>(null);

  /**
   * @description
   * Formulario reactivo con los datos del cliente. Se construye con
   * `nonNullable.group()` para que los controles de campos opcionales
   * entreguen `''` en lugar de `null` al llamar a `getRawValue()`, lo que
   * permite distinguir explícitamente "vacío" de `null` antes de enviar al
   * backend.
   *
   * - `customerName`: requerido, mínimo 2 caracteres.
   * - `customerPhone`, `customerAddress`, `notes`: opcionales, se envían como
   *   `null` si el usuario los dejó en blanco.
   */
  readonly form = this.fb.nonNullable.group({
    customerName: ['', [Validators.required, Validators.minLength(2)]],
    customerPhone: [''],
    customerAddress: [''],
    notes: [''],
  });

  /**
   * @description
   * Intenta enviar el pedido al backend siguiendo este flujo:
   *
   * 1. **Validación**: si el formulario es inválido, llama a
   *    `markAllAsTouched()` para disparar los mensajes de error visuales en
   *    todos los campos y aborta el envío con un `return` anticipado.
   * 2. **Guard de doble envío**: activa `submitting` y limpia cualquier error
   *    previo antes de iniciar la llamada HTTP.
   * 3. **Conversión de opcionales**: los campos opcionales devueltos como `''`
   *    por `getRawValue()` se convierten a `null` para respetar el contrato
   *    del backend.
   * 4. **Llamada HTTP**: delega en `CatalogService.placeOrder()`, que retorna
   *    un Observable que emite una única vez y completa de inmediato (comportamiento
   *    estándar de `HttpClient`).
   * 5. **Éxito (`next`)**: almacena la respuesta en `orderResponse` (lo que
   *    provoca el cambio de vista en el template), limpia el carrito y
   *    desactiva el indicador de carga. El vaciado del carrito ocurre aquí
   *    —no en `complete`— para reflejar la intención semántica de "limpiar
   *    solo cuando el servidor confirmó".
   * 6. **Error**: muestra un mensaje amigable y restaura `submitting` a
   *    `false` para permitir un nuevo intento.
   */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    const { customerName, customerPhone, customerAddress, notes } = this.form.getRawValue();

    this.catalogService
      .placeOrder({
        customerName,
        customerPhone: customerPhone || null,
        customerAddress: customerAddress || null,
        notes: notes || null,
        items: this.catalogService.cart().map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      })
      .subscribe({
        next: (response) => {
          this.orderResponse.set(response);
          this.catalogService.clearCart();
          this.submitting.set(false);
        },
        error: () => {
          this.submitError.set('No se pudo enviar el pedido. Intente nuevamente.');
          this.submitting.set(false);
        },
      });
  }

  /**
   * @description
   * Cierra el diálogo programáticamente. Se invoca desde el botón de cancelar
   * (antes del envío) o desde el botón de cerrar (tras la confirmación exitosa).
   */
  close(): void {
    this.dialogRef.close();
  }
}
