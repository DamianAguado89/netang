import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { OrderAdminService } from '@app/admin/orders/order-admin.service';
import { SaleDto } from '@app/models/order.model';

interface DialogData {
  saleId: number;
}

@Component({
  selector: 'app-order-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  templateUrl: './order-detail-dialog.component.html',
  styleUrl: './order-detail-dialog.component.scss',
})
export class OrderDetailDialogComponent implements OnInit {
  private readonly service = inject(OrderAdminService);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  readonly sale = signal<SaleDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly detailColumns = ['productName', 'quantity', 'price', 'total'];

  ngOnInit(): void {
    this.service.getOrder(this.data.saleId).subscribe({
      next: (sale) => {
        this.sale.set(sale);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle del pedido.');
        this.loading.set(false);
      },
    });
  }
}
