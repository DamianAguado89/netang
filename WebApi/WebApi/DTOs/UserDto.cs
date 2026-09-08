namespace WebApi.DTOs;

// Cuenta registrada (AspNetUsers) junto con su rol actual, para el panel de
// administración de usuarios del super admin. Role es siempre uno solo
// ("Customer", "Admin" o "SuperAdmin") porque el resto del sistema asume
// rol único por usuario (ver TokenService.GenerateToken).
public record UserDto(string Id, string Email, string FullName, string Role);

// Body de PUT /api/users/{id}/role. Solo admite "Admin" o "Customer" —
// ver UserEndpoints.UpdateUserRole para el porqué de esa restricción.
public record UpdateUserRoleRequest(string Role);
