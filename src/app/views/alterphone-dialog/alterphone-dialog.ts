import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { PhoneFormatPipe } from "../../pipes/phone-format.pipe";
import { ConfigService } from '../../services/api.service'; 
import { UserDataService } from '../../services/user-data-service';
import { CommonModule } from '@angular/common';
import { MatCard, MatCardContent } from "@angular/material/card";
import { MatFormField, MatError, MatFormFieldModule } from "@angular/material/form-field"; 
import { FormBuilder, FormGroup, Validators,ReactiveFormsModule  } from '@angular/forms';
import { AltphoneRequest, LogRequest } from '../../models/requests/dashboardRequest';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-alterphone-dialog',
  imports: [MatDialogContent, MatFormFieldModule, MatInputModule,MatDialogActions, MatButtonModule, PhoneFormatPipe, CommonModule, MatCard, MatCardContent,ReactiveFormsModule, MatFormField, MatError],
  templateUrl: './alterphone-dialog.html',
  styleUrl: './alterphone-dialog.css',
})
export class AlterphoneDialog { 
addAltphoneFormGroup!: FormGroup;
  isLoading = false;

  constructor(
    private dialogRef: MatDialogRef<AlterphoneDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private apiService: ConfigService,
    private userData: UserDataService,
  ) {}

  ngOnInit(): void {
    this.buildForm(); 
  }

   private buildForm(): void {
    this.addAltphoneFormGroup = this.fb.group({
      alt_phone_no: ['', Validators.required]
    });
  }

  async submitAltphone(): Promise<void> {

    if (this.addAltphoneFormGroup.invalid) {
      this.addAltphoneFormGroup.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValues = this.addAltphoneFormGroup.value;
    try {   

        const user = this.userData.getUser(); 
        const payload: AltphoneRequest = {
          table_name: 'MEM_ALT_PHONE',
          insertDataArray: [{
            medicaid_id: this.data.member.medicaid_id,
            alt_phone_no: formValues.alt_phone_no, 
            add_by: user.ID 
          }]
        };
        await this.addAltphone(payload);
        const logpayload: LogRequest = {
                table_name: 'MEM_SYSTEM_LOG',
                insertDataArray: [{
                  medicaid_id: this.data.member.medicaid_id,
                  log_name: 'ADD ALTERNATIVE PHONE',
                  log_details: `ADD ALTERNATIVE PHONE FOR ${this.data.member.medicaid_id}`,
                  log_status: 'Success',
                  log_by: user.ID,
                  action_type: 'ADD ALTERNATIVE PHONE'
                }]
          };
        await this.add_system_log(logpayload);

        // ✅ success
        this.afterSuccess();
    } catch (error) {
      console.error('Alternative phone add failed', error);
    } finally {
      this.isLoading = false;
    }
}

 addAltphone(request: AltphoneRequest): Promise<any> {
     return this.apiService.insert<any, AltphoneRequest>(request);
  }

  add_system_log(request: LogRequest): Promise<any> {
    return this.apiService.insert<any, LogRequest>(request);
  }

  formatPhone(event: Event) {
  const input = event.target as HTMLInputElement;

  // Remove non-digits
  let digits = input.value.replace(/\D/g, '').substring(0, 10);

  let formatted = '';

  if (digits.length > 0) {
    formatted = '(' + digits.substring(0, 3);
  }
  if (digits.length >= 4) {
    formatted += ') ' + digits.substring(3, 6);
  }
  if (digits.length >= 7) {
    formatted += '-' + digits.substring(6, 10);
  }

  input.value = formatted;
  this.addAltphoneFormGroup.get('alt_phone_no')?.setValue(formatted, {
    emitEvent: false
  });
}

  private afterSuccess(): void {
    this.isLoading = false;
    this.resetForm(); 
    // 🔔 Notify parent that data changed
    this.dialogRef.close({
      refresh: true,
      medicaid_id: this.data.member.medicaid_id
    });
  }

  private resetForm(): void { 
    this.addAltphoneFormGroup.reset();
  }

  confirm() {
    this.dialogRef.close(true);
  }

}
