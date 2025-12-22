import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TransferDialog } from '../views/dialogs/transfer-dialog/transfer-dialog';

@Injectable({ providedIn: 'root' })
export class TransferDialogService {
     constructor(private dialog: MatDialog) {}
    
      open(rows: any[],departmentList:any[]): Promise<any> {
        //console.log(departmentList);
        const dialogRef: MatDialogRef<TransferDialog> =
          this.dialog.open(TransferDialog, {
            width: '700px',
            maxWidth: '90vw',
            disableClose: true,
            data: {
              title: `${rows.length} MEMBER SELECTED FOR TRANSFER`,
              members: rows,
              departmentList
            }
          });
    
        return dialogRef.afterClosed().toPromise();
      }

}