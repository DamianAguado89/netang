namespace WebApi.DTOs;

public record CustomerDto(int Id, string Name, string? Email, string? Phone, string? Address, string? ImageUrl);

public record CreateCustomerRequest(string Name, string? Email, string? Phone, string? Address);

public record UpdateCustomerRequest(string Name, string? Email, string? Phone, string? Address);

// Usado por el usuario autenticado para actualizar su propio perfil.
// Email no se incluye porque está ligado a la cuenta de Identity y no se cambia aquí.
public record UpdateProfileRequest(string Name, string? Phone, string? Address);
