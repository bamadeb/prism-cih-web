import { Component} from '@angular/core';
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
import { QRCodeComponent   } from 'angularx-qrcode';

import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
//import { AngularxQrcodeModule } from 'angularx-qrcode';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule,
    CommonModule,
    QRCodeComponent
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
  session: string = '';
  qrCodeData: string = '';
  otp: string = '';

  showQrScreen: boolean = false;
  showOtpScreen: boolean = false;
  //private renderer!: Renderer2;
  constructor(private router: Router,
    private authService: Auth,
    private userData: UserDataService,
    private titleService: Title,
    private idleService: IdleTimeoutService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    
   
    private apiService: ConfigService,
    private dialog: MatDialog) { }

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
      const cognitoResult = await this.auth.login(this.username, this.password);



      //console.log('✅ Login success:', result);
      if (cognitoResult.status === "SUCCESS") {
        await this.continueBackendLogin();
 
      } else if (cognitoResult.status === "MFA_SETUP") {

        this.session = cognitoResult.session;

        this.setupQrCode();

      } else if (cognitoResult.status === "SOFTWARE_TOKEN_MFA") {

        this.session = cognitoResult.session;

        this.showOtpScreen = true;

      }
    } catch (error) {
      //console.log('error: ',error);
      const err = error as Error;
      //console.log('Error message:', err);
      this.errorMessage = err.message;
    } finally {
      this.isLoading = false;
    }
  }
  // async setupQrCode() {
  //   try {
  //     const response =
  //       await this.auth.associateSoftwareToken(
  //         this.session
  //       );
  //     this.session = response.Session;
  //     const secretCode =
  //       response.SecretCode;
  //     this.qrCodeData = `otpauth://totp/Prism:${this.username}?secret=${secretCode}&issuer=Prism`;
  //     this.showQrScreen = true;
  //   }
  //   catch (err) {
  //     this.errorMessage = "Failed to setup MFA";
  //   }
  // }
async setupQrCode() {
  try {

    //console.log("setupQrCode session:", this.session);

    const response =
      await this.auth.associateSoftwareToken(this.session);

    //console.log("associateSoftwareToken response:", response);

    this.session = response.Session;

    const secretCode = response.SecretCode;

    this.qrCodeData =  `otpauth://totp/Prism:${encodeURIComponent(this.username)}?secret=${secretCode}&issuer=Prism`;

    //console.log("QR Data:", this.qrCodeData);

    this.showQrScreen = true;
    this.cdr.detectChanges();
  }
  catch (err) {
    console.error(err);
    this.errorMessage = "Failed to setup MFA";
  }
}  
  async verifyFirstOtp() {
    try {
      const verify = await this.auth.verifySoftwareToken(this.session,this.otp);
    // ✅ CHECK if session exists
      if (!verify.Session) {
        throw new Error("Session missing from Cognito response");
      }      
      await this.auth.confirmMfaSetup(
        this.username,
        verify.Session,
        this.otp
      );
      this.showQrScreen = false;
      this.continueBackendLogin();
    }
    catch {
      this.errorMessage =
        "Invalid OTP";
    }
  }
  async verifyLoginOtp() {
    try {
      await this.auth.verifyLoginOtp(this.username,this.session,this.otp);
      this.showOtpScreen = false;
      this.continueBackendLogin();
    }
    catch {
      this.errorMessage =
        "Invalid OTP";
    }
  }
  async continueBackendLogin() {
    try {
      this.isLoading = true;
      const request: LoginRequest = {
        username: this.username,
        password: this.password
      };
      const result = await this.authService.login<any>(request);
      if (result.data.length > 0) {
        const user = result.data[0];
        user.pageAccess = result.pageAccess;
        this.userData.setUser(user);
        // 🔒 Password expired (STRICT)
        if (user.is_password_expired === 1) {
          this.isLoading = false;
          this.openPasswordWarningDialog(user,true);
          return;
        }
        // ⚠️ Password expiry warning (SOFT)
        if (user.password_expiry_warning === 1) {
          this.isLoading = false;
          this.openPasswordWarningDialog(
            user,
            false
          );
          return;
        }
        // ✅ Normal login success
        this.completeLogin(user);
      }
      else {
        this.errorMessage = "Invalid login credentials";
      }
    }
    catch (err: any) {
      this.errorMessage = err.message || "Login failed";
    }
    finally {
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
      console.log("action : ", action);
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

  addloginHistory() {
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
