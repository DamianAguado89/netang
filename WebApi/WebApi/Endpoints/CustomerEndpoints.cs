using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.Models;

namespace WebApi.Endpoints;

public static class CustomerEndpoints
{
    public static void MapCustomerEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/customers");

        group.MapGet("/", GetAllCustomers);
        group.MapGet("/{id:int}", GetCustomer);
        group.MapPost("/", CreateCustomer);
        group.MapPut("/{id:int}", UpdateCustomer);
        group.MapDelete("/{id:int}", DeleteCustomer);
    }

    private static async Task<IResult> GetAllCustomers(ApplicationDbContext db)
    {
        var list = await db.Customers.Include(cu => cu.Sales).ToListAsync();
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> GetCustomer(int id, ApplicationDbContext db)
    {
        var customer = await db.Customers.Include(cu => cu.Sales).ThenInclude(s => s.SaleDetails)
            .FirstOrDefaultAsync(cu => cu.Id == id);
        return customer is not null ? TypedResults.Ok(customer) : TypedResults.NotFound();
    }

    private static async Task<IResult> CreateCustomer(Customer input, ApplicationDbContext db)
    {
        db.Customers.Add(input);
        await db.SaveChangesAsync();
        return TypedResults.Created($"/api/customers/{input.Id}", input);
    }

    private static async Task<IResult> UpdateCustomer(int id, Customer input, ApplicationDbContext db)
    {
        var customer = await db.Customers.FindAsync(id);
        if (customer is null) return TypedResults.NotFound();

        customer.Name = input.Name;
        customer.Email = input.Email;
        customer.Phone = input.Phone;
        customer.Address = input.Address;

        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    private static async Task<IResult> DeleteCustomer(int id, ApplicationDbContext db)
    {
        var customer = await db.Customers.Include(cu => cu.Sales).FirstOrDefaultAsync(cu => cu.Id == id);
        if (customer is null) return TypedResults.NotFound();
        if (customer.Sales.Any()) return TypedResults.Conflict($"Customer {id} has related sales.");
        db.Customers.Remove(customer);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }
}