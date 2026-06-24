using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

// Endpoints de administración para el CRUD completo de categorías.
// Las categorías son el clasificador raíz del catálogo: cada producto pertenece a una.
// Consumidos por el panel admin Angular; el storefront no expone categorías directamente,
// sino que las recibe embebidas en cada ProductDto del catálogo.
public static class CategoryEndpoints
{
    // Registra las cinco rutas del módulo bajo /api/categories.
    // No hay ruta de imagen porque las categorías no tienen imagen propia.
    public static void MapCategoryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/categories").WithTags("Categories").RequireAuthorization("AdminPolicy");

        group.MapGet("/", GetAllCategories);
        group.MapGet("/{id:int}", GetCategory);
        group.MapPost("/", CreateCategory);
        group.MapPut("/{id:int}", UpdateCategory);
        group.MapDelete("/{id:int}", DeleteCategory);
    }

    // Devuelve la lista completa de categorías.
    // No requiere Include porque CategoryDto no expone productos —
    // la proyección con Select es suficiente y evita cargar la colección Products en memoria.
    private static async Task<IResult> GetAllCategories(ApplicationDbContext db)
    {
        var list = await db.Categories
            .Select(c => new CategoryDto(c.Id, c.Name, c.IsActive, c.RegistrationDate))
            .ToListAsync();
        return TypedResults.Ok(list);
    }

    // Devuelve una categoría por su Id.
    // FindAsync es suficiente porque el DTO no necesita navegación a Products.
    // Devuelve 404 si el Id no existe.
    private static async Task<IResult> GetCategory(int id, ApplicationDbContext db)
    {
        var c = await db.Categories.FindAsync(id);
        return c is not null
            ? TypedResults.Ok(new CategoryDto(c.Id, c.Name, c.IsActive, c.RegistrationDate))
            : TypedResults.NotFound();
    }

    // Crea una nueva categoría.
    // Category no tiene FK hacia otras entidades, por lo que no es necesaria validación previa.
    // RegistrationDate se asigna en UTC en el servidor — nunca se acepta del cliente.
    // Devuelve 201 Created con la URL del recurso y el DTO de la categoría creada.
    private static async Task<IResult> CreateCategory(CreateCategoryRequest req, ApplicationDbContext db)
    {
        var category = new Category { Name = req.Name, IsActive = req.IsActive, RegistrationDate = DateTime.UtcNow };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return TypedResults.Created($"/api/categories/{category.Id}",
            new CategoryDto(category.Id, category.Name, category.IsActive, category.RegistrationDate));
    }

    // Actualiza el nombre y el estado activo de una categoría existente.
    // FindAsync es suficiente porque no se necesita navegar a Products para la actualización.
    // Devuelve 404 si el Id no existe, 204 si la actualización fue exitosa.
    private static async Task<IResult> UpdateCategory(int id, UpdateCategoryRequest req, ApplicationDbContext db)
    {
        var category = await db.Categories.FindAsync(id);
        if (category is null) return TypedResults.NotFound();

        category.Name = req.Name;
        category.IsActive = req.IsActive;
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    // Elimina una categoría solo si no tiene productos asociados.
    // Incluye Products en la consulta para verificar la restricción sin un query extra.
    // Devuelve 409 Conflict si hay productos asociados — el admin debe reasignarlos o eliminarlos primero.
    // Devuelve 404 si el Id no existe, 204 si se eliminó correctamente.
    private static async Task<IResult> DeleteCategory(int id, ApplicationDbContext db)
    {
        var category = await db.Categories.Include(c => c.Products).FirstOrDefaultAsync(c => c.Id == id);
        if (category is null) return TypedResults.NotFound();
        if (category.Products.Any()) return TypedResults.Conflict($"Category {id} has related products.");
        db.Categories.Remove(category);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }
}
