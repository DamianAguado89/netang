using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

public static class ProductEndpoints
{
    public static void MapProductEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/products").WithTags("Products");

        group.MapGet("/", GetAllProducts);
        group.MapGet("/{id:int}", GetProduct);
        group.MapPost("/", CreateProduct);
        group.MapPut("/{id:int}", UpdateProduct);
        group.MapDelete("/{id:int}", DeleteProduct);
    }

    private static async Task<IResult> GetAllProducts(ApplicationDbContext db)
    {
        var list = await db.Products
            .Include(p => p.Category)
            .Select(p => new ProductDto(
                p.Id, p.Name, p.Description, p.ImageUrl, p.Price, p.Stock,
                p.IsActive, p.CategoryId, p.Category!.Name, p.RegistrationDate))
            .ToListAsync();
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> GetProduct(int id, ApplicationDbContext db)
    {
        var p = await db.Products.Include(p => p.Category).FirstOrDefaultAsync(p => p.Id == id);
        return p is not null
            ? TypedResults.Ok(new ProductDto(
                p.Id, p.Name, p.Description, p.ImageUrl, p.Price, p.Stock,
                p.IsActive, p.CategoryId, p.Category!.Name, p.RegistrationDate))
            : TypedResults.NotFound();
    }

    private static async Task<IResult> CreateProduct(CreateProductRequest req, ApplicationDbContext db)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == req.CategoryId))
            return TypedResults.BadRequest($"Category {req.CategoryId} does not exist.");

        var product = new Product
        {
            Name = req.Name,
            Description = req.Description,
            ImageUrl = req.ImageUrl,
            Price = req.Price,
            Stock = req.Stock,
            IsActive = req.IsActive,
            CategoryId = req.CategoryId,
            RegistrationDate = DateTime.UtcNow
        };
        db.Products.Add(product);
        await db.SaveChangesAsync();

        await db.Entry(product).Reference(p => p.Category).LoadAsync();
        return TypedResults.Created($"/api/products/{product.Id}",
            new ProductDto(product.Id, product.Name, product.Description, product.ImageUrl,
                product.Price, product.Stock, product.IsActive, product.CategoryId,
                product.Category!.Name, product.RegistrationDate));
    }

    private static async Task<IResult> UpdateProduct(int id, UpdateProductRequest req, ApplicationDbContext db)
    {
        var product = await db.Products.FindAsync(id);
        if (product is null) return TypedResults.NotFound();

        if (!await db.Categories.AnyAsync(c => c.Id == req.CategoryId))
            return TypedResults.BadRequest($"Category {req.CategoryId} does not exist.");

        product.Name = req.Name;
        product.Description = req.Description;
        product.ImageUrl = req.ImageUrl;
        product.Price = req.Price;
        product.Stock = req.Stock;
        product.IsActive = req.IsActive;
        product.CategoryId = req.CategoryId;

        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    private static async Task<IResult> DeleteProduct(int id, ApplicationDbContext db)
    {
        var product = await db.Products.Include(p => p.SaleDetails).FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return TypedResults.NotFound();
        if (product.SaleDetails.Any())
            return TypedResults.Conflict($"Product {id} has sale details and cannot be deleted.");
        db.Products.Remove(product);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }
}
