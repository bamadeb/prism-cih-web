import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MatCardModule } from "@angular/material/card";
import { ConfigService } from '../../../services/api.service';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { Title } from '@angular/platform-browser';
import { HeaderService } from '../../../services/header.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
    MatIcon],
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

  measurementYear = new Date().getFullYear();


  years = [2026,2025, 2024, 2023, 2022];
  
 
availableTins: { VENDOR_NUM: string; LAST_NAME: string }[] = [];
currentYear: any;
  constructor(
    private readonly apiService: ConfigService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,private titleService: Title,
    private readonly headerService: HeaderService 
  ) {     
     
    this.starPerformanceFormGroup = this.fb.group({      
      year: [],
      plan: ['AHC'],
      tins: [[]]     // multi-select
    });
  }


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
  
  this.availableTins = result.data || [];
  //console.log(this.availableTins);

  
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
   
    name: p.PLANS // adjust if API uses different field
  }));
}


async applyFilter() {
  const { year: selectedYear, plan, tins } = this.starPerformanceFormGroup.value;
  this.isLoading = true;
  try {
    // The YEAR dropdown selects currentYear; year is always the prior year,
    // sent alongside it so the API can return both years for comparison.
    const currentYear = selectedYear;
    const year = selectedYear - 1;
    const payload = { year, plan, tins ,currentYear};
    this.currentYear = currentYear;

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
    : this.availableTins.map(t => t.VENDOR_NUM);
}


}

