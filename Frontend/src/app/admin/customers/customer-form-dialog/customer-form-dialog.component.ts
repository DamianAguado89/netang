import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CustomerAdminService } from '@app/admin/customers/customer-admin.service';
import { CustomerDto } from '@app/models/customer.model';

/**
 * @description
 * Convierte la fecha del `MatDatepicker` al formato ISO de solo fecha (`YYYY-MM-DD`).
 *
 * No se usa `toISOString()` porque convierte a UTC y, para husos horarios negativos
 * como el argentino, desplazaría la fecha de cumpleaños un día hacia atrás.
 * Se leen los componentes locales de la fecha para preservar el día que eligió el usuario.
 *
 * @param date Fecha seleccionada en el datepicker, o `null` si el campo quedó vacío.
 * @returns La fecha como `YYYY-MM-DD`, o `null` si no se seleccionó ninguna.
 */
function toIsoDate(date: Date | null): string | null {
  if (!date) return null;
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * @description Contrato público del dialog de cliente.
 * Se declara vacío de forma intencional: el dialog es solo de creación, pero la
 * interface se mantiene para respetar la convención del resto de dialogs del panel
 * y permitir extenderla sin romper a los consumidores.
 */
export interface CustomerFormDialogData {}

/**
 * @description
 * Dialog de alta rápida de cliente, pensado para el flujo de facturación en el local:
 * cuando el cliente que atiende el mostrador no existe todavía en el sistema,
 * se lo crea sin salir de la pantalla de venta.
 *
 * Es **solo de creación** (no tiene modo edición) y omite deliberadamente el email
 * y la imagen: en el mostrador solo se piden los datos mínimos, y el payload envía
 * `email: null`.
 *
 * Al guardar cierra el dialog con el `CustomerDto` recién creado en lugar de un booleano,
 * para que la pantalla de facturación pueda seleccionarlo de inmediato sin hacer
 * una segunda búsqueda contra el backend.
 *
 * Provee `provideNativeDateAdapter()` a nivel de componente porque es el único lugar
 * de la aplicación que usa datepicker; no hace falta cargar el adaptador de fechas
 * en el bootstrap global.
 */
@Component({
  selector: 'app-customer-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideNativeDateAdapter()],
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './customer-form-dialog.component.html',
  styleUrl: './customer-form-dialog.component.scss',
})
export class CustomerFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CustomerAdminService);
  private readonly dialogRef = inject(MatDialogRef<CustomerFormDialogComponent, CustomerDto | null>);

  /** `true` mientras el alta está en curso. Deshabilita los botones para evitar doble envío. */
  readonly saving = signal(false);

  /** Mensaje de error del último intento de alta fallido, o `null` si no hubo error. */
  readonly saveError = signal<string | null>(null);

  /**
   * Formulario reactivo del cliente.
   *
   * `birthDate` se tipa como `Date | null` porque el `MatDatepicker` trabaja con
   * objetos `Date` nativos; la conversión a string ISO ocurre en `save()`.
   */
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    address: [''],
    phone: [''],
    birthDate: [null as Date | null],
  });

  /**
   * @description
   * Valida el formulario, da de alta el cliente y cierra el dialog con el `CustomerDto` creado.
   * Los campos de texto vacíos se envían como `null` en lugar de `''` para que el backend
   * los persista como ausentes y no como cadenas vacías.
   */
  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);

    const raw = this.form.getRawValue();
    this.service
      .createCustomer({
        name: raw.name.trim(),
        email: null,
        phone: raw.phone.trim() || null,
        address: raw.address.trim() || null,
        birthDate: toIsoDate(raw.birthDate),
      })
      .subscribe({
        next: (customer) => {
          this.saving.set(false);
          this.dialogRef.close(customer);
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set(
            'Ocurrió un error al guardar el cliente. Verificá los datos e intentá de nuevo.'
          );
        },
      });
  }

  /**
   * @description Cierra el dialog sin dar de alta al cliente.
   * Devuelve `null` para que el consumidor distinga la cancelación de un alta exitosa,
   * que siempre devuelve un `CustomerDto`.
   */
  cancel(): void {
    this.dialogRef.close(null);
  }
}
