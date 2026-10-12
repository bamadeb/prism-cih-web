import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';

/** Opens the app's confirm dialog; resolves true only when the user confirms. */
export async function confirmAction(
  dialog: MatDialog,
  title: string,
  message: string,
  confirmButtonName = 'Confirm'
): Promise<boolean> {
  const result = await firstValueFrom(
    dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: { title, message, confirmButtonName }
    }).afterClosed()
  );
  return result === true;
}

/** Confirmation shown before a staged CSV import is processed. */
export function confirmProcessImport(
  dialog: MatDialog,
  fileLabel: string,
  totalRecords: number,
  errorCount: number
): Promise<boolean> {
  const warning = errorCount > 0
    ? ` ${errorCount} of them have errors (shown in the table) and may be skipped or rejected.`
    : '';
  return confirmAction(
    dialog,
    `Process ${fileLabel} file`,
    `Process ${totalRecords} uploaded record(s)?${warning} This updates live data and cannot be undone.`,
    'Process'
  );
}
