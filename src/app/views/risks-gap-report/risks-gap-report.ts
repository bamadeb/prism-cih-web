import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ConfigService } from '../../services/api.service';
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

@Component({
  selector: 'app-risks-gap-report',
  imports: [MatCardModule, MatFormField, MatFormFieldModule, MatSelectModule, MatDatepickerModule,ReactiveFormsModule, MatInputModule, MatProgressSpinnerModule      ],
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
  // measurementYear = '2024';
  // providerGroup = 'Collective Impact Health (CIH)';

  // years = [2025, 2024, 2023, 2022];
  // plans = [
  //   { id: 'AHC', name: 'AHC' },
  //   { id: 'Independence', name: 'Independence' }
  // ];
  // planTinMap: Record<string, string[]> = {
  //   AHC: ['237082074', '273160687', '200807794'],   // CHI → 3 TINs
  //   'Independence': ['111111111', '222222222']            // Plan B → 2 TINs
  // };

  // availableTins: string[] = [];
  constructor(
    private apiService: ConfigService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
     private titleService: Title,
    
  ) {
    const today = new Date();

    const thirtyDaysBefore = new Date();
    thirtyDaysBefore.setDate(today.getDate() - 30);
    this.riskGapsFormGroup = this.fb.group({
      
      start_date: [thirtyDaysBefore],
      end_date: [today]  // multi-select
    });
  }

  ngOnInit(): void {
    // initialize TINs for default plan
    // this.titleService.setTitle('PRISM :: STAR PERFORMANCE');
    // this.onPlanChange(this.starPerformanceFormGroup.value.plan);

    // // listen to plan changes
    // this.starPerformanceFormGroup
    //   .get('plan')
    //   ?.valueChanges
    //   .subscribe((planId: string) => {
    //     this.onPlanChange(planId);
    //   });
     this.applyFilter();
  }
  // onPlanChange(planId: string) {
  //   this.availableTins = this.planTinMap[planId] || [];

  //   // Reset selected TINs when plan changes
  //   this.riskGapsFormGroup.patchValue({
  //     tins: []
  //   });
  // }
  async applyFilter() {
    //const { year, plan, tins } = this.riskGapsFormGroup.value;
    const { start_date, end_date } = this.riskGapsFormGroup.value;
    this.isLoading = true;
    //this.measurementYear = year;
    const payload = {
      start_date: start_date,
      end_date: end_date
    };

    const result = await this.apiService.getGapsObservationData<any>(payload);

    this.riskGapsReportList = result?.data || [];
    this.dataSource.data = this.riskGapsReportList;
    this.isLoading = false;

    this.cdr.detectChanges();
  }
  // get selectedTins(): string[] {
  //   return this.starPerformanceFormGroup?.value?.tins?.length
  //     ? this.starPerformanceFormGroup.value.tins
  //     : this.availableTins;
  // }
    downloadCsv() {
    if (!this.riskGapsReportList.length) {
      alert('No data available to download.');
      return;
    }

    // ---------------------------------------------
    // 1) FIRST API DATA (existing: this.gapsData)
    // ---------------------------------------------
    const api1Data = this.riskGapsReportList;

    // Custom CSV header (NOT object keys)
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

    // Convert API1 data to CSV rows using your header
    const rows1 = api1Data.map(item => [
      item.RECIP_NO ?? '',
      item.RECIP_NO ?? '',
      item.MEDICARE_NO ?? '',
      item.FIRST_NAME ?? '',
      item.LAST_NAME ?? '',
      item.BIRTH ?? '', 
      item.ObservationDate !== '01/01/1900' ? item.ObservationDate  : '',
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
    ].map(v => v.toString().replace(/\|/g, ' ')).join('|')); 

      // ---------------------------------------------
      // 3) MERGE BOTH API DATASETS INTO CSV
      // ---------------------------------------------
      const csvRows = [
        header.join('|'),
        ...rows1 
      ];

      // ---------------------------------------------
      // 4) FILENAME
      // ---------------------------------------------
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const yyyy = now.getFullYear();
      const filename = `RISK_GAPS_CIH_(${mm}-${dd}-${yyyy}).CSV`;

      // ---------------------------------------------
      // 5) DOWNLOAD CSV
      // ---------------------------------------------
      const blob = new Blob([csvRows.join('\n')], {
        type: 'text/csv;charset=utf-8;'
      });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
  
  }
}

