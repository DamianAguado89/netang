using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

public static class SaleEndpoints
{
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

    private static async Task<IResult> GetSale(int id, ApplicationDbContext db)
    {
        var sale = await db.Sales
            .Include(s => s.Customer)
            .Include(s => s.SaleDetails).ThenInclude(sd => sd.Product)
            .FirstOrDefaultAsync(s => s.Id == id);
        return sale is not null ? TypedResults.Ok(ToDto(sale)) : TypedResults.NotFound();
    }

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

    private static async Task<IResult> DeleteSale(int id, ApplicationDbContext db)
    {
        var sale = await db.Sales.Include(s => s.SaleDetails).FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null) return TypedResults.NotFound();
        db.SaleDetails.RemoveRange(sale.SaleDetails);
        db.Sales.Remove(sale);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

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
