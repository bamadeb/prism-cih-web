import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input'; 
import { BaseComponent } from '../../base/base.component';
import { ErrorReportingService } from '../../services/errorReporting/error-reporting.service';
import { ConfigService } from '../../services/api.service';
import { DashboardRequest, ProviderPerformance } from '../../models/requests/dashboardRequest';
import { Title } from '@angular/platform-browser';
import { MatIcon } from "@angular/material/icon";
import { MatCheckboxModule} from '@angular/material/checkbox';
import { MatTabsModule } from '@angular/material/tabs'; 
import { MatSelectChange, MatSelectModule } from '@angular/material/select'; 
import { MatDividerModule } from '@angular/material/divider';
import { CommonModule } from '@angular/common';
import { UserDataService } from '../../services/user-data-service';
import { PhoneFormatPipe } from '../../pipes/phone-format.pipe';
import { MatProgressSpinner } from "@angular/material/progress-spinner"; 
import { BenefitsDialogService } from '../../services/benefits-dialog.service'; 
import { AddActionDialogService } from '../../services/add-action-dialog.service';
import { QualitygapDialogService } from '../../services/qualitygap-dialog.service';
import { RiskgapDialogService } from '../../services/riskgap-dialog.service';
import { CallListDialogService } from '../../services/calllist-dialog.service';
import { TaskListDialogService } from '../../services/tasklist-dialog.service'; 
import { NolongerPatientDialogService } from '../../services/nolonger-patience-dialog.service';
import { AlterPhoneDialogService } from '../../services/alternatephone-dialog.service';
import { AlterAddressDialogService } from '../../services/alteraddress-dialog.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SelectionModel } from '@angular/cdk/collections';
import { ActionHandlerService } from '../../services/action.service'; 
import { HeaderService } from '../../services/header.service'; 
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button'; 

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatCardModule,
    MatDialogModule,
    MatTableModule,
    MatPaginatorModule,MatMenuModule,
    MatButtonModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatIcon, MatCheckboxModule, MatTabsModule, MatSelectModule, MatDividerModule, PhoneFormatPipe, CommonModule,
    MatProgressSpinner,
    MatTooltipModule,
    
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

  displayedColumns: string[] = ['2', 'MEM_INFO', 'PHONE', 'PCP_TAX_ID', 'PCP_VISIT_FLAG', 'PRIORITY_FLAG', 'upcoming_task_date', 'Call_count', 'risk_gap_count', 'risk_comp_count', 'risk_perf', 'quality_count', 'quality_comp_count', 'quality_perf', '1'];
  displayedColumnsTransfer: string[] = [
    'medicaid_id',
    'memberName',
    'BIRTH',
    'phone',
    'address',
    'refer_by_name',
    'refer_to_name',
    'added_date',
    'referring_reason'
  ];
  displayedColumnsNolongerpatient: string[] = [
    'medicaid_id',
    'memberName',
    'BIRTH',
    'phone',
    'address', 
    'NO_LONGER_PATIENT_DATE','NO_LONGER_PATIENT_NOTE','1'
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
  loginUserId: number | null = null;
  loginRoleId: number | null = null;
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
  alt_phone: any[] = []; 
  members: any[] = [];
  selection = new SelectionModel<any>(true, []); // true = multiple selection
  selectedAction: string | null = null; 
  selectedNavigatorId: number = 0;


  constructor(
    errorLogger: ErrorReportingService,
    matDialog: MatDialog,
    private titleService: Title, private apiService: ConfigService,private userData: UserDataService,
    public dialog: MatDialog,private benefitsService: BenefitsDialogService,
    private addActionService: AddActionDialogService,private qualitygapsService:QualitygapDialogService,private riskgapsService:RiskgapDialogService,
    private callListService:CallListDialogService,private taskListService:TaskListDialogService,
    private noLongerPatientService:NolongerPatientDialogService,private alternatePhoneListService:AlterPhoneDialogService,
    private alternateAddressListService:AlterAddressDialogService,
    private actionService:ActionHandlerService,
    private headerService: HeaderService 

  ) {
    super(errorLogger, matDialog);
    const user1 = this.userData.getUser();
    console.log(user1); 
  }

  ngOnInit(): void {
    this.titleService.setTitle('PRISM :: DASHBOARD');
    this.headerService.setTitle('Dashboard');
    
    this.loadTableData();
  }

  private async withLoader<T>(
  task: () => Promise<T>,
  onError?: (err: any) => void
): Promise<T | undefined> {
  this.isLoading = true;
  try {
    return await task();
  } catch (err) {
    console.error(err);
    //onError?.(err);
    this.displayError('Something went wrong', 'Please try again');
    return undefined;
  } finally {
    this.isLoading = false;
  }
}
  

  /** Whether all rows are selected */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  /** Selects all rows if not all selected; otherwise clear selection */
  masterToggle() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.dataSource.data.forEach(row => this.selection.select(row));
    }
  }

  getSelectedRows(): any[] {
  return this.selection.selected;
  }

  /** Checkbox label (accessibility) */
  checkboxLabel(row?: any): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row`;
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

    this.dataSource.sortingDataAccessor = this.defaultSortingAccessor;
    this.transferdataSource.sortingDataAccessor = this.defaultSortingAccessor;
    this.nolongerpatientdataSource.sortingDataAccessor = this.defaultSortingAccessor;

    this.attachTableFeatures();
    this.attachTableFeaturestransfer();
    this.attachTableFeaturesnoLongerpatient();
  }

/** Load dashboard data from API */
async loadTableData(): Promise<void> {
  await this.withLoader(async () => {
    const user = this.userData.getUser();      
    if(user.role_id == 7){
      this.loginUserId =this.selectedNavigatorId ?? 0;
    }else{
       this.loginUserId=user.ID;
    }
    this.loginRoleId =user.role_id;
    //console.log(user);
    //this.loginUserId = this.selectedNavigatorId ?? (user.role_id == 7 ? 0 : user.ID);
    
    //console.log('loginUserId: '+this.loginUserId);
    //console.log('loginRoleId: '+this.loginRoleId);
    const request: DashboardRequest = { user_id: this.loginUserId };
    const result = await this.apiService.dashboard<any>(request);
    const members = result?.data || [];

    this.dataSource.data = members.map((m: any) => ({
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
      upcoming_task_date: m.upcoming_task_date || 'N/A',
      Call_count: m.Call_count,
      risk_gap_count: m.risk_gap_count,
      risk_comp_count: m.risk_comp_count,
      risk_perf: m.risk_perf,
      quality_count: m.quality_count,
      quality_comp_count: m.quality_comp_count,
      quality_perf: m.quality_perf
    }));

    this.selection.clear();
    //this.dataSource._updateChangeSubscription();
    this.dataSource.data = [...this.dataSource.data];

    await this.loadprojectoverviewData();
  });
}

showRiskgaps(row: any) { 
   this.withLoader(() => this.riskgapsService.showRiskgapDialog(row));
}

private defaultSortingAccessor(item: any, property: string) {
  if (property === 'MEM_INFO') {
    return item.medicaid_id;
  }
  return item[property];
}


showQualitygaps(row: any) {
  this.withLoader(() => this.qualitygapsService.showQualitygapDialog(row));
}

showBenefits(row: any) {
  this.withLoader(() => this.benefitsService.showBenefitsDialog(row));
}

showCallList(row: any) {
  this.withLoader(() => this.callListService.showcallListDialog(row));
}  

confirmAction(row: any) {
  this.withLoader(async () => {
    const result = await this.noLongerPatientService.confirmbox(row);
    if (result?.refresh) {
      this.removeMemberFromTable(row.medicaid_id);
      // 2️⃣ add to no longer patient table
      
      this.nolongerpatientdataSource.data = [
      {
        medicaid_id: row.medicaid_id,
        FIRST_NAME: row.FIRST_NAME,
        LAST_NAME: row.LAST_NAME,
        NO_LONGER_PATIENT_DATE: this.formatMDY(new Date())
      },
      ...this.nolongerpatientdataSource.data
    ];

    // refresh table
    this.nolongerpatientdataSource._updateChangeSubscription();

    }
  });
}

confirmboxUndo(row: any) {
  //console.log(row);
  this.withLoader(async () => {
    const result = await this.noLongerPatientService.confirmboxUndo(row);
    if (result?.refresh) {
      this.removeNolongerFromTable(row.medicaid_id);
      // 2️⃣ add to no longer patient table
      //console.log(row);
      this.dataSource.data = [
      {
        medicaid_id: row.medicaid_id,
        MEM_NO: row.MEM_NO,
        FIRST_NAME: row.FIRST_NAME,
        LAST_NAME: row.LAST_NAME,
        BIRTH: row.BIRTH,
        OTHER_ADDR1: row.OTHER_ADDR1,
        OTHER_PHONE: row.OTHER_PHONE,
        latest_alt_address: row.latest_alt_address,
        latest_alt_phone: row.latest_alt_phone,
        PCP_TAX_ID: row.PCP_TAX_ID,
        PCP_VISIT_DATE: row.PCP_VISIT_DATE,
        PCP_VISIT_FLAG: row.PCP_VISIT_FLAG,
        PRIORITY_FLAG: row.PRIORITY_FLAG,
        upcoming_task_date: row.upcoming_task_date || 'N/A',
        Call_count: row.Call_count,
        risk_gap_count: row.risk_gap_count,
        risk_comp_count: row.risk_comp_count,
        risk_perf: row.risk_perf,
        quality_count: row.quality_count,
        quality_comp_count: row.quality_comp_count,
        quality_perf: row.quality_perf
      },
      ...this.dataSource.data
    ];

    // refresh table
    this.dataSource._updateChangeSubscription();

    }
  });
}


removeNolongerFromTable(medicaidId: number): void {
  const updatedData = this.nolongerpatientdataSource.data.filter(
    nolongerpatientlist => nolongerpatientlist.medicaid_id !== medicaidId
  );

  this.nolongerpatientdataSource.data = updatedData;
  // 🔁 refresh paginator & table
  this.nolongerpatientdataSource._updateChangeSubscription();
} 

formatMDY(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

removeMemberFromTable(medicaidId: number): void {
  const updatedData = this.dataSource.data.filter(
    member => member.medicaid_id !== medicaidId
  );

  this.dataSource.data = updatedData;
  // 🔁 refresh paginator & table
  this.dataSource._updateChangeSubscription();
} 

async onActionChange(event: MatSelectChange) {
  if (!event.value) return;

  const selectedRows = this.getSelectedRows();
  if (!selectedRows.length) {
    alert('Please select at least one member');
    this.selectedAction = null;
    return;
  }

  await this.withLoader(async () => {
    const result = await this.actionService.handleAction(
      event.value,
      selectedRows,
      this.planList,
      this.departmentList
    );

    if (result?.refresh) {
      this.removeRowsFromTable(selectedRows);
    }
  });

  this.selectedAction = null;
  this.selection.clear();
}

removeRowsFromTable(rows: any[]) {
  const ids = new Set(rows.map(r => r.medicaid_id));
  this.dataSource.data = this.dataSource.data.filter(
    r => !ids.has(r.medicaid_id)
  );
}

addalterAddr(row: any) {
  this.withLoader(async () => {
    const dialogRef = await this.alternateAddressListService.showalterAddressListDialog(row);
    dialogRef.afterClosed().subscribe(result => {
      if (result?.refresh) {
        this.syncMemberAltAddress(result.medicaid_id);
      }
    });
  });
} 

addalternativePhone(row: any) {
  this.withLoader(async () => {
    const dialogRef = await this.alternatePhoneListService.showalterPhoneListDialog(row);
    dialogRef.afterClosed().subscribe(result => {
      if (result?.refresh) {
        this.syncMemberAltPhone(result.medicaid_id);
      }
    });
  });
}

syncMemberAltAddress(medicaidId: number) {
  this.withLoader(async () => {
    const res = await this.apiService.alternateaddressList<any>({ medicaid_id: medicaidId });
    const addr = res?.data?.altaddress?.[0];
    if (!addr) return;

    this.updateRow(medicaidId, { latest_alt_address: addr.alt_address });
  });
}

syncMemberAltPhone(medicaidId: number) {
  this.withLoader(async () => {
    const res = await this.apiService.alternatephoneList<any>({ medicaid_id: medicaidId });
    const latest = res?.data?.prismMemberaltphone?.[0]?.alt_phone_no;
    if (!latest) return;

    this.updateRow(medicaidId, { latest_alt_phone: latest });
  });
}

private updateRow(medicaidId: number, changes: any) {
  const index = this.dataSource.data.findIndex(m => m.medicaid_id === medicaidId);
  if (index === -1) return;

  this.dataSource.data[index] = {
    ...this.dataSource.data[index],
    ...changes
  };
  this.dataSource._updateChangeSubscription();
}

showTasklist(row: any) {
  this.withLoader(async () => {
    const dialogRef = await this.taskListService.showtaskListDialog(row);
    dialogRef.afterClosed().subscribe(result => {
      if (result?.refresh) {
        this.refreshMemberRow(result.medicaid_id);
      }
    });
  });
}   

  async refreshMemberRow(medicaid_id: string): Promise<void> {
    try {
      const request: DashboardRequest = {
        user_id: this.loginUserId
      };

      const res = await this.apiService.dashboard<any>(request);
      const members = res.data || [];

      const updatedMember = members.find(
        (m: any) => m.medicaid_id === medicaid_id
      );

      if (!updatedMember) return;

      const index = this.dataSource.data.findIndex(
        m => m.medicaid_id === medicaid_id
      );

      if (index !== -1) {
        this.dataSource.data[index] = {
          ...this.dataSource.data[index],
          upcoming_task_date: updatedMember.upcoming_task_date,
          Call_count: updatedMember.Call_count,
          risk_gap_count: updatedMember.risk_gap_count,
          quality_count: updatedMember.quality_count
        };

        // 🔁 trigger table refresh
        this.dataSource._updateChangeSubscription();
      }

    } catch (err) {
      console.error('Member refresh failed', err);
    }
  }


async openAddActionDialog(
  medicaid_id: string,
  member_name: string,
  member_db: string,
  addr: string,
  phone: string,
  practice: string,
  PCP_TAX_ID: number,
) {
  this.isLoading = true;
  //alert(medicaid_id);

  try {
    const actionSaved = await this.addActionService.showAddActionDialog(
      medicaid_id,
      member_name,
      member_db,
      addr,
      phone,
      practice,PCP_TAX_ID
    );
    this.loadTableData();
    this.isLoading = false;
  } catch (err) {
    console.error(err);
  } finally {
    this.isLoading = false;
  }
}

copyToClipboard(text: string) {
  if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
    // Modern supported browser
    navigator.clipboard.writeText(text)
      .then(() => {})
      .catch(() => {
        this.fallbackCopy(text);
      });
  } else {
    // Fallback
    this.fallbackCopy(text);
  }
}

fallbackCopy(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
} 

onNavigatorChange(navigatorId: number): void {
  //alert(navigatorId);
  this.selectedNavigatorId = navigatorId;
  this.loadTableData();
}

  async loadprojectoverviewData(): Promise<void> {
    const request: DashboardRequest = {
      user_id: this.loginUserId
    };

    try {
      const res = await this.apiService.poweroverview<any>(request);
      //console.log('Power Overview:', res);  
      if (res.data) {
        //console.log(res.data.NoLongerPatientList);
        this.overallSummary = res.data.overallRiskQualitySummary || [];
        this.ownSummary = res.data.ownRiskQualitySummary || [];
        this.navigatorList = res.data.navigatorList || []; 
        //this.recentActivity = res.data.recentActivity || [];
        this.departmentList = res.data.departmentList || [];
        this.planList = res.data.planList || []; 
        this.calculatePerformance(res.data);
        this.loadTransfertabledata(res.data.referralList);
        this.loadNopatienttabledata(res.data.NoLongerPatientList);
      }

    } catch (error) {
      console.log('error:' + error);
    }

  }

  loadTransfertabledata(transferlist: any) { 
    if (transferlist.length > 0) {
      //console.log(transferlist); 
      const transferDATA = transferlist.map((r: any, index: number) => ({
        medicaid_id: r.medicaid_id,
        memberName: r.memberName,
        BIRTH: r.BIRTH,
        phone: r.phone,
        address: r.address,
        added_date: r.added_date,
        refer_by_name: r.refer_by_name,
        refer_to_name: r.refer_to_name,
        referring_reason: r.referring_reason
      }));
      //console.log(transferDATA);
      this.transferdataSource.data = transferDATA;
    }
  }

  loadNopatienttabledata(nolongerpatientlist: any) {
    if (nolongerpatientlist.length > 0) {
      const nopatientDATA = nolongerpatientlist.map((r: any, index: number) => ({
        medicaid_id: r.medicaid_id,
        memberName: r.memberName,
        BIRTH: r.BIRTH,
        phone: r.phone,
        address: r.address,
        FIRST_NAME: r.FIRST_NAME,
        LAST_NAME: r.LAST_NAME,
        MEM_NO: r.MEM_NO,         
        OTHER_ADDR1: r.OTHER_ADDR1,
        OTHER_PHONE: r.OTHER_PHONE,
        latest_alt_address: r.latest_alt_address,
        latest_alt_phone: r.latest_alt_phone,
        PCP_TAX_ID: r.PCP_TAX_ID,
        PCP_VISIT_DATE: r.PCP_VISIT_DATE,
        PCP_VISIT_FLAG: r.PCP_VISIT_FLAG,
        PRIORITY_FLAG: r.PRIORITY_FLAG,
        NO_LONGER_PATIENT_DATE: r.NO_LONGER_PATIENT_DATE,
        NO_LONGER_PATIENT_NOTE: r.NO_LONGER_PATIENT_NOTE
      }));
      //console.log(nopatientDATA);
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
