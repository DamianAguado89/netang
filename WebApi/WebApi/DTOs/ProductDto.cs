namespace WebApi.DTOs;

public record ProductDto(
    int Id,
    string Name,
    string? Description,
    string? ImageUrl,
    decimal Price,
    decimal? ListPrice,
    decimal? MarkupPercentage,
    int Stock,
    bool SoldByWeight,
    bool IsActive,
    int CategoryId,
    string CategoryName,
    DateTime RegistrationDate
);

public record CreateProductRequest(
    string Name,
    string? Description,
    decimal ListPrice,
    decimal MarkupPercentage,
    int Stock,
    bool SoldByWeight,
    bool IsActive,
    int CategoryId
);

public record UpdateProductRequest(
    string Name,
    string? Description,
    decimal ListPrice,
    decimal MarkupPercentage,
    int Stock,
    bool SoldByWeight,
    bool IsActive,
    int CategoryId
);
