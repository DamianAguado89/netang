import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { OrderAdminService } from '@app/admin/orders/order-admin.service';
import { SaleDto } from '@app/models/order.model';

@Component({
  selector: 'app-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss',
})
export class BillingComponent implements OnInit {
  private readonly service = inject(OrderAdminService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  readonly sale = signal<SaleDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly confirming = signal(false);
  readonly confirmed = signal(false);

  readonly detailColumns = ['productName', 'quantity', 'price', 'total'];

  ngOnInit(): void {
    this.loadSale();
  }

  private loadSale(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getOrder(parseInt(this.id(), 10)).subscribe({
      next: (sale) => {
        this.sale.set(sale);
        this.loading.set(false);
        // Si el pedido ya estaba confirmado al cargar, mostrar estado confirmado
        if (sale.isConfirmed) {
          this.confirmed.set(true);
        }
      },
      error: () => {
        this.error.set('No se pudo cargar el pedido.');
        this.loading.set(false);
      },
    });
  }

  confirm(): void {
    const sale = this.sale();
    if (!sale || this.confirming()) return;

    this.confirming.set(true);
    this.service.confirmOrder(sale.id).subscribe({
      next: () => {
        this.confirmed.set(true);
        this.confirming.set(false);
        this.loadSale();
      },
      error: () => {
        this.error.set('No se pudo confirmar la venta. Intentá de nuevo.');
        this.confirming.set(false);
      },
    });
  }

  print(): void {
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/admin/orders']);
  }
}
