import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AuthService } from '@app/auth/auth.service';
import { ProfileService } from '@app/auth/profile.service';
import { UpdateProfileRequest } from '@app/models/auth.model';

/**
 * @description Componente de edición del perfil del usuario autenticado.
 *
 * Muestra y permite editar nombre completo, teléfono y dirección del cliente.
 * El email es de solo lectura y proviene del token JWT. Incluye sección de
 * avatar con vista previa y subida de imagen.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly profileService = inject(ProfileService);
  private readonly fb = inject(FormBuilder);

  /** Indica si el formulario está siendo enviado. */
  readonly saving = signal(false);

  /** Indica si se está subiendo una imagen. */
  readonly uploadingImage = signal(false);

  /** Mensaje de éxito tras una operación exitosa. */
  readonly successMessage = signal<string | null>(null);

  /** Mensaje de error de la última operación fallida. */
  readonly errorMessage = signal<string | null>(null);

  /** URL del avatar calculada desde el perfil cargado. */
  readonly avatarUrl = computed(() => {
    const url = this.profileService.profile()?.imageUrl;
    return url ? this.profileService.baseUrl() + url : null;
  });

  /** Iniciales del nombre, usadas como fallback cuando no hay imagen. */
  readonly initials = computed(() => {
    const n = this.authService.currentUser()?.fullName ?? '?';
    return n
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  });

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    address: [''],
  });

  /**
   * @description Inicializa el formulario con los datos del perfil ya cargado.
   * Si el perfil aún no está disponible (sesión recién iniciada), espera a que
   * `ProfileService` lo cargue — el effect en el servicio lo dispara automáticamente.
   */
  ngOnInit(): void {
    const p = this.profileService.profile();
    if (p) {
      this.patchForm(p.name, p.phone, p.address);
    }
  }

  /**
   * @description Rellena el formulario con los datos del perfil del usuario.
   * @param name Nombre completo del cliente.
   * @param phone Teléfono de contacto, puede ser null.
   * @param address Dirección de entrega, puede ser null.
   */
  private patchForm(
    name: string,
    phone: string | null,
    address: string | null
  ): void {
    this.form.patchValue({ name, phone: phone ?? '', address: address ?? '' });
  }

  /**
   * @description Envía los cambios del formulario al backend.
   * Muestra feedback de éxito o error mediante signals.
   */
  save(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const { name, phone, address } = this.form.getRawValue();
    const req: UpdateProfileRequest = {
      name: name!,
      phone: phone || null,
      address: address || null,
    };

    this.profileService.updateProfile(req).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Perfil actualizado correctamente.');
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('No se pudo guardar el perfil. Intentá de nuevo.');
      },
    });
  }

  /**
   * @description Maneja la selección de una nueva imagen de avatar.
   * Sube el archivo al backend y recarga el perfil tras la subida.
   * @param event Evento del input[type=file] del DOM.
   */
  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingImage.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.profileService.uploadAvatar(file).subscribe({
      next: () => {
        this.uploadingImage.set(false);
        this.successMessage.set('Imagen actualizada correctamente.');
      },
      error: () => {
        this.uploadingImage.set(false);
        this.errorMessage.set('No se pudo subir la imagen. Intentá de nuevo.');
      },
    });
  }
}
