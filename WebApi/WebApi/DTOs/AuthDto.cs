namespace WebApi.DTOs;

public record RegisterRequest(string FullName, string Email, string Password);
public record LoginRequest(string Email, string Password);
public record GoogleLoginRequest(string Credential);
public record AuthResponse(string Token, string Email, string FullName, string Role);
