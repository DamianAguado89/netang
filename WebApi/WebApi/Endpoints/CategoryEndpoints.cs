using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.Models;

namespace WebApi.Endpoints;

public static class CategoryEndpoints
{
    public static void MapCategoryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/categories");

        group.MapGet("/", GetAllCategories);
        group.MapGet("/{id:int}", GetCategory);
        group.MapPost("/", CreateCategory);
        group.MapPut("/{id:int}", UpdateCategory);
        group.MapDelete("/{id:int}", DeleteCategory);
    }

    private static async Task<IResult> GetAllCategories(ApplicationDbContext db)
    {
        var list = await db.Categories.Include(c => c.Products).ToListAsync();
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> GetCategory(int id, ApplicationDbContext db)
    {
        var category = await db.Categories.Include(c => c.Products).FirstOrDefaultAsync(c => c.Id == id);
        return category is not null ? TypedResults.Ok(category) : TypedResults.NotFound();
    }

    private static async Task<IResult> CreateCategory(Category input, ApplicationDbContext db)
    {
        input.RegistrationDate = DateTime.UtcNow;
        db.Categories.Add(input);
        await db.SaveChangesAsync();
        return TypedResults.Created($"/api/categories/{input.Id}", input);
    }

    private static async Task<IResult> UpdateCategory(int id, Category input, ApplicationDbContext db)
    {
        var category = await db.Categories.FindAsync(id);
        if (category is null) return TypedResults.NotFound();

        category.Name = input.Name;
        category.IsActive = input.IsActive;
        // preserve original RegistrationDate
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