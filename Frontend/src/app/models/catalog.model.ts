export interface CatalogProduct {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stock: number;
  soldByWeight: boolean;
  categoryId: number;
  categoryName: string;
}

export interface CartItem {
  product: CatalogProduct;
  quantity: number;
}

/**
 * @description
 * Calcula el importe de un ítem del carrito replicando la misma fórmula que usa
 * el backend (`CalculateLineTotal` en `SaleEndpoints`/`OrderEndpoints`) y el POS
 * admin (`lineSubtotal` en `pos.component.ts`).
 *
 * Para productos que se venden por peso, `product.price` es el precio por
 * **kilogramo** y `quantity` son los **gramos** cargados en el carrito, por eso
 * se divide por 1000 antes de redondear a centavos. Para el resto, `quantity`
 * son unidades y el cálculo es el de siempre.
 *
 * @param product Producto del ítem, con su `price` y flag `soldByWeight`.
 * @param quantity Unidades del producto, o gramos si `soldByWeight` es `true`.
 * @returns El importe del ítem en pesos, redondeado a 2 decimales.
 */
export function catalogItemTotal(product: CatalogProduct, quantity: number): number {
  if (!product.soldByWeight) return product.price * quantity;
  return Math.round((product.price * quantity / 1000 + Number.EPSILON) * 100) / 100;
}

export interface PlaceOrderRequest {
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  notes: string | null;
  items: Array<{ productId: number; quantity: number }>;
}

export interface PlaceOrderResponse {
  saleId: number;
  documentNumber: string;
  total: number;
  customerName: string;
}
