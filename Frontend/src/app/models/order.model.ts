export interface SaleDetailDto {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface SaleDto {
  id: number;
  documentNumber: string;
  paymentType: string;
  notes: string | null;
  total: number;
  registrationDate: string;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  saleDetails: SaleDetailDto[];
}
