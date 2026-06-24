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
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';

import { AuthService } from '@app/auth/auth.service';
import { ProfileService } from '@app/auth/profile.service';
import { CatalogService } from '@app/catalog/catalog.service';
import { CartComponent } from '@app/catalog/cart/cart.component';
import { OrderDialogComponent } from '@app/catalog/order-dialog/order-dialog.component';
import { ProductCardComponent } from '@app/catalog/product-card/product-card.component';

/**
 * Vista pública del catálogo de productos de Doña Pierina.
 *
 * @description
 * Permite a los clientes explorar la oferta de productos Sin TACC,
 * filtrar por categoría y gestionar el carrito de compras antes de
 * confirmar su pedido mediante un dialog de orden.
 *
 * Utiliza `ChangeDetectionStrategy.OnPush` y signals para mantener
 * la reactividad sin necesidad de Zone.js.
 */
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
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    ProductCardComponent,
    CartComponent,
  ],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
})
export class CatalogComponent implements OnInit {
  /**
   * Servicio de catálogo expuesto como `readonly` para que la plantilla
   * pueda acceder directamente a sus signals (p. ej. `catalogService.loading()`).
   */
  readonly catalogService = inject(CatalogService);

  /** Servicio de autenticación, accedido desde la plantilla para mostrar/ocultar el avatar. */
  readonly authService = inject(AuthService);

  /** Servicio de perfil, accedido desde la plantilla para obtener la imagen del avatar. */
  readonly profileService = inject(ProfileService);

  /** Servicio de Material para abrir dialogs de forma imperativa. */
  private readonly dialog = inject(MatDialog);

  /** Controla la visibilidad del sidenav del carrito. */
  readonly cartOpen = signal(false);

  /** Controla la visibilidad del sidenav de navegación en mobile. */
  readonly navOpen = signal(false);

  /**
   * Categoría actualmente seleccionada como filtro.
   * `null` significa "todas las categorías".
   */
  readonly selectedCategory = signal<string | null>(null);

  /**
   * Lista de nombres de categoría únicos, derivada de los productos cargados
   * y ordenada alfabéticamente para presentarlos como chips de filtro.
   */
  readonly categories = computed(() => {
    const names = this.catalogService
      .products()
      .map((p) => p.categoryName)
      .filter((name, index, arr) => arr.indexOf(name) === index);
    return names.sort((a, b) => a.localeCompare(b));
  });

  /**
   * Subconjunto de productos que coincide con la categoría seleccionada.
   * Devuelve todos los productos cuando no hay filtro activo.
   */
  readonly filteredProducts = computed(() => {
    const cat = this.selectedCategory();
    if (!cat) return this.catalogService.products();
    return this.catalogService.products().filter((p) => p.categoryName === cat);
  });

  /**
   * Iniciales del nombre completo del usuario autenticado (máximo dos palabras).
   * Usado como fallback cuando no hay imagen de avatar.
   */
  readonly initials = computed(() => {
    const n = this.authService.currentUser()?.fullName ?? '?';
    return n
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  });

  /**
   * URL absoluta de la imagen de avatar del usuario.
   * Combina la base de la API (sin el segmento `/api`) con la ruta relativa devuelta
   * por el backend. Devuelve `null` si el perfil no tiene imagen.
   */
  readonly avatarUrl = computed(() => {
    const url = this.profileService.profile()?.imageUrl;
    return url ? this.profileService.baseUrl() + url : null;
  });

  /**
   * Dispara la carga inicial del catálogo desde la API pública `/api/catalog`.
   */
  ngOnInit(): void {
    this.catalogService.loadProducts();
  }

  /**
   * Alterna la visibilidad del sidenav del carrito.
   */
  toggleCart(): void {
    this.cartOpen.update((open) => !open);
  }

  /**
   * Cierra el sidenav del carrito.
   */
  closeCart(): void {
    this.cartOpen.set(false);
  }

  /**
   * Cierra el carrito y abre el dialog de confirmación de pedido.
   * El dialog incluye el formulario con datos del cliente y detalle del pedido.
   */
  openOrderDialog(): void {
    this.closeCart();
    this.dialog.open(OrderDialogComponent, { width: '500px' });
  }

  /**
   * Aplica el filtro de categoría sobre el listado de productos.
   *
   * @param cat - Nombre de la categoría a filtrar, o `null` para mostrar todas.
   */
  filterByCategory(cat: string | null): void {
    this.selectedCategory.set(cat ?? null);
  }

  /**
   * Alterna la visibilidad del sidenav de navegación (solo mobile).
   */
  toggleNav(): void {
    this.navOpen.update((o) => !o);
  }

  /**
   * Cierra el sidenav de navegación.
   */
  closeNav(): void {
    this.navOpen.set(false);
  }

  /**
   * Cierra la sesión del usuario y redirige al login.
   */
  logout(): void {
    this.authService.logout();
  }
}
