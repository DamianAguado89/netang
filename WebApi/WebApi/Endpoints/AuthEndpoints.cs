using Google.Apis.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;
using WebApi.Services;

namespace WebApi.Endpoints;

// Endpoints de autenticación: registro email/password, login y login con Google.
// Todos son anónimos — el JWT resultante porta el claim de rol para que
// RequireAuthorization("AdminPolicy") evalúe el acceso sin ir a la base de datos.
public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/register", Register);
        group.MapPost("/login", Login);
        group.MapPost("/google", GoogleLogin);
    }

    // Si el email coincide con SuperAdminSeed:Email, promueve al usuario al rol
    // SuperAdmin (reemplazando cualquier otro rol que tuviera). Se llama en cada
    // login/registro en lugar de una sola vez al arrancar: así el control de quién
    // es super admin vive únicamente en la configuración (no en un flag de la base
    // que alguien podría manipular vía la API de roles), y si esa cuenta llega a
    // perder el rol por algún error, se auto-repara en el siguiente login.
    private static async Task PromoteSuperAdminIfConfigured(
        ApplicationUser user, UserManager<ApplicationUser> userManager, IConfiguration config)
    {
        var superAdminEmail = config["SuperAdminSeed:Email"];
        if (superAdminEmail is null || !string.Equals(user.Email, superAdminEmail, StringComparison.OrdinalIgnoreCase))
            return;

        if (await userManager.IsInRoleAsync(user, "SuperAdmin")) return;

        var currentRoles = await userManager.GetRolesAsync(user);
        if (currentRoles.Count > 0)
            await userManager.RemoveFromRolesAsync(user, currentRoles);
        await userManager.AddToRoleAsync(user, "SuperAdmin");
    }

    // Crea cuenta nueva con rol Customer por defecto (o SuperAdmin si el email
    // coincide con SuperAdminSeed:Email — cubre el caso de que el super admin
    // decida registrarse con email/password en vez de Google).
    // Identity valida la fortaleza del password (min 8 chars, 1 dígito, 1 mayúscula).
    // Devuelve 400 con los mensajes de error de Identity si el email ya existe o el password es débil.
    // También crea el registro Customer vinculado por UserId para que /api/profile funcione de inmediato.
    private static async Task<IResult> Register(
        RegisterRequest req,
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext db,
        TokenService tokenService,
        IConfiguration config)
    {
        var user = new ApplicationUser
        {
            FullName = req.FullName,
            Email = req.Email,
            UserName = req.Email
        };

        var result = await userManager.CreateAsync(user, req.Password);
        if (!result.Succeeded)
            return TypedResults.BadRequest(result.Errors.Select(e => e.Description));

        await userManager.AddToRoleAsync(user, "Customer");
        await PromoteSuperAdminIfConfigured(user, userManager, config);

        // Crea el Customer vinculado si no existe ya uno con ese email (evita duplicados).
        if (!await db.Customers.AnyAsync(c => c.UserId == user.Id))
        {
            db.Customers.Add(new Customer
            {
                Name = req.FullName,
                Email = req.Email,
                UserId = user.Id
            });
            await db.SaveChangesAsync();
        }

        var roles = await userManager.GetRolesAsync(user);
        var role = roles.FirstOrDefault() ?? "Customer";
        var token = tokenService.GenerateToken(user, role);
        return TypedResults.Ok(new AuthResponse(token, user.Email!, user.FullName, role));
    }

    // Autentica con email y password. Usa CheckPasswordAsync en lugar de SignInManager
    // porque AddIdentityCore no registra el middleware de cookies que SignInManager requiere.
    // El 401 no distingue entre email inexistente y password incorrecto para no exponer qué
    // emails están registrados (enumeración de usuarios).
    private static async Task<IResult> Login(
        LoginRequest req,
        UserManager<ApplicationUser> userManager,
        TokenService tokenService,
        IConfiguration config)
    {
        var user = await userManager.FindByEmailAsync(req.Email);
        if (user is null || !await userManager.CheckPasswordAsync(user, req.Password))
            return TypedResults.Unauthorized();

        await PromoteSuperAdminIfConfigured(user, userManager, config);

        var roles = await userManager.GetRolesAsync(user);
        var role = roles.FirstOrDefault() ?? "Customer";
        var token = tokenService.GenerateToken(user, role);
        return TypedResults.Ok(new AuthResponse(token, user.Email!, user.FullName, role));
    }

    // Valida el ID token de Google con las claves públicas de Google (no requiere client_secret).
    // Si el email ya existe en la base de datos inicia sesión; si no, crea la cuenta automáticamente.
    // EmailConfirmed = true porque Google ya verificó el email al emitir el token.
    // El catch genérico captura cualquier falla de validación (token inválido, expirado, audience errónea).
    private static async Task<IResult> GoogleLogin(
        GoogleLoginRequest req,
        UserManager<ApplicationUser> userManager,
        IConfiguration config,
        ApplicationDbContext db,
        TokenService tokenService)
    {
        GoogleJsonWebSignature.Payload payload;
        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [config["Google:ClientId"]]
            };
            payload = await GoogleJsonWebSignature.ValidateAsync(req.Credential, settings);
        }
        catch
        {
            return TypedResults.Unauthorized();
        }

        var user = await userManager.FindByEmailAsync(payload.Email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                FullName = payload.Name,
                Email = payload.Email,
                UserName = payload.Email,
                EmailConfirmed = true
            };
            var result = await userManager.CreateAsync(user);
            if (!result.Succeeded)
                return TypedResults.BadRequest(result.Errors.Select(e => e.Description));
            await userManager.AddToRoleAsync(user, "Customer");

            // Crea el Customer vinculado para que /api/profile funcione de inmediato.
            if (!await db.Customers.AnyAsync(c => c.UserId == user.Id))
            {
                db.Customers.Add(new Customer
                {
                    Name = payload.Name,
                    Email = payload.Email,
                    UserId = user.Id
                });
                await db.SaveChangesAsync();
            }
        }

        await PromoteSuperAdminIfConfigured(user, userManager, config);

        var roles = await userManager.GetRolesAsync(user);
        var role = roles.FirstOrDefault() ?? "Customer";
        var token = tokenService.GenerateToken(user, role);
        return TypedResults.Ok(new AuthResponse(token, user.Email!, user.FullName, role));
    }
}
