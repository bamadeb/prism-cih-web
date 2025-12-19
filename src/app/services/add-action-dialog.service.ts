import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigService } from './api.service';
//import { MedicaidIdRequest } from '../models/requests/commonRequest';
import { AddAction } from '../views/shared/components/add-action/add-action';
import { firstValueFrom } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class AddActionDialogService {

  constructor(
    //private apiService: ConfigService,
    private dialog: MatDialog,
    //private sanitizer: DomSanitizer
  ) {}
  //isLoading = false;
  // async showAddActionDialog(medicaid_id: string, member_name: string,member_dob: string): Promise<MatDialogRef<AddAction>> {
  //    //this.isLoading = true;
  //   return await this.dialog.open(AddAction, {
  //     width: '95vw',
  //     maxWidth: '100vw',
  //    // panelClass: 'xl-dialog',
  //    panelClass: 'add-action-dialog',
  //     data: {
  //       medicaid_id,
  //       member_name,
  //       member_dob
  //     }
  //   });
  //   //return dialogRef.afterOpened().toPromise();
  // }
showAddActionDialog(medicaid_id: string,  member_name: string,  member_dob: string): Promise<void> {

  const dialogRef = this.dialog.open(AddAction, {
    width: '95vw',
    maxWidth: '100vw',
    panelClass: 'add-action-dialog',
    data: { medicaid_id, member_name, member_dob }
  });

  return firstValueFrom(dialogRef.afterOpened());
}

  // private openDialog(medicaid_id: string, member_name: string,member_dob: string) {
    
  //   //this.isLoading = true;
  //   this.dialog.open(AddAction, {
  //     width: '95vw',
  //     maxWidth: '100vw',
  //    // panelClass: 'xl-dialog',
  //    panelClass: 'add-action-dialog',
  //     data: {
  //       medicaid_id,
  //       member_name,
  //       member_dob
  //     }
  //   });
  // }

 
}
