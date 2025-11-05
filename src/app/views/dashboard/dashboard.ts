import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BaseComponent } from '../../base/base.component';
import { ErrorReportingService } from '../../services/errorReporting/error-reporting.service';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-dashboard',
  imports: [MatCardModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard extends BaseComponent{
  constructor(
    errorLogger: ErrorReportingService,
    matDialog: MatDialog,
    public dialog: MatDialog
    ) {
    super(errorLogger, matDialog);
  }

}
