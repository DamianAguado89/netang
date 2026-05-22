import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OrderAdminService } from '@app/admin/orders/order-admin.service';
import { OrderDetailDialogComponent } from '@app/admin/orders/order-detail-dialog/order-detail-dialog.component';

@Component({
  selector: 'app-order-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.scss',
})
export class OrderListComponent implements OnInit {
  private readonly service = inject(OrderAdminService);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns = [
    'documentNumber',
    'customerName',
    'customerPhone',
    'total',
    'registrationDate',
    'actions',
  ];

  readonly orders = this.service.orders;
  readonly loading = this.service.loading;
  readonly error = this.service.error;

  ngOnInit(): void {
    this.service.loadOrders();
  }

  openDetail(saleId: number): void {
    this.dialog.open(OrderDetailDialogComponent, {
      width: '640px',
      data: { saleId },
    });
  }
}
