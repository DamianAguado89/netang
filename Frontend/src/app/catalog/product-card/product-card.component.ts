import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { CatalogProduct } from '@app/models/catalog.model';
import { environment } from '@env/environment';

@Component({
  selector: 'app-product-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  private readonly apiBase = environment.apiUrl.replace('/api', '');

  readonly product = input.required<CatalogProduct>();
  readonly quantity = input(0);

  readonly add = output<void>();
  readonly changeQty = output<number>();

  readonly imageUrl = computed(() => {
    const url = this.product().imageUrl;
    return url ? this.apiBase + url : null;
  });
}
