using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApi.Models;

public class Product
{
    [Key]
    public int Id { get; set; }

    [Required]
    [StringLength(150)]
    [Display(Name = "Name")]
    public string Name { get; set; } = null!;

    [Display(Name = "Stock")]
    public int Stock { get; set; }

    // Cuando es true, Price representa el precio por kilogramo y Stock se lleva en gramos.
    // La cantidad cargada en una venta (SaleDetail.Quantity) se interpreta como gramos
    // en lugar de unidades — ver SaleEndpoints/OrderEndpoints para el cálculo del subtotal.
    [Display(Name = "Sold By Weight")]
    public bool SoldByWeight { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    [DataType(DataType.Currency)]
    [Display(Name = "Price")]
    public decimal Price { get; set; }

    // Nullable: products created before this feature don't have these populated.
    // Price remains the authoritative, stored value used everywhere else.
    [Column(TypeName = "decimal(18,2)")]
    [Display(Name = "List Price")]
    public decimal? ListPrice { get; set; }

    // 4 decimales (no 2): permite que un aumento recalculado a partir de un precio de
    // venta editado a mano (ver product-form-dialog en el frontend) reproduzca ese
    // precio exacto al redondear, en vez de perder centavos por falta de precisión.
    [Column(TypeName = "decimal(9,4)")]
    [Display(Name = "Markup Percentage")]
    public decimal? MarkupPercentage { get; set; }

    [StringLength(500)]
    [Display(Name = "Description")]
    public string? Description { get; set; }

    [StringLength(500)]
    [Display(Name = "Image URL")]
    public string? ImageUrl { get; set; }

    [Display(Name = "Is Active")]
    public bool IsActive { get; set; } = true;

    [DataType(DataType.DateTime)]
    [Display(Name = "Registration Date")]
    [DisplayFormat(DataFormatString = "{0:yyyy-MM-dd HH:mm:ss}", ApplyFormatInEditMode = true)]
    public DateTime RegistrationDate { get; set; } = DateTime.UtcNow;

    // Foreign key
    [Required]
    [Display(Name = "Category")]
    public int CategoryId { get; set; }

    public Category? Category { get; set; }

    public ICollection<SaleDetail> SaleDetails { get; set; } = new List<SaleDetail>();

    public byte[]? ImageData { get; set; }

    [StringLength(100)]
    public string? ImageContentType { get; set; }
}