using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.Models;

namespace WebApi.Endpoints;

public static class ProductEndpoints
{
    public static void MapProductEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/products");

        group.MapGet("/", GetAllProducts);
        group.MapGet("/{id:int}", GetProduct);
        group.MapPost("/", CreateProduct);
        group.MapPut("/{id:int}", UpdateProduct);
        group.MapDelete("/{id:int}", DeleteProduct);
    }

    private static async Task<IResult> GetAllProducts(ApplicationDbContext db)
    {
        var list = await db.Products.Include(p => p.Category).ToListAsync();
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> GetProduct(int id, ApplicationDbContext db)
    {
        var product = await db.Products.Include(p => p.Category).FirstOrDefaultAsync(p => p.Id == id);
        return product is not null ? TypedResults.Ok(product) : TypedResults.NotFound();
    }

    private static async Task<IResult> CreateProduct(Product input, ApplicationDbContext db)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId))
            return TypedResults.BadRequest($"Category {input.CategoryId} does not exist.");

        input.RegistrationDate = DateTime.UtcNow;
        db.Products.Add(input);
        await db.SaveChangesAsync();
        return TypedResults.Created($"/api/products/{input.Id}", input);
    }

    private static async Task<IResult> UpdateProduct(int id, Product input, ApplicationDbContext db)
    {
        var product = await db.Products.FindAsync(id);
        if (product is null) return TypedResults.NotFound();

        if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId))
            return TypedResults.BadRequest($"Category {input.CategoryId} does not exist.");

        product.Name = input.Name;
        product.Stock = input.Stock;
        product.Price = input.Price;
        product.IsActive = input.IsActive;
        product.CategoryId = input.CategoryId;

        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    private static async Task<IResult> DeleteProduct(int id, ApplicationDbContext db)
    {
        var product = await db.Products.Include(p => p.SaleDetails).FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return TypedResults.NotFound();
        if (product.SaleDetails.Any()) return TypedResults.Conflict($"Product {id} has sale details and cannot be deleted.");
        db.Products.Remove(product);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }
}