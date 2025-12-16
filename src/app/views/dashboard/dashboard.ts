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
import { DashboardRequest, ProviderPerformance } from '../../models/requests/dashboardRequest';
import { Title } from '@angular/platform-browser';
import { MatIcon } from "@angular/material/icon";
import { MatCheckboxModule} from '@angular/material/checkbox';
import { MatTabsModule } from '@angular/material/tabs'; 
import { MatSelectModule } from '@angular/material/select'; 
import { MatDividerModule } from '@angular/material/divider';
import { CommonModule } from '@angular/common';
import { UserDataService } from '../../services/user-data-service';
import { PhoneFormatPipe } from '../../pipes/phone-format.pipe';
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { ActionDialog } from '../../dialogs/action-dialog/action-dialog';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'; 
import { BenefitsDialogService } from '../../services/benefits-dialog.service'; 
import { AddAction } from '../shared/components/add-action/add-action' 
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
    MatIcon, MatCheckboxModule, MatTabsModule, MatSelectModule, MatSelectModule, MatDividerModule, PhoneFormatPipe, CommonModule,
    MatProgressSpinner
],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard extends BaseComponent implements OnInit, AfterViewInit {
  providerTinNameMapping: Record<string, string> = {
    '200807794': 'Mercado Medical Practice',
    '237082074': 'GPHA',
    '273160687': 'Dr. Milbourne',
  };

  displayedColumns: string[] = ['2','MEM_INFO', 'PHONE', 'PCP_TAX_ID', 'PCP_VISIT_FLAG','PRIORITY_FLAG','upcoming_task_date','Call_count','risk_gap_count','risk_comp_count','risk_perf','quality_count','quality_comp_count','quality_perf','1'];
  displayedColumnsTransfer: string[] = [
    'medicaid_id',
    'refer_by_name',
    'refer_to_name',
    'added_date',
    'referring_reason'
  ];
  displayedColumnsNolongerpatient: string[] = [
    'medicaid_id',
    'FIRST_NAME',
    'LAST_NAME', 
    'NO_LONGER_PATIENT_DATE'
  ];
  dataSource: MatTableDataSource<any> = new MatTableDataSource<any>([]);
  transferdataSource: MatTableDataSource<any> = new MatTableDataSource<any>([]);
  nolongerpatientdataSource: MatTableDataSource<any> = new MatTableDataSource<any>([]);
@ViewChild('mainPaginator') mainPaginator!: MatPaginator;
@ViewChild('mainSort') mainSort!: MatSort;

@ViewChild('transferPaginator') transferPaginator!: MatPaginator;
@ViewChild('transferSort') transferSort!: MatSort;

@ViewChild('nolongerpatientPaginator') nolongerpatientPaginator!: MatPaginator;
@ViewChild('nolongerpatientSort') nolongerpatientSort!: MatSort;
 
  transferlist: any[] = [];   
  totalArray: any = {}; 
  loginUserId : number | null = null; 
  isLoading = false;
  isOpen = false;
  overallSummary: any = {};
  ownSummary: any = {};
  departmentList: any = {};
  recentActivity: any = {};
  referralList: any = {};
  planList: any = {};
  NoLongerPatientList: any = {};
  navigatorList: any[] = []; 
  performanceArray: Record<string, ProviderPerformance>[] = [];
  entry: any = {}; 
 

  constructor(
    errorLogger: ErrorReportingService,
    matDialog: MatDialog,
    private httpClient: HttpClient,
    private titleService: Title,
    private apiService: ConfigService,
    private userData: UserDataService,
    public dialog: MatDialog, private sanitizer: DomSanitizer,private benefitsService: BenefitsDialogService
  ) {
    super(errorLogger, matDialog);
  }

  ngOnInit(): void {
    this.titleService.setTitle('PRISM :: DASHBOARD'); 
    this.loadTableData();
  }

  ngAfterViewInit(): void {
  this.dataSource.paginator = this.mainPaginator;
  this.dataSource.sort = this.mainSort;

  // TRANSFER TABLE
  this.transferdataSource.paginator = this.transferPaginator;
  this.transferdataSource.sort = this.transferSort;

  // NO LONGER PATIENT TABLE
  this.nolongerpatientdataSource.paginator = this.nolongerpatientPaginator;
  this.nolongerpatientdataSource.sort = this.nolongerpatientSort;

    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'MEM_INFO':
          // Sort by MEM_NO, change if you want different sorting
          return item.medicaid_id;
        default:
          return item[property];
      }
    };
    this.transferdataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'MEM_INFO':
          // Sort by MEM_NO, change if you want different sorting
          return item.medicaid_id;
        default:
          return item[property];
      }
    };

    this.nolongerpatientdataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'MEM_INFO':
          // Sort by MEM_NO, change if you want different sorting
          return item.medicaid_id;
        default:
          return item[property];
      }
    };

    this.attachTableFeatures();
    this.attachTableFeaturestransfer();
    this.attachTableFeaturesnoLongerpatient();
  }

  /** Load data from API */
  async loadTableData(): Promise<void> { 
    this.isLoading = true;  
    const user = this.userData.getUser();
    //console.log('Dashboard:', user);
    if(user.role_id == 7){
      this.loginUserId = 0; 
    }else{
      this.loginUserId = user.ID; 
    }
    
    const request: DashboardRequest = {
        user_id: this.loginUserId
    }; 

    try {
      
      const result = await this.apiService.dashboard<any>(request); 
      const members = result.data || [];  
      //console.log('Dashboard:', result);
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

      this.loadprojectoverviewData();

    }catch(error) {
      console.log('error:'+error);      
    }finally{
       this.isLoading = false; 
    }
        
  }
 

   showBenefits(row: any) {
    this.isLoading = true;
    this.benefitsService
      .showBenefitsDialog(row)
      .finally(() => {
        this.isLoading = false;
    });
  }
 
openAddActionDialog(medicaid_id: string){
  const dialogRef = this.dialog.open(AddAction,{
    width: '95vw',        // or '95%'
    maxWidth: '100vw',    // IMPORTANT
    height: 'auto'
  });
  
  alert(medicaid_id); 
}



  async loadprojectoverviewData(): Promise<void> {  
    const request: DashboardRequest = {
        user_id: this.loginUserId
    }; 

    try {           
      const res = await this.apiService.poweroverview<any>(request);  
      //console.log('Power Overview:', res);  
       if (res.data) {
        this.overallSummary = res.data.overallRiskQualitySummary || [];
        this.ownSummary = res.data.ownRiskQualitySummary || [];
        this.navigatorList = res.data.navigatorList || [];
        this.recentActivity = res.data.recentActivity || [];
        //this.referralList = res.data.referralList || [];
        //this.planList = res.data.planList || [];
        //this.NoLongerPatientList = res.data.NoLongerPatientList || [];
        this.calculatePerformance(res.data);
        this.loadTransfertabledata(res.data.referralList);
        this.loadNopatienttabledata(res.data.NoLongerPatientList);   
       }

    }catch(error) {
      console.log('error:'+error);      
    } 

  }

loadTransfertabledata(transferlist: any){
   if (transferlist.length > 0) { 
      //console.log(transferlist); 
      const transferDATA = transferlist.map((r: any, index: number) => ({
        medicaid_id: r.medicaid_id,
        added_date: r.added_date,
        refer_by_name: r.refer_by_name,
        refer_to_name: r.refer_to_name,
        referring_reason: r.referring_reason
      }));
      //console.log(DATA);
      this.transferdataSource.data = transferDATA;
   }
}

loadNopatienttabledata(nolongerpatientlist: any){
   if (nolongerpatientlist.length > 0) {   
      const nopatientDATA = nolongerpatientlist.map((r: any, index: number) => ({
        medicaid_id: r.medicaid_id,
        FIRST_NAME: r.FIRST_NAME,
        LAST_NAME: r.LAST_NAME,
        NO_LONGER_PATIENT_DATE: r.NO_LONGER_PATIENT_DATE 
      }));
      //console.log(DATA);
      this.nolongerpatientdataSource.data = nopatientDATA;
   }
} 
  /** Attach paginator & sorting */
  attachTableFeatures(): void {
    if (this.mainPaginator) this.dataSource.paginator = this.mainPaginator;
    if (this.mainSort) this.dataSource.sort = this.mainSort;
  }

  attachTableFeaturestransfer(): void {
    if (this.transferPaginator) this.transferdataSource.paginator = this.transferPaginator;
    if (this.transferSort) this.transferdataSource.sort = this.transferSort;
  }

  attachTableFeaturesnoLongerpatient(): void {
    if (this.nolongerpatientPaginator) this.nolongerpatientdataSource.paginator = this.nolongerpatientPaginator;
    if (this.nolongerpatientSort) this.nolongerpatientdataSource.sort = this.nolongerpatientSort;
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

  applyFiltertransfer(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value || '';
    this.transferdataSource.filter = filterValue.trim().toLowerCase();
  }

  applyFilternopatient(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value || '';
    this.nolongerpatientdataSource.filter = filterValue.trim().toLowerCase();
  }


  toggleDiv() {
  this.isOpen = !this.isOpen;
}

calculatePerformance(data: any) {
  const performanceList = data.priorityAndOtherPerformanceSummary || [];
  const performanceArray: Record<string, ProviderPerformance>[] = [];
  const totalArray: any = this.initializeTotals();

  // 🔹 Provider TIN → Name mapping
  const providerTinNameMapping: Record<string, string> = {
    '200807794': 'Mercado Medical Practice',
    '237082074': 'GPHA',
    '273160687': 'Dr. Milbourne',
  };

  for (const item of performanceList) {
    const pcpId = String(item['PCP_TAX_ID']);
    const values: any = { ...item };
    delete values['PCP_TAX_ID'];

    const num = (v: any) => parseFloat(v || 0);

    // ---------- PRIORITY CALL ----------
    const priority_count = num(values.priority_count);
    const call_count = num(values.call_count);
    totalArray.total_priority_count += priority_count;
    totalArray.total_call_count += call_count;

    values.priority_percentage = this.percent(call_count, priority_count);
    values.priority_color = this.getColor(values.priority_percentage);

    // ---------- OTHER CALL ----------
    const other_call_count = num(values.other_call_count);
    const other_count = num(values.other_count);
    totalArray.total_other_call_count += other_call_count;
    totalArray.total_other_count += other_count;

    values.other_call_percentage = this.percent(other_call_count, other_count);
    values.other_call_color = this.getColor(values.other_call_percentage);

    // ---------- RISK GAPS ----------
    const priority_complete_gaps_count = num(values.priority_complete_gaps_count);
    const priority_gaps_count = num(values.priority_gaps_count);
    totalArray.total_priority_complete_gaps_count += priority_complete_gaps_count;
    totalArray.total_priority_gaps_count += priority_gaps_count;

    values.priority_gaps_percentage = this.percent(priority_complete_gaps_count, priority_gaps_count);
    values.priority_gaps_color = this.getColor(values.priority_gaps_percentage);

    const other_gaps_count = num(values.other_gaps_count);
    const other_complete_gaps_count = num(values.other_complete_gaps_count);
    totalArray.total_other_gaps_count += other_gaps_count;
    totalArray.total_other_complete_gaps_count += other_complete_gaps_count;

    values.other_gaps_percentage = this.percent(other_complete_gaps_count, other_gaps_count);
    values.other_gaps_color = this.getColor(values.other_gaps_percentage);

    // ---------- QUALITY GAPS ----------
    const priority_complete_quality_gaps_count = num(values.priority_complete_quality_gaps_count);
    const priority_quality_gaps_count = num(values.priority_quality_gaps_count);
    totalArray.total_priority_complete_quality_gaps_count += priority_complete_quality_gaps_count;
    totalArray.total_priority_quality_gaps_count += priority_quality_gaps_count;

    values.priority_quality_gaps_percentage = this.percent(priority_complete_quality_gaps_count, priority_quality_gaps_count);
    values.priority_quality_gaps_color = this.getColor(values.priority_quality_gaps_percentage);

    const other_quality_gaps_count = num(values.other_quality_gaps_count);
    const other_complete_quality_gaps_count = num(values.other_complete_quality_gaps_count);
    totalArray.total_other_quality_gaps_count += other_quality_gaps_count;
    totalArray.total_other_complete_quality_gaps_count += other_complete_quality_gaps_count;

    values.other_quality_gaps_percentage = this.percent(other_complete_quality_gaps_count, other_quality_gaps_count);
    values.other_quality_gaps_color = this.getColor(values.other_quality_gaps_percentage);

    // ---------- PCP VISITS ----------
    const priority_pcp_visit_count = num(values.priority_pcp_visit_count);
    const other_pcp_visit_count = num(values.other_pcp_visit_count);
    totalArray.total_priority_count_pcp += priority_pcp_visit_count;
    totalArray.total_other_count_pcp += other_pcp_visit_count;

    //console.log(other_pcp_visit_count);
    //console.log(totalArray.total_other_count_pcp);
    values.priority_pcp_visit_percentage = this.percent(priority_pcp_visit_count, priority_count);
    values.priority_pcp_visit_color = this.getColor(values.priority_pcp_visit_percentage);

    values.other_pcp_visit_percentage = this.percent(other_pcp_visit_count, other_count);
    values.other_pcp_visit_color = this.getColor(values.other_pcp_visit_percentage);

    // ---------- PROVIDER NAME ----------
    values.provider_name = providerTinNameMapping[pcpId] || '';

    performanceArray.push({ [pcpId]: values });
  }

  // ---------- TOTAL PERCENTAGES ----------
  totalArray.priority_call_percentage = this.percent(totalArray.total_call_count, totalArray.total_priority_count);
  totalArray.other_call_percentage = this.percent(totalArray.total_other_call_count, totalArray.total_other_count);

  totalArray.priority_gaps_percentage = this.percent(totalArray.total_priority_complete_gaps_count, totalArray.total_priority_gaps_count);
  totalArray.other_gaps_percentage = this.percent(totalArray.total_other_complete_gaps_count, totalArray.total_other_gaps_count);

  totalArray.priority_quality_gaps_percentage = this.percent(totalArray.total_priority_complete_quality_gaps_count, totalArray.total_priority_quality_gaps_count);
  totalArray.other_quality_gaps_percentage = this.percent(totalArray.total_other_complete_quality_gaps_count, totalArray.total_other_quality_gaps_count);

  totalArray.priority_pcp_percentage = this.percent(totalArray.total_priority_count_pcp, totalArray.total_priority_count);
  totalArray.other_pcp_percentage = this.percent(totalArray.total_other_count_pcp, totalArray.total_other_count);

  // ---------- TOTAL COLORS ----------
  totalArray.priority_call_color = this.getColor(totalArray.priority_call_percentage);
  totalArray.other_call_color = this.getColor(totalArray.other_call_percentage);
  totalArray.priority_gaps_color = this.getColor(totalArray.priority_gaps_percentage);
  totalArray.other_gaps_color = this.getColor(totalArray.other_gaps_percentage);
  totalArray.priority_quality_gaps_color = this.getColor(totalArray.priority_quality_gaps_percentage);
  totalArray.other_quality_gaps_color = this.getColor(totalArray.other_quality_gaps_percentage);
  totalArray.priority_pcp_color = this.getColor(totalArray.priority_pcp_percentage);
  totalArray.other_pcp_color = this.getColor(totalArray.other_pcp_percentage);

  // ---------- SAVE FINAL ----------
  this.performanceArray = performanceArray;
  this.totalArray = totalArray;

  //console.log('✅ Provider performance summary:', this.performanceArray);
  //console.log('✅ Totals:', this.totalArray);
}


  initializeTotals() {
    return {
      total_priority_count: 0,
      total_call_count: 0,
      total_other_call_count: 0,
      total_other_count: 0,
      total_priority_complete_gaps_count: 0,
      total_priority_gaps_count: 0,
      total_other_gaps_count: 0,
      total_other_complete_gaps_count: 0,
      total_priority_complete_quality_gaps_count: 0,
      total_priority_quality_gaps_count: 0,
      total_other_quality_gaps_count: 0,
      total_other_complete_quality_gaps_count: 0,
      total_priority_count_pcp: 0,
      total_other_count_pcp: 0
    };
  }

  percent(a: number, b: number): number {
    return b > 0 ? +(a / b * 100).toFixed(2) : 0;
  }

  getColor(percent: number): string {
    if (percent < 60) return 'red';
    if (percent < 80) return '#FFAE42';
    return 'green';
  }
}
