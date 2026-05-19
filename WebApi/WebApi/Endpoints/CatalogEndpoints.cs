using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;

namespace WebApi.Endpoints;

// Public read-only catalog — no auth required, used by the Angular storefront
public static class CatalogEndpoints
{
    public static void MapCatalogEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/catalog").WithTags("Catalog");

        group.MapGet("/", GetCatalog);
        group.MapGet("/{id:int}", GetCatalogProduct);
    }

    private static async Task<IResult> GetCatalog(ApplicationDbContext db)
    {
        var products = await db.Products
            .Include(p => p.Category)
            .Where(p => p.IsActive)
            .OrderBy(p => p.Category!.Name).ThenBy(p => p.Name)
            .Select(p => new ProductDto(
                p.Id, p.Name, p.Description, p.ImageUrl, p.Price, p.Stock,
                p.IsActive, p.CategoryId, p.Category!.Name, p.RegistrationDate))
            .ToListAsync();
        return TypedResults.Ok(products);
    }

    private static async Task<IResult> GetCatalogProduct(int id, ApplicationDbContext db)
    {
        var p = await db.Products
            .Include(p => p.Category)
            .Where(p => p.Id == id && p.IsActive)
            .FirstOrDefaultAsync();

        return p is not null
            ? TypedResults.Ok(new ProductDto(
                p.Id, p.Name, p.Description, p.ImageUrl, p.Price, p.Stock,
                p.IsActive, p.CategoryId, p.Category!.Name, p.RegistrationDate))
            : TypedResults.NotFound();
    }
}
