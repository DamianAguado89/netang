using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.Models;

namespace WebApi.Endpoints;

// Endpoints de CRUD granular para ítems de venta individuales (SaleDetail).
// Cada mutación llama a RecalculateSaleTotal para mantener el total de la venta padre sincronizado.
// Estos endpoints son de uso interno del admin; el flujo normal de creación de ventas
// usa SaleEndpoints que maneja los ítems como parte del mismo request.
public static class SaleDetailEndpoints
{
    // Registra las cinco rutas estándar bajo /api/saledetails.
    public static void MapSaleDetailEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/saledetails").WithTags("Sale Details").RequireAuthorization("AdminPolicy");

        group.MapGet("/", GetAllDetails);
        group.MapGet("/{id:int}", GetDetail);
        group.MapPost("/", CreateDetail);
        group.MapPut("/{id:int}", UpdateDetail);
        group.MapDelete("/{id:int}", DeleteDetail);
    }

    // Devuelve todos los ítems de venta con sus navegaciones a Product y Sale cargadas.
    // Se expone la entidad directamente (sin DTO) porque este endpoint es de uso exclusivamente
    // interno y el ciclo de referencia entre Sale y SaleDetail está controlado con IgnoreCycles.
    private static async Task<IResult> GetAllDetails(ApplicationDbContext db)
    {
        var list = await db.SaleDetails.Include(sd => sd.Product).Include(sd => sd.Sale).ToListAsync();
        return TypedResults.Ok(list);
    }

    // Devuelve un ítem de venta por su Id con Product y Sale cargados.
    // Usa FirstOrDefaultAsync con Include porque FindAsync no soporta navegaciones.
    // Devuelve 404 si el Id no existe.
    private static async Task<IResult> GetDetail(int id, ApplicationDbContext db)
    {
        var detail = await db.SaleDetails.Include(sd => sd.Product).Include(sd => sd.Sale).FirstOrDefaultAsync(sd => sd.Id == id);
        return detail is not null ? TypedResults.Ok(detail) : TypedResults.NotFound();
    }

    // Crea un ítem de venta validando que la venta y el producto existan.
    // El total del ítem se calcula en el servidor (Price * Quantity) para evitar inconsistencias.
    // Tras insertar se recalcula el total de la venta padre para mantenerlo sincronizado.
    // Devuelve 400 si la venta o el producto no existen, 201 con el ítem creado.
    private static async Task<IResult> CreateDetail(SaleDetail input, ApplicationDbContext db)
    {
        if (!await db.Sales.AnyAsync(s => s.Id == input.SaleId))
            return TypedResults.BadRequest($"Sale {input.SaleId} does not exist.");
        if (!await db.Products.AnyAsync(p => p.Id == input.ProductId))
            return TypedResults.BadRequest($"Product {input.ProductId} does not exist.");

        input.Total = input.Price * input.Quantity;
        db.SaleDetails.Add(input);
        await db.SaveChangesAsync();

        await RecalculateSaleTotal(input.SaleId, db);
        return TypedResults.Created($"/api/saledetails/{input.Id}", input);
    }

    // Actualiza un ítem de venta validando las FK antes de persistir.
    // Recalcula el total de la venta padre tras el cambio porque Price o Quantity pudieron variar.
    // Devuelve 404 si el ítem no existe, 400 si la venta o producto no existen, 204 si fue exitoso.
    private static async Task<IResult> UpdateDetail(int id, SaleDetail input, ApplicationDbContext db)
    {
        var detail = await db.SaleDetails.FindAsync(id);
        if (detail is null) return TypedResults.NotFound();

        if (!await db.Sales.AnyAsync(s => s.Id == input.SaleId))
            return TypedResults.BadRequest($"Sale {input.SaleId} does not exist.");
        if (!await db.Products.AnyAsync(p => p.Id == input.ProductId))
            return TypedResults.BadRequest($"Product {input.ProductId} does not exist.");

        detail.SaleId = input.SaleId;
        detail.ProductId = input.ProductId;
        detail.Quantity = input.Quantity;
        detail.Price = input.Price;
        detail.Total = input.Price * input.Quantity;

        await db.SaveChangesAsync();
        await RecalculateSaleTotal(detail.SaleId, db);
        return TypedResults.NoContent();
    }

    // Elimina un ítem de venta y recalcula el total de la venta padre.
    // El SaleId se guarda antes de llamar a Remove porque después de la eliminación
    // la propiedad detail.SaleId podría no estar disponible en el contexto de EF Core.
    // Devuelve 404 si el ítem no existe, 204 si se eliminó correctamente.
    private static async Task<IResult> DeleteDetail(int id, ApplicationDbContext db)
    {
        var detail = await db.SaleDetails.FindAsync(id);
        if (detail is null) return TypedResults.NotFound();

        var saleId = detail.SaleId;
        db.SaleDetails.Remove(detail);
        await db.SaveChangesAsync();
        await RecalculateSaleTotal(saleId, db);
        return TypedResults.NoContent();
    }

    // Recalcula y persiste el total de una venta sumando los totales de todos sus ítems actuales.
    // El cast a (decimal?) en SumAsync es necesario porque sobre una colección vacía
    // SumAsync devuelve null para tipos nullables — el ?? 0m garantiza que nunca se asigne null.
    private static async Task RecalculateSaleTotal(int saleId, ApplicationDbContext db)
    {
        var total = await db.SaleDetails.Where(sd => sd.SaleId == saleId).SumAsync(sd => (decimal?)sd.Total) ?? 0m;
        var sale = await db.Sales.FindAsync(saleId);
        if (sale is not null)
        {
            sale.Total = total;
            await db.SaveChangesAsync();
        }
    }
}