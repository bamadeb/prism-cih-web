import { Component,OnInit } from '@angular/core';
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
export class ChangePassword implements OnInit{

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

  constructor(
    private readonly router: Router,
    private readonly titleService: Title,
    private readonly apiService: ConfigService,
    private readonly userData: UserDataService
  ) { }

  ngOnInit() {
    this.titleService.setTitle('PRISM :: CHANGE PASSWORD');

    setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.bgImages.length;
    }, 4000);
  }

  async onSubmit(): Promise<void> {
    this.clearError();
    const riskObsUpdateArray: any[] = [];
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
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

      const response =await this.apiService.updateCognitoUser(cognito_username, {}, this.newPassword);
      console.log('Conito res :',response);
      if (response?.statusCode !== 200) {
        throw new Error(response?.error || 'Password update failed');
      }
      const apiparamUpdate = {
        ID: user.ID,
        Password: this.newPassword,
        password_last_changed: new Date()
      };
      await this.apiService.prismUserPasswordUpdate<any>(apiparamUpdate);


      // 3️⃣ Clear user session and force re-login
      this.userData.clearUser();

      this.router.navigate(['/login'], {
        state: {
          successMessage: 'Password changed successfully. Please login.'
        }
      });

    } catch (error: any) {
        console.error('Password update failed', error);

  // Show Cognito error message
        if (error?.error) {
          this.errorMessage = error.error;
        }
        else if (error?.message) {
          this.errorMessage = error.message;
        }
        else {
          this.errorMessage = 'Password does not meet password policy requirements.';
        }
    } finally {
      this.isLoading = false;
    }
  }

  clearError(): void {
    this.errorMessage = '';
  }
}
