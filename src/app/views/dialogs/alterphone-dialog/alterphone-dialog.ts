import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { PhoneFormatPipe } from "../../../pipes/phone-format.pipe";
import { ConfigService } from '../../../services/api.service'; 
import { UserDataService } from '../../../services/user-data-service';
import { CommonModule } from '@angular/common';
import { MatCard, MatCardContent } from "@angular/material/card";
import { MatFormField, MatError, MatFormFieldModule } from "@angular/material/form-field"; 
import { FormBuilder, FormGroup, Validators,ReactiveFormsModule  } from '@angular/forms';
import { AltphoneRequest, LogRequest } from '../../../models/requests/dashboardRequest';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { MatIconModule } from '@angular/material/icon';
import { PhoneDigitsValidator } from '../../../validators/validators';

const digitsOnly = (v: any) => String(v ?? '').replace(/\D/g, '');

@Component({
  selector: 'app-alterphone-dialog',
  imports: [
    MatDialogContent, MatFormFieldModule, MatInputModule,
    MatButtonModule, PhoneFormatPipe, CommonModule, MatCard, MatCardContent,
    ReactiveFormsModule, MatFormField, MatError,
    MatProgressSpinner, MatIconModule
],
  templateUrl: './alterphone-dialog.html',
  styleUrls: ['./alterphone-dialog.css']
})
export class AlterphoneDialog implements OnInit{
  addAltphoneFormGroup!: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly dialogRef: MatDialogRef<AlterphoneDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private readonly fb: FormBuilder,
    private readonly apiService: ConfigService,
    private readonly userData: UserDataService
  ) {}

  ngOnInit(): void {
    this.buildForm();
  }

  private buildForm(): void {
    this.addAltphoneFormGroup = this.fb.group({
      alt_phone_no: ['', [Validators.required, PhoneDigitsValidator]]
    });

    this.addAltphoneFormGroup.valueChanges.subscribe(() => this.errorMessage = '');
  }

  // Compares digits only, so "(555) 123-4567" matches "5551234567".
  // A stored number with a leading US country code (11 digits) is compared on its last 10.
  private isDuplicatePhone(phone: string): boolean {
    const target = digitsOnly(phone);
    const m = this.data.member ?? {};
    const existing = [
      m.phone, m.HOME_PHONE, m.OTHER_PHONE,
      ...(this.data.alt_phone ?? []).map((p: any) => p.alt_phone_no)
    ];
    return existing.some(p => {
      const d = digitsOnly(p);
      return d.length >= 10 && d.slice(-10) === target;
    });
  }

  // ============================
  // SUBMIT HANDLER
  // ============================
  async submitAltphone(): Promise<void> {
    if (this.addAltphoneFormGroup.invalid) {
      this.addAltphoneFormGroup.markAllAsTouched();
      return;
    }

    if (this.isDuplicatePhone(this.addAltphoneFormGroup.value.alt_phone_no)) {
      this.errorMessage = 'This phone number is already on file for this member.';
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;

    try {
      const payload = this.buildPhonePayload();
      await this.apiService.insert(payload);

      // The phone is saved at this point; a failed audit-log write
      // shouldn't keep the dialog open and invite a duplicate submit.
      await this.logSuccess().catch(err => console.error('Audit log failed', err));
      this.closeWithRefresh();

    } catch (error: any) {
      console.error('Add alternative phone failed', error);
      this.errorMessage =
        error?.error?.message ||
        error?.error?.error ||
        'Failed to save the alternate phone. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  // ============================
  // PAYLOAD BUILDERS
  // ============================
  private buildPhonePayload(): AltphoneRequest {
    const user = this.userData.getUser();
    const f = this.addAltphoneFormGroup.value;

    return {
      table_name: 'MEM_ALT_PHONE',
      insertDataArray: [{
        medicaid_id: this.data.member.medicaid_id,
        alt_phone_no: f.alt_phone_no,
        add_by: user.ID
      }]
    };
  }

  private logSuccess(): Promise<any> {
    const user = this.userData.getUser();
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
    return this.apiService.insert(logpayload);
  }

  // ============================
  // HELPERS
  // ============================
  private closeWithRefresh(): void {
    this.dialogRef.close({
      refresh: true,
      medicaid_id: this.data.member.medicaid_id
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  formatPhone(event: Event): void {
    const input = event.target as HTMLInputElement;
    let digits = input.value.replace(/\D/g, '').slice(0, 10);
    let formatted = '';

    if (digits.length > 0) formatted = `(${digits.substring(0, 3)}`;
    if (digits.length >= 4) formatted += `) ${digits.substring(3, 6)}`;
    if (digits.length >= 7) formatted += `-${digits.substring(6, 10)}`;

    input.value = formatted;
    this.addAltphoneFormGroup.get('alt_phone_no')?.setValue(formatted, { emitEvent: false });
  }
}
