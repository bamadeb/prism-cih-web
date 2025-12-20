import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfigService } from './api.service'; 
import { Injectable } from '@angular/core';
import { AlteraddressDialog } from '../views/dialogs/alteraddress-dialog/alteraddress-dialog';

@Injectable({ providedIn: 'root' })
export class AlterAddressDialogService {

  constructor(
    private dialog: MatDialog,
    private apiService: ConfigService
  ) {}

  async showalterAddressListDialog(row: any): Promise<MatDialogRef<AlteraddressDialog>> {

    const request = { medicaid_id: row.medicaid_id };
    const res = await this.apiService.alternateaddressList<any>(request);
    return this.dialog.open(AlteraddressDialog, {
      width: '80vw',
      maxWidth: '900px', 
      data: {
        title: `ALTERNATE ADDRESS - ${row.FIRST_NAME} ${row.LAST_NAME} (#${row.MEM_NO})`,
        member: row,
        alt_address: res.data.altaddress || []
      }
    });
  }
}
