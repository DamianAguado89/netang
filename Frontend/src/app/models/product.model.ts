export interface ProductDto {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  categoryId: number;
  categoryName: string;
  registrationDate: string;
}

export interface CreateProductRequest {
  name: string;
  description: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  categoryId: number;
}

export interface UpdateProductRequest {
  name: string;
  description: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  categoryId: number;
}

export interface CategoryDto {
  id: number;
  name: string;
  isActive: boolean;
  registrationDate: string;
}
