import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule,Validators, AbstractControl, ValidationErrors  } from '@angular/forms';
import { ConfigService } from '../../../services/api.service';
import { Title } from '@angular/platform-browser';
import { MatCardModule } from "@angular/material/card";
import { MatFormField, MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";
import { MatTableDataSource } from '@angular/material/table';
// import { DatePipe } from '@angular/common';
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



@Component({
  selector: 'app-risks-gap-report',
 standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatFormField, MatFormFieldModule, MatSelectModule, MatDatepickerModule,ReactiveFormsModule, MatInputModule, MatProgressSpinnerModule,
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,    
    MatButtonModule],
  providers: [
    provideNativeDateAdapter()   // <-- REQUIRED FIX
  ],templateUrl: './risks-gap-report.html',
  styleUrl: './risks-gap-report.css',
})
export class RisksGapReport {


  riskGapsFormGroup!: FormGroup;
  isLoading = false;

  riskGapsReportList: any[] = [];

  dataSource = new MatTableDataSource<any>([]);
  selection = new SelectionModel<any>(true, []);

  @ViewChild('mainPaginator') paginator!: MatPaginator;
  @ViewChild('mainSort') sort!: MatSort;
  displayedColumns: string[] = [
  'medicaid_id',
  'TYPE',
  'DIAG_CODE',
  'DIAG_DESC',
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

 
  constructor(
    private apiService: ConfigService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private headerService: HeaderService ,
    private titleService: Title,
    
  ) {
    const today = new Date();

    const thirtyDaysBefore = new Date();
    thirtyDaysBefore.setDate(today.getDate() - 30);
    this.riskGapsFormGroup = this.fb.group({ 
      start_date: [thirtyDaysBefore, Validators.required],
      end_date: [today, Validators.required]
    },
    { validators: this.dateRangeValidator } // ✅ custom validator
  );
  }

  async ngOnInit() { 
    this.titleService.setTitle('PRISM :: RISK GAPS');
    this.headerService.setTitle('RISK GAPS');
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
  
 async applyFilter() {
  if (this.riskGapsFormGroup.invalid) {
    this.riskGapsFormGroup.markAllAsTouched();
    return;
  }

  this.isLoading = true;

  try {
    const { start_date, end_date } = this.riskGapsFormGroup.value;

    const result = await this.apiService.getGapsObservationData({
      start_date,
      end_date
    });

    // ✅ TypeScript now knows that 'data' exists
    this.riskGapsReportList = result.data ?? [];
    this.dataSource.data = this.riskGapsReportList;

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

    const header = [
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

    const rows = this.riskGapsReportList.map(item =>
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

    const csv = [header.join('|'), ...rows].join('\n');

    const now = new Date();
    const filename = `RISK_GAPS_CIH_(${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}).CSV`;

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
}

