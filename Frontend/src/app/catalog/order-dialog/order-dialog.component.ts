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
  readonly catalogService = inject(CatalogService);
  private readonly dialogRef = inject(MatDialogRef<OrderDialogComponent>);
  private readonly fb = inject(FormBuilder);

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly orderResponse = signal<PlaceOrderResponse | null>(null);

  readonly form = this.fb.nonNullable.group({
    customerName: ['', [Validators.required, Validators.minLength(2)]],
    customerPhone: [''],
    customerAddress: [''],
    notes: [''],
  });

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

  close(): void {
    this.dialogRef.close();
  }
}
