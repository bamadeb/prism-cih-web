import { Component, Inject, ViewChild, OnInit } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogContent,
  MatDialogActions,
  MatDialogTitle
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCard, MatCardContent } from "@angular/material/card";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatSelect, MatOption } from "@angular/material/select";
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../../../services/api.service';
import { UserDataService } from '../../../services/user-data-service';
import {
  LogRequest,
  MemberplanRequest,
  PlanexistRequest
} from '../../../models/requests/dashboardRequest';

@Component({
  selector: 'app-assignplan-dialog',
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
    MatOption
  ],
  templateUrl: './assignplan-dialog.html',
  styleUrl: './assignplan-dialog.css',
})
export class AssignplanDialog implements OnInit {

  isLoading = false;
  assignPlanFormGroup!: FormGroup;

  // 🔹 ACTION dropdown (outside form)
  selectedAction: string | null = null;

  @ViewChild('actionSelect') actionSelect!: MatSelect;

  constructor(
    private fb: FormBuilder,
    private apiService: ConfigService,
    private userData: UserDataService,
    private dialogRef: MatDialogRef<AssignplanDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {
    this.buildForm();
  }

  private buildForm(): void {
    this.assignPlanFormGroup = this.fb.group({
      plan_id: [null, Validators.required]
    });
  }

  async assignPlan(): Promise<void> {

    if (this.assignPlanFormGroup.invalid) {
      this.assignPlanFormGroup.markAllAsTouched();
      return;
    }

    const { plan_id } = this.assignPlanFormGroup.value;

    if (!plan_id) {
      alert('⚠️ Please select a plan.');
      return;
    }

    this.isLoading = true;

    try {
      const user = this.userData.getUser();

      // 🔹 Normalize members (single / multiple)
      const members = Array.isArray(this.data.members)
        ? this.data.members
        : [this.data.members];

      // 🔹 1️⃣ VERIFY PLAN EXISTS
      await Promise.all(
        members.map(async (m: any) => {
          const params: PlanexistRequest = {
            medicaid_id: m.medicaid_id,
            plan_id
          };

          const res = await this.varifyplan(params);

          if (res?.data?.length > 0) {
            throw new Error(`Plan already exists for member #${m.medicaid_id}`);
          }
        })
      );

      // 🔹 2️⃣ INSERT PLAN
      const payload: MemberplanRequest = {
        table_name: 'MEM_PLAN_MEMBERS',
        insertDataArray: members.map((m: any) => ({
          medicaid_id: m.medicaid_id,
          plan_id,
          added_by: user.ID
        }))
      };

      await this.addplanMember(payload);

      // 🔹 3️⃣ INSERT LOGS
      const logPayload: LogRequest = {
        table_name: 'MEM_SYSTEM_LOG',
        insertDataArray: members.map((m: any) => ({
          medicaid_id: m.medicaid_id,
          log_name: 'ASSIGN PLAN',
          log_details: `PLAN ASSIGNED TO ${m.medicaid_id}`,
          log_status: 'Success',
          log_by: user.ID,
          action_type: 'ASSIGN PLAN'
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

  // ✅ AFTER SUCCESS
  private afterSuccess(): void {
    this.resetForm();
    this.dialogRef.close({ refresh: true });
  }

  // ✅ RESET FORM + ACTION DROPDOWN
  private resetForm(): void {
    this.assignPlanFormGroup.reset({ plan_id: null });
    this.selectedAction = null; // resets ACTION dropdown
  }


addplanMember(request: MemberplanRequest): Promise<any> {
     return this.apiService.insert<any, MemberplanRequest>(request);
  }

varifyplan(request: PlanexistRequest): Promise<any> {
  return this.apiService.checkplanexist<any>(request);
}

add_system_log(request: LogRequest): Promise<any> {
    return this.apiService.insert<any, LogRequest>(request);
  }

close() {
    this.dialogRef.close(true);
  }

}
