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

import { ConfigService } from '../../../services/api.service';
import {
  UserRequest,
  UpdateUserRequest,
  UsernameRequest
} from '../../../models/requests/userRequest';

@Component({
  selector: 'app-adduser-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinner
  ],
  templateUrl: './adduser-dialog.html',
  styleUrls: ['./adduser-dialog.css']
})
export class AdduserDialog implements OnInit {

  addUserFormGroup!: FormGroup;
  hidePassword = true;
  isLoading = false;
  isEditMode = false;
  currentUserId: number | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private apiService: ConfigService,
    private dialogRef: MatDialogRef<AdduserDialog>
  ) {}

  // 🔹 INIT
  ngOnInit(): void {
    this.buildForm();

    if (this.data?.isEditMode && this.data?.user) {
      this.enableEditMode(this.data.user);
    }
  }

  // 🔹 FORM BUILDER
  private buildForm(): void {
    this.addUserFormGroup = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      role: ['', Validators.required],
      department: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      status: ['', Validators.required]
    });
  }

  // 🔹 EDIT MODE SETUP
  private enableEditMode(user: any): void {
    //console.log(user);
    this.isEditMode = true;
    this.currentUserId = user.ID;

    this.addUserFormGroup.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: user.password,
      role: user.roleId,
      department: user.department_id,
      status: Number(user.member_status)
    });

    this.addUserFormGroup.get('email')?.disable();
  }

  // 🔹 SUBMIT HANDLER
  async submitUser(): Promise<void> {
    if (this.addUserFormGroup.invalid) {
      this.addUserFormGroup.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValue = this.addUserFormGroup.getRawValue();

    try {
      await this.processUser(formValue);
      this.dialogRef.close({ refresh: true });

    } catch (error: any) {
      this.handleError(error);
    } finally {
      this.isLoading = false;
    }
  }

  // 🔹 PROCESS ADD / UPDATE
  private async processUser(formValue: any): Promise<void> {
    if (this.isEditMode) {
      await this.updateUser(formValue);
    } else {
      await this.checkEmailExists(formValue.email);
      await this.insertUser(formValue);
    }
  }

  // 🔹 EMAIL CHECK
  private async checkEmailExists(email: string): Promise<void> {
    const params: UsernameRequest = { username: email };
    const res = await this.apiService.checkuserexist<any>(params);

    if (Array.isArray(res?.data) && res.data.length > 0) {
      throw { code: 'EMAIL_EXISTS' };
    }
  }

  // 🔹 INSERT USER
  private async insertUser(formValue: any): Promise<void> {
    const payload: UserRequest = {
      table_name: 'MEM_USERS',
      insertDataArray: [{
        FistName: formValue.firstName.trim(),
        LastName: formValue.lastName.trim(),
        EmailID: formValue.email,
        Password: formValue.password,
        role_id: formValue.role,
        department_id: formValue.department,
        member_status: Number(formValue.status)
      }]
    };

    await this.apiService.insert<any, UserRequest>(payload);
  }

  // 🔹 UPDATE USER
  private async updateUser(formValue: any): Promise<void> {
    if (!this.currentUserId) {
      throw { code: 'USER_ID_MISSING' };
    }

    const payload: UpdateUserRequest = {
      table_name: 'MEM_USERS',
      id_field_name: 'ID',
      id_field_value: this.currentUserId,
      updateData: {
        FistName: formValue.firstName.trim(),
        LastName: formValue.lastName.trim(),
        ...(formValue.password && { Password: formValue.password }),
        role_id: formValue.role,
        department_id: formValue.department,
        member_status: Number(formValue.status)
      }
    };

    await this.apiService.update<any, UpdateUserRequest>(payload);
  }

  // 🔹 ERROR HANDLER
  private handleError(error: any): void {
    console.error('❌ User operation failed:', error);

    switch (error?.code) {
      case 'EMAIL_EXISTS':
        this.addUserFormGroup.get('email')?.setErrors({ exists: true });
        break;

      case 'USER_ID_MISSING':
        alert('User ID missing. Please refresh and try again.');
        break;

      default:
        alert('Something went wrong. Please try again.');
    }
  }

  // 🔹 CLOSE DIALOG
  close(): void {
    this.dialogRef.close({ refresh: false });
  }
}
