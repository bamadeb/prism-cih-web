import { Component, Inject,OnInit } from '@angular/core';
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
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { NotBlankValidator, ZipValidator } from '../../../validators/validators';
import { US_STATES } from '../../../constants/us-states';

// Field limits for the alternate address form.
const ADDRESS_MAX = 150;
const CITY_MAX = 50;

@Component({
  selector: 'app-alteraddress-dialog',
   providers: [provideNativeDateAdapter()], // ✅ REQUIRED
  imports: [MatDialogContent, MatDatepickerModule, MatNativeDateModule, MatFormFieldModule, MatInputModule, MatButtonModule, CommonModule, MatCard, MatCardContent, ReactiveFormsModule, MatFormField, MatError, MatProgressSpinner, MatSelectModule, MatIconModule],
  templateUrl: './alteraddress-dialog.html',
  styleUrl: './alteraddress-dialog.css',
})
export class AlteraddressDialog implements OnInit{
  addAltaddressFormGroup!: FormGroup;
  isLoading = false;
  errorMessage = '';
  readonly states = US_STATES;
  readonly addressMax = ADDRESS_MAX;
  readonly cityMax = CITY_MAX;

  constructor(
    private readonly dialogRef: MatDialogRef<AlteraddressDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private readonly fb: FormBuilder,
    private readonly apiService: ConfigService,
    private readonly userData: UserDataService
  ) {}

  ngOnInit(): void {
    this.buildForm();
  }

  private buildForm(): void {
    this.addAltaddressFormGroup = this.fb.group({
      alt_address: ['', [Validators.required, Validators.maxLength(ADDRESS_MAX), NotBlankValidator]],
      alt_city: ['', [Validators.required, Validators.maxLength(CITY_MAX), NotBlankValidator]],
      alt_state: ['', Validators.required],
      alt_zip: ['', [Validators.required, ZipValidator]],
      add_date: ['']
    });

    this.addAltaddressFormGroup.valueChanges.subscribe(() => this.errorMessage = '');
  }

  // Same street + city + state + ZIP (ignoring case, spacing and punctuation)
  // as the member's primary address or an existing alternate address.
  private isDuplicateAddress(f: any): boolean {
    const key = (address: any, city: any, state: any, zip: any) =>
      [address, city, state, String(zip ?? '').replace(/\D/g, '').slice(0, 5)]
        .map(v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''))
        .join('|');

    const target = key(f.alt_address, f.alt_city, f.alt_state, f.alt_zip);
    const m = this.data.member ?? {};
    if (target === key(m.ADDR1, m.CITY, m.STATE, m.ZIP)) return true;
    return (this.data.alt_address ?? []).some((a: any) =>
      target === key(a.alt_address, a.alt_city, a.alt_state, a.alt_zip));
  }

  // ============================
  // SUBMIT HANDLER
  // ============================
  async submitAltAddress(): Promise<void> {
    if (this.addAltaddressFormGroup.invalid) {
      this.addAltaddressFormGroup.markAllAsTouched();
      return;
    }

    if (this.isDuplicateAddress(this.addAltaddressFormGroup.value)) {
      this.errorMessage = 'This address is already on file for this member.';
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;

    try {
      const payload = this.buildAddressPayload();
      await this.apiService.insert(payload);

      // The address is saved at this point; a failed audit-log write
      // shouldn't keep the dialog open and invite a duplicate submit.
      await this.logSuccess().catch(err => console.error('Audit log failed', err));
      this.closeWithRefresh();

    } catch (error: any) {
      console.error('Add alternative address failed', error);
      this.errorMessage =
        error?.error?.message ||
        error?.error?.error ||
        'Failed to save the alternate address. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  // ============================
  // PAYLOAD BUILDERS
  // ============================
  private buildAddressPayload(): AltaddressRequest {
    const user = this.userData.getUser();
    const f = this.addAltaddressFormGroup.value;

    return {
      table_name: 'MEM_ALT_ADDRESS',
      insertDataArray: [{
        medicaid_id: this.data.member.medicaid_id,
        alt_address: f.alt_address.trim(),
        alt_city: f.alt_city.trim(),
        alt_state: f.alt_state,
        alt_zip: f.alt_zip.trim(),
        add_date: this.formatDateToYMD(f.add_date),
        add_by: user.ID
      }]
    };
  }

  formatDateToYMD(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`; // m/d/Y format
  }

  private logSuccess(): Promise<any> {
    const user = this.userData.getUser();

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

  

  formatZip(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 9);
    input.value = digits.length > 5
      ? `${digits.slice(0, 5)}-${digits.slice(5)}`
      : digits;

    this.addAltaddressFormGroup
      .get('alt_zip')
      ?.setValue(input.value, { emitEvent: false });
  }
}

