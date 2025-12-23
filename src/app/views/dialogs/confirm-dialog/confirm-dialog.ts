import { Component, Inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { UpdateMemberRequest,LogRequest } from '../../../models/requests/dashboardRequest';
import { ConfigService } from '../../../services/api.service';
import { UserDataService } from '../../../services/user-data-service';
import { MatProgressSpinner } from "@angular/material/progress-spinner";
//import { MatProgressSpinner } from "@angular/material/progress-spinner";

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinner
],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css'
})
export class ConfirmDialog {

  isLoading = false;

  constructor(
    private dialogRef: MatDialogRef<ConfirmDialog>,
    private apiService: ConfigService,
    private userData: UserDataService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  // ============================
  // CONFIRM ACTION
  // ============================
  async confirm(result: boolean, medicaidId: number): Promise<void> {
    if (!result) {
      this.dialogRef.close({ refresh: false });
      return;
    }

    this.isLoading = true;

    try {
      await this.markNoLongerPatient(medicaidId);
      await this.logAction(medicaidId);

      // ✅ notify parent
      this.dialogRef.close({
        refresh: true,
        medicaid_id: medicaidId
      });

    } catch (error) {
      console.error('No longer patient update failed', error);
      alert('Failed to update patient status. Please try again.');

    } finally {
      this.isLoading = false;
    }
  }

  // ============================
  // UPDATE MEMBER
  // ============================
  private markNoLongerPatient(medicaidId: number): Promise<any> {
    const payload: UpdateMemberRequest = {
      table_name: 'MEM_MEMBERS',
      id_field_name: 'RECIP_NO',
      id_field_value: medicaidId,
      updateData: {
        NO_LONGER_PATIENT_FLAG: 1,
        NO_LONGER_PATIENT_DATE: new Date().toISOString().slice(0, 10)
      }
    };

    return this.apiService.update(payload);
  }

  // ============================
  // SYSTEM LOG
  // ============================
  private logAction(medicaidId: number): Promise<any> {
    const user = this.userData.getUser();

    const logPayload: LogRequest = {
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

    return this.apiService.insert(logPayload);
  }
}
