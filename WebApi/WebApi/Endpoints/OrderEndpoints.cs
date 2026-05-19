using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

// Public order submission — used by the Angular storefront (no auth required)
public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/orders").WithTags("Orders");

        group.MapPost("/", PlaceOrder);
    }

    private static async Task<IResult> PlaceOrder(PlaceOrderRequest req, ApplicationDbContext db)
    {
        if (req.Items == null || !req.Items.Any())
            return TypedResults.BadRequest("El pedido debe tener al menos un producto.");

        // Find or create customer by phone number
        Customer? customer = null;
        if (!string.IsNullOrWhiteSpace(req.CustomerPhone))
            customer = await db.Customers.FirstOrDefaultAsync(c => c.Phone == req.CustomerPhone);

        if (customer is null)
        {
            customer = new Customer
            {
                Name = req.CustomerName,
                Phone = req.CustomerPhone,
                Address = req.CustomerAddress
            };
            db.Customers.Add(customer);
            await db.SaveChangesAsync();
        }

        // Build sale
        var docNumber = $"DP-{DateTime.UtcNow:yyyyMMddHHmmss}";
        var sale = new Sale
        {
            CustomerId = customer.Id,
            DocumentNumber = docNumber,
            Notes = req.Notes,
            RegistrationDate = DateTime.UtcNow
        };

        foreach (var item in req.Items)
        {
            var product = await db.Products.FindAsync(item.ProductId);
            if (product is null || !product.IsActive)
                return TypedResults.BadRequest($"Producto {item.ProductId} no disponible.");
            if (item.Quantity <= 0)
                return TypedResults.BadRequest($"Cantidad inválida para el producto {product.Name}.");

            sale.SaleDetails.Add(new SaleDetail
            {
                ProductId = product.Id,
                Quantity = item.Quantity,
                Price = product.Price,
                Total = product.Price * item.Quantity
            });
        }

        sale.Total = sale.SaleDetails.Sum(sd => sd.Total);
        db.Sales.Add(sale);
        await db.SaveChangesAsync();

        return TypedResults.Created($"/api/sales/{sale.Id}",
            new PlaceOrderResponse(sale.Id, sale.DocumentNumber, sale.Total, customer.Name));
    }
}
