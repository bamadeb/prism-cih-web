import { Component, Inject, ViewChild, OnInit } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogContent,
  MatDialogActions,
  MatDialogTitle
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect, MatOption } from '@angular/material/select';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../../../services/api.service';
import { UserDataService } from '../../../services/user-data-service';
import {
  LogRequest,
  TransferRequest,
  UpdateoutreachMemberRequest
} from '../../../models/requests/dashboardRequest';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-transfer-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatCard,
    MatCardContent,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
  ],
  templateUrl: './transfer-dialog.html',
  styleUrl: './transfer-dialog.css',
})
export class TransferDialog implements OnInit {

  isLoading = false;
  transferFormGroup!: FormGroup;
  userList: any[] = [];

  constructor(
    private fb: FormBuilder,
    private apiService: ConfigService,
    private userData: UserDataService,
    private dialogRef: MatDialogRef<TransferDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {
    this.buildForm();
  }

  private buildForm(): void {
    this.transferFormGroup = this.fb.group({
      department_id: [null, Validators.required],
      user_id: [null, Validators.required],
      referring_reason: [''],
    });
  }

  // ========================= TRANSFER =========================
  async transfer(): Promise<void> {

    if (this.transferFormGroup.invalid) {
      this.transferFormGroup.markAllAsTouched();
      return;
    }

    const formValue = this.transferFormGroup.value;
    this.isLoading = true;

    try {
      const user = this.userData.getUser();

      const members = Array.isArray(this.data.members)
        ? this.data.members
        : [this.data.members];

      // 1️⃣ INSERT TRANSFER RECORDS
      const payload: TransferRequest = {
        table_name: 'MEM_REFERRING',
        insertDataArray: members.map((m: any) => ({
          medicaid_id: m.medicaid_id,
          department_id: formValue.department_id,
          referring_reason: formValue.referring_reason,
          refer_to: formValue.user_id,
          refer_by: user.ID
        }))
      };

      await this.addplanMember(payload);

      // 2️⃣ UPDATE OUTREACH MEMBERS (BULK)
      await this.updateoutreachMember(members, formValue.user_id);

      // 3️⃣ INSERT LOGS
      const logPayload: LogRequest = {
        table_name: 'MEM_SYSTEM_LOG',
        insertDataArray: members.map((m: any) => ({
          medicaid_id: m.medicaid_id,
          log_name: 'TRANSFER MEMBER',
          log_details: `TRANSFER MEMBER TO ${m.medicaid_id}`,
          log_status: 'Success',
          log_by: user.ID,
          action_type: 'TRANSFER MEMBER'
        }))
      };

      await this.add_system_log(logPayload);

      this.afterSuccess();

    } catch (err: any) {
      alert(err?.message || 'Something went wrong');
      console.warn(err);
    } finally {
      this.isLoading = false;
    }
  }

  // ========================= UPDATE OUTREACH =========================
  async updateoutreachMember(members: any[], user_id: number): Promise<void> {
 
     const updateData1 = members.map((m: any) => ({
      medicaid_id: m.medicaid_id,
      Care_Coordinator_id: user_id
    }));
    //console.log(updateData1);
    const payload: UpdateoutreachMemberRequest = {
      table_name: 'MEM_OUTREACH_MEMBERS',
      id_field_name: 'medicaid_id',
      updates: updateData1   // send array directly
    };     

    await this.updatemember(payload);
  }

  updatemember(request: UpdateoutreachMemberRequest): Promise<any> {
    return this.apiService.multipleRowAndFieldUpdate<UpdateoutreachMemberRequest>(request);
  }

  // ========================= DEPARTMENT CHANGE =========================
  onDepartmentChange(departmentId: number): void {
    if (!departmentId) return;

    this.isLoading = true;
    this.apiService.getUsersByDepartment({ department_id: departmentId })
      .then((res: any) => {
        this.userList = res?.data || [];
      })
      .finally(() => this.isLoading = false);
  }

  // ========================= SUCCESS =========================
  private afterSuccess(): void {
  const members = Array.isArray(this.data.members)
    ? this.data.members
    : [this.data.members];

  const transferredIds = members.map((m: any) => m.medicaid_id);

  this.resetForm();

  this.dialogRef.close({
    refresh: true,
    removedIds: transferredIds   // 👈 send back IDs
  });
}


  private resetForm(): void {
    this.transferFormGroup.reset({
      department_id: null,
      user_id: null,
      referring_reason: ''
    });
  }

  // ========================= API HELPERS =========================
  addplanMember(request: TransferRequest): Promise<any> {
    return this.apiService.insert<any, TransferRequest>(request);
  }

  add_system_log(request: LogRequest): Promise<any> {
    return this.apiService.insert<any, LogRequest>(request);
  }

  close(): void {
    this.dialogRef.close(true);
  }
}
