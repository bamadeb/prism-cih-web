import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from "@angular/material/card";
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Title } from '@angular/platform-browser'; 
import { ConfigService } from '../../../services/api.service';  
import { IdleTimeoutService } from '../../../services/idle-timeout'; 
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../../../services/auth';
import { LoginRequest } from '../../../models/requests/loginRequest';
import { MatIconModule } from '@angular/material/icon';
import { UserDataService } from '../../../services/user-data-service';

import { AuthService } from '../../../services/auth.service';

import { LogRequest } from '../../../models/requests/dashboardRequest';
import { MatDialog } from '@angular/material/dialog';
import { PasswordWarningDialog } from '../../dialogs/password-warning-dialog/password-warning-dialog';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule,
],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  username = '';
  password = '';
  userId: number = 0;
  isLoading = false;
  errorMessage = '';
  errorMsg: any;
  successMessage = '';
  constructor(private router: Router,
    private authService: Auth, 
    private userData: UserDataService,
    private titleService: Title,
    private idleService: IdleTimeoutService,
    private auth: AuthService,
    private apiService: ConfigService,
    private dialog: MatDialog) {}

  bgImages = [
      'assets/images/1.jpg',
      'assets/images/2.jpg',
      'assets/images/3.jpg',
      'assets/images/4.jpg'
    ];

    currentIndex = 0;

    ngOnInit() {
       this.titleService.setTitle('PRISM :: LOGIN');
       //const navigation = this.router.getCurrentNavigation();
        //this.errorMessage = navigation?.extras?.state?.['message'] || '';
        this.errorMessage = window.history.state?.message || '';
        this.successMessage = window.history.state?.successMessage || '';
        //console.log(this.errorMessage);
      setInterval(() => {
        this.currentIndex = (this.currentIndex + 1) % this.bgImages.length;
      }, 4000); // 4 seconds
    }
  async onSubmit() { 
    this.isLoading = true;
    this.clearError();
    const request: LoginRequest = {
      username: this.username,
      password: this.password
    };

    try {
      await this.auth.login(this.username, this.password);
      const result = await this.authService.login<any>(request);
      //console.log('✅ Login success:', result);
      if(result.data.length>0){
        const user = result.data[0]; 
        user.pageAccess = result.pageAccess;
        this.userData.setUser(user);        
        // 🔒 Password expired (STRICT)
        if (user.is_password_expired === 1) {
          this.isLoading = false;
          this.openPasswordWarningDialog(user, true);
          return;
        }

        // ⚠️ Password expiry warning (SOFT)
        if (user.password_expiry_warning === 1) {
          this.isLoading = false;
          this.openPasswordWarningDialog(user, false);
          return;
        }

        // this.userData.setUser(user); 
 
        // const roleId = user.role_id; 
        // this.userId = user.ID; 
        // this.idleService.startWatching();
        // this.addloginHistory();
        // this.router.navigate(['/dashboard']);  
        // ✅ Normal login
        this.completeLogin(user);  
      }
      else{
        this.errorMessage = 'Invalid login credentials';
      } 
    } catch (error) {
      //console.log('error: ',error);
      const err = error as Error;
      //console.log('Error message:', err.message);           
      this.errorMessage = err.message;
    } finally {
      this.isLoading = false;
    }
  }
  clearError() { 
    this.errorMessage = '';
  }
    private openPasswordWarningDialog(
      user: any,
      isExpired: boolean
    ): void {

      const dialogRef = this.dialog.open(PasswordWarningDialog, {
        width: '500px',
        disableClose: true,
        data: {
          message: user.password_message,
          is_password_expired: isExpired
        }
      });

      dialogRef.afterClosed().subscribe((action: 'change' | 'skip') => {
        console.log("action : ",action);
        // 🔒 Expired → must reset
        if (isExpired) {
          if (action === 'change') {
            this.router.navigate(['/change-password']);
          }
          return; // ⛔ never allow login
        }

        // ⚠️ Warning → optional
        if (action === 'change') {
          this.router.navigate(['/change-password']);
        } else {
          this.completeLogin(user);
        }
      });
    }

  private completeLogin(user: any): void {
    this.userData.setUser(user);
    this.userId = user.ID;
    this.idleService.startWatching();
    this.addloginHistory();
    this.router.navigate(['/dashboard']);
  }

  addloginHistory(){
    const logpayload: LogRequest = {
      table_name: 'MEM_SYSTEM_LOG',
      insertDataArray: [{
        medicaid_id: 0,
        log_name: 'LOGIN',
        log_details: `Login By ${this.username}`,
        log_status: 'SUCCESS',
        log_by: this.userId,
        action_type: `${this.username}`
      }]
    };
    return this.apiService.insert(logpayload);
  }
}
