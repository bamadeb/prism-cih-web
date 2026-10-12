import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AddpageAccess } from '../views/dialogs/addpage-access/addpage-access/addpage-access';

@Injectable({ providedIn: 'root' })
export class PageAccessDialogService {

  constructor(private readonly dialog: MatDialog) {}

  /** ---------------- ADD PAGE ACCESS ---------------- */
  addDialog(
    roles: any[],
    pagelist: any[],
    existing: any[] = []
  ): MatDialogRef<AddpageAccess> {

    return this.openDialog({
      title: 'ADD PAGE ACCESS',
      roles,
      pagelist,
      existing,
      isEditMode: false
    });
  }

  /** ---------------- EDIT PAGE ACCESS ---------------- */
  editDialog(
    roles: any[],
    pagelist: any[],
    list: any,
    existing: any[] = []
  ): MatDialogRef<AddpageAccess> {

    return this.openDialog({
      title: 'UPDATE PAGE ACCESS',
      roles,
      pagelist,
      list,
      existing,
      isEditMode: true
    });
  }

  /** ---------------- PRIVATE COMMON DIALOG ---------------- */
  private openDialog(data: any): MatDialogRef<AddpageAccess> {
    return this.dialog.open(AddpageAccess, {
      width: '500px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data
    });
  }
}
