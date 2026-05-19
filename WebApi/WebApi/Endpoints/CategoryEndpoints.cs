using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

public static class CategoryEndpoints
{
    public static void MapCategoryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/categories").WithTags("Categories");

        group.MapGet("/", GetAllCategories);
        group.MapGet("/{id:int}", GetCategory);
        group.MapPost("/", CreateCategory);
        group.MapPut("/{id:int}", UpdateCategory);
        group.MapDelete("/{id:int}", DeleteCategory);
    }

    private static async Task<IResult> GetAllCategories(ApplicationDbContext db)
    {
        var list = await db.Categories
            .Select(c => new CategoryDto(c.Id, c.Name, c.IsActive, c.RegistrationDate))
            .ToListAsync();
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> GetCategory(int id, ApplicationDbContext db)
    {
        var c = await db.Categories.FindAsync(id);
        return c is not null
            ? TypedResults.Ok(new CategoryDto(c.Id, c.Name, c.IsActive, c.RegistrationDate))
            : TypedResults.NotFound();
    }

    private static async Task<IResult> CreateCategory(CreateCategoryRequest req, ApplicationDbContext db)
    {
        var category = new Category { Name = req.Name, IsActive = req.IsActive, RegistrationDate = DateTime.UtcNow };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return TypedResults.Created($"/api/categories/{category.Id}",
            new CategoryDto(category.Id, category.Name, category.IsActive, category.RegistrationDate));
    }

    private static async Task<IResult> UpdateCategory(int id, UpdateCategoryRequest req, ApplicationDbContext db)
    {
        var category = await db.Categories.FindAsync(id);
        if (category is null) return TypedResults.NotFound();

        category.Name = req.Name;
        category.IsActive = req.IsActive;
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

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
