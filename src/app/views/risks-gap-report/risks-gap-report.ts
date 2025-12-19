import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ConfigService } from '../../services/api.service';
import { Title } from '@angular/platform-browser';
import { MatCardModule } from "@angular/material/card";
import { MatFormField, MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";
import { MatTableDataSource } from '@angular/material/table';
import { DatePipe } from '@angular/common';
import { MatDatepickerModule } from "@angular/material/datepicker";
 
@Component({
  selector: 'app-risks-gap-report',
  imports: [MatCardModule, MatFormField, MatFormFieldModule, MatSelectModule, DatePipe, MatDatepickerModule,ReactiveFormsModule   ],
  templateUrl: './risks-gap-report.html',
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
    private fb: FormBuilder, private titleService: Title
  ) {
    this.riskGapsFormGroup = this.fb.group({
      
      start_date: ["12/01/2025"],
      end_date: ["12/31/2025"]  // multi-select
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
    const { year, plan, tins } = this.riskGapsFormGroup.value;

    this.isLoading = true;
    //this.measurementYear = year;
    const payload = {
      start_date: "11/01/2025", end_date: "12/31/2025"
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

}

