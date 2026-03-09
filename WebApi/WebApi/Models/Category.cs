using System.ComponentModel.DataAnnotations;

namespace WebApi.Models;

public class Category
{
    [Key]
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    [Display(Name = "Name")]
    public string Name { get; set; } = null!;

    [Display(Name = "Is Active")]
    public bool IsActive { get; set; } = true;

    [DataType(DataType.DateTime)]
    [Display(Name = "Registration Date")]
    [DisplayFormat(DataFormatString = "{0:yyyy-MM-dd HH:mm:ss}", ApplyFormatInEditMode = true)]
    public DateTime RegistrationDate { get; set; } = DateTime.UtcNow;

    public ICollection<Product> Products { get; set; } = new List<Product>();
}