/**
 * @description Cuenta registrada (AspNetUsers) devuelta por `GET /api/users`,
 * junto con su rol actual. Solo accesible para el super admin.
 */
export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

/** Body de `PUT /api/users/{id}/role`. `role` solo admite "Admin" o "Customer". */
export interface UpdateUserRoleRequest {
  role: string;
}
