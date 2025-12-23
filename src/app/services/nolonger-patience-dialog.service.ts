import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigService } from './api.service'; 
import { ConfirmDialog } from '../views/dialogs/confirm-dialog/confirm-dialog';
import {MatIconModule} from '@angular/material/icon'
import { ConfirmDialogResult } from '../models/requests/dashboardRequest';

@Injectable({ providedIn: 'root' })
export class NolongerPatientDialogService {

  constructor(
    private dialog: MatDialog
  ) {}

  // ============================
  // OPEN CONFIRM DIALOG
  // ============================
  async confirmbox(row: any): Promise<ConfirmDialogResult | undefined> {
    try {
      const dialogRef = this.dialog.open(ConfirmDialog, {
        width: '80vw',
        maxWidth: '600px',
        data: {
          title: 'CONFIRM ACTION',
          name: `${row.FIRST_NAME} ${row.LAST_NAME}`,
          phone: row.OTHER_PHONE,
          birth: row.BIRTH,
          medicaid_id: row.medicaid_id
        }
      });

      return await dialogRef.afterClosed().toPromise();

    } catch (error) {
      console.error('Confirm dialog failed', error);
      return undefined;
    }
  }
}
