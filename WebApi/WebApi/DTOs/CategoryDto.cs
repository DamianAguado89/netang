namespace WebApi.DTOs;

public record CategoryDto(int Id, string Name, bool IsActive, DateTime RegistrationDate);

public record CreateCategoryRequest(string Name, bool IsActive = true);

public record UpdateCategoryRequest(string Name, bool IsActive);
