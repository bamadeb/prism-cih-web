import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigService } from './api.service'; 
import { ConfirmDialog } from '../views/dialogs/confirm-dialog/confirm-dialog';
import {MatIconModule} from '@angular/material/icon'
import { ConfirmDialogResult } from '../models/requests/dashboardRequest';

@Injectable({
  providedIn: 'root'
})
export class NolongerPatientDialogService {

  constructor(
    private apiService: ConfigService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer
  ) {}

  
confirmbox(row: any): Promise<ConfirmDialogResult | undefined> {

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

  return dialogRef.afterClosed().toPromise();
}


 
}
