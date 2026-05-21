import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { CatalogService } from '@app/catalog/catalog.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatDividerModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent {
  readonly catalogService = inject(CatalogService);

  readonly close = output<void>();
  readonly checkout = output<void>();
}
