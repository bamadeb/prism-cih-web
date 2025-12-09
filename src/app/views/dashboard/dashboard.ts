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
import { MatIcon } from "@angular/material/icon";
import { MatCheckboxModule} from '@angular/material/checkbox';
import { MatTabsModule } from '@angular/material/tabs'; 
import { MatSelectModule } from '@angular/material/select'; 
import { MatDividerModule } from '@angular/material/divider';
import { CommonModule } from '@angular/common';

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
    MatInputModule,
    MatIcon,MatCheckboxModule,MatTabsModule, MatSelectModule,MatSelectModule,MatDividerModule,CommonModule
],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard extends BaseComponent implements OnInit, AfterViewInit {

  displayedColumns: string[] = ['2','MEM_INFO', 'PHONE', 'PCP_TAX_ID', 'PCP_VISIT_FLAG','PRIORITY_FLAG','upcoming_task_date','Call_count','risk_gap_count','risk_comp_count','risk_perf','quality_count','quality_comp_count','quality_perf','1'];
  dataSource: MatTableDataSource<any> = new MatTableDataSource<any>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  riskData: any[] = []; 
  riskColumns: any[] = []; 
  workData: any[] = []; 
  selectedDoctor1: any[] = []; 

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
    const riskColumns = ['title', 'gaps', 'completed', 'performance'];
    const workColumns = ['work', 'col1', 'total'];

const riskData = [
  { title: 'Overall (PRIORITY)', gaps: 0, completed: 0, performance: '0%', color: 'gray' },
  { title: 'Overall (OTHERS)', gaps: 679, completed: 81, performance: '12%', color: 'red' },
];

const workData = [
  { work: 'CONTACTED (PRIORITY)', col1: '0/0 (0%)', total: '0/0 (0%)' },
  { work: 'CONTACTED (OTHERS)', col1: '4/52 (8%)', total: '19/686 (3%)' },
];

const selectedDoctor1 = 'Merca..';

    this.loadTableData();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'MEM_INFO':
          // Sort by MEM_NO, change if you want different sorting
          return item.medicaid_id;
        default:
          return item[property];
      }
    };
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
          const DATA = members.map((m: any, index: number) => ({
            medicaid_id: m.medicaid_id,
            MEM_NO: m.MEM_NO,
            FIRST_NAME: m.FIRST_NAME,
            LAST_NAME: m.LAST_NAME,
            BIRTH: m.BIRTH,
            OTHER_ADDR1: m.OTHER_ADDR1,
            OTHER_PHONE: m.OTHER_PHONE,
            latest_alt_address: m.latest_alt_address,
            latest_alt_phone: m.latest_alt_phone,
            PCP_TAX_ID: m.PCP_TAX_ID,
            PCP_VISIT_DATE: m.PCP_VISIT_DATE,
            PCP_VISIT_FLAG: m.PCP_VISIT_FLAG,
            PRIORITY_FLAG: m.PRIORITY_FLAG,
            upcoming_task_date: m.upcoming_task_date || m.upcoming_task_date || 'N/A',
            Call_count: m.Call_count,
            risk_gap_count: m.risk_gap_count,
            risk_comp_count: m.risk_comp_count,
            risk_perf: m.risk_perf,
            quality_count: m.quality_count,
            quality_comp_count: m.quality_comp_count,
            quality_perf: m.quality_perf
          }));
          //console.log(DATA);
          this.dataSource.data = DATA;      
      } 

    }catch(error) {
      console.log('error:'+error);      
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
