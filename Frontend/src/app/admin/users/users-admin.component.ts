import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '@app/auth/auth.service';
import { UserAdminService } from '@app/admin/users/user-admin.service';
import { UserDto } from '@app/models/user.model';

/**
 * @description
 * Panel de administración de usuarios y roles, accedido por la ruta `/admin/users`
 * y protegido por `superAdminGuard` — es la única pantalla del sistema donde se
 * puede otorgar o revocar el rol Admin a una cuenta ya registrada.
 *
 * Solo lista cuentas que ya existen en `AspNetUsers`: no se puede "invitar" a
 * alguien que todavía no inició sesión al menos una vez (registro, login o
 * Google Sign-In), porque hasta ese momento no hay una fila que promover.
 *
 * El rol SuperAdmin nunca aparece como opción para asignar — está reservado a
 * la cuenta configurada en el backend (`SuperAdminSeed:Email`) y esa fila se
 * muestra fija, sin selector, igual que la fila del propio usuario logueado
 * (nadie puede cambiarse el rol a sí mismo, ver `UserEndpoints.UpdateUserRole`).
 */
@Component({
  selector: 'app-users-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './users-admin.component.html',
  styleUrl: './users-admin.component.scss',
})
export class UsersAdminComponent implements OnInit {
  private readonly service = inject(UserAdminService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  /** Control reactivo del campo de búsqueda; su valor se sincroniza con `searchTerm`. */
  readonly searchControl = new FormControl('');

  /** Término de búsqueda activo, alimentado desde `searchControl.valueChanges`. */
  readonly searchTerm = signal('');

  /** Columnas que renderiza `mat-table`. */
  readonly displayedColumns = ['fullName', 'email', 'role'];

  /** Roles asignables desde este panel — SuperAdmin queda deliberadamente afuera. */
  readonly assignableRoles: Array<{ value: string; label: string }> = [
    { value: 'Customer', label: 'Cliente' },
    { value: 'Admin', label: 'Administrador' },
  ];

  /** Alias del signal del servicio para exponerlo directamente al template. */
  readonly loading = this.service.loading;

  /** Alias del signal del servicio; el template muestra el mensaje de error si no es `null`. */
  readonly error = this.service.error;

  /** Id de la cuenta actualmente logueada, para no dejarle tocar su propia fila. */
  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  /**
   * Lista de usuarios filtrada por el término de búsqueda actual (nombre o email).
   */
  readonly filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.service.users();
    return this.service
      .users()
      .filter(
        (u) =>
          u.fullName.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term)
      );
  });

  /**
   * @description
   * Carga el listado inicial de usuarios y conecta el control de búsqueda al
   * signal `searchTerm`.
   */
  ngOnInit(): void {
    this.service.loadUsers();
    this.searchControl.valueChanges.subscribe((val) =>
      this.searchTerm.set(val ?? '')
    );
  }

  /**
   * @description Indica si la fila de un usuario puede editarse desde este panel.
   * Bloqueada para el super admin (rol fijo) y para la propia cuenta logueada
   * (el backend rechaza ambos casos igual, pero deshabilitar el selector evita
   * el viaje al servidor y deja claro por qué esa fila no se puede tocar).
   * @param user Usuario de la fila a evaluar.
   */
  isRowEditable(user: UserDto): boolean {
    return user.role !== 'SuperAdmin' && user.id !== this.currentUserId();
  }

  /**
   * @description
   * Cambia el rol de un usuario. Si el backend confirma el cambio, recarga la
   * lista para reflejar el nuevo rol; si falla, revierte el selector (al no
   * mutar el signal, `[value]` vuelve a mostrar el rol anterior) y avisa por qué.
   *
   * @param user Usuario cuya fila disparó el cambio.
   * @param newRole Rol elegido en el selector ("Admin" o "Customer").
   */
  onRoleChange(user: UserDto, newRole: string): void {
    if (newRole === user.role) return;

    this.service.updateRole(user.id, { role: newRole }).subscribe({
      next: () => {
        this.service.loadUsers();
        const roleLabel = this.assignableRoles.find((r) => r.value === newRole)?.label ?? newRole;
        this.snackBar.open(`${user.fullName} ahora es ${roleLabel}.`, 'Cerrar', { duration: 3000 });
      },
      error: (err) => {
        const msg =
          err.status === 400
            ? 'No se pudo cambiar el rol: la cuenta no admite ese cambio.'
            : 'Error al cambiar el rol. Intentá de nuevo.';
        this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
      },
    });
  }
}
