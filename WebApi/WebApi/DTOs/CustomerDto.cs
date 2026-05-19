namespace WebApi.DTOs;

public record CustomerDto(int Id, string Name, string? Email, string? Phone, string? Address);

public record CreateCustomerRequest(string Name, string? Email, string? Phone, string? Address);

public record UpdateCustomerRequest(string Name, string? Email, string? Phone, string? Address);
