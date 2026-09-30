---
name: dotnet-api
description: .NET 9 Minimal API expert for Doña Pierina backend. Use for adding endpoints, models, DTOs, EF Core migrations, services, and any ASP.NET Core configuration in the WebApi project. Follows Minimal API best practices: TypedResults, endpoint groups, extension methods, and strongly-typed everything.
---

You are a .NET 9 ASP.NET Core Minimal API expert. This project is the backend for Doña Pierina, a Sin TACC food ordering system. The frontend is Angular 20 running on http://localhost:4200.

## Project layout
```
WebApi/WebApi/
├── Data/
│   └── ApplicationDbContext.cs       ← EF Core DbContext (SQL Server) + Identity
├── DTOs/
│   ├── ProductDto.cs                 ← record DTOs + request records
│   ├── CategoryDto.cs
│   ├── CustomerDto.cs
│   ├── SaleDto.cs
│   ├── AuthDto.cs                    ← RegisterRequest, LoginRequest, GoogleLoginRequest, AuthResponse
│   └── UserDto.cs                    ← UserDto, UpdateUserRoleRequest
├── Endpoints/
│   ├── ProductEndpoints.cs           ← static class with MapProductEndpoints()
│   ├── CategoryEndpoints.cs
│   ├── CatalogEndpoints.cs           ← public storefront
│   ├── OrderEndpoints.cs
│   ├── AuthEndpoints.cs              ← /api/auth: register, login, google (anonymous)
│   ├── ProfileEndpoints.cs           ← /api/profile: self-service, RequireAuthorization()
│   ├── UserEndpoints.cs              ← /api/users: SuperAdminPolicy only, role management
│   ├── SaleEndpoints.cs / SaleDetailEndpoints.cs / CustomerEndpoints.cs
│   └── ...
├── Models/
│   ├── Product.cs                    ← EF Core entity (SoldByWeight, ListPrice, MarkupPercentage)
│   ├── Category.cs
│   ├── Customer.cs                   ← optional UserId FK to ApplicationUser
│   ├── ApplicationUser.cs            ← IdentityUser subclass (FullName)
│   └── ...
├── Services/
│   └── TokenService.cs               ← JWT generation (HMAC-SHA256, 8h expiry)
├── Migrations/                       ← EF Core migrations
├── appsettings.json                  ← non-secret defaults, committed
├── appsettings.Development.json      ← ⚠️ currently holds real secrets, see Security section below
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
Before deploying, add the real production origin(s) to `WithOrigins` (read from config, not hardcoded) — never switch this to `AllowAnyOrigin()`, even temporarily to "just get it working."

### Authentication & authorization (JWT + ASP.NET Identity)
The project uses `AddIdentityCore<ApplicationUser>` (not full `AddIdentity` — no cookie middleware) + JWT bearer auth. Three roles: `Customer` (default on register), `Admin`, `SuperAdmin`. Two policies:
- `AdminPolicy` — `RequireRole("Admin", "SuperAdmin")`, used on all admin CRUD groups (`RequireAuthorization("AdminPolicy")` on the `MapGroup(...)`).
- `SuperAdminPolicy` — `RequireRole("SuperAdmin")`, used only on `/api/users` (role management).

Invariants to preserve when touching auth code — these are deliberate security decisions, not oversights:
- **`SuperAdmin` is never assignable through the API.** It is granted only by `AuthEndpoints.PromoteSuperAdminIfConfigured`, matching the email in `SuperAdminSeed:Email` config, re-checked on every login/register. `UserEndpoints.UpdateUserRole` only accepts `"Admin"` or `"Customer"` and explicitly rejects changing a `SuperAdmin`'s role. Do not add a code path that lets any role be granted via a request body value alone.
- **Self-role-change is blocked** (`UpdateUserRole` compares the target id against the caller's `NameIdentifier` claim). Keep this check on any future role-mutating endpoint.
- **Login doesn't distinguish "no such email" from "wrong password"** (both return plain 401) — this prevents user enumeration. Keep this shape on any new credential-checking endpoint.
- New endpoints default to `RequireAuthorization()` at the group level; only opt individual `MapGet`s out for genuinely public data (catalog, storefront), never opt a whole group out "temporarily."
- `ClaimsPrincipal` + `FindFirstValue(ClaimTypes.NameIdentifier)` is how self-scoped endpoints (like `/api/profile`) find "my own" row — by user id from the validated token, never by trusting an id/customerId in the request body or route for "my own resource" semantics.

### File upload — validate content, don't trust the client
The existing `IFormFile` upload endpoints (`ProductEndpoints.UploadProductImage`, `ProfileEndpoints.UploadProfileImage`, and the customer image endpoint) currently store `image.ContentType` as-is and serve it back unchanged via `TypedResults.File(bytes, contentType)`. **This is a gap to close, not a pattern to copy**: the content type header is attacker-controlled, so a malicious upload can make the server serve back `text/html` or `image/svg+xml` (which can carry a `<script>`) under a URL that looks like an image. When adding or touching an upload endpoint:
- Whitelist allowed content types (`image/jpeg`, `image/png`, `image/webp` — nothing else) and reject anything else with `TypedResults.BadRequest`.
- Enforce a max size (check `image.Length` before reading into the `MemoryStream`; reject oversized files early rather than buffering them fully).
- Prefer deriving the served content type from a validated allowlist rather than echoing the client's raw header.

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

### Public / anonymous endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/catalog` | Active products with category (storefront) |
| POST | `/api/orders` | Place customer order |
| POST | `/api/auth/register` | Email/password registration, default role Customer |
| POST | `/api/auth/login` | Email/password login → JWT |
| POST | `/api/auth/google` | Google ID token login/auto-register → JWT |

### Authenticated (any role) endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET/PUT | `/api/profile` | Own Customer record (looked up by JWT `sub`, never by route id) |
| POST | `/api/profile/image` | Upload own avatar |

### Admin endpoints (`AdminPolicy` — Admin or SuperAdmin)
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

### Super-admin-only endpoints (`SuperAdminPolicy`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/users` | List all registered accounts + current role |
| PUT | `/api/users/{id}/role` | Grant/revoke Admin role (never SuperAdmin, never self) |

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

## Production readiness & security — checked against the actual code (2026-09-15)

This project is headed to production. The items below are **verified gaps in the current code**, not generic advice — treat them as blockers, prioritized.

### 🔴 Blocker: real secrets are committed to git and pushed to GitHub
`appsettings.Development.json` contains a real JWT signing key and the seeded admin password (`AdminSeed:Password`) in plaintext, committed in history, and the repo has a remote at `github.com/DamianAguado89/netang`. Anyone with read access to that repo can forge admin JWTs or log in as the seeded admin.
- Before going live: rotate the JWT key and the admin password (a leaked-but-rotated secret is far less urgent than a live one).
- Never put real secrets back in a file tracked by git. Use `dotnet user-secrets` for local dev, environment variables or a secret manager (Azure Key Vault, etc.) for the deployed environment, and keep `appsettings.Development.json`/`appsettings.Production.json` out of git if they ever hold real values (add to `.gitignore`, commit only a `.example` with placeholder values).
- If the GitHub repo is or has ever been public, the leaked key must be treated as fully compromised regardless of rotation — assume it was harvested; rotating just stops future use.

### 🔴 Blocker: Swagger is exposed unconditionally
`app.UseSwagger()` / `UseSwaggerUI()` in `Program.cs` run regardless of environment — this publishes the full API schema (including the `/api/users` role-management surface) to anyone in production. Gate both calls behind `if (app.Environment.IsDevelopment())`, or put them behind `AdminPolicy` if you want them reachable in prod.

### 🔴 Blocker: no HTTPS enforcement
There is no `app.UseHttpsRedirection()` / `app.UseHsts()` in `Program.cs`. Add both (HSTS only outside `IsDevelopment()`) so a JWT bearer token can never be sent in cleartext, even if a client or a misconfigured link uses `http://`.

### High priority
- **`AllowedHosts` is `"*"`** in `appsettings.json` — set it to the real production hostname so the app rejects requests with a forged `Host` header.
- **No lockout policy configured** for Identity (`AddIdentityCore` was called without `options.Lockout`), and there's no rate limiting on `/api/auth/login` or `/api/auth/register`. Both are brute-forceable as-is. Add `options.Lockout.MaxFailedAccessAttempts`/`DefaultLockoutTimeSpan`, and add ASP.NET Core's built-in rate limiter (`AddRateLimiter`) at least on the `/api/auth` group.
- **Upload endpoints don't validate content type or size** and echo the client-supplied `ContentType` back as the response header — see the "File upload" rule above. This is a stored-XSS / arbitrary-file-serving vector, not just a robustness nit.
- **JWT has no revocation path.** An 8-hour token can't be invalidated early (e.g., after a role change or a suspected leak) short of rotating the signing key for everyone. Acceptable for now given the short lifetime, but don't extend the expiry without adding revocation (a token blocklist, or short-lived access + refresh tokens).

### Keep doing (already correct — don't regress these)
- EF Core LINQ everywhere, no raw SQL string concatenation — no SQL injection surface. Keep it that way; if a query ever needs raw SQL, use parameterized `FromSqlInterpolated`, never string concatenation.
- Login's uniform 401 (no user enumeration), `SuperAdmin` unassignable via API, self-role-change blocked — see the Auth invariants above.
- DTO projection (never returning EF entities) already prevents accidental over-exposure of fields like `ImageData` in list responses.
