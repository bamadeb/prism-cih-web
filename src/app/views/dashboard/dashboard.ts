import { Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BaseComponent } from '../../base/base.component';
import { ErrorReportingService } from '../../services/errorReporting/error-reporting.service';
import { MatDialog } from '@angular/material/dialog';
import { UserDataService } from '../../services/user-data-service';

@Component({
  selector: 'app-dashboard',
  imports: [MatCardModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard extends BaseComponent implements OnInit{
  constructor(
    errorLogger: ErrorReportingService,
    matDialog: MatDialog,
    public dialog: MatDialog,
    private userData: UserDataService
    ) {
    super(errorLogger, matDialog);
  }

  async ngOnInit(): Promise<void> {
    this.displayError("ffff","fffffff");
    this.userData.setUserName("Rps");
    this.displayInfo(this.userData.getUserName(),"Check localstorage");
  }
}
