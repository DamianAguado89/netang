export interface CustomerDto {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  birthDate: string | null;
  imageUrl: string | null;
}

export interface CreateCustomerRequest {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  birthDate: string | null;
}
