using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

// Endpoints del perfil del usuario autenticado.
// Todas las rutas requieren JWT válido; el UserId se extrae del claim sub del token.
// El Customer vinculado al usuario se busca por UserId, no por Id numérico,
// para que el usuario no pueda editar el perfil de otro Customer cambiando un parámetro de ruta.
public static class ProfileEndpoints
{
    public static void MapProfileEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/profile").WithTags("Profile").RequireAuthorization();

        group.MapGet("/", GetProfile);
        group.MapPut("/", UpdateProfile);
        group.MapPost("/image", UploadProfileImage).DisableAntiforgery();
    }

    // Devuelve el Customer vinculado al usuario autenticado.
    // 404 si el usuario registrado no tiene aún un Customer asociado (admin sin perfil de cliente).
    private static async Task<IResult> GetProfile(ClaimsPrincipal claims, ApplicationDbContext db)
    {
        var userId = claims.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return TypedResults.Unauthorized();

        var c = await db.Customers.FirstOrDefaultAsync(c => c.UserId == userId);
        if (c is null) return TypedResults.NotFound();

        return TypedResults.Ok(new CustomerDto(
            c.Id, c.Name, c.Email, c.Phone, c.Address, c.BirthDate,
            c.ImageData != null ? $"/api/customers/{c.Id}/image" : null));
    }

    // Actualiza nombre, teléfono y dirección del perfil propio.
    // Email no se edita aquí porque está ligado a la cuenta de Identity.
    private static async Task<IResult> UpdateProfile(
        UpdateProfileRequest req,
        ClaimsPrincipal claims,
        ApplicationDbContext db)
    {
        var userId = claims.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return TypedResults.Unauthorized();

        var c = await db.Customers.FirstOrDefaultAsync(c => c.UserId == userId);
        if (c is null) return TypedResults.NotFound();

        c.Name = req.Name;
        c.Phone = req.Phone;
        c.Address = req.Address;

        await db.SaveChangesAsync();

        return TypedResults.Ok(new CustomerDto(
            c.Id, c.Name, c.Email, c.Phone, c.Address, c.BirthDate,
            c.ImageData != null ? $"/api/customers/{c.Id}/image" : null));
    }

    // Sube o reemplaza el avatar del usuario autenticado.
    // DisableAntiforgery es necesario porque IFormFile usa multipart/form-data.
    private static async Task<IResult> UploadProfileImage(
        IFormFile image,
        ClaimsPrincipal claims,
        ApplicationDbContext db)
    {
        var userId = claims.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return TypedResults.Unauthorized();

        var c = await db.Customers.FirstOrDefaultAsync(c => c.UserId == userId);
        if (c is null) return TypedResults.NotFound();

        using var ms = new MemoryStream();
        await image.CopyToAsync(ms);
        c.ImageData = ms.ToArray();
        c.ImageContentType = image.ContentType;

        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }
}
