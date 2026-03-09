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

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    [DataType(DataType.Currency)]
    [Display(Name = "Price")]
    public decimal Price { get; set; }

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
}