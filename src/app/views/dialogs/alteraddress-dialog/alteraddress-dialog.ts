import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ConfigService } from '../../../services/api.service'; 
import { UserDataService } from '../../../services/user-data-service';
import { CommonModule } from '@angular/common';
import { MatCard, MatCardContent } from "@angular/material/card";
import { MatFormField, MatError, MatFormFieldModule } from "@angular/material/form-field"; 
import { FormBuilder, FormGroup, Validators,ReactiveFormsModule  } from '@angular/forms';
import { AltaddressRequest, LogRequest } from '../../../models/requests/dashboardRequest';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinner } from "@angular/material/progress-spinner";

@Component({
  selector: 'app-alteraddress-dialog',
   providers: [provideNativeDateAdapter()], // ✅ REQUIRED
  imports: [MatDialogContent,MatDatepickerModule,MatNativeDateModule, MatFormFieldModule, MatInputModule, MatDialogActions, MatButtonModule, CommonModule, MatCard, MatCardContent, ReactiveFormsModule, MatFormField, MatError],
  templateUrl: './alteraddress-dialog.html',
  styleUrl: './alteraddress-dialog.css',
})
export class AlteraddressDialog { 
addAltaddressFormGroup!: FormGroup;
  isLoading = false;

  constructor(
    private dialogRef: MatDialogRef<AlteraddressDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private apiService: ConfigService,
    private userData: UserDataService,
  ) {}

  ngOnInit(): void {
    this.buildForm(); 
  }

   private buildForm(): void {
    this.addAltaddressFormGroup = this.fb.group({
      alt_address: ['', Validators.required],
      alt_city: ['', Validators.required],
      alt_state: ['', Validators.required],
      alt_zip: ['', Validators.required],
      add_date: [''],
    });
  }

  async submitAltAddress(): Promise<void> {

    if (this.addAltaddressFormGroup.invalid) {
      this.addAltaddressFormGroup.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    const formValues = this.addAltaddressFormGroup.value;
    console.log(formValues);
    try {   

        const user = this.userData.getUser(); 
        const payload: AltaddressRequest = {
          table_name: 'MEM_ALT_ADDRESS',
          insertDataArray: [{
            medicaid_id: this.data.member.medicaid_id,
            alt_address: formValues.alt_address,
            alt_city: formValues.alt_city,
            alt_state: formValues.alt_state,
            alt_zip: formValues.alt_zip,
            add_date: formValues.add_date, 
            add_by: user.ID 
          }]
        };
        await this.addAltaddress(payload);
        const logpayload: LogRequest = {
                table_name: 'MEM_SYSTEM_LOG',
                insertDataArray: [{
                  medicaid_id: this.data.member.medicaid_id,
                  log_name: 'ADD ALTERNATIVE ADDRESS',
                  log_details: `ADD ALTERNATIVE ADDRESS FOR ${this.data.member.medicaid_id}`,
                  log_status: 'SUCCESS',
                  log_by: user.ID,
                  action_type: 'ADD ALTERNATIVE ADDRESS'
                }]
          };
        await this.add_system_log(logpayload);
        // ✅ success
        this.afterSuccess();
    } catch (error) {
      console.error('Add alternative address failed', error);
    } finally {
      this.isLoading = false;
    }
}

 addAltaddress(request: AltaddressRequest): Promise<any> {
     return this.apiService.insert<any, AltaddressRequest>(request);
  }

  add_system_log(request: LogRequest): Promise<any> {
    return this.apiService.insert<any, LogRequest>(request);
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
    this.addAltaddressFormGroup.reset();
  }

  formatZip(event: Event) {
    const input = event.target as HTMLInputElement;
    // allow only digits, max 9
    let digits = input.value.replace(/\D/g, '').substring(0, 9);
    let formatted = digits;
    // ZIP+4 format
    if (digits.length > 5) {
      formatted = digits.substring(0, 5) + '-' + digits.substring(5);
    }
    input.value = formatted;
    this.addAltaddressFormGroup.get('alt_zip')?.setValue(formatted, { emitEvent: false });
}

close() {
  this.dialogRef.close(true);
}

}
