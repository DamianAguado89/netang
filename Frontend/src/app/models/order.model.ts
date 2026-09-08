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
  isConfirmed: boolean;
  confirmedAt: string | null;
  saleDetails: SaleDetailDto[];
}

export interface SaleDetailRequest {
  productId: number;
  quantity: number;
}

export interface CreateSaleRequest {
  customerId: number;
  paymentType: string | null;
  notes: string | null;
  saleDetails: SaleDetailRequest[];
}
