using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

// Endpoints de administración para el CRUD completo de ventas más la acción de confirmación.
// Cada venta incluye siempre sus ítems (SaleDetails) y el cliente, por lo que todas las
// consultas usan Include + ThenInclude. El helper privado ToDto centraliza el mapeo
// para evitar repetirlo en los cuatro métodos que devuelven SaleDto.
public static class SaleEndpoints
{
    // Registra las siete rutas del módulo bajo /api/sales.
    // /week es un filtro temporal para la vista de resumen semanal del admin.
    // /{id}/confirm es una acción de transición de estado, no un CRUD estándar.
    public static void MapSaleEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/sales").WithTags("Sales");

        group.MapGet("/", GetAllSales);
        group.MapGet("/week", GetSalesByWeek);
        group.MapGet("/{id:int}", GetSale);
        group.MapPost("/", CreateSale);
        group.MapPut("/{id:int}", UpdateSale);
        group.MapDelete("/{id:int}", DeleteSale);
        group.MapPost("/{id:int}/confirm", ConfirmSale);
    }

    // Devuelve todas las ventas con cliente e ítems completos.
    // ThenInclude carga el nombre del producto en cada ítem para construir el DTO sin queries adicionales.
    // No tiene paginación porque el volumen esperado de ventas es manejable en una sola consulta.
    private static async Task<IResult> GetAllSales(ApplicationDbContext db)
    {
        var list = await db.Sales
            .Include(s => s.Customer)
            .Include(s => s.SaleDetails).ThenInclude(sd => sd.Product)
            .Select(s => ToDto(s))
            .ToListAsync();
        return TypedResults.Ok(list);
    }

    // GET /api/sales/week?date=2026-05-19  (defaults to current week if no date)
    // Devuelve las ventas de la semana que contiene la fecha indicada.
    // El cálculo de lunes corrige el caso del domingo: en .NET DayOfWeek.Sunday = 0 (no 7),
    // lo que desplazaría el lunes al futuro si no se ajusta explícitamente.
    // La comparación usa UTC porque RegistrationDate se almacena en UTC en la base de datos.
    private static async Task<IResult> GetSalesByWeek(ApplicationDbContext db, DateTime? date)
    {
        var reference = date?.ToUniversalTime() ?? DateTime.UtcNow;
        var monday = reference.AddDays(-(int)reference.DayOfWeek + (int)DayOfWeek.Monday).Date;
        if (reference.DayOfWeek == DayOfWeek.Sunday)
            monday = monday.AddDays(-7);
        var nextMonday = monday.AddDays(7);

        var list = await db.Sales
            .Include(s => s.Customer)
            .Include(s => s.SaleDetails).ThenInclude(sd => sd.Product)
            .Where(s => s.RegistrationDate >= monday && s.RegistrationDate < nextMonday)
            .Select(s => ToDto(s))
            .ToListAsync();
        return TypedResults.Ok(list);
    }

    // Devuelve una venta por su Id con cliente e ítems completos.
    // Usa FirstOrDefaultAsync (no FindAsync) porque las cadenas ThenInclude
    // no son compatibles con FindAsync — este carga solo por clave primaria sin navegación.
    // Devuelve 404 si el Id no existe.
    private static async Task<IResult> GetSale(int id, ApplicationDbContext db)
    {
        var sale = await db.Sales
            .Include(s => s.Customer)
            .Include(s => s.SaleDetails).ThenInclude(sd => sd.Product)
            .FirstOrDefaultAsync(s => s.Id == id);
        return sale is not null ? TypedResults.Ok(ToDto(sale)) : TypedResults.NotFound();
    }

    // Crea una venta validando el cliente y cada producto antes de persistir.
    // El total se calcula en el servidor sumando los subtotales de cada ítem —
    // nunca se acepta el total que envía el cliente para evitar manipulación de precios.
    // Tras el SaveChanges se cargan las referencias de Customer y SaleDetails+Product
    // para poder construir el DTO completo que se devuelve en el 201 Created.
    private static async Task<IResult> CreateSale(CreateSaleRequest req, ApplicationDbContext db)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == req.CustomerId))
            return TypedResults.BadRequest($"Customer {req.CustomerId} does not exist.");

        var sale = new Sale
        {
            CustomerId = req.CustomerId,
            DocumentNumber = req.DocumentNumber,
            PaymentType = req.PaymentType,
            Notes = req.Notes,
            RegistrationDate = DateTime.UtcNow
        };

        foreach (var item in req.SaleDetails)
        {
            if (!await db.Products.AnyAsync(p => p.Id == item.ProductId))
                return TypedResults.BadRequest($"Product {item.ProductId} does not exist.");

            sale.SaleDetails.Add(new SaleDetail
            {
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                Price = item.Price,
                Total = item.Price * item.Quantity
            });
        }

        sale.Total = sale.SaleDetails.Sum(sd => sd.Total);
        db.Sales.Add(sale);
        await db.SaveChangesAsync();

        await db.Entry(sale).Reference(s => s.Customer).LoadAsync();
        await db.Entry(sale).Collection(s => s.SaleDetails).Query()
            .Include(sd => sd.Product).LoadAsync();

        return TypedResults.Created($"/api/sales/{sale.Id}", ToDto(sale));
    }

    // Actualiza una venta reemplazando completamente sus ítems (delete-and-reinsert).
    // RemoveRange elimina todos los ítems existentes antes de agregar los nuevos,
    // evitando la complejidad de un diff ítem por ítem con los mismos datos del request.
    // Reutiliza CreateSaleRequest porque la estructura de creación y actualización es idéntica.
    // Recalcula el total desde los nuevos ítems antes de persistir.
    // Devuelve 404 si la venta no existe, 400 si cliente o algún producto no existen, 204 si fue exitoso.
    private static async Task<IResult> UpdateSale(int id, CreateSaleRequest req, ApplicationDbContext db)
    {
        var sale = await db.Sales.Include(s => s.SaleDetails).FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null) return TypedResults.NotFound();

        if (!await db.Customers.AnyAsync(c => c.Id == req.CustomerId))
            return TypedResults.BadRequest($"Customer {req.CustomerId} does not exist.");

        sale.DocumentNumber = req.DocumentNumber;
        sale.PaymentType = req.PaymentType;
        sale.Notes = req.Notes;
        sale.CustomerId = req.CustomerId;

        db.SaleDetails.RemoveRange(sale.SaleDetails);

        foreach (var item in req.SaleDetails)
        {
            if (!await db.Products.AnyAsync(p => p.Id == item.ProductId))
                return TypedResults.BadRequest($"Product {item.ProductId} does not exist.");

            sale.SaleDetails.Add(new SaleDetail
            {
                SaleId = sale.Id,
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                Price = item.Price,
                Total = item.Price * item.Quantity
            });
        }

        sale.Total = sale.SaleDetails.Sum(sd => sd.Total);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    // Elimina una venta y todos sus ítems.
    // RemoveRange elimina los SaleDetails explícitamente antes que la venta padre
    // para respetar la restricción de FK — EF Core no los elimina en cascada de forma automática
    // a menos que esté configurado OnDelete(Cascade) en el modelo.
    // Devuelve 404 si el Id no existe, 204 si se eliminó correctamente.
    private static async Task<IResult> DeleteSale(int id, ApplicationDbContext db)
    {
        var sale = await db.Sales.Include(s => s.SaleDetails).FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null) return TypedResults.NotFound();
        db.SaleDetails.RemoveRange(sale.SaleDetails);
        db.Sales.Remove(sale);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    // Confirma una venta: descuenta el stock de cada producto y marca la venta como confirmada.
    // La guard 409 garantiza idempotencia: si la venta ya fue confirmada no se vuelve a descontar stock.
    // Math.Max(0, stock - cantidad) evita stock negativo ante inconsistencias de datos previas.
    // Devuelve 404 si la venta no existe, 409 si ya estaba confirmada, 204 si se confirmó correctamente.
    private static async Task<IResult> ConfirmSale(int id, ApplicationDbContext db)
    {
        var sale = await db.Sales
            .Include(s => s.SaleDetails)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (sale is null) return TypedResults.NotFound();
        if (sale.IsConfirmed)
            return TypedResults.Conflict($"La venta {sale.DocumentNumber} ya fue confirmada.");

        foreach (var detail in sale.SaleDetails)
        {
            var product = await db.Products.FindAsync(detail.ProductId);
            if (product is not null)
                product.Stock = Math.Max(0, product.Stock - detail.Quantity);
        }

        sale.IsConfirmed = true;
        sale.ConfirmedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return TypedResults.NoContent();
    }

    // Helper privado que mapea la entidad Sale a SaleDto.
    // Se centraliza aquí para no repetir el mapeo en GetAllSales, GetSale, GetSalesByWeek y CreateSale.
    // El operador ?. con ?? string.Empty maneja el caso en que la navegación no cargó
    // (no ocurre en producción porque siempre se usa Include, pero evita NullReferenceException).
    private static SaleDto ToDto(Sale s) => new(
        s.Id,
        s.DocumentNumber,
        s.PaymentType,
        s.Notes,
        s.Total,
        s.RegistrationDate,
        s.CustomerId,
        s.Customer?.Name ?? string.Empty,
        s.Customer?.Phone,
        s.SaleDetails.Select(sd => new SaleDetailDto(
            sd.Id, sd.ProductId, sd.Product?.Name ?? string.Empty,
            sd.Quantity, sd.Price, sd.Total)).ToList(),
        s.IsConfirmed,
        s.ConfirmedAt
    );
}
