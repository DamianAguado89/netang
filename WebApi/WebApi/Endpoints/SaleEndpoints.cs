using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.Models;

namespace WebApi.Endpoints;

public static class SaleEndpoints
{
    public static void MapSaleEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/sales");

        group.MapGet("/", GetAllSales);
        group.MapGet("/{id:int}", GetSale);
        group.MapPost("/", CreateSale);
        group.MapPut("/{id:int}", UpdateSale);
        group.MapDelete("/{id:int}", DeleteSale);
    }

    private static async Task<IResult> GetAllSales(ApplicationDbContext db)
    {
        var list = await db.Sales
            .Include(s => s.Customer)
            .Include(s => s.SaleDetails).ThenInclude(sd => sd.Product)
            .ToListAsync();
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> GetSale(int id, ApplicationDbContext db)
    {
        var sale = await db.Sales
            .Include(s => s.Customer)
            .Include(s => s.SaleDetails).ThenInclude(sd => sd.Product)
            .FirstOrDefaultAsync(s => s.Id == id);
        return sale is not null ? TypedResults.Ok(sale) : TypedResults.NotFound();
    }

    private static async Task<IResult> CreateSale(Sale input, ApplicationDbContext db)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == input.CustomerId))
            return TypedResults.BadRequest($"Customer {input.CustomerId} does not exist.");

        input.RegistrationDate = DateTime.UtcNow;

        if (input.SaleDetails != null && input.SaleDetails.Any())
        {
            foreach (var sd in input.SaleDetails)
            {
                if (!await db.Products.AnyAsync(p => p.Id == sd.ProductId))
                    return TypedResults.BadRequest($"Product {sd.ProductId} does not exist.");
                sd.Total = sd.Price * sd.Quantity;
            }

            input.Total = input.SaleDetails.Sum(sd => sd.Total);
        }

        db.Sales.Add(input);
        await db.SaveChangesAsync();
        return TypedResults.Created($"/api/sales/{input.Id}", input);
    }

    private static async Task<IResult> UpdateSale(int id, Sale input, ApplicationDbContext db)
    {
        var sale = await db.Sales.Include(s => s.SaleDetails).FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null) return TypedResults.NotFound();

        if (!await db.Customers.AnyAsync(c => c.Id == input.CustomerId))
            return TypedResults.BadRequest($"Customer {input.CustomerId} does not exist.");

        sale.DocumentNumber = input.DocumentNumber;
        sale.PaymentType = input.PaymentType;
        sale.CustomerId = input.CustomerId;

        if (input.SaleDetails != null)
        {
            // Replace details: remove existing, add new
            db.SaleDetails.RemoveRange(sale.SaleDetails);
            await db.SaveChangesAsync();

            foreach (var sd in input.SaleDetails)
            {
                if (!await db.Products.AnyAsync(p => p.Id == sd.ProductId))
                    return TypedResults.BadRequest($"Product {sd.ProductId} does not exist.");

                sd.Total = sd.Price * sd.Quantity;
                sd.SaleId = sale.Id;
                db.SaleDetails.Add(sd);
            }
        }

        await db.SaveChangesAsync();
        await RecalculateSaleTotal(sale.Id, db);
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

    private static async Task RecalculateSaleTotal(int saleId, ApplicationDbContext db)
    {
        var total = await db.SaleDetails.Where(sd => sd.SaleId == saleId).SumAsync(sd => (decimal?)sd.Total) ?? 0m;
        var sale = await db.Sales.FindAsync(saleId);
        if (sale is not null)
        {
            sale.Total = total;
            await db.SaveChangesAsync();
        }
    }
}