using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

// Endpoints de administración para el CRUD completo de productos.
// Consumidos por el panel admin Angular — cubren la gestión de nombre, descripción,
// precio, stock, categoría e imagen. La imagen tiene rutas propias para desacoplar
// la transferencia de blob (multipart) del resto del CRUD (JSON).
public static class ProductEndpoints
{
    // Registra las siete rutas del módulo bajo /api/products.
    // DisableAntiforgery() solo se aplica al upload de imagen porque IFormFile requiere
    // multipart/form-data, que no puede incluir el token antifalsificación estándar.
    public static void MapProductEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/products").WithTags("Products");

        group.MapGet("/", GetAllProducts);
        group.MapGet("/{id:int}", GetProduct);
        group.MapGet("/{id:int}/image", GetProductImage);
        group.MapPost("/", CreateProduct);
        group.MapPost("/{id:int}/image", UploadProductImage).DisableAntiforgery();
        group.MapPut("/{id:int}", UpdateProduct);
        group.MapDelete("/{id:int}", DeleteProduct);
    }

    // Devuelve la lista completa de productos con su categoría incluida.
    // La proyección con Select construye el DTO directamente en SQL — EF Core nunca carga
    // la entidad completa en memoria, evitando over-fetching.
    // La URL de imagen se genera dinámicamente: si existe blob devuelve /api/products/{id}/image,
    // de lo contrario devuelve null. El frontend usa null para mostrar un placeholder.
    private static async Task<IResult> GetAllProducts(ApplicationDbContext db)
    {
        var list = await db.Products
            .Include(p => p.Category)
            .Select(p => new ProductDto(
                p.Id, p.Name, p.Description,
                p.ImageData != null ? $"/api/products/{p.Id}/image" : null,
                p.Price, p.Stock, p.IsActive, p.CategoryId, p.Category!.Name, p.RegistrationDate))
            .ToListAsync();
        return TypedResults.Ok(list);
    }

    // Devuelve un producto por su Id incluyendo la información de categoría.
    // Usa FirstOrDefaultAsync con Include porque FindAsync no soporta Include —
    // se necesita la categoría para construir el DTO completo.
    // Devuelve 404 si el Id no existe.
    private static async Task<IResult> GetProduct(int id, ApplicationDbContext db)
    {
        var p = await db.Products.Include(p => p.Category).FirstOrDefaultAsync(p => p.Id == id);
        return p is not null
            ? TypedResults.Ok(new ProductDto(
                p.Id, p.Name, p.Description,
                p.ImageData != null ? $"/api/products/{p.Id}/image" : null,
                p.Price, p.Stock, p.IsActive, p.CategoryId, p.Category!.Name, p.RegistrationDate))
            : TypedResults.NotFound();
    }

    // Sirve el blob de imagen almacenado en la columna varbinary(max) del producto.
    // FindAsync es suficiente aquí porque no se necesita la categoría, solo los campos de imagen.
    // El ContentType se guardó en la subida; si falta se asume image/jpeg como fallback.
    // Devuelve 404 si el producto no existe o si todavía no tiene imagen asignada.
    private static async Task<IResult> GetProductImage(int id, ApplicationDbContext db)
    {
        var product = await db.Products.FindAsync(id);
        if (product is null || product.ImageData is null)
            return TypedResults.NotFound();
        return TypedResults.File(product.ImageData, product.ImageContentType ?? "image/jpeg");
    }

    // Reemplaza o asigna la imagen de un producto leyendo el archivo del form-data.
    // El MemoryStream lee todos los bytes antes de asignarlos para evitar leer el stream en partes.
    // El ContentType se toma del archivo subido para que el GET de imagen responda con el header correcto.
    // Devuelve 404 si el producto no existe, 204 si la imagen se guardó correctamente.
    private static async Task<IResult> UploadProductImage(int id, IFormFile image, ApplicationDbContext db)
    {
        var product = await db.Products.FindAsync(id);
        if (product is null) return TypedResults.NotFound();

        using var ms = new MemoryStream();
        await image.CopyToAsync(ms);
        product.ImageData = ms.ToArray();
        product.ImageContentType = image.ContentType;
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    // Crea un nuevo producto validando primero que la categoría exista.
    // AnyAsync evita una inserción con FK inválida que generaría una excepción de base de datos.
    // RegistrationDate se asigna en UTC en el servidor — nunca se acepta del cliente.
    // Después del SaveChanges se carga la referencia de categoría para incluir CategoryName en la respuesta.
    // Devuelve 400 si la categoría no existe, 201 Created con la URL del recurso y el DTO completo.
    private static async Task<IResult> CreateProduct(CreateProductRequest req, ApplicationDbContext db)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == req.CategoryId))
            return TypedResults.BadRequest($"Category {req.CategoryId} does not exist.");

        var product = new Product
        {
            Name = req.Name,
            Description = req.Description,
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
            new ProductDto(product.Id, product.Name, product.Description,
                product.ImageData != null ? $"/api/products/{product.Id}/image" : null,
                product.Price, product.Stock, product.IsActive, product.CategoryId,
                product.Category!.Name, product.RegistrationDate));
    }

    // Actualiza los datos de un producto existente.
    // Valida que la nueva categoría exista antes de persistir para evitar FK inválida.
    // No toca ImageData ni RegistrationDate — la imagen tiene su propio endpoint y la fecha es inmutable.
    // Devuelve 404 si el producto no existe, 400 si la categoría no existe, 204 si la actualización fue exitosa.
    private static async Task<IResult> UpdateProduct(int id, UpdateProductRequest req, ApplicationDbContext db)
    {
        var product = await db.Products.FindAsync(id);
        if (product is null) return TypedResults.NotFound();

        if (!await db.Categories.AnyAsync(c => c.Id == req.CategoryId))
            return TypedResults.BadRequest($"Category {req.CategoryId} does not exist.");

        product.Name = req.Name;
        product.Description = req.Description;
        product.Price = req.Price;
        product.Stock = req.Stock;
        product.IsActive = req.IsActive;
        product.CategoryId = req.CategoryId;

        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    // Elimina un producto solo si no tiene detalles de venta asociados.
    // Incluye SaleDetails en la consulta para verificar la restricción sin un query extra.
    // Devuelve 409 Conflict si hay ventas asociadas — el admin debe desactivar el producto
    // (IsActive = false) en lugar de borrarlo para preservar la integridad histórica de las ventas.
    // Devuelve 404 si el Id no existe, 204 si se eliminó correctamente.
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
