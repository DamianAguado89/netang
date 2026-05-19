namespace WebApi.DTOs;

public record SaleDetailDto(
    int Id,
    int ProductId,
    string ProductName,
    int Quantity,
    decimal Price,
    decimal Total
);

public record SaleDto(
    int Id,
    string DocumentNumber,
    string? PaymentType,
    string? Notes,
    decimal Total,
    DateTime RegistrationDate,
    int CustomerId,
    string CustomerName,
    string? CustomerPhone,
    List<SaleDetailDto> SaleDetails
);

public record SaleDetailRequest(int ProductId, int Quantity, decimal Price);

public record CreateSaleRequest(
    int CustomerId,
    string DocumentNumber,
    string? PaymentType,
    string? Notes,
    List<SaleDetailRequest> SaleDetails
);

// Used by the public order form (Angular catalog)
public record PlaceOrderRequest(
    string CustomerName,
    string? CustomerPhone,
    string? CustomerAddress,
    string? Notes,
    List<OrderItemRequest> Items
);

public record OrderItemRequest(int ProductId, int Quantity);

public record PlaceOrderResponse(int SaleId, string DocumentNumber, decimal Total, string CustomerName);
