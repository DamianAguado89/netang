using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

// Endpoints de administración de usuarios y roles — exclusivos del rol SuperAdmin.
// Permiten ver todas las cuentas registradas y otorgar/revocar el rol Admin sin
// tocar la base de datos a mano. El rol SuperAdmin nunca se asigna acá: se controla
// únicamente por el email configurado en SuperAdminSeed (ver AuthEndpoints), para
// que no se pueda crear un segundo super admin por accidente ni por API.
public static class UserEndpoints
{
    public static void MapUserEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/users").WithTags("Users").RequireAuthorization("SuperAdminPolicy");

        group.MapGet("/", GetAllUsers);
        group.MapPut("/{id}/role", UpdateUserRole);
    }

    // Lista todas las cuentas registradas (clientes, admins y el super admin) con su rol actual.
    // GetRolesAsync hace un round-trip por usuario porque Identity no expone una forma directa
    // de traer roles en lote — aceptable acá porque la cantidad de cuentas registradas es chica.
    private static async Task<IResult> GetAllUsers(UserManager<ApplicationUser> userManager)
    {
        var users = userManager.Users.OrderBy(u => u.FullName).ToList();

        var result = new List<UserDto>();
        foreach (var u in users)
        {
            var roles = await userManager.GetRolesAsync(u);
            result.Add(new UserDto(u.Id, u.Email!, u.FullName, roles.FirstOrDefault() ?? "Customer"));
        }

        return TypedResults.Ok(result);
    }

    // Otorga o revoca el rol Admin de un usuario. Solo acepta "Admin" o "Customer":
    // el rol SuperAdmin está reservado al email de SuperAdminSeed y nunca se asigna
    // por acá — ni siquiera el propio super admin puede cambiarse el rol a sí mismo
    // (y aunque pudiera, el próximo login lo repromueve automáticamente).
    private static async Task<IResult> UpdateUserRole(
        string id,
        UpdateUserRoleRequest req,
        ClaimsPrincipal claims,
        UserManager<ApplicationUser> userManager)
    {
        if (req.Role != "Admin" && req.Role != "Customer")
            return TypedResults.BadRequest("El rol debe ser \"Admin\" o \"Customer\".");

        var callerId = claims.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id == callerId)
            return TypedResults.BadRequest("No podés cambiar tu propio rol.");

        var user = await userManager.FindByIdAsync(id);
        if (user is null) return TypedResults.NotFound();

        if (await userManager.IsInRoleAsync(user, "SuperAdmin"))
            return TypedResults.BadRequest("No se puede cambiar el rol del super admin.");

        var currentRoles = await userManager.GetRolesAsync(user);
        if (currentRoles.Count > 0)
            await userManager.RemoveFromRolesAsync(user, currentRoles);
        await userManager.AddToRoleAsync(user, req.Role);

        return TypedResults.Ok(new UserDto(user.Id, user.Email!, user.FullName, req.Role));
    }
}
