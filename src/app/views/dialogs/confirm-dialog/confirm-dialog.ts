import { Component, Inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { UpdateMemberRequest,LogRequest } from '../../../models/requests/dashboardRequest';
import { ConfigService } from '../../../services/api.service';
import { UserDataService } from '../../../services/user-data-service';
import { MatProgressSpinner } from "@angular/material/progress-spinner";

@Component({
  selector: 'app-confirm-dialog',
  imports: [ CommonModule,
    MatDialogModule,     // ✅ REQUIRED
    MatButtonModule,
    MatProgressSpinner,
    MatIconModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
 isLoading = false;
   constructor(
    private dialogRef: MatDialogRef<ConfirmDialog>,private apiService: ConfigService,private userData: UserDataService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  async confirm(result: boolean, medicaidId: number) {
  try {
    if (result) {
      this.isLoading = true;

      const payload: UpdateMemberRequest = {
        table_name: 'MEM_MEMBERS',
        id_field_name: 'RECIP_NO',
        id_field_value: medicaidId,
        updateData: {
          NO_LONGER_PATIENT_FLAG: 1,
          NO_LONGER_PATIENT_DATE: new Date().toISOString().slice(0, 10)
        }
      };

      await this.updateMember(payload);
      const user = this.userData.getUser();
      const logpayload: LogRequest = {
        table_name: 'MEM_SYSTEM_LOG',
        insertDataArray: [{
          medicaid_id: medicaidId,
          log_name: 'UPDATE MEMBER',
          log_details: `MARK AS NO LONGER PATIENT - ${medicaidId}`,
          log_status: 'SUCCESS',
          log_by: user.ID,
          action_type: 'UPDATE MEMBER'
        }]
      };

      await this.add_system_log(logpayload);

      // ✅ IMPORTANT: notify parent
      this.dialogRef.close({
        refresh: true,
        medicaid_id: medicaidId
      });
      

    } else {
      this.dialogRef.close({ refresh: false });
    }
     

  } catch (error) {
    console.error('No longer patient update failed', error);
  }
}


  updateMember(request: UpdateMemberRequest): Promise<any> {
    return this.apiService.update<any,UpdateMemberRequest>(request);
  }

  add_system_log(request: LogRequest): Promise<any> {
    return this.apiService.insert<any, LogRequest>(request);
  }

}
