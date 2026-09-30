import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
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
import { MatIcon } from "@angular/material/icon";
import { MatCheckbox } from "@angular/material/checkbox";
import { UserDataService } from '../../../services/user-data-service';



@Component({
  selector: 'app-risks-gap-report',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatFormFieldModule, MatSelectModule, MatDatepickerModule, ReactiveFormsModule, MatInputModule, MatProgressSpinnerModule,
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule, MatIcon, MatCheckbox],
  providers: [
    provideNativeDateAdapter()   // <-- REQUIRED FIX
  ], templateUrl: './risks-gap-report.html',
  styleUrl: './risks-gap-report.css',
})
export class RisksGapReport implements AfterViewInit, OnInit {


  riskGapsFormGroup!: FormGroup;
  isLoading = false;
  userId: string | null = null;
  riskGapsReportList: any[] = [];
  availableTins: { VENDOR_NUM: string; LAST_NAME: string }[] = [];

  dataSource = new MatTableDataSource<any>([]);
  selection = new SelectionModel<any>(true, []);

  @ViewChild('mainPaginator') paginator!: MatPaginator;
  @ViewChild('mainSort') sort!: MatSort;
  riskColumns: string[] = [
    'select',
    'medicaid_id',
    'mode',
    'Gap_Code',
    'MEASURE_DESC',
    'ObservationDate',
    'Observation_Year',
    'Observation_Code',
    'CPT_Code_Modifier',
    'Observation_Code_Set',
    'Observation_Result',
    'Service_Provider_NPI',
    'Service_Provider_Taxonomy_Code',
    'Service_Provider_Name',
    'Service_Provider_Type',
    'Service_Provider_RxProviderFlag',
    'Provider_Group_NPI',
    'Provider_Group_Taxonomy_Code',
    'Provider_Group_Name',
    'Source'
  ];

  qualityColumns: string[] = [
    'select',
    'medicaid_id',
    'mode',
    'PROVIDER_ID',
    'ReferenceID',
    'DOS',
    'DOSThru',
    'Service_Provider_Type',
    'Service_Provider_Taxonomy_Code',
    'CPTPx1',
    'CPTPx2',
    'HCPCSPx',
    'LOINC',
    'LOINCAnswer',
    'SNOMED',
    'ICDDX',
    'ICDDX10',
    'ICDPx',
    'ICDPx10',
    'RxNorm',
    'CVX',
    'Modifier',
    'Observation_Result',
    'RxProviderFlag',
    'PCPFlag',
    'QuantityDispensed',
    'SuppSource'
  ];
  displayedColumns: string[] = [];


  constructor(
    private readonly apiService: ConfigService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly headerService: HeaderService,
    private readonly titleService: Title,
    private readonly userData: UserDataService,

  ) {
    const today = new Date();

    const thirtyDaysBefore = new Date();
    thirtyDaysBefore.setDate(today.getDate() - 30);
    this.riskGapsFormGroup = this.fb.group({
      gaps_type: ['risk'],
      tin: [''],
      start_date: [thirtyDaysBefore, Validators.required],
      end_date: [today, Validators.required]
    },
      { validators: this.dateRangeValidator } // ✅ custom validator
    );
  }

  async ngOnInit() {
    this.titleService.setTitle('PRISM :: GAPS REPORT');
    this.headerService.setTitle('GAPS REPORT');
    const user = this.userData.getUser();
    this.userId = user.ID;
    await this.loadTins();
    await this.applyFilter();
  }

  async loadTins() {
    try {
      const result = await this.apiService.addActionMaster<any>({});
      this.availableTins = result.data?.vendorList || [];
    } catch (err) {
      console.error('TIN load failed', err);
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
  }

  formatDateToYMD(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`; // m/d/Y format
  }

  /**
   * Wraps a YYYY-MM-DD date in an Excel text formula (="YYYY-MM-DD") so Excel does not
   * re-interpret it and display it in the machine's locale (e.g. DD-MM-YYYY).
   * Returns '' for blank/sentinel values.
   */
  formatDosDateForExcel(value: any): string {
    const ymd = this.formatDosDate(value);
    return ymd ? `="${ymd}"` : '';
  }

  /** Formats DOS / DOSThru values to YYYY-MM-DD; blank for empty or the 01/01/1900 sentinel */
  formatDosDate(value: any): string {
    if (value === null || value === undefined) return '';
    const str = value.toString().trim();
    if (!str || str.startsWith('01/01/1900') || str.startsWith('1900-01-01')) return '';

    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(str);
    if (m) {
      return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    }

    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Formats a quality-gap row's provider as "Provider Name (provider_id)" */
  formatProviderCell(item: any): string {
    const name = (item.PROVIDER_NAME ?? '').toString().trim();
    const id = (item.provider_id ?? '').toString().trim();
    return name ? `${name} (${id})` : id;
  }

  /** Splits a "+"-joined CPTPx value (e.g. "3077F + 3079F") into its individual parts for display. */
  getCptPxPart(value: any, part: 1 | 2): string {
    const s = (value ?? '').toString().trim();
    if (!s) return '';
    const parts = s.split('+').map((p: string) => p.trim());
    return parts[part - 1] ?? '';
  }

  /** Normalizes flag values to Y / N (from Yes/No, true/false, 1/0). Blank stays blank. */
  formatYN(value: any): string {
    if (value === null || value === undefined || value === '') return '';
    const s = value.toString().trim().toLowerCase();
    if (['y', 'yes', 'true', '1'].includes(s)) return 'Y';
    if (['n', 'no', 'false', '0'].includes(s)) return 'N';
    return value.toString();
  }


  async applyFilter() {
    if (this.riskGapsFormGroup.invalid) {
      this.riskGapsFormGroup.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    try {
      const { start_date, end_date, gaps_type, tin } = this.riskGapsFormGroup.value;

      const formatDate = (d: string | Date) => {
        const date = new Date(d);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      };

      const payload = {
        start_date: this.formatDateToYMD(start_date),
        end_date: this.formatDateToYMD(end_date),
        gaps_type,
        tin: tin || ''
      };

      const result = await this.apiService.getGapsObservationData(payload);

      // ✅ TypeScript now knows that 'data' exists
      this.riskGapsReportList = result.data ?? [];
      this.dataSource.data = this.riskGapsReportList;

      // ✅ SWITCH COLUMNS HERE
      if (gaps_type === 'quality') {
        this.displayedColumns = this.qualityColumns;
      } else {
        this.displayedColumns = this.riskColumns;
      }

    } catch (err) {
      console.error('Risk gaps load failed', err);
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
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

    if (!this.riskGapsReportList.length) {
      alert('No data available to download.');
      return;
    }

    const gapsType = this.riskGapsFormGroup.get('gaps_type')?.value;

    let header: string[] = [];
    let rows: string[] = [];

    // =========================
    // RISK DOWNLOAD
    // =========================
    if (gapsType === 'risk') {

      header = [
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

      rows = this.riskGapsReportList.map(item =>
        [
          item.RECIP_NO ?? '',
          item.RECIP_NO ?? '',
          item.MEDICARE_NO ?? '',
          item.FIRST_NAME ?? '',
          item.LAST_NAME ?? '',
          item.BIRTH ?? '',
          item.ObservationDate !== '01/01/1900' ? item.ObservationDate : '',
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
        ]
          .map(value =>
            `"${(value ?? '')
              .toString()
              .replace(/"/g, '""')}"`
          )
          .join(',')
      );
    }

    // =========================
    // QUALITY DOWNLOAD
    // =========================
    else if (gapsType === 'quality') {

      header = [
        'MemberKey',
        'ProviderKey',
        'ReferenceID',
        'DOS',
        'DOSThru',
        'ProviderType',
        'ProviderTaxonomy',
        'CPTPx',
        'CPTPx2',
        'HCPCSPx',
        'LOINC',
        'SNOMED',
        'ICDDX10',
        'ICDPx',
        'ICDPx10',
        'RxNorm',
        'CVX',
        'Modifier',
        'RxProviderFlag',
        'PCPFlag',
        'QuantityDispensed',
        'SuppSource',
        'Result',
        'LOINCAnswer'
      ];

      rows = this.riskGapsReportList.map(item =>
        [
          item.RECIP_NO ?? '',
          this.formatProviderCell(item),
          item.ReferenceID ?? '',
          this.formatDosDateForExcel(item.ObservationDate),
          this.formatDosDateForExcel(item.DOSThru),
          item.Service_Provider_Type ?? '',
          item.Service_Provider_Taxonomy_Code ?? '',
          this.getCptPxPart(item.CPTPx, 1),
          this.getCptPxPart(item.CPTPx, 2),
          item.HCPCSPx ?? '',
          item.LOINC ?? '',
          item.SNOMED ?? '',
          item.ICDDX10 ?? '',
          item.ICDPx ?? '',
          item.ICDPx10 ?? '',
          item.RxNorm ?? '',
          item.CVX ?? '',
          item.Modifier ?? '',
          this.formatYN(item.RxProviderFlag),
          this.formatYN(item.PCPFlag),
          item.QuantityDispensed ?? '',
          item.SuppSource ?? '',
          item.Observation_Result ?? '',
          item.LOINCAnswer ?? ''
        ]
          .map(value => {
            const s = (value ?? '').toString();
            // Keep Excel text formulas (="...") unquoted so Excel evaluates them
            if (/^="[^"]*"$/.test(s)) return s;
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(',')
      );
    }

    // =========================
    // CREATE CSV
    // =========================
    const csvContent = [
      header.map(h => `"${h}"`).join(','),
      ...rows
    ].join('\n');

    // =========================
    // FILE NAME
    // =========================
    const now = new Date();

    const filename =
      `GAPS_${(gapsType || 'UNKNOWN')
        .toUpperCase()}_FILE_CSV(${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}).csv`;

    // =========================
    // DOWNLOAD FILE
    // =========================
    const blob = new Blob(
      [csvContent],
      { type: 'text/csv;charset=utf-8;' }
    );

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

  } catch (error) {
    console.error('CSV download failed:', error);
    alert('Failed to download CSV.');
  }
}

  downloadPipedelimeter(): void {
    try {
      if (!this.riskGapsReportList.length) {
        alert('No data available to download.');
        return;
      }

      const gapsType = this.riskGapsFormGroup.get('gaps_type')?.value;

      let header: string[] = [];
      let rows: string[] = [];

      // ✅ RISK DOWNLOAD
      if (gapsType === 'risk') {
        header = [
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

        rows = this.riskGapsReportList.map(item =>
          [
            item.RECIP_NO ?? '',
            item.RECIP_NO ?? '',
            item.MEDICARE_NO ?? '',
            item.FIRST_NAME ?? '',
            item.LAST_NAME ?? '',
            item.BIRTH ?? '',
            item.ObservationDate !== '01/01/1900' ? item.ObservationDate : '',
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
          ]
            .map(v => (v ?? '').toString().replace(/\|/g, ' '))
            .join('|')
        );
      }

      // ✅ QUALITY DOWNLOAD
      else if (gapsType === 'quality') {
        header = [
          'MemberKey',
          'ProviderKey',
          'ReferenceID',
          'DOS',
          'DOSThru',
          'ProviderTaxonomy',
          'ProviderType',
          'CPTPx',
          'CPTPx2',
          'HCPCSPx',
          'LOINC',
          'SNOMED',
          'ICDDX10',
          'ICDPx',
          'ICDPx10',
          'RxNorm',
          'CVX',
          'Modifier',
          'RxProviderFlag',
          'PCPFlag',
          'QuantityDispensed',
          'SuppSource',
          'Result',
          'LOINCAnswer'
        ];

        rows = this.riskGapsReportList.map(item =>
          [
            item.RECIP_NO ?? '',
            this.formatProviderCell(item),
            item.ReferenceID ?? '',
            this.formatDosDate(item.ObservationDate),
            this.formatDosDate(item.DOSThru),
            item.Service_Provider_Type ?? '',
            item.Service_Provider_Taxonomy_Code ?? '',
            this.getCptPxPart(item.CPTPx, 1),
            this.getCptPxPart(item.CPTPx, 2),
            item.HCPCSPx ?? '',
            item.LOINC ?? '',
            item.SNOMED ?? '',
            item.ICDDX10 ?? '',
            item.ICDPx ?? '',
            item.ICDPx10 ?? '',
            item.RxNorm ?? '',
            item.CVX ?? '',
            item.Modifier ?? '',
            this.formatYN(item.RxProviderFlag),
            this.formatYN(item.PCPFlag),
            item.QuantityDispensed ?? '',
            item.SuppSource ?? '',
            item.Observation_Result ?? '',
            item.LOINCAnswer ?? ''
          ]
            .map(v => (v ?? '').toString().replace(/\|/g, ' '))
            .join('|')
        );
      }

      const csv = [header.join('|'), ...rows].join('\n');
      const now = new Date();
      const filename = `GAPS_${(gapsType || 'UNKNOWN').toUpperCase()}_FILE_(${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}).CSV`;
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
    const value = (event.target as HTMLInputElement).value ?? '';
    this.dataSource.filter = value.trim().toLowerCase();
  }

  /** Selects all rows if not all selected; otherwise clear selection */
  masterToggle() {
    const selectableRows = this.dataSource.data.filter(
      row => row.added_by === this.userId
    );

    if (this.selection.selected.length === selectableRows.length) {
      this.selection.clear();
    } else {
      this.selection.clear();
      selectableRows.forEach(row => this.selection.select(row));
    }
  }

  getSelectedRows(): any[] {
    return this.selection.selected;
  }



  /** Checkbox label (accessibility) */
  checkboxLabel(row?: any): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row`;
  }

  isAllSelected() {
    const selectableRows = this.dataSource.data.filter(
      row => row.added_by === this.userId
    );
    return this.selection.selected.length === selectableRows.length;
  }


  async removeSelected(): Promise<void> {
    if (!this.selection.hasValue()) return;

  const confirmed = confirm(
    `Remove ${this.selection.selected.length} selected record(s)?`
  );
  if (!confirmed) return;

  this.isLoading = true;
  // collect payload
  const payload = this.selection.selected.map(row => ({
    id: row.id,
    subscriber_number: row.SUBSCRIBER_NUMBER,
    gap_code: row.Gap_Code,
    Type: row.Type
  }));
  
  try {
    await this.apiService.deleteGapObservations({ records: payload });

    const selected = new Set(this.selection.selected);
    this.riskGapsReportList = this.riskGapsReportList.filter(
      row => !selected.has(row)
    );
    this.dataSource.data = this.riskGapsReportList;
    this.selection.clear();
    this.cdr.markForCheck();

  } catch (err) {
    console.error('Delete failed', err);
    alert('Failed to remove records');
  } finally {
    this.isLoading = false;
    this.cdr.markForCheck();
 
  }

}

}