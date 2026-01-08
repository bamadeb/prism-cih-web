import { ChangeDetectorRef, Component } from '@angular/core';
import { MatCardModule } from "@angular/material/card";
import { ConfigService } from '../../../services/api.service';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { Title } from '@angular/platform-browser';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { HeaderService } from '../../../services/header.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PROVIDER_TIN_MAP } from '../../../constants/constant';

@Component({
  selector: 'app-star-performance',
  imports: [MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
  MatDatepickerModule],
  templateUrl: './star-performance.html',
  styleUrl: './star-performance.css'
})
export class StarPerformance {

  starPerformanceFormGroup!: FormGroup;
  isLoading = false;

  starReportList: any[] = [];

  measurementYear = 2025;
  providerGroup = 'Collective Impact Health';

//   providerTinNameMapping: Record<string, string> = {
//   '200807794': 'Mercado Medical Practice',
//   '237082074': 'GPHA',
//   '273160687': 'Dr. Milbourne',
// };

  years = [2026,2025, 2024, 2023, 2022];
    plans = [
    { id: 'AHC', name: 'AHC' },
    { id: 'Independence', name: 'Independence' }
  ];
  planTinMap: Record<string, string[]> = {
    AHC: ['237082074', '273160687', '200807794'],   // CHI → 3 TINs
    'Independence': ['111111111', '222222222']            // Plan B → 2 TINs
  };
 
availableTins: string[] = [];
  constructor(
    private apiService: ConfigService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,private titleService: Title,
    private headerService: HeaderService 
  ) {     
     
    this.starPerformanceFormGroup = this.fb.group({      
      year: [],
      plan: ['AHC'],
      tins: [[]]     // multi-select
    });
  }

  getProviderGroupByTin(tin: string): string {
  const providerName = PROVIDER_TIN_MAP[tin];
  return providerName
    ? `${this.providerGroup} (${providerName})`
    : this.providerGroup;
}


  ngOnInit(): void {
  this.isLoading = true;

  this.starPerformanceFormGroup.patchValue({
    year: this.measurementYear
  });

  this.titleService.setTitle('PRISM :: STAR PERFORMANCE');
  this.headerService.setTitle('STAR PERFORMANCE');

  this.onPlanChange(this.starPerformanceFormGroup.value.plan);

  this.starPerformanceFormGroup
    .get('plan')
    ?.valueChanges
    .subscribe(planId => this.onPlanChange(planId));

  this.applyFilter();
}


onPlanChange(planId: string) {
  this.availableTins = this.planTinMap[planId] || [];

  // Reset selected TINs when plan changes
  this.starPerformanceFormGroup.patchValue({
    tins: []
  });
}

async applyFilter() {
  const { year, plan, tins } = this.starPerformanceFormGroup.value;

  this.isLoading = true;

  try {
    const payload = { year, plan, tins };
    const result = await this.apiService.getStarPerformanceByYear<any>(payload);

    this.starReportList = result?.data || [];

  } catch (error) {
    this.starReportList = [];
  } finally {
    this.isLoading = false;
    this.cdr.detectChanges(); // 🔑 force UI update
  }
}


  get selectedTins(): string[] {
    return this.starPerformanceFormGroup?.value?.tins?.length
      ? this.starPerformanceFormGroup.value.tins
      : this.availableTins;
  }

}

