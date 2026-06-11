import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { ProductListComponent } from '@app/admin/products/product-list/product-list.component';

/**
 * @description
 * Componente shell/contenedor de la página de administración de productos.
 * Es activado por la ruta `/admin/products` (lazy-loaded).
 *
 * Su única responsabilidad es proveer el layout de la página: el encabezado
 * con el título y el botón "Nuevo producto", y delegar la renderización del
 * contenido principal a `ProductListComponent`.
 *
 * No contiene lógica de negocio propia — toda la lógica de listado, creación,
 * edición y eliminación de productos reside en `ProductListComponent` y
 * `ProductAdminService`. Esta separación intencional (patrón shell + children)
 * facilita incorporar nuevas secciones al panel de administración en el futuro
 * sin alterar la lógica existente.
 *
 * El botón "Nuevo producto" del template delega la apertura del dialog de
 * formulario al componente hijo mediante binding de template, sin que este
 * componente necesite conocer el detalle de esa interacción.
 */
@Component({
  selector: 'app-products-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink, ProductListComponent],
  templateUrl: './products-admin.component.html',
  styleUrl: './products-admin.component.scss',
})
export class ProductsAdminComponent {}
