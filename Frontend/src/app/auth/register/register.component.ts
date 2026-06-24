import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '@app/auth/auth.service';

/**
 * @description Componente de registro de nuevos usuarios.
 * Permite crear una cuenta con nombre, email y contraseña, o registrarse con Google.
 * Redirige a `/admin/orders` tras un registro exitoso.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent implements AfterViewInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly form = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /** Controla la visibilidad de la contraseña en el campo de texto. */
  hidePassword = true;

  /** Indica si hay una petición de registro en curso. */
  readonly loading = signal(false);

  /** Mensaje de error a mostrar si el registro falla. */
  readonly error = signal<string | null>(null);

  ngAfterViewInit(): void {
    this.initGoogleSignIn();
  }

  /**
   * @description Registra al usuario con los datos del formulario.
   * Muestra spinner mientras espera la respuesta del backend.
   */
  register(): void {
    if (this.loading() || this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    const { fullName, email, password } = this.form.getRawValue();

    this.authService.register({ fullName, email, password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo completar el registro. El email puede estar en uso.');
      },
    });
  }

  /**
   * @description Registra/autentica al usuario con la credencial emitida por Google.
   * @param credential Token JWT de Google Identity Services.
   */
  loginWithGoogle(credential: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.authService.loginWithGoogle(credential).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo autenticar con Google. Intentá de nuevo.');
      },
    });
  }

  /**
   * @description Inicializa el botón de Google Sign-In usando la librería GIS.
   * Se llama en `ngAfterViewInit` para garantizar que el DOM esté disponible.
   */
  private initGoogleSignIn(): void {
    const google = (window as unknown as Record<string, unknown>)[
      'google'
    ] as GoogleAccounts | undefined;

    if (!google) return;

    google.accounts.id.initialize({
      client_id:
        '269697135792-kr83lhvo15kbpd36fd2frn3mrerrnu0g.apps.googleusercontent.com',
      callback: (response: { credential: string }) => {
        this.loginWithGoogle(response.credential);
      },
    });

    google.accounts.id.renderButton(
      document.getElementById('google-signin-btn'),
      { type: 'standard', size: 'large', width: 360, text: 'signup_with', locale: 'es' }
    );
  }
}

/** Tipado mínimo de la API de Google Identity Services para evitar `any`. */
interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (
        element: HTMLElement | null,
        options: Record<string, unknown>
      ) => void;
    };
  };
}
