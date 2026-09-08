export interface ProductDto {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  listPrice: number | null;
  markupPercentage: number | null;
  stock: number;
  soldByWeight: boolean;
  isActive: boolean;
  categoryId: number;
  categoryName: string;
  registrationDate: string;
}

export interface CreateProductRequest {
  name: string;
  description: string | null;
  listPrice: number;
  markupPercentage: number;
  stock: number;
  soldByWeight: boolean;
  isActive: boolean;
  categoryId: number;
}

export interface UpdateProductRequest {
  name: string;
  description: string | null;
  listPrice: number;
  markupPercentage: number;
  stock: number;
  soldByWeight: boolean;
  isActive: boolean;
  categoryId: number;
}

export interface CategoryDto {
  id: number;
  name: string;
  isActive: boolean;
  registrationDate: string;
}
