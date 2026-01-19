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
  selector: 'app-file-log-report',
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
  templateUrl: './file-log-report.html',
  styleUrl: './file-log-report.css',
})
export class FileLogReport implements OnInit, AfterViewInit {

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
processList: any[] = []; 
logDetails: any[] = [];

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
  this.titleService.setTitle('PRISM :: FILE PROCESS LOG REPORT');
  this.headerService.setTitle('FILE PROCESS REPORT');

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

  async onProcessTypeChange() {
    const log_for = this.actionLogFormGroup.get('process_type')?.value;
    this.processList = [];
    this.logDetails = [];
    this.actionLogFormGroup.get('process_list')?.setValue('');
    //alert(log_for);
    if (!log_for) return;
      //console.log(this.processLogForm.get('process_list')?.value);
    //console.log(this.process_list);
    const getApiData = { log_for: log_for };
    const result = await this.apiService.getFIleprocesslist<any>(getApiData);
    const rawData = result?.data ?? [];
    this.processList = result.data;  
    this.isLoading = false
     
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

async onProcessSelect() {
    const session_id = this.actionLogFormGroup.get('process_list')?.value;
    this.logDetails = [];

    if (!session_id) return;

    this.isLoading = true;
    const payload = { 
      session_id: session_id 
    };
    const result = await this.apiService.getfileprocessLoglist<any>(payload); 
     const rawData = result?.data ?? [];
    this.logDetails = result.data; 
    this.isLoading = false 
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
  formatDateTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const month = d.getMonth() + 1;
    return `${month}/${d.getDate()}/${d.getFullYear()} ${hours}:${minutes}:${seconds} ${ampm}`;
  }
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
