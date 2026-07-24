import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Title } from '@angular/platform-browser';

import { ConfigService } from '../../services/api.service';
import { UserDataService } from '../../services/user-data-service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css',
})
export class ChangePassword implements OnInit, OnDestroy {

  newPassword = '';
  confirmPassword = '';
  isLoading = false;
  errorMessage = '';
  currentYear: number = new Date().getFullYear();
  bgImages = [
    'assets/images/1.jpg',
    'assets/images/2.jpg',
    'assets/images/3.jpg',
    'assets/images/4.jpg'
  ];
  currentIndex = 0;
  private intervalId!: ReturnType<typeof setInterval>;

  get passwordMismatch(): boolean {
    return !!this.confirmPassword && this.newPassword !== this.confirmPassword;
  }

  constructor(
    private readonly router: Router,
    private readonly titleService: Title,
    private readonly apiService: ConfigService,
    private readonly userData: UserDataService
  ) { }

  ngOnInit() {
    this.titleService.setTitle('PRISM :: CHANGE PASSWORD');
    this.intervalId = setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.bgImages.length;
    }, 4000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }

  async onSubmit(): Promise<void> {
    this.clearError();

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    const policyError = this.validatePasswordPolicy(this.newPassword);
    if (policyError) {
      this.errorMessage = policyError;
      return;
    }

    const user = this.userData.getUser();
    if (!user) {
      this.errorMessage = 'Session expired. Please login again.';
      return;
    }

    this.isLoading = true;

    try {
      const cognito_username = user.cognito_username;
      if (!cognito_username) {
        throw new Error('COGNITO_USERNAME_MISSING');
      }

      const response = await this.apiService.updateCognitoUser(cognito_username, {}, this.newPassword);
      if (response?.statusCode !== 200) {
        throw new Error(response?.error || 'Password update failed');
      }

      await this.apiService.prismUserPasswordUpdate<any>({
        ID: user.ID,
        Password: this.newPassword,
        password_last_changed: new Date()
      });

      this.userData.clearUser();
      this.router.navigate(['/login'], {
        state: { successMessage: 'Password changed successfully. Please login.' }
      });

    } catch (error: any) {
      if (error?.error) {
        this.errorMessage = error.error;
      } else if (error?.message) {
        this.errorMessage = error.message;
      } else {
        this.errorMessage = 'Password does not meet password policy requirements.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  private validatePasswordPolicy(password: string): string | null {
    if (password.length < 15)        return 'Password must be at least 15 characters.';
    if (!/[A-Z]/.test(password))     return 'Password must include at least one uppercase letter.';
    if (!/[a-z]/.test(password))     return 'Password must include at least one lowercase letter.';
    if (!/[0-9]/.test(password))     return 'Password must include at least one number.';
    if (!/[!@#$%^&*]/.test(password)) return 'Password must include at least one special character (! @ # $ % ^ & *).';
    return null;
  }

  clearError(): void {
    this.errorMessage = '';
  }
}
