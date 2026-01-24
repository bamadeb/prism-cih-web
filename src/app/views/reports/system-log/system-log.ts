import { ChangeDetectorRef,
  Component,
  OnInit,
  AfterViewInit,
  ViewChild, 
  ChangeDetectionStrategy} from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfigService } from '../../../services/api.service';
import { Title } from '@angular/platform-browser';
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
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

@Component({
  selector: 'app-system-log',
   standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    ReactiveFormsModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './system-log.html',
  styleUrl: './system-log.css',
})
export class SystemLog implements OnInit, AfterViewInit {

  displayedColumns: string[] = [
      'medicaid_id',
      'log_name',
      'log_details',
      'log_status', 
      'add_date' 
  ];

dataSource = new MatTableDataSource<any>([]);
selection = new SelectionModel<any>(true, []);

@ViewChild('mainPaginator') paginator!: MatPaginator;
@ViewChild('mainSort') sort!: MatSort;

actionLogFormGroup!: FormGroup;
isLoading = false;     
navigatorList: any[] = [];  
  
  constructor(
    private apiService: ConfigService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private headerService: HeaderService,
    private titleService: Title
  ) {
    const today = new Date();
    const thirtyDaysBefore = new Date();
    thirtyDaysBefore.setDate(today.getDate() - 30);

    // ✅ All required controls added
    this.actionLogFormGroup = this.fb.group({
      user_id: [3],      
      start_date: [thirtyDaysBefore, Validators.required],
      end_date: [today, Validators.required],
    },{ validators: this.dateRangeValidator });
  }

  async ngOnInit() {
  this.titleService.setTitle('PRISM :: SYSTEM LOG REPORT');
  this.headerService.setTitle('SYSTEM LOG REPORT');

  await this.loadLogreport();   // must come first
  await this.applyFilter();
}

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    this.dataSource.sortingDataAccessor = (item, property) => {
      const value = item[property];
      return typeof value === 'string' ? value.toLowerCase() : value;
    };
  }

  async applyFilter() {
  this.isLoading = true;

  try {
    const payload = {
      ...this.actionLogFormGroup.value,
      start_date: this.formatYMD(this.actionLogFormGroup.value.start_date),
      end_date: this.formatYMD(this.actionLogFormGroup.value.end_date),
    }; 

    const result = await this.apiService.getSystemlog<any>(payload);
    const rawData = Array.isArray(result?.data)
  ? result.data
  : Array.isArray(result?.data?.data)
    ? result.data.data
    : []; 
     this.dataSource.data = rawData.map((u: any) => ({
        medicaid_id: u.medicaid_id ?? '',
        log_name: u.log_name ?? '',
        log_details: u.log_details ?? '',
        log_status: u.log_status ?? '',
        add_date: u.add_date ?? ''
      }));

    this.selection.clear();
  } finally {
    this.isLoading = false;
    this.cdr.markForCheck(); // ✅ OnPush safe
  }
}

async loadLogreport() {
  this.isLoading = true;
  try {
    const result = await this.apiService.addActionMaster<any>('0'); 
    this.navigatorList = result.data?.allusersList ?? [];      

  } finally {
    this.isLoading = false;
    this.cdr.markForCheck(); // ✅ OnPush safe
  }
}

  ////////////////////// Helper ///////////////////////////
  dateRangeValidator(control: AbstractControl) {
    const start = control.get('start_date')?.value;
    const end = control.get('end_date')?.value;

    if (!start || !end) return null; // skip if not set yet

    return new Date(end).getTime() >= new Date(start).getTime()
      ? null
      : { dateRangeInvalid: true }; // error key
  }

  formatYMD(date:Date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}/${year}`;
  }

  filter(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.dataSource.filter = value.trim().toLowerCase();
  }

}
