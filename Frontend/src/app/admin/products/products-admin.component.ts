import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { ProductListComponent } from '@app/admin/products/product-list/product-list.component';

@Component({
  selector: 'app-products-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink, ProductListComponent],
  templateUrl: './products-admin.component.html',
  styleUrl: './products-admin.component.scss',
})
export class ProductsAdminComponent {}
