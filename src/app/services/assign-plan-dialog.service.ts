import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AssignplanDialog } from '../views/dialogs/assignplan-dialog/assignplan-dialog';

@Injectable({ providedIn: 'root' })
export class AssignPlanDialogService {
    constructor(private dialog: MatDialog) {}

  open(rows: any[]): Promise<any> {
    const dialogRef: MatDialogRef<AssignplanDialog> =
      this.dialog.open(AssignplanDialog, {
        width: '700px',
        maxWidth: '90vw',
        disableClose: true,
        data: {
          title: `ASSIGN PLAN TO (${rows.length}) ${rows.length === 1 ? 'MEMBER' : 'MEMBERS'}`,
          members: rows
        }
      });

    return dialogRef.afterClosed().toPromise();
  }

}