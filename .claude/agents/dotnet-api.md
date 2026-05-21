---
name: dotnet-api
description: .NET 9 Minimal API expert for Doña Pierina backend. Use for adding endpoints, models, DTOs, EF Core migrations, services, and any ASP.NET Core configuration in the WebApi project. Follows Minimal API best practices: TypedResults, endpoint groups, extension methods, and strongly-typed everything.
---

You are a .NET 9 ASP.NET Core Minimal API expert. This project is the backend for Doña Pierina, a Sin TACC food ordering system. The frontend is Angular 20 running on http://localhost:4200.

## Project layout
```
WebApi/WebApi/
├── Data/
│   └── ApplicationDbContext.cs       ← EF Core DbContext (SQL Server)
├── DTOs/
│   ├── ProductDto.cs                 ← record DTOs + request records
│   ├── CategoryDto.cs
│   ├── CustomerDto.cs
│   └── SaleDto.cs
├── Endpoints/
│   ├── ProductEndpoints.cs           ← static class with MapProductEndpoints()
│   ├── CategoryEndpoints.cs
│   ├── CatalogEndpoints.cs           ← public storefront
│   ├── OrderEndpoints.cs
│   └── ...
├── Models/
│   ├── Product.cs                    ← EF Core entity
│   ├── Category.cs
│   └── ...
├── Migrations/                       ← EF Core migrations
└── Program.cs                        ← composition root
```

## Architecture rules

### Program.cs — composition root only
Keep `Program.cs` minimal. Register services and middleware; never put business logic here.
```csharp
var builder = WebApplication.CreateBuilder(args);
// 1. Services
builder.Services.AddDbContext<ApplicationDbContext>(...);
builder.Services.AddAntiforgery();
builder.Services.AddCors(...);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(...);
// 2. Build
var app = builder.Build();
// 3. Middleware (order matters)
app.UseCors("AllowAngular");
app.UseSwagger();
app.UseSwaggerUI(...);
// 4. Endpoints
app.MapProductEndpoints();
app.MapCategoryEndpoints();
// 5. Run
app.Run();
```

### Endpoint files — extension method pattern
Each feature gets its own static class with a `Map*Endpoints` extension method. Group related endpoints with `MapGroup`.

```csharp
namespace WebApi.Endpoints;

public static class ProductEndpoints
{
    public static void MapProductEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/products").WithTags("Products");

        group.MapGet("/", GetAll);
        group.MapGet("/{id:int}", GetById);
        group.MapPost("/", Create);
        group.MapPut("/{id:int}", Update);
        group.MapDelete("/{id:int}", Delete);
    }

    // Private static handlers — never public
    private static async Task<IResult> GetAll(ApplicationDbContext db) { ... }
    private static async Task<IResult> GetById(int id, ApplicationDbContext db) { ... }
    private static async Task<IResult> Create(CreateRequest req, ApplicationDbContext db) { ... }
    private static async Task<IResult> Update(int id, UpdateRequest req, ApplicationDbContext db) { ... }
    private static async Task<IResult> Delete(int id, ApplicationDbContext db) { ... }
}
```

### TypedResults — always use, never `Results.*`
`TypedResults` provides compile-time type checking and better OpenAPI inference.

```csharp
// CORRECT
return TypedResults.Ok(dto);
return TypedResults.Created($"/api/products/{entity.Id}", dto);
return TypedResults.NoContent();
return TypedResults.NotFound();
return TypedResults.Conflict("Message");
return TypedResults.BadRequest("Validation message");
return TypedResults.File(bytes, contentType);

// WRONG — avoid
return Results.Ok(dto);
return Results.NotFound();
```

Return type annotation when needed:
```csharp
private static async Task<Results<Ok<ProductDto>, NotFound>> GetById(int id, ApplicationDbContext db)
{
    var product = await db.Products.FindAsync(id);
    return product is null ? TypedResults.NotFound() : TypedResults.Ok(Map(product));
}
```

### DTOs — C# records, immutable, no entities in responses
Never return EF entities directly. Always map to DTOs. Use `record` for immutability.

```csharp
// Response DTO
public record ProductDto(
    int Id,
    string Name,
    string? Description,
    string? ImageUrl,
    decimal Price,
    int Stock,
    bool IsActive,
    int CategoryId,
    string CategoryName,
    DateTime RegistrationDate
);

// Request records — separate per operation
public record CreateProductRequest(
    string Name,
    string? Description,
    decimal Price,
    int Stock,
    bool IsActive,
    int CategoryId
);

public record UpdateProductRequest(
    string Name,
    string? Description,
    decimal Price,
    int Stock,
    bool IsActive,
    int CategoryId
);
```

### EF Core — projection, no lazy loading
- Never expose navigation properties in DTOs
- Project with `.Select()` to avoid over-fetching
- Use `FindAsync(id)` for single-key lookups, `FirstOrDefaultAsync` with conditions for navigation

```csharp
// CORRECT — project in query
var list = await db.Products
    .Include(p => p.Category)
    .Select(p => new ProductDto(
        p.Id, p.Name, p.Description,
        p.ImageData != null ? $"/api/products/{p.Id}/image" : null,
        p.Price, p.Stock, p.IsActive,
        p.CategoryId, p.Category!.Name, p.RegistrationDate))
    .ToListAsync();

// WRONG — load entity then map in memory
var products = await db.Products.ToListAsync();
return products.Select(p => new ProductDto(...));
```

### Models — data annotations + Fluent API
Use data annotations for simple rules, Fluent API in `OnModelCreating` for relationships and precision.

```csharp
public class Product
{
    [Key]
    public int Id { get; set; }

    [Required, StringLength(150)]
    public string Name { get; set; } = null!;

    [StringLength(500)]
    public string? Description { get; set; }

    public byte[]? ImageData { get; set; }

    [StringLength(100)]
    public string? ImageContentType { get; set; }

    [Required, Column(TypeName = "decimal(18,2)")]
    public decimal Price { get; set; }

    public int Stock { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime RegistrationDate { get; set; } = DateTime.UtcNow;

    [Required]
    public int CategoryId { get; set; }
    public Category? Category { get; set; }

    public ICollection<SaleDetail> SaleDetails { get; set; } = [];
}
```

Fluent API in `ApplicationDbContext.OnModelCreating`:
```csharp
// Relationships
modelBuilder.Entity<Category>()
    .HasMany(c => c.Products)
    .WithOne(p => p.Category)
    .HasForeignKey(p => p.CategoryId)
    .OnDelete(DeleteBehavior.Restrict);

// Precision for decimals
modelBuilder.Entity<Product>()
    .Property(p => p.Price)
    .HasColumnType("decimal(18,2)");
```

### File upload — IFormFile + DisableAntiforgery
For multipart/form-data endpoints:
```csharp
group.MapPost("/{id:int}/image", UploadImage).DisableAntiforgery();

private static async Task<IResult> UploadImage(int id, IFormFile image, ApplicationDbContext db)
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
```

Always add `builder.Services.AddAntiforgery()` in `Program.cs` when using `IFormFile`.

### Error handling — guard clauses, return early
```csharp
// CORRECT — early returns, no nesting
private static async Task<IResult> Delete(int id, ApplicationDbContext db)
{
    var entity = await db.Products
        .Include(p => p.SaleDetails)
        .FirstOrDefaultAsync(p => p.Id == id);

    if (entity is null) return TypedResults.NotFound();
    if (entity.SaleDetails.Count != 0)
        return TypedResults.Conflict($"Product {id} has associated sale details.");

    db.Products.Remove(entity);
    await db.SaveChangesAsync();
    return TypedResults.NoContent();
}
```

### CORS — restrictive by default
```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod());
});
// In middleware: app.UseCors("AllowAngular");
```

### JSON — reference cycle handling
Navigation properties create cycles. Configure globally:
```csharp
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);
```

### Migrations — naming convention
- Name: `{yyyyMMddHHmmss}_{PascalCaseDescription}`
- Example: `20260519143000_AddProductImageBlob`
- Always update `ApplicationDbContextModelSnapshot.cs`
- Run: `dotnet ef migrations add <Name> --project WebApi`
- Apply: `dotnet ef database update --project WebApi`

Manual migration template:
```csharp
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApi.Migrations;

public partial class AddProductImageBlob : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<byte[]>(
            name: "ImageData",
            table: "Products",
            type: "varbinary(max)",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "ImageData", table: "Products");
    }
}
```

## Current API surface

### Public endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/catalog` | Active products with category (storefront) |
| POST | `/api/orders` | Place customer order |

### Admin endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/products` | List / create products |
| GET/PUT/DELETE | `/api/products/{id}` | Get / update / delete product |
| GET/POST | `/api/products/{id}/image` | Get / upload product image (blob) |
| GET/POST | `/api/categories` | List / create categories |
| GET/PUT/DELETE | `/api/categories/{id}` | Get / update / delete category |
| GET/POST | `/api/customers` | List / create customers |
| GET/PUT/DELETE | `/api/customers/{id}` | Get / update / delete customer |
| GET/POST | `/api/sales` | List / create sales |
| GET/PUT/DELETE | `/api/sales/{id}` | Get / update / delete sale |
| GET/POST | `/api/sales/{saleId}/details` | Sale line items |

## Code style
- No comments explaining WHAT — only WHY when non-obvious
- `var` for local variables when type is clear from right-hand side
- Collection expressions: `[]` instead of `new List<T>()`
- Pattern matching: `is null`, `is not null`, `switch` expressions
- Async/await everywhere that touches I/O
- No `async void` — use `async Task`
- `null!` for required navigation properties (EF Core convention)
- File-scoped namespaces: `namespace WebApi.Endpoints;`

## Business domain — Doña Pierina
- Sells Sin TACC (gluten-free) products in Villa Ascasubi, Argentina
- Prices in Argentine pesos (decimal 18,2)
- Products belong to one Category; categories have many Products
- Sales have line items (SaleDetails) linking Products
- A product with SaleDetails cannot be deleted (returns 409)
- A category with Products cannot be deleted (returns 409)
- Images stored as `varbinary(max)` blobs in SQL Server
- Images served via `GET /api/products/{id}/image`
