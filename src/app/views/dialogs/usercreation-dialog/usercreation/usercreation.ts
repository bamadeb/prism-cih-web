import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { ConfigService } from '../../../../services/api.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDatepicker } from "@angular/material/datepicker";
import { provideNativeDateAdapter } from '@angular/material/core'; 
import { UserDataService } from '../../../../services/user-data-service';

@Component({
  selector: 'app-usercreation',
   providers: [provideNativeDateAdapter()], 
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinner,
    MatDatepicker
],
  templateUrl: './usercreation.html',
  styleUrl: './usercreation.css',
})
export class Usercreation {

  userCreationFormGroup!: FormGroup;
    hidePassword = true;
    isLoading = false;
    isEditMode = false;
    roles: any[] = [];
    currentPlanId: number | null = null;
  
    constructor(
      @Inject(MAT_DIALOG_DATA) public data: any,
      private fb: FormBuilder,
      private apiService: ConfigService,
      private userData: UserDataService,
      private dialogRef: MatDialogRef<Usercreation>
    ) {}
  
    // 🔹 INIT
    ngOnInit(): void {
      this.buildForm();
  
      // if (this.data?.isEditMode && this.data?.plan) {
      //   this.enableEditMode(this.data.plan);
      // }
    }
  
    // 🔹 FORM BUILDER
    buildForm() {
  // ✅ create form FIRST
  this.userCreationFormGroup = this.fb.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    role_id: [9, Validators.required],
    request_date: [new Date(), Validators.required],
    status: ['0', Validators.required]
  });

  // ✅ then load roles async
  this.loadRoles();
}

async loadRoles() {
  const res = await this.apiService.users<any>();
  this.roles = res?.data?.roles ?? [];
}
  
    // 🔹 EDIT MODE SETUP
    // private enableEditMode(plan: any): void { 
    //   this.isEditMode = true;
    //   this.currentPlanId = plan.id;
  
    //   this.userCreationFormGroup.patchValue({
    //     plan_name: plan.plan_name,
    //     start_date: plan.start_date ? new Date(plan.start_date) : null,
    //     end_date: plan.end_date ? new Date(plan.end_date) : null,
    //     status: plan.status 
    //   });       
    // }
  
    // 🔹 SUBMIT HANDLER
    async submitRequest(): Promise<void> {
      if (this.userCreationFormGroup.invalid) {
        this.userCreationFormGroup.markAllAsTouched();
        return;
      }
  
      this.isLoading = true;
      const formValue = this.userCreationFormGroup.getRawValue();
      console.log(formValue);
      
      try {
        await this.processRequest(formValue);
        this.dialogRef.close({ refresh: true });
  
      } catch (error: any) {
        this.handleError(error);
      } finally {
        this.isLoading = false;
      }
    }
  
    // 🔹 PROCESS ADD / UPDATE
    private async processRequest(formValue: any): Promise<void> {

      if (this.isEditMode) {
        //await this.updatePlan(formValue);
      } else {      
        await this.insertRequest(formValue);
      }
    } 
  
    // 🔹 INSERT PLAN
    private async insertRequest(formValue: any): Promise<void> {
      const user = this.userData.getUser();
      const payload = {
        table_name: 'USER_CREATION_REQUEST',
        insertDataArray: [{
          FIRST_NAME: formValue.first_name,
          LAST_NAME: formValue.last_name,
          EMAIL: formValue.email,
          PHONE: formValue.phone,
          ROLE_ID: formValue.role_id,
          STATUS: formValue.status,
          DATE_OF_REQUEST: formValue.request_date,
          ADDED_BY: user.ID,
        }]
      };
  
      await this.apiService.insert(payload);
    }
  
     
  
    // 🔹 UPDATE PLAN
    // private async updatePlan(formValue: any): Promise<void> {
    //   if (!this.currentPlanId) {
    //     throw { code: 'PLAN_ID_MISSING' };
    //   }
  
    
  
    // 🔹 ERROR HANDLER
    private handleError(error: any): void {
      console.error('❌ Request operation failed:', error);
  
      // switch (error?.code) {
      //   case 'PLAN_ID_MISSING':
      //     alert('Plan ID missing. Please refresh and try again.');
      //     break;
  
      //   default:
      //     alert('Something went wrong. Please try again.');
      // }
    } 

     formatPhone(event: Event): void {
    const input = event.target as HTMLInputElement;
    let digits = input.value.replace(/\D/g, '').slice(0, 10);
    let formatted = '';

    if (digits.length > 0) formatted = `(${digits.substring(0, 3)}`;
    if (digits.length >= 4) formatted += `) ${digits.substring(3, 6)}`;
    if (digits.length >= 7) formatted += `-${digits.substring(6, 10)}`;

    input.value = formatted;
    this.userCreationFormGroup.get('phone')?.setValue(formatted, { emitEvent: false });
  }
  
    // 🔹 CLOSE DIALOG
    close(): void {
      this.dialogRef.close({ refresh: false });
    }

}
