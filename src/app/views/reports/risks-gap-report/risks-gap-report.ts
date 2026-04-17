import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule,Validators, AbstractControl, ValidationErrors  } from '@angular/forms';
import { ConfigService } from '../../../services/api.service';
import { Title } from '@angular/platform-browser';
import { MatCardModule } from "@angular/material/card";
import { MatFormField, MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";
import { MatTableDataSource } from '@angular/material/table';

import { MatDatepickerModule } from "@angular/material/datepicker";
import { provideNativeDateAdapter } from '@angular/material/core'; 
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; 
import { HeaderService } from '../../../services/header.service';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common'; 
import { MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { MatIcon } from "@angular/material/icon";
import { MatCheckbox } from "@angular/material/checkbox";
import { UserDataService } from '../../../services/user-data-service';
import { MatDialogClose } from "@angular/material/dialog";



@Component({
  selector: 'app-risks-gap-report',
 standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatFormField, MatFormFieldModule, MatSelectModule, MatDatepickerModule, ReactiveFormsModule, MatInputModule, MatProgressSpinnerModule,
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule, MatIcon, MatCheckbox, MatDialogClose],
  providers: [
    provideNativeDateAdapter()   // <-- REQUIRED FIX
  ],templateUrl: './risks-gap-report.html',
  styleUrl: './risks-gap-report.css',
})
export class RisksGapReport implements AfterViewInit ,OnInit {


  riskGapsFormGroup!: FormGroup;
  isLoading = false;
  userId: string | null = null;
  riskGapsReportList: any[] = [];

  dataSource = new MatTableDataSource<any>([]);
  selection = new SelectionModel<any>(true, []);

  @ViewChild('mainPaginator') paginator!: MatPaginator;
  @ViewChild('mainSort') sort!: MatSort;
  riskColumns: string[] = [
  'select',
  'medicaid_id',
  'mode',
  'Gap_Code',
  'MEASURE_DESC',
  'ObservationDate',
  'Observation_Year',
  'Observation_Code',
  'CPT_Code_Modifier',
  'Observation_Code_Set',
  'Observation_Result',
  'Service_Provider_NPI',
  'Service_Provider_Taxonomy_Code',
  'Service_Provider_Name',
  'Service_Provider_Type',
  'Service_Provider_RxProviderFlag',
  'Provider_Group_NPI',
  'Provider_Group_Taxonomy_Code',
  'Provider_Group_Name',
  'Source'
];

qualityColumns: string[] = [
  'select',
  'medicaid_id',
  'mode',
  'PROVIDER_ID', 
  'ObservationDate',
  'DOSThru',
  'CPTPx',
  'HCPCSPx',
  'LOINC',
  'SNOMED',
  'ICDDX',
  'ICDDX10',
  'RxNorm',
  'CVX',
  'Result',
  'RxProviderFlag',
  'PCPFlag',
  'QuantityDispensed',
  'SuppSource',
  'Observation_Result',
  'LOINCAnswer'
];
  displayedColumns: string[] =[];

 
  constructor(
    private readonly apiService: ConfigService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly headerService: HeaderService ,
    private readonly titleService: Title,
    private readonly userData: UserDataService,
    
  ) {
    const today = new Date();

    const thirtyDaysBefore = new Date();
    thirtyDaysBefore.setDate(today.getDate() - 30);
    this.riskGapsFormGroup = this.fb.group({ 
      gaps_type: ['risk'],
      start_date: [thirtyDaysBefore, Validators.required],
      end_date: [today, Validators.required]
    },
    { validators: this.dateRangeValidator } // ✅ custom validator
  );
  }

  async ngOnInit() { 
    this.titleService.setTitle('PRISM :: GAPS REPORT');
    this.headerService.setTitle('GAPS REPORT');
    const user = this.userData.getUser();
    this.userId = user.ID; 
    // Load page 
    await this.applyFilter();
  }

  

  ngAfterViewInit(): void {
  if (this.paginator) {
    this.dataSource.paginator = this.paginator;
  }
  

  if (this.sort) {
    this.dataSource.sort = this.sort;
  }

  this.dataSource.sortingDataAccessor = (item, property) => {
    const value = item[property];
    return typeof value === 'string' ? value.toLowerCase() : value;
  };
}

formatDateToYMD(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`; // m/d/Y format
  }
  
 async applyFilter() {
  if (this.riskGapsFormGroup.invalid) {
    this.riskGapsFormGroup.markAllAsTouched();
    return;
  }

  this.isLoading = true;

  try {
    const { start_date, end_date,gaps_type } = this.riskGapsFormGroup.value;

    const formatDate = (d: string | Date) => {
      const date = new Date(d);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    const payload = {
      start_date: this.formatDateToYMD(start_date),
      end_date: this.formatDateToYMD(end_date),
      gaps_type
    };

    const result = await this.apiService.getGapsObservationData(payload);

    // ✅ TypeScript now knows that 'data' exists
    this.riskGapsReportList = result.data ?? [];    
    this.dataSource.data = this.riskGapsReportList;

    // ✅ SWITCH COLUMNS HERE
    if (gaps_type === 'quality') {
      this.displayedColumns = this.qualityColumns;
    } else {
      this.displayedColumns = this.riskColumns;
    }

  } catch (err) {
    console.error('Risk gaps load failed', err);
  } finally {
    this.isLoading = false;
    this.cdr.markForCheck();
  }
}


dateRangeValidator(control: AbstractControl): ValidationErrors | null {
  const start = control.get('start_date')?.value;
  const end = control.get('end_date')?.value;

  if (!start || !end) return null;

  const startDate = new Date(start).getTime();
  const endDate = new Date(end).getTime();

  return endDate >= startDate
    ? null
    : { dateRangeInvalid: true };
}


   
   downloadCsv(): void {
  try {
    if (!this.riskGapsReportList.length) {
      alert('No data available to download.');
      return;
    }

    const gapsType = this.riskGapsFormGroup.get('gaps_type')?.value;

    let header: string[] = [];
    let rows: string[] = [];

    // ✅ RISK DOWNLOAD
    if (gapsType === 'risk') {
      header = [
        'MEMBER ID',
        'PATIENT MEMBER ID',
        'PATIENT CMS MEDICARE NUMBER',
        'MEMBER FIRST NAME',
        'MEMBER LAST NAME',
        'MEMBER DOB',
        'OBSERVATION DATE',
        'OBSERVATION YEAR',
        'OBSERVATION CODE',
        'CPT CODE MODIFIER',
        'OBSERVATION CODE SET',
        'OBSERVATION RESULT',
        'SERVICE PROVIDER NPI',
        'SERVICE PROVIDER TAXONOMY CODE',
        'SERVICE PROVIDER NAME',
        'SERVICE PROVIDER TYPE',
        'SERVICE PROVIDER RXPROVIDERFLAG',
        'PROVIDER GROUP NPI',
        'PROVIDER GROUP TAXONOMY CODE',
        'PROVIDER GROUP NAME',
        'SOURCE'
      ];

      rows = this.riskGapsReportList.map(item =>
        [
          item.RECIP_NO ?? '',
          item.RECIP_NO ?? '',
          item.MEDICARE_NO ?? '',
          item.FIRST_NAME ?? '',
          item.LAST_NAME ?? '',
          item.BIRTH ?? '',
          item.ObservationDate !== '01/01/1900' ? item.ObservationDate : '',
          item.Observation_Year ?? '',
          item.Observation_Code ?? '',
          item.CPT_Code_Modifier ?? '',
          item.Observation_Code_Set ?? '',
          item.Observation_Result ?? '',
          item.Service_Provider_NPI ?? '',
          item.Service_Provider_Taxonomy_Code ?? '',
          item.Service_Provider_Name ?? '',
          item.Service_Provider_Type ?? '',
          item.Service_Provider_RxProviderFlag ?? '',
          item.Provider_Group_NPI ?? '',
          item.Provider_Group_Taxonomy_Code ?? '',
          item.Provider_Group_Name ?? '',
          item.Source ?? ''
        ]
          .map(v => v.toString().replace(/\|/g, ' '))
          .join('|')
      );
    }

    // ✅ QUALITY DOWNLOAD
    else if (gapsType === 'quality') { 
      header = [
        'MemberKey',
        'ProviderKey',
        'DOS',
        'DOSThru',
        'CPTPx',
        'HCPCSPx',
        'LOINC',
        'SNOMED',
        'ICDDX',
        'ICDDX10',
        'RxNorm',
        'CVX',
        'Result',
        'RxProviderFlag',
        'PCPFlag',
        'QuantityDispensed',
        'SuppSource',
        'ObservationResult',
        'LOINCAnswer'
      ];

      rows = this.riskGapsReportList.map(item =>
        [
          item.RECIP_NO ?? '',
          item.PROVIDER_ID ?? '',
          item.ObservationDate !== '01/01/1900' ? item.ObservationDate : '',
          item.DOSThru !== '01/01/1900' ? item.DOSThru : '',
          item.CPTPx ?? '',
          item.HCPCSPx ?? '',
          item.LOINC ?? '',
          item.SNOMED ?? '',
          item.ICDDX ?? '',
          item.ICDDX10 ?? '',
          item.RxNorm ?? '',
          item.CVX ?? '',
          item.Result ?? '',
          item.RxProviderFlag ?? '',
          item.PCPFlag ?? '',
          item.QuantityDispensed ?? '',
          item.SuppSource ?? '',
          item.Observation_Result ?? '',
          item.LOINCAnswer ?? ''
        ]
          .map(v => (v ?? '').toString().replace(/\|/g, ' '))
          .join('|')
      );
    }

    const csv = [header.join('|'), ...rows].join('\n');
    const now = new Date();
    const filename = `GAPS_${(gapsType || 'UNKNOWN').toUpperCase()}_FILE_(${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}).CSV`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

  } catch (error) {
    console.error('CSV download failed:', error);
    alert('Failed to download CSV.');
  }
}

  filter(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.dataSource.filter = value.trim().toLowerCase();
  }

  /** Selects all rows if not all selected; otherwise clear selection */
  masterToggle() {
    const selectableRows = this.dataSource.data.filter(
      row => row.add_by === this.userId
    );

    if (this.selection.selected.length === selectableRows.length) {
      this.selection.clear();
    } else {
      this.selection.clear();
      selectableRows.forEach(row => this.selection.select(row));
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

  isAllSelected() {
    const selectableRows = this.dataSource.data.filter(
      row => row.add_by === this.userId
    );
    return this.selection.selected.length === selectableRows.length;
  }


 async removeSelected(): Promise<void> {
  if (!this.selection.hasValue()) return;

  const confirmed = confirm(
    `Remove ${this.selection.selected.length} selected record(s)?`
  );
  if (!confirmed) return;

  this.isLoading = true;
  // collect payload
  const payload = this.selection.selected.map(row => ({
    id: row.id,
    subscriber_number: row.SUBSCRIBER_NUMBER,
    gap_code: row.Gap_Code,
    Type: row.Type
  }));
  
  try {
    await this.apiService.deleteGapObservations({ records: payload });

    // remove from UI
    const selected = new Set(this.selection.selected);
    this.riskGapsReportList = this.riskGapsReportList.filter(
      row => !selected.has(row)
    );

    this.dataSource.data = this.riskGapsReportList;
    this.selection.clear();
    this.isLoading = false;
    
  } catch (err) {
    console.error('Delete failed', err);
    alert('Failed to remove records');
  }
}

}

