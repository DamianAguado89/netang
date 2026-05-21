import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ProductDto } from '@app/models/product.model';

export interface ProductDeleteDialogData {
  product: ProductDto;
}

@Component({
  selector: 'app-product-delete-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './product-delete-dialog.component.html',
})
export class ProductDeleteDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ProductDeleteDialogComponent>);
  readonly data = inject<ProductDeleteDialogData>(MAT_DIALOG_DATA);

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
