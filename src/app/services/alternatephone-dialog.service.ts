import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfigService } from './api.service';
import { AlterphoneDialog } from '../views/alterphone-dialog/alterphone-dialog';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AlterPhoneDialogService {

  constructor(
    private dialog: MatDialog,
    private apiService: ConfigService
  ) {}

  async showalterPhoneListDialog(row: any): Promise<MatDialogRef<AlterphoneDialog>> {

    const request = { medicaid_id: row.medicaid_id };
    const res = await this.apiService.alternatephoneList<any>(request);
    return this.dialog.open(AlterphoneDialog, {
      width: '80vw',
      maxWidth: '900px', 
      data: {
        title: `ALTERNATE PHONE NUMBER - ${row.FIRST_NAME} ${row.LAST_NAME} (#${row.MEM_NO})`,
        member: row,
        alt_phone: res.data.prismMemberaltphone || []
      }
    });
  }
}
