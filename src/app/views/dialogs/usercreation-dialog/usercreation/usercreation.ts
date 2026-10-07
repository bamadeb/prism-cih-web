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
import {
  EMAIL_MAX,
  EMAIL_RE,
  NAME_MAX,
  NameValidator,
  NotFutureDateValidator,
  PhoneDigitsValidator
} from '../../../../validators/validators';

// USER_CREATION_REQUEST.STATUS values that still count as an open request.
const OPEN_REQUEST_STATUSES = new Set([0, 1]); // NEW, IN-PROCESS

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
export class Usercreation implements OnInit{

  userCreationFormGroup!: FormGroup;
    hidePassword = true;
    isLoading = false;
    isEditMode = false;
    roles: any[] = [];
    currentPlanId: number | null = null;
    errorMessage = '';
    readonly today = new Date();
  
    constructor(
      @Inject(MAT_DIALOG_DATA) public data: any,
      private readonly fb: FormBuilder,
      private readonly apiService: ConfigService,
      private readonly userData: UserDataService,
      private readonly dialogRef: MatDialogRef<Usercreation>
    ) {}
  
    // 🔹 INIT
    ngOnInit(): void {
      this.buildForm();
  

    }
  
    // 🔹 FORM BUILDER
    buildForm() {
  // ✅ create form FIRST
  this.userCreationFormGroup = this.fb.group({
    first_name: ['', [Validators.required, Validators.maxLength(NAME_MAX), NameValidator]],
    last_name: ['', [Validators.required, Validators.maxLength(NAME_MAX), NameValidator]],
    email: ['', [Validators.required, Validators.maxLength(EMAIL_MAX), Validators.pattern(EMAIL_RE)]],
    phone: ['', [Validators.required, PhoneDigitsValidator]],
    role_id: [9, Validators.required],
    request_date: [new Date(), [Validators.required, NotFutureDateValidator]],
    // A new request always starts as NEW; the field is hidden on create.
    status: ['0', Validators.required]
  });

  this.userCreationFormGroup.valueChanges.subscribe(() => this.errorMessage = '');

  // ✅ then load roles async
  this.loadRoles();
}

async loadRoles() {
  try {
    const res = await this.apiService.users<any>();
    this.roles = res?.data?.roles ?? [];
  } catch (error) {
    console.error('Failed to load roles', error);
    this.errorMessage = 'Could not load roles. Please close and try again.';
  }
}
  
  
    // 🔹 SUBMIT HANDLER
    async submitRequest(): Promise<void> {
      if (this.userCreationFormGroup.invalid) {
        this.userCreationFormGroup.markAllAsTouched();
        return;
      }
  
      this.errorMessage = '';
      this.isLoading = true;
      const formValue = this.userCreationFormGroup.getRawValue();
      formValue.first_name = formValue.first_name.trim();
      formValue.last_name = formValue.last_name.trim();
      formValue.email = formValue.email.trim();

      try {
        if (!this.isEditMode) {
          formValue.status = '0';
          await this.checkDuplicateEmail(formValue.email);
        }
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
  
     
  

  
    
  
    // 🔹 DUPLICATE EMAIL CHECK (existing user, or an open request)
    private async checkDuplicateEmail(email: string): Promise<void> {
      const existing = await this.apiService.checkuserexist<any>({ username: email });
      if (Array.isArray(existing?.data) && existing.data.length > 0) {
        throw { code: 'USER_EXISTS' };
      }

      const requests = await this.apiService.userRequestList<any>();
      const target = email.toLowerCase();
      const hasOpenRequest = (requests?.data?.plans ?? []).some((r: any) =>
        String(r.EMAIL ?? '').trim().toLowerCase() === target &&
        OPEN_REQUEST_STATUSES.has(Number(r.STATUS))
      );
      if (hasOpenRequest) {
        throw { code: 'REQUEST_EXISTS' };
      }
    }

    // 🔹 ERROR HANDLER
    private handleError(error: any): void {
      console.error('❌ Request operation failed:', error);

      const emailControl = this.userCreationFormGroup.get('email');
      if (error?.code === 'USER_EXISTS') {
        emailControl?.setErrors({ userExists: true });
        emailControl?.markAsTouched();
        return;
      }
      if (error?.code === 'REQUEST_EXISTS') {
        emailControl?.setErrors({ requestExists: true });
        emailControl?.markAsTouched();
        return;
      }

      this.errorMessage =
        error?.error?.message ||
        error?.error?.error ||
        'Failed to save the request. Please try again.';
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
