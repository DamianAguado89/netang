export interface CatalogProduct {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stock: number;
  categoryId: number;
  categoryName: string;
}

export interface CartItem {
  product: CatalogProduct;
  quantity: number;
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
