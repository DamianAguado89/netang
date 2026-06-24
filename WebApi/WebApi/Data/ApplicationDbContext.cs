using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WebApi.Models;

namespace WebApi.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Category> Categories { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<Customer> Customers { get; set; }
    public DbSet<Sale> Sales { get; set; }
    public DbSet<SaleDetail> SaleDetails { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // base.OnModelCreating es obligatorio aquí para que Identity cree sus propias tablas
        base.OnModelCreating(modelBuilder);

        // Category 1 : N Product
        modelBuilder.Entity<Category>()
            .HasMany(c => c.Products)
            .WithOne(p => p.Category)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // Customer 1 : N Sale
        modelBuilder.Entity<Customer>()
            .HasMany(cu => cu.Sales)
            .WithOne(s => s.Customer)
            .HasForeignKey(s => s.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        // Sale 1 : N SaleDetail
        modelBuilder.Entity<Sale>()
            .HasMany(s => s.SaleDetails)
            .WithOne(sd => sd.Sale)
            .HasForeignKey(sd => sd.SaleId)
            .OnDelete(DeleteBehavior.Cascade);

        // Product 1 : N SaleDetail
        modelBuilder.Entity<Product>()
            .HasMany(p => p.SaleDetails)
            .WithOne(sd => sd.Product)
            .HasForeignKey(sd => sd.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        // Precision for decimals (redundant with [Column], but explicit here)
        modelBuilder.Entity<Product>().Property(p => p.Price).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Sale>().Property(s => s.Total).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<SaleDetail>().Property(sd => sd.Price).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<SaleDetail>().Property(sd => sd.Total).HasColumnType("decimal(18,2)");
    }
}