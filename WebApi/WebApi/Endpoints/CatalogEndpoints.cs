using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;

namespace WebApi.Endpoints;

// Endpoints públicos del catálogo — sin autenticación, consumidos por el storefront Angular.
// Agrupa las rutas bajo /api/catalog usando el patrón de extension methods para mantener
// Program.cs limpio: cada feature tiene su propia clase estática con MapXEndpoints().
public static class CatalogEndpoints
{
    // Registra las dos rutas del catálogo en un grupo compartiendo el prefijo /api/catalog.
    // WithTags("Catalog") agrupa los endpoints bajo la misma sección en Swagger UI.
    public static void MapCatalogEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/catalog").WithTags("Catalog");

        group.MapGet("/", GetCatalog);
        group.MapGet("/{id:int}", GetCatalogProduct);
    }

    // Retorna todos los productos activos ordenados por categoría y nombre.
    // El filtro Where(p => p.IsActive) asegura que el cliente solo vea productos habilitados.
    // La proyección con Select construye el DTO directamente en SQL — EF Core nunca carga
    // la entidad completa en memoria, evitando over-fetching.
    // La URL de imagen se genera dinámicamente: si el producto tiene blob se arma la ruta
    // /api/products/{id}/image, si no tiene imagen devuelve null.
    private static async Task<IResult> GetCatalog(ApplicationDbContext db)
    {
        var products = await db.Products
            .Include(p => p.Category)
            .Where(p => p.IsActive)
            .OrderBy(p => p.Category!.Name).ThenBy(p => p.Name)
            .Select(p => new ProductDto(
                p.Id, p.Name, p.Description,
                p.ImageData != null ? $"/api/products/{p.Id}/image" : null,
                p.Price, p.ListPrice, p.MarkupPercentage,
                p.Stock, p.SoldByWeight, p.IsActive, p.CategoryId, p.Category!.Name, p.RegistrationDate))
            .ToListAsync();
        return TypedResults.Ok(products);
    }

    // Retorna un producto individual por Id, solo si está activo.
    // Combina el filtro de Id y de IsActive en una sola consulta para evitar un round-trip extra.
    // Devuelve 404 si el producto no existe o fue desactivado — el frontend lo maneja redirigiendo al catálogo.
    private static async Task<IResult> GetCatalogProduct(int id, ApplicationDbContext db)
    {
        var p = await db.Products
            .Include(p => p.Category)
            .Where(p => p.Id == id && p.IsActive)
            .FirstOrDefaultAsync();

        return p is not null
            ? TypedResults.Ok(new ProductDto(
                p.Id, p.Name, p.Description,
                p.ImageData != null ? $"/api/products/{p.Id}/image" : null,
                p.Price, p.ListPrice, p.MarkupPercentage,
                p.Stock, p.SoldByWeight, p.IsActive, p.CategoryId, p.Category!.Name, p.RegistrationDate))
            : TypedResults.NotFound();
    }
}
