using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApi.Models;

public class Sale
{
    [Key]
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    [Display(Name = "Document Number")]
    public string DocumentNumber { get; set; } = null!;

    [StringLength(50)]
    [Display(Name = "Payment Type")]
    public string? PaymentType { get; set; }

    [StringLength(500)]
    [Display(Name = "Notes")]
    public string? Notes { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    [DataType(DataType.Currency)]
    [Display(Name = "Total")]
    public decimal Total { get; set; }

    [DataType(DataType.DateTime)]
    [Display(Name = "Registration Date")]
    [DisplayFormat(DataFormatString = "{0:yyyy-MM-dd HH:mm:ss}", ApplyFormatInEditMode = true)]
    public DateTime RegistrationDate { get; set; } = DateTime.UtcNow;

    // Foreign key to Customer
    [Required]
    [Display(Name = "Customer")]
    public int CustomerId { get; set; }

    public Customer? Customer { get; set; }

    public ICollection<SaleDetail> SaleDetails { get; set; } = new List<SaleDetail>();
}