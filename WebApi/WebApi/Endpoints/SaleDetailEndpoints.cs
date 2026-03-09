using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.Models;

namespace WebApi.Endpoints;

public static class SaleDetailEndpoints
{
    public static void MapSaleDetailEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/saledetails");

        group.MapGet("/", GetAllDetails);
        group.MapGet("/{id:int}", GetDetail);
        group.MapPost("/", CreateDetail);
        group.MapPut("/{id:int}", UpdateDetail);
        group.MapDelete("/{id:int}", DeleteDetail);
    }

    private static async Task<IResult> GetAllDetails(ApplicationDbContext db)
    {
        var list = await db.SaleDetails.Include(sd => sd.Product).Include(sd => sd.Sale).ToListAsync();
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> GetDetail(int id, ApplicationDbContext db)
    {
        var detail = await db.SaleDetails.Include(sd => sd.Product).Include(sd => sd.Sale).FirstOrDefaultAsync(sd => sd.Id == id);
        return detail is not null ? TypedResults.Ok(detail) : TypedResults.NotFound();
    }

    private static async Task<IResult> CreateDetail(SaleDetail input, ApplicationDbContext db)
    {
        if (!await db.Sales.AnyAsync(s => s.Id == input.SaleId))
            return TypedResults.BadRequest($"Sale {input.SaleId} does not exist.");
        if (!await db.Products.AnyAsync(p => p.Id == input.ProductId))
            return TypedResults.BadRequest($"Product {input.ProductId} does not exist.");

        input.Total = input.Price * input.Quantity;
        db.SaleDetails.Add(input);
        await db.SaveChangesAsync();

        await RecalculateSaleTotal(input.SaleId, db);
        return TypedResults.Created($"/api/saledetails/{input.Id}", input);
    }

    private static async Task<IResult> UpdateDetail(int id, SaleDetail input, ApplicationDbContext db)
    {
        var detail = await db.SaleDetails.FindAsync(id);
        if (detail is null) return TypedResults.NotFound();

        if (!await db.Sales.AnyAsync(s => s.Id == input.SaleId))
            return TypedResults.BadRequest($"Sale {input.SaleId} does not exist.");
        if (!await db.Products.AnyAsync(p => p.Id == input.ProductId))
            return TypedResults.BadRequest($"Product {input.ProductId} does not exist.");

        detail.SaleId = input.SaleId;
        detail.ProductId = input.ProductId;
        detail.Quantity = input.Quantity;
        detail.Price = input.Price;
        detail.Total = input.Price * input.Quantity;

        await db.SaveChangesAsync();
        await RecalculateSaleTotal(detail.SaleId, db);
        return TypedResults.NoContent();
    }

    private static async Task<IResult> DeleteDetail(int id, ApplicationDbContext db)
    {
        var detail = await db.SaleDetails.FindAsync(id);
        if (detail is null) return TypedResults.NotFound();

        var saleId = detail.SaleId;
        db.SaleDetails.Remove(detail);
        await db.SaveChangesAsync();
        await RecalculateSaleTotal(saleId, db);
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