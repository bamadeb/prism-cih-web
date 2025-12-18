import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigService } from './api.service';
import { MedicaidIdRequest } from '../models/requests/commonRequest';
import { AddAction } from '../views/shared/components/add-action/add-action';

@Injectable({
  providedIn: 'root'
})
export class AddActionDialogService {

  constructor(
    private apiService: ConfigService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer
  ) {}
isLoading = false;
  async showAddActionDialog(medicaid_id: string, member_name: string,member_db: string): Promise<void> {
    // const request: MedicaidIdRequest = {
    //   medicaid_id: medicaid_id
    // };
        this.isLoading = true;
    this.openDialog(medicaid_id,member_name,member_db);
    //return true;
    // return this.apiService.benefitsList<any>(request)
    //   .then(res => {
    //     const benefitsList = res?.data || [];
    //     this.openDialog(row, benefitsList);
    //   })
    //   .catch(err => {
    //     console.error('Benefits error:', err);
    //   });
  }

  private openDialog(medicaid_id: string, member_name: string,member_dob: string) {
    
    this.isLoading = true;
    this.dialog.open(AddAction, {
      width: '95vw',
      maxWidth: '100vw',
     // panelClass: 'xl-dialog',
     panelClass: 'add-action-dialog',
      data: {
        medicaid_id,
        member_name,
        member_dob
      }
    });
  }

  private escapeHtml(text: string = ''): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
