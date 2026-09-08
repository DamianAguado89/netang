using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using System.Text;
using System.Text.Json.Serialization;
using WebApi.Data;
using WebApi.Endpoints;
using WebApi.Models;
using WebApi.Services;

var builder = WebApplication.CreateBuilder(args);

// DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions =>
        {
            sqlOptions.CommandTimeout(60);
            // Reintenta automáticamente ante fallas transitorias (SQL Server aún iniciando, red inestable).
            sqlOptions.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorNumbersToAdd: null);
        }));

// JSON: ignore circular references produced by navigation properties
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);

// CORS: allow Angular dev server and future production origin
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.AddAntiforgery();

// Identity — AddIdentityCore evita registrar cookie auth que no se usa en JWT APIs.
// RequireNonAlphanumeric = false simplifica el registro sin sacrificar seguridad real.
builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 8;
})
.AddRoles<IdentityRole>()
.AddEntityFrameworkStores<ApplicationDbContext>();

// JWT Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

// AdminPolicy acepta "Admin" o "SuperAdmin" — el super admin puede hacer todo lo que
// un admin puede, además de administrar roles. SuperAdminPolicy es más estricta:
// solo para /api/users (ver UserEndpoints), donde se otorga/revoca el rol Admin.
// Ambas se evalúan desde el claim del JWT, sin consultar la base.
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminPolicy", policy => policy.RequireRole("Admin", "SuperAdmin"));
    options.AddPolicy("SuperAdminPolicy", policy => policy.RequireRole("SuperAdmin"));
});

builder.Services.AddScoped<TokenService>();

// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Doña Pierina API", Version = "v1" });

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
        c.IncludeXmlComments(xmlPath);
});

var app = builder.Build();

// Seed: roles Admin/Customer y usuario admin inicial si no existen.
// Solo se ejecuta si AdminSeed:Email está configurado (evita fallar en CI sin config).
using (var scope = app.Services.CreateScope())
{
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

    foreach (var role in new[] { "Admin", "Customer", "SuperAdmin" })
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));

    var adminEmail = app.Configuration["AdminSeed:Email"];
    var adminPassword = app.Configuration["AdminSeed:Password"];
    if (adminEmail is not null && await userManager.FindByEmailAsync(adminEmail) is null)
    {
        var admin = new ApplicationUser
        {
            FullName = "Admin",
            Email = adminEmail,
            UserName = adminEmail,
            EmailConfirmed = true
        };
        await userManager.CreateAsync(admin, adminPassword!);
        await userManager.AddToRoleAsync(admin, "Admin");
    }
}

app.UseCors("AllowAngular");

// UseAuthentication y UseAuthorization deben ir después de UseCors y antes de los endpoints.
app.UseAuthentication();
app.UseAuthorization();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Doña Pierina API v1");
    c.RoutePrefix = "swagger";
});

// Auth (público)
app.MapAuthEndpoints();

// Perfil del usuario autenticado (requiere JWT, cualquier rol)
app.MapProfileEndpoints();

// Admin endpoints (protegidos con AdminPolicy en cada grupo)
app.MapCategoryEndpoints();
app.MapProductEndpoints();
app.MapCustomerEndpoints();
app.MapSaleEndpoints();
app.MapSaleDetailEndpoints();

// Administración de usuarios y roles (protegido con SuperAdminPolicy)
app.MapUserEndpoints();

// Public endpoints (storefront)
app.MapCatalogEndpoints();
app.MapOrderEndpoints();

app.MapGet("/", () => "Doña Pierina API");

app.Run();
