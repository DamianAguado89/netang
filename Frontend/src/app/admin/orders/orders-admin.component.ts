import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { OrderListComponent } from '@app/admin/orders/order-list/order-list.component';

@Component({
  selector: 'app-orders-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink, OrderListComponent],
  templateUrl: './orders-admin.component.html',
  styleUrl: './orders-admin.component.scss',
})
export class OrdersAdminComponent {}
