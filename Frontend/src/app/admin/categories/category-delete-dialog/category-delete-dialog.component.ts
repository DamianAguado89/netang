import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CategoryDto } from '@app/models/product.model';

export interface CategoryDeleteDialogData {
  category: CategoryDto;
}

@Component({
  selector: 'app-category-delete-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './category-delete-dialog.component.html',
})
export class CategoryDeleteDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CategoryDeleteDialogComponent>);
  readonly data = inject<CategoryDeleteDialogData>(MAT_DIALOG_DATA);

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
