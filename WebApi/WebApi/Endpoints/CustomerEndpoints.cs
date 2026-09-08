using Microsoft.EntityFrameworkCore;
using WebApi.Data;
using WebApi.DTOs;
using WebApi.Models;

namespace WebApi.Endpoints;

public static class CustomerEndpoints
{
    public static void MapCustomerEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/customers").WithTags("Customers").RequireAuthorization("AdminPolicy");

        group.MapGet("/", GetAllCustomers);
        group.MapGet("/{id:int}", GetCustomer);
        // Anónima: la imagen se carga desde <img src="...">, el navegador no puede adjuntar JWT.
        group.MapGet("/{id:int}/image", GetCustomerImage).AllowAnonymous();
        group.MapPost("/", CreateCustomer);
        group.MapPut("/{id:int}", UpdateCustomer);
        group.MapDelete("/{id:int}", DeleteCustomer);
    }

    private static async Task<IResult> GetAllCustomers(ApplicationDbContext db)
    {
        var list = await db.Customers
            .Select(c => new CustomerDto(c.Id, c.Name, c.Email, c.Phone, c.Address, c.BirthDate,
                c.ImageData != null ? $"/api/customers/{c.Id}/image" : null))
            .ToListAsync();
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> GetCustomer(int id, ApplicationDbContext db)
    {
        var c = await db.Customers.FindAsync(id);
        return c is not null
            ? TypedResults.Ok(new CustomerDto(c.Id, c.Name, c.Email, c.Phone, c.Address, c.BirthDate,
                c.ImageData != null ? $"/api/customers/{c.Id}/image" : null))
            : TypedResults.NotFound();
    }

    private static async Task<IResult> GetCustomerImage(int id, ApplicationDbContext db)
    {
        var c = await db.Customers.FindAsync(id);
        if (c is null || c.ImageData is null) return TypedResults.NotFound();
        return TypedResults.File(c.ImageData, c.ImageContentType ?? "image/jpeg");
    }

    private static async Task<IResult> CreateCustomer(CreateCustomerRequest req, ApplicationDbContext db)
    {
        var customer = new Customer
        {
            Name = req.Name,
            Email = req.Email,
            Phone = req.Phone,
            Address = req.Address,
            BirthDate = req.BirthDate
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        return TypedResults.Created($"/api/customers/{customer.Id}",
            new CustomerDto(customer.Id, customer.Name, customer.Email, customer.Phone, customer.Address, customer.BirthDate, null));
    }

    private static async Task<IResult> UpdateCustomer(int id, UpdateCustomerRequest req, ApplicationDbContext db)
    {
        var customer = await db.Customers.FindAsync(id);
        if (customer is null) return TypedResults.NotFound();

        customer.Name = req.Name;
        customer.Email = req.Email;
        customer.Phone = req.Phone;
        customer.Address = req.Address;
        customer.BirthDate = req.BirthDate;

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
