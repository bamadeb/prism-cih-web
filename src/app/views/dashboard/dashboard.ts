import { Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BaseComponent } from '../../base/base.component';
import { ErrorReportingService } from '../../services/errorReporting/error-reporting.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog'; 
// import { UserDataService } from '../../services/user-data-service';

@Component({
  selector: 'app-dashboard',
  imports: [MatCardModule, MatDialogModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard extends BaseComponent implements OnInit{
// this.userData.setUserName("Rps");
  constructor(
    errorLogger: ErrorReportingService,
    matDialog: MatDialog,
    public dialog: MatDialog,
    // private userData: UserDataService
    ) {
    super(errorLogger, matDialog);
  }

  async ngOnInit(): Promise<void> {
      // Removed popup on load
      console.log('Dashboard loaded');
   // this.displayError("ERROR MESSAGE DISPLAY","ERROR POPUP TEST");
    // this.userData.setUserName("Rps");
    // this.displayInfo(this.userData.getUserName(),"Check localstorage");
  }
    /** Triggered by button click */
    showErrorPopup() {
      this.displayError('ERROR MESSAGE DISPLAY', 'ERROR POPUP TEST');
    }
}
