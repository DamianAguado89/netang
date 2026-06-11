using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

// Endpoint público para recibir pedidos del storefront Angular — sin autenticación.
// Solo expone un POST porque los clientes únicamente crean pedidos, no los consultan ni modifican.
public static class OrderEndpoints
{
    // Registra la única ruta del módulo bajo /api/orders.
    // WithTags("Orders") agrupa el endpoint en su propia sección en Swagger UI.
    public static void MapOrderEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/orders").WithTags("Orders");

        group.MapPost("/", PlaceOrder);
    }

    // Recibe el pedido del cliente, crea o reutiliza su registro y persiste la venta.
    // El flujo tiene tres etapas: validación → upsert de cliente → construcción de la venta.
    private static async Task<IResult> PlaceOrder(PlaceOrderRequest req, ApplicationDbContext db)
    {
        // Guard clause: un pedido sin ítems no tiene sentido de negocio.
        if (req.Items == null || !req.Items.Any())
            return TypedResults.BadRequest("El pedido debe tener al menos un producto.");

        // Upsert de cliente por número de teléfono:
        // si el cliente ya existe en la base (mismo teléfono) se reutiliza su registro,
        // evitando duplicados. Si no tiene teléfono o no se encuentra, se crea uno nuevo.
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
            // Se guarda aquí para obtener el Id generado por la base antes de usarlo en la venta.
            await db.SaveChangesAsync();
        }

        // El número de documento se genera con marca de tiempo UTC para garantizar unicidad
        // sin necesidad de una secuencia en la base de datos. Formato: DP-20260602143022.
        var docNumber = $"DP-{DateTime.UtcNow:yyyyMMddHHmmss}";
        var sale = new Sale
        {
            CustomerId = customer.Id,
            DocumentNumber = docNumber,
            Notes = req.Notes,
            RegistrationDate = DateTime.UtcNow
        };

        // Por cada ítem del pedido se valida que el producto exista y esté activo,
        // y que la cantidad sea positiva. Si alguno falla, se aborta todo el pedido (400).
        // El precio se toma del producto en el momento del pedido — no del frontend —
        // para evitar manipulación de precios desde el cliente.
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

        // El total de la venta se calcula en el servidor sumando los subtotales de cada línea,
        // nunca se acepta el total que envía el cliente.
        sale.Total = sale.SaleDetails.Sum(sd => sd.Total);
        db.Sales.Add(sale);
        await db.SaveChangesAsync();

        // Retorna 201 Created con la URL del recurso y los datos mínimos que el frontend
        // necesita para mostrar la confirmación: id, número de pedido, total y nombre del cliente.
        return TypedResults.Created($"/api/sales/{sale.Id}",
            new PlaceOrderResponse(sale.Id, sale.DocumentNumber, sale.Total, customer.Name));
    }
}
