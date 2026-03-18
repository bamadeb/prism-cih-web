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
  selector: 'app-logreport',
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
  templateUrl: './logreport.html',
  styleUrl: './logreport.css',
})
export class Logreport implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
      'medicaid_id',
      'Panel_Name',
      'action_type',
      'action_result',
      'action_status',
      'action_date',
      'action_note'
  ];

private readonly activityLabelMap: Record<string, string> = {
  'Call received': 'Calls received',
  'Phone call': 'Phone calls',
  'Home visit': 'Home Visits',
  'Text sent': 'Text sent',
  'Letter sent': 'Letters sent'
};

getActivityLabel(type: string): string {
  return this.activityLabelMap[type] ?? type;
}

dataSource = new MatTableDataSource<any>([]);
selection = new SelectionModel<any>(true, []);

@ViewChild('mainPaginator') paginator!: MatPaginator;
@ViewChild('mainSort') sort!: MatSort;

actionLogFormGroup!: FormGroup;
isLoading = false;
totalCount = 0;
activityCount: Record<string, number> = [] as any;
actionLogReportList: any[] = [];
navigatorList: any[] = [];
action_ativity_type: any[] = [];  

  // ✅ Status constants
  ACTION_STATUS = {
    SUCCESS: 'SUCCESS',
    SCHEDULED: 'SCHEDULED',
    FAILURE: 'FAILURE'
  };

  constructor(
    private readonly apiService: ConfigService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly headerService: HeaderService,
    private readonly titleService: Title
  ) {
    const today = new Date();
    const thirtyDaysBefore = new Date();
    thirtyDaysBefore.setDate(today.getDate() - 30);

    // ✅ All required controls added
    this.actionLogFormGroup = this.fb.group({
      navigator_id: [null],
      activity_type: [null],
      action_status: [null],
      start_date: [thirtyDaysBefore, Validators.required],
      end_date: [today, Validators.required],
    },{ validators: this.dateRangeValidator });
  }

  async ngOnInit() {
  this.titleService.setTitle('PRISM :: ACTION LOG REPORT');
  this.headerService.setTitle('ACTION LOG REPORT');

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

    const result = await this.apiService.getActionlogData<any>(payload);
    const rawData = result?.data ?? [];

    this.totalCount = rawData.length;

    // 🔹 Reset counts
    Object.keys(this.activityCount).forEach(k => this.activityCount[k] = 0);

    // 🔹 Map + count in one loop
    this.dataSource.data = rawData.map((u: any) => {
      const type = u.action_type;
      if (this.activityCount[type] !== undefined) {
        this.activityCount[type]++;
      }

      return {
        medicaid_id: u.medicaid_id,
        Panel_Name: u.Panel_Name ?? '',
        action_type: type ?? '',
        action_result: u.action_result ?? '',
        action_status: u.action_status ?? '',
        action_date: u.action_date ?? '',
        action_note: u.action_note ?? ''
      };
    });

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

    const activityTypes = result.data?.actionActivityType ?? [];
    this.navigatorList = result.data?.usersList ?? [];

    // 🔹 Enrich activity types with display labels
    this.action_ativity_type = activityTypes.map((a: any) => ({
      ...a,
      display_label: this.getActivityLabel(a.action_type)
    }));

    // 🔹 Initialize counts dynamically
    this.activityCount = this.action_ativity_type.reduce(
      (acc: Record<string, number>, cur: any) => {
        acc[cur.action_type] = 0;
        return acc;
      },
      {}
    );

  } finally {
    this.isLoading = false;
    this.cdr.markForCheck(); // ✅ OnPush safe
  }
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
    return `${year}-${month}-${day}`;
  }

  filter(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.dataSource.filter = value.trim().toLowerCase();
  }
}
