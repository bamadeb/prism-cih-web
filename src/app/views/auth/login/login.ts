import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from "@angular/material/card";
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../../../services/auth';
import { LoginRequest } from '../../../models/requests/loginRequest';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule
],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  username = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  constructor(private router: Router,private authService: Auth) {}

  async onSubmit() {
    this.errorMessage = '';
    this.isLoading = true;

    const request: LoginRequest = {
      username: this.username,
      password: this.password
    };

    try {
      const result = await this.authService.login<any>(request);
      console.log('✅ Login success:', result);
      // if(result.data.length>0){
      //   this.router.navigate(['/dashboard']);
      // }
      // else{
      //   this.errorMessage = 'Invalid credentials.';
      // }
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = 'Invalid credentials or network error.';
    } finally {
      this.isLoading = false;
    }
  }
}
