import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { HttpClient } from '@angular/common/http';
import { BaseComponent } from '../../base/base.component';
import { ErrorReportingService } from '../../services/errorReporting/error-reporting.service'; 
import { ConfigService } from '../../services/api.service';
import { DashboardRequest } from '../../models/requests/dashboardRequest';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatCardModule,
    MatDialogModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard extends BaseComponent implements OnInit, AfterViewInit {

  displayedColumns: string[] = ['MEM_NO', 'FIRST_NAME', 'LAST_NAME'];
  dataSource: MatTableDataSource<any> = new MatTableDataSource<any>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    errorLogger: ErrorReportingService,
    matDialog: MatDialog,
    private httpClient: HttpClient,
    private titleService: Title,
    private apiService: ConfigService,
    public dialog: MatDialog
  ) {
    super(errorLogger, matDialog);
  }

  ngOnInit(): void {
    this.titleService.setTitle('PRISM :: DASHBOARD');
    this.loadTableData();
  }

  ngAfterViewInit(): void {
    this.attachTableFeatures();
  }

  /** Load data from API */
  async loadTableData(): Promise<void> { 
     const request: DashboardRequest = {
          user_id: '1' 
        };

    try {
      const result = await this.apiService.dashboard<any>(request); 
      const members = result.data?.members || [];  
      //console.log('Dashboard:', members.length);
      if (members.length > 0) { 

          // Map API data to your table structure
          const DATA = members.map((m: any, index: number) => ({
            MEM_NO: m.MEM_NO || m.MEM_NO,
            FIRST_NAME: m.FIRST_NAME || m.FIRST_NAME || 'N/A',
            LAST_NAME: m.LAST_NAME || m.LAST_NAME || 'N/A'
          }));
          console.log(DATA);
          this.dataSource.data = DATA;      
      } 

    }catch(error) {
      
    }finally{
       
    }
        
  }

  /** Attach paginator & sorting */
  attachTableFeatures(): void {
    if (this.paginator) this.dataSource.paginator = this.paginator;
    if (this.sort) this.dataSource.sort = this.sort;
  }

  /** Trigger error popup */
  showErrorPopup(): void {
    this.displayError('ERROR MESSAGE DISPLAY', 'ERROR POPUP TEST');
  }

  /** Search filter */
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value || '';
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }
}
