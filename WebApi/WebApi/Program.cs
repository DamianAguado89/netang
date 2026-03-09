using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using System;
using WebApi.Data;
using WebApi.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// Add DbContext - update the connection string in appsettings.json
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "WebApi", Version = "v1" });

    // Include XML comments if the project generates them
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }
});

var app = builder.Build();

// Enable Swagger (you can restrict to Development if desired)
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "WebApi v1");
    c.RoutePrefix = "swagger"; // swagger UI at /swagger
});

// Register endpoint classes
app.MapCategoryEndpoints();
app.MapProductEndpoints();
app.MapCustomerEndpoints();
app.MapSaleEndpoints();
app.MapSaleDetailEndpoints();

app.MapGet("/", () => "Hello World!");

app.Run();
