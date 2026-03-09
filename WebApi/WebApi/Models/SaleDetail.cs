using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApi.Models;

public class SaleDetail
{
    [Key]
    public int Id { get; set; }

    // Foreign key to Sale
    [Required]
    [Display(Name = "Sale")]
    public int SaleId { get; set; }

    public Sale? Sale { get; set; }

    // Foreign key to Product
    [Required]
    [Display(Name = "Product")]
    public int ProductId { get; set; }

    public Product? Product { get; set; }

    [Required]
    [Display(Name = "Quantity")]
    public int Quantity { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    [DataType(DataType.Currency)]
    [Display(Name = "Price")]
    public decimal Price { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    [DataType(DataType.Currency)]
    [Display(Name = "Total")]
    public decimal Total { get; set; }
}