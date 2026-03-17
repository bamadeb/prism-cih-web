import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
//import { PROVIDER_TIN_MAP } from '../../../constants/constant';
import { CommonModule } from '@angular/common';
import { MatIcon } from "@angular/material/icon";


@Component({
  selector: 'app-star-performance',
  imports: [MatCardModule, CommonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    MatDatepickerModule, MatIcon],
  templateUrl: './star-performance.html',
  styleUrl: './star-performance.css'
})
export class StarPerformance implements OnInit {

  starPerformanceFormGroup!: FormGroup;
  isLoading = false;

  starReportList: any[] = [];
  vendorList: any[] = [];
  providerTinMap: Record<string, string> = {};
  vendorPlanList: any[] = [];
  plans: { name: string }[] = [];

  measurementYear = 2025;
  //providerGroup = 'Collective Impact Health';

//   providerTinNameMapping: Record<string, string> = {
//   '200807794': 'Mercado Medical Practice',
//   '237082074': 'GPHA',
//   '273160687': 'Dr. Milbourne',
// };

  years = [2026,2025, 2024, 2023, 2022];
  //   plans = [
  //   { id: 'AHC', name: 'AHC' },
  //   { id: 'Independence', name: 'Independence' }
  // ];
  // planTinMap: Record<string, string[]> = {
  //   AHC: ['237082074', '273160687', '200807794'],         // CHI → 3 TINs
  //   'Independence': ['111111111', '222222222']            // Plan B → 2 TINs
  // };
 
availableTins: { VENDOR_NUM: string; LAST_NAME: string }[] = [];
currentYear: any;
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

//   getProviderGroupByTin(tin: string): string {
//   const providerName = PROVIDER_TIN_MAP[tin];
//   return providerName
//     ? `${providerName}`
//     : this.providerGroup;
// }

getProviderGroupByTin(tin: string): string {
  const providerName = this.providerTinMap[tin];
  return providerName;
}


  ngOnInit(): void {
  this.isLoading = true;

  this.starPerformanceFormGroup.patchValue({
    year: this.measurementYear
  });

  this.titleService.setTitle('PRISM :: STAR PERFORMANCE');
  this.headerService.setTitle('STAR PERFORMANCE');

  this.loadVendors();   // 🔑 dynamic providers

  this.onPlanChange(this.starPerformanceFormGroup.value.plan);

  this.starPerformanceFormGroup
    .get('plan')
    ?.valueChanges
    .subscribe(planId => this.onPlanChange(planId));

  this.applyFilter();
}


async onPlanChange(planId: string) { 
  const payload ={plan:planId};
  const result = await this.apiService.getVendorListByplan<any>(payload);  
  //this.availableTins = this.planTinMap[planId] || [];
  this.availableTins = result.data || [];
  console.log(this.availableTins);

  
  // Reset selected TINs when plan changes
  this.starPerformanceFormGroup.patchValue({
    tins: []
  });
}

async loadVendors() {
  const payload = {}; // whatever payload your API expects

  const result = await this.apiService.addActionMaster<any>(payload);
  this.vendorList = result.data.vendorList || [];

  // Build dynamic TIN → Provider Name map
  this.providerTinMap = {};
  this.vendorList.forEach((v: any) => {
    this.providerTinMap[String(v.VENDOR_NUM)] = v.LAST_NAME;
  });

  // 🔹 plans (dynamic)
  this.vendorPlanList = result.data.vendorPlanList || [];

  this.plans = this.vendorPlanList.map((p: any) => ({
   // id: p.PLAN_ID,     // adjust if API uses different field
    name: p.PLANS // adjust if API uses different field
  }));
}


async applyFilter() {
  const { year, plan, tins } = this.starPerformanceFormGroup.value;
  this.isLoading = true;
  try {
    const currentYear = new Date().getFullYear();
    const payload = { year, plan, tins ,currentYear};  
    this.currentYear = currentYear;
    //alert(currentYear);
    const result = await this.apiService.getStarPerformanceByYear<any>(payload);
    //console.log(result.data);

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
    : this.availableTins.map(t => t.VENDOR_NUM);
}


}

