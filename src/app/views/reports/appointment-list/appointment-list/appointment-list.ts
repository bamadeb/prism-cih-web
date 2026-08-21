import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ConfigService } from '../../../../services/api.service';
import { Title } from '@angular/platform-browser';
import { MatCardModule } from "@angular/material/card";
import { MatFormField, MatFormFieldModule } from "@angular/material/form-field";
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
interface AppointmentResponse {
  data: any[];
}
@Component({
  selector: 'app-appointment-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatFormField, MatFormFieldModule, MatSelectModule, MatDatepickerModule, ReactiveFormsModule, MatInputModule, MatProgressSpinnerModule,
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule, MatIcon],
  providers: [provideNativeDateAdapter()],
  templateUrl: './appointment-list.html',
  styleUrl: './appointment-list.css',
})


export class AppointmentList implements AfterViewInit,OnInit {

  appListFormGroup!: FormGroup;
  isLoading = false;
  appointmentList: any[] = [];
  availableVendors: { VENDOR_NUM: string; LAST_NAME: string }[] = [];
  searchText = '';
  dataSource = new MatTableDataSource<any>([]);
  selection = new SelectionModel<any>(true, []);

  @ViewChild('mainPaginator') paginator!: MatPaginator;
  @ViewChild('mainSort') sort!: MatSort;
  displayedColumns: string[] = [
    'medicaid_id',
    'TYPE',
    'action_date',
    'vendor_id',
    'provider_id',
    'status',
    'place_of_appointment',
    'note',
    'FistName',
    'add_date'
  ];


  constructor(
    private readonly apiService: ConfigService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly headerService: HeaderService,
    private readonly titleService: Title,

  ) {
    const today = new Date();

    const thirtyDaysBefore = new Date();
    thirtyDaysBefore.setDate(today.getDate() - 30);
    this.appListFormGroup = this.fb.group({
      start_date: [thirtyDaysBefore, Validators.required],
      end_date: [today, Validators.required],
      vendor: ['']
    },
      { validators: this.dateRangeValidator } // ✅ custom validator
    );
  }

  async ngOnInit() {
    this.titleService.setTitle('PRISM :: APPOINTMENTS');
    this.headerService.setTitle('APPOINTMENTS');
    await this.loadVendors();
    this.appListFormGroup.get('vendor')?.valueChanges.subscribe(() => {
      this.applyCombinedFilter();
    });
    // Load page
    await this.applyFilter();
  }

  async loadVendors() {
    try {
      const result = await this.apiService.addActionMaster<any>({});
      this.availableVendors = result.data?.vendorList || [];
    } catch (err) {
      console.error('Vendor load failed', err);
    }
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

    this.dataSource.filterPredicate = (row: any, filter: string) => {
      let text = '';
      let vendor = '';
      try {
        ({ text = '', vendor = '' } = JSON.parse(filter));
      } catch {
        text = filter;
      }

      const matchesText = !text || Object.values(row).some(value =>
        (value ?? '').toString().toLowerCase().includes(text)
      );

      const matchesVendor = !vendor || (row.vendor_id ?? '').toString() === vendor;

      return matchesText && matchesVendor;
    };

    this.applyCombinedFilter();
  }

  applyCombinedFilter(): void {
    const vendor = this.appListFormGroup.get('vendor')?.value ?? '';
    this.dataSource.filter = JSON.stringify({ text: this.searchText, vendor });
  }

  async applyFilter() {
    if (this.appListFormGroup.invalid) {
      this.appListFormGroup.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    try {
      const formvalues= this.appListFormGroup.value;
      const start_date= this.formatDateToYMD(formvalues.start_date);
      const end_date= this.formatDateToYMD(formvalues.end_date);

      const result = await this.apiService.getAppointmentList<any>({
        start_date, 
        end_date
      });
      this.appointmentList = result.data ?? [];
      this.dataSource.data = this.appointmentList;

    } catch (err) {
      console.error('Appointment List load failed', err);
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  formatDateToYMD(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`; // m/d/Y format
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
    if (!this.appointmentList.length) {
      alert('No data available to download.');
      return;
    }

    const header = [
      'MEMBER ID',
      'TYPE',
      'ACTION DATE',
      'TIME',
      'VENDOR',
      'PROVIDER',
      'STATUS',
      'PLACE OF APPOINTMENT',
      'NOTE',
      'ADDED BY',
      'ADDED DATE'
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

    const rows = this.appointmentList.map(item => [
      item.medicaid_id ?? '',
      item.type ?? '',
      item.action_date !== '01/01/1900' ? formatMDY(item.action_date) : '',
      item.action_time ?? '',
      item.vendor_id ?? '',
      item.provider_id ?? '',
      item.status ?? '',
      item.place_of_appointment ?? '',
      item.note ?? '',
      item.FistName ?? '',
      item.add_date !== '01/01/1900' ? formatMDY(item.add_date) : ''
    ].map(escapeCsv).join(','));

    const csv = [
      header.map(h => `"${h}"`).join(','),
      ...rows
    ].join('\n');

    const now = new Date();
    const filename = `APPOINTMENT_LIST_(${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}).CSV`;

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
    this.searchText = ((event.target as HTMLInputElement).value ?? '').trim().toLowerCase();
    this.applyCombinedFilter();
  }

}
