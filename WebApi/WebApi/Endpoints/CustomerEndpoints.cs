using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

public static class CustomerEndpoints
{
    public static void MapCustomerEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/customers").WithTags("Customers");

        group.MapGet("/", GetAllCustomers);
        group.MapGet("/{id:int}", GetCustomer);
        group.MapPost("/", CreateCustomer);
        group.MapPut("/{id:int}", UpdateCustomer);
        group.MapDelete("/{id:int}", DeleteCustomer);
    }

    private static async Task<IResult> GetAllCustomers(ApplicationDbContext db)
    {
        var list = await db.Customers
            .Select(c => new CustomerDto(c.Id, c.Name, c.Email, c.Phone, c.Address))
            .ToListAsync();
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> GetCustomer(int id, ApplicationDbContext db)
    {
        var c = await db.Customers.FindAsync(id);
        return c is not null
            ? TypedResults.Ok(new CustomerDto(c.Id, c.Name, c.Email, c.Phone, c.Address))
            : TypedResults.NotFound();
    }

    private static async Task<IResult> CreateCustomer(CreateCustomerRequest req, ApplicationDbContext db)
    {
        var customer = new Customer
        {
            Name = req.Name,
            Email = req.Email,
            Phone = req.Phone,
            Address = req.Address
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        return TypedResults.Created($"/api/customers/{customer.Id}",
            new CustomerDto(customer.Id, customer.Name, customer.Email, customer.Phone, customer.Address));
    }

    private static async Task<IResult> UpdateCustomer(int id, UpdateCustomerRequest req, ApplicationDbContext db)
    {
        var customer = await db.Customers.FindAsync(id);
        if (customer is null) return TypedResults.NotFound();

        customer.Name = req.Name;
        customer.Email = req.Email;
        customer.Phone = req.Phone;
        customer.Address = req.Address;

        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    private static async Task<IResult> DeleteCustomer(int id, ApplicationDbContext db)
    {
        var customer = await db.Customers.Include(c => c.Sales).FirstOrDefaultAsync(c => c.Id == id);
        if (customer is null) return TypedResults.NotFound();
        if (customer.Sales.Any()) return TypedResults.Conflict($"Customer {id} has related sales.");
        db.Customers.Remove(customer);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }
}
