import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CatalogService } from '@app/catalog/catalog.service';
import { CartComponent } from '@app/catalog/cart/cart.component';
import { OrderDialogComponent } from '@app/catalog/order-dialog/order-dialog.component';
import { ProductCardComponent } from '@app/catalog/product-card/product-card.component';

@Component({
  selector: 'app-catalog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatBadgeModule,
    MatButtonModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    ProductCardComponent,
    CartComponent,
  ],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
})
export class CatalogComponent implements OnInit {
  readonly catalogService = inject(CatalogService);
  private readonly dialog = inject(MatDialog);

  readonly cartOpen = signal(false);
  readonly navOpen = signal(false);
  readonly selectedCategory = signal<string | null>(null);

  readonly categories = computed(() => {
    const names = this.catalogService
      .products()
      .map((p) => p.categoryName)
      .filter((name, index, arr) => arr.indexOf(name) === index);
    return names.sort((a, b) => a.localeCompare(b));
  });

  readonly filteredProducts = computed(() => {
    const cat = this.selectedCategory();
    if (!cat) return this.catalogService.products();
    return this.catalogService.products().filter((p) => p.categoryName === cat);
  });

  ngOnInit(): void {
    this.catalogService.loadProducts();
  }

  toggleCart(): void {
    this.cartOpen.update((open) => !open);
  }

  closeCart(): void {
    this.cartOpen.set(false);
  }

  openOrderDialog(): void {
    this.closeCart();
    this.dialog.open(OrderDialogComponent, { width: '500px' });
  }

  filterByCategory(cat: string | null): void {
    this.selectedCategory.set(cat ?? null);
  }

  toggleNav(): void {
    this.navOpen.update((o) => !o);
  }

  closeNav(): void {
    this.navOpen.set(false);
  }
}
