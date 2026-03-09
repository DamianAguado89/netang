
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace WebApi.Models;

public class Customer
{
    [Key]
    public int Id { get; set; }

    [Required]
    [StringLength(150)]
    [Display(Name = "Name")]
    public string Name { get; set; } = null!;

    [StringLength(200)]
    [DataType(DataType.EmailAddress)]
    [Display(Name = "Email")]
    public string? Email { get; set; }

    [StringLength(50)]
    [DataType(DataType.PhoneNumber)]
    [Display(Name = "Phone")]
    public string? Phone { get; set; }

    [StringLength(300)]
    [Display(Name = "Address")]
    public string? Address { get; set; }

    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
}