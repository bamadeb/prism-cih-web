import { ChangeDetectorRef,
  Component,
  OnInit,
  AfterViewInit,
  ViewChild, 
  ChangeDetectionStrategy} from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfigService } from '../../../../services/api.service';
import { Title } from '@angular/platform-browser';
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";
import { MatTableDataSource } from '@angular/material/table';
import { MatDatepickerModule } from "@angular/material/datepicker";
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HeaderService } from '../../../../services/header.service';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common'; 
import { MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { MatIcon } from "@angular/material/icon";

@Component({
  selector: 'app-outreach-activity',
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
    MatProgressSpinnerModule,
    MatIcon
],
  providers: [provideNativeDateAdapter()],
  templateUrl: './outreach-activity.html',
  styleUrl: './outreach-activity.css',
})
export class OutreachActivity implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
      'medicaid_id',
      'Panel_Name',
      'action_type',
      'action_result',
      'action_status',
      'action_date',
      'user_name',
      'action_note'
  ];

private activityLabelMap: Record<string, string> = {
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
roles: any[] = [];

  // ✅ Status constants
  ACTION_STATUS = {
    SUCCESS: 'SUCCESS',
    SCHEDULED: 'SCHEDULED',
    FAILURE: 'FAILURE'
  };

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
      role: [null],
      navigator_id: [null],
      activity_type: [null],
      action_status: [null],
      start_date: [thirtyDaysBefore, Validators.required],
      end_date: [today, Validators.required],
    },{ validators: this.dateRangeValidator });
  }

  async ngOnInit() {
  this.titleService.setTitle('PRISM :: OUTREACH ACTIVITY REPORT');
  this.headerService.setTitle('OUTREACH ACTIVITY REPORT');

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

    console.log('Filter payload:', payload); // Debug log

    const result = await this.apiService.getActionlogData<any>(payload);
    console.log('API result:', result); // Debug log
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
        user_name: u.user_name ?? '',
        action_note: u.action_note ?? ''
      };
    });

    this.selection.clear();

  } finally {
    this.isLoading = false;
    this.cdr.markForCheck(); // ✅ OnPush safe
  }
}

async onRoleChange(roleId: number) {

  this.isLoading = true;
  this.cdr.markForCheck();

  if (!roleId) {
    this.navigatorList = [];
    this.isLoading = false;
    this.cdr.markForCheck();
    return;
  }

  try {

    const result = await this.apiService.getUserListByid<any>({ role: roleId });

    this.navigatorList = result?.data ?? [];
    this.dataSource.data = [];
  } catch (error) {
    console.error('Error loading users', error);
  }
  finally {

    this.isLoading = false;
    this.cdr.markForCheck();

  }

}


async loadLogreport() {
  this.isLoading = true;

  try {
    const result = await this.apiService.addActionMaster<any>('0');
    //console.log(result);
    const activityTypes = result.data?.actionActivityType ?? [];
    //this.navigatorList = result.data?.usersList ?? [];
    this.roles = result?.data?.roles ?? [];

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

  downloadCsv(): void {
  try {
    if (!this.dataSource.data.length) {
      alert('No data available to download.');
      return;
    }

    const header = [
      'MEMBER ID',
      'ACTIVITY CATEGORY',
      'ACTIVITY TYPE',
      'ACTION RESULT',
      'ACTION STATUS',
      'ACTION DATE',
      'USER NAME',
      'NOTE'
    ];

    const formatMDY = (value: any): string => {
      if (!value) return '';
      const d = new Date(value);
      if (isNaN(d.getTime())) return value; // if not a valid date, return as-is
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    };

    const escapeCsv = (value: any): string => {
      if (value === null || value === undefined) return '""';
      return `"${value.toString().replace(/"/g, '""')}"`; // escape quotes
    };

    const rows = this.dataSource.data.map(item => [
      item.medicaid_id ?? '',
      item.Panel_Name ?? '',     
      item.action_type ?? '',
      item.action_result ?? '',
      item.action_status ?? '',
      item.action_date !== '01/01/1900' ? formatMDY(item.action_date) : '',
      item.user_name ?? '',
      item.action_note ?? '' 
    ].map(escapeCsv).join(','));

    const csv = [
      header.map(h => `"${h}"`).join(','),
      ...rows
    ].join('\n');

    const now = new Date();
    const filename = `OUTREACH_ACTIVITY_REPORT_(${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}).CSV`;

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
