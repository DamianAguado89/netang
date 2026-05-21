using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApi.Migrations
{
    public partial class AddProductImageBlob : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "ImageData",
                table: "Products",
                type: "varbinary(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageContentType",
                table: "Products",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "ImageData", table: "Products");
            migrationBuilder.DropColumn(name: "ImageContentType", table: "Products");
        }
    }
}
