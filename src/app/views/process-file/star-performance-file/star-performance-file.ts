import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatFormField, MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { provideNativeDateAdapter } from '@angular/material/core';
import { ConfigService } from '../../../services/api.service';
import { HeaderService } from '../../../services/header.service';
import { UserDataService } from '../../../services/user-data-service';
import { MemberFileRequest } from '../../../models/requests/memberFileRequest';
import { CsvRowError, MAX_CSV_ROWS, checkCsvFile, parseCsv } from '../../../utilities/csv-import';
import { MatDialog } from '@angular/material/dialog';
import { confirmProcessImport } from '../../../utilities/confirm';
import { CsvErrorsComponent } from '../../../shared/components/csv-errors/csv-errors.component';
const TABLE = 'MEM_STAR_PERFORMANCE_REPORT_DATA_TEMP';

const REQUIRED_STAR_COLUMNS = ['Measure Name', 'Statistics'];
// Same pattern the importer has always used to spot measure-date columns.
const DATE_COLUMN_RE = /\d{1,2}\/\d{1,2}\/\d{4}/;

@Component({
  selector: 'app-star-performance-file',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CsvErrorsComponent, MatCardModule, MatFormField, MatFormFieldModule, ReactiveFormsModule, MatInputModule, MatProgressSpinnerModule,
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule, MatIcon],
  providers: [provideNativeDateAdapter()],
  templateUrl: './star-performance-file.html',
  styleUrl: './star-performance-file.css',
})
export class StarPerformanceFile implements OnInit , AfterViewInit {


  /* ---------- FORM & FILE ---------------------------- */
  processMembersFormGroup!: FormGroup;
  selectedFile: File | null = null;

  /* ----------- TABLE --------------------------------- */
  dataSource = new MatTableDataSource<any>([]);
 
  displayedColumns: string[] = [
  'Measure_Name',
  'Measure_Code',
  'Statistics'
];

  @ViewChild('mainPaginator') paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  /* ---------------------------- STATE ---------------------------- */
  sessionId = '';
  tempMemberList: any[] = [];
  totalRecords = 0;
  exist_count = 0;
  error_count = 0;
  isUpload = false;
  isProcessing = false;
  isLoading = false;
  csvErrors: CsvRowError[] = [];
  processLogList: any[] = [];

  constructor(
    private readonly dialog: MatDialog,
    private readonly apiService: ConfigService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly headerService: HeaderService,
    private readonly titleService: Title, private readonly router: Router, private readonly auth: UserDataService

  ) {
    this.processMembersFormGroup = this.fb.group({
      file: [null, Validators.required]
    });
  }

  /* ============================ LIFECYCLE ============================ */

  async ngOnInit() {
    this.titleService.setTitle('PRISM :: PROCESS STAR PERFORMANCE FILE');
    this.headerService.setTitle('PROCESS STAR PERFORMANCE FILE');
    const user = this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
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

  // Checked by extension: browsers report .csv with different MIME types
  // (Windows with Excel installed uses application/vnd.ms-excel).
  onFileSelect(event: any): void {
    const file: File | undefined = event.target.files?.[0];
    this.csvErrors = [];
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      this.selectedFile = file;
      this.processMembersFormGroup.patchValue({ file: file });
    } else {
      this.selectedFile = null;
      this.processMembersFormGroup.get('file')?.reset();
      if (this.fileInput) this.fileInput.nativeElement.value = '';
      if (file) this.csvErrors = [{ row: 0, message: 'Only .csv files are allowed.' }];
    }
    this.cdr.markForCheck();
  }

  private resetFile(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = ''; // ✅ allowed
    }
    this.processMembersFormGroup.get('file')?.reset();
    this.selectedFile = null;
  }

  /* ============================ UPLOAD ============================ */
  async qualityFileSubmit(): Promise<void> {

    if (!this.processMembersFormGroup.valid || !this.selectedFile) {
      this.processMembersFormGroup.markAllAsTouched();
      return;
    }

    if (this.isUpload) return;
    this.isUpload = true;
    this.processLogList = [];

    const file = this.selectedFile;
    this.csvErrors = [];

    const fileError = checkCsvFile(file);
    if (fileError) {
      this.csvErrors = [{ row: 0, message: fileError }];
      this.resetFile();
      this.isUpload = false;
      this.cdr.markForCheck();
      return;
    }

    try {
      const parsed = await parseCsv(file);

      // Columns are dynamic (one per measure date), so check the fixed ones
      // and that at least one date column exists.
      const dateColumns = parsed.fields.filter(f => DATE_COLUMN_RE.test(f));
      const missing = REQUIRED_STAR_COLUMNS.filter(c => !parsed.fields.includes(c));
      if (missing.length || !dateColumns.length) {
        alert(`File header mismatch. Expected columns ${REQUIRED_STAR_COLUMNS.join(', ')} and at least one date column (M/D/YYYY).`);
        return;
      }

      const errors: CsvRowError[] = [...parsed.errors];
      if (!parsed.rows.length) {
        errors.push({ row: 0, message: 'The file has no data rows.' });
      } else if (parsed.rows.length > MAX_CSV_ROWS) {
        errors.push({ row: 0, message: `The file has ${parsed.rows.length} rows; the maximum is ${MAX_CSV_ROWS}.` });
      }

      this.sessionId = Math.floor(Date.now() / 1000).toString();

      // Build array for inserting
      const insertDataArray: any[] = [];
      const seen = new Map<string, number>();
      let lastMeasureName = '';
      let lastMeasureCode = '';
      parsed.rows.forEach((row: any, i: number) => {
        const line = i + 2;

        let measureName = (row['Measure Name'] || '').trim();
        let measureCode = (row['Measure Name_1'] || row['Measure'] || '').trim();
        const statistics = (row['Statistics'] || '').trim();
        if (statistics !== 'Numerator' && statistics !== 'Denominator') {
          return; // ignore Pct or any other values
        }
        // ✅ Use previous value if blank
        if (!measureName) measureName = lastMeasureName;
        if (!measureCode) measureCode = lastMeasureCode;

        // store current as previous
        lastMeasureName = measureName;
        lastMeasureCode = measureCode;

        if (!measureName) {
          errors.push({ row: line, message: 'Measure Name is required.' });
        }

        dateColumns.forEach((key) => {
          // Counts may use thousands separators ("1,234").
          const value = String(row[key] ?? '').trim().replace(/,/g, '');
          if (value === '') return;

          if (!/^-?\d+(\.\d+)?$/.test(value)) {
            errors.push({ row: line, message: `${key} "${value}" is not a number.` });
            return;
          }

          const dupKey = `${measureName}|${measureCode}|${statistics}|${key}`;
          const firstLine = seen.get(dupKey);
          if (firstLine !== undefined) {
            errors.push({ row: line, message: `${measureName} ${statistics} for ${key} duplicates line ${firstLine}.` });
            return;
          }
          seen.set(dupKey, line);

          insertDataArray.push({
            Measure_Name: measureName,
            Measure_Code: measureCode,
            Statistics: statistics,
            Measure_Date: this.cleanDate(key),
            Measure_Value: value,
            INSERT_SESSION_ID: this.sessionId
          });
        });
      });

      if (errors.length) {
        this.csvErrors = errors;
        this.resetFile();
        return;
      }

      // ------------------ Batch processing ------------------
      await this.uploadInBatches(insertDataArray);

      // ------------------ Fetch temp members ------------------
      await this.loadTempStarPerformance();

      // Reset form + file
      this.processMembersFormGroup.reset();
      this.selectedFile = null;
      this.resetFile();

    } catch (error) {
      console.error("CSV upload failed:", error);
      alert("Unexpected error while processing star performance file.");
    } finally {
      this.isUpload = false;
      this.cdr.markForCheck();
    }
  }

  /* ============================ PROCESS FILE ============================ */

  async processQualityGaps(): Promise<void> {
    if (!this.sessionId) return;

    if (!(await confirmProcessImport(this.dialog, 'star performance', this.totalRecords, this.error_count))) {
      return;
    }

    this.isProcessing = true;
    try {
      const res = await this.apiService.processStarPerformanceSeccionID<any>({
        session_id: this.sessionId
      });
      this.processLogList = res?.data?.loglist ?? [];
      this.clearResults();
    } finally {
      this.isProcessing = false;
    }
  }

  private clearResults(): void {
    this.tempMemberList = [];
    this.dataSource.data = [];
    this.totalRecords = this.exist_count = this.error_count = 0;
  }



  /* ============================ API ============================ */

  private async uploadInBatches(insertDataArray: any[]): Promise<void> {
    const batches = this.chunkArray(insertDataArray, 1000);

    for (let i = 0; i < batches.length; i++) {
      try {
        await this.insertTemptable(batches[i]);
      } catch (err) {
        console.error(`❌ Batch ${i + 1} failed`, err);
        throw err;
      }
    }
  }

  private async insertTemptable(insertDataArray: any[]): Promise<void> {

    const payload = {
      table_name: TABLE,
      insertDataArray: insertDataArray   // ✅ no extra []
    };


    await this.apiService.insert<any, MemberFileRequest>(payload);
  }

  
private async loadTempStarPerformance(): Promise<void> {

  const res = await this.apiService.getTempStarPerformanceBySeccionID<any>({
    session_id: this.sessionId
  });

  const rawData = res?.data ?? [];

  
const pivot = this.buildExcelView(rawData);

this.dynamicDates = pivot.dates;

this.displayedColumns = [
  'Measure_Name',
  'Measure_Code',
  'Statistics',
  ...this.dynamicDates
];
  this.dataSource.data = pivot.rows;

  this.totalRecords = pivot.rows.length;

  if (this.paginator) {
    this.dataSource.paginator = this.paginator;
  }

  if (this.sort) {
    this.dataSource.sort = this.sort;
  }

  this.cdr.markForCheck();
}
 
  /* ============================ UTILS ============================ */

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  private cleanDate(value: any): string | null {
    if (!value || value.toString().trim() === '' || value.toString().toUpperCase() === 'NULL') {
      return null;
    }

    const val = value.toString().trim();
    // Already ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val;

    // Split on / or - and trim each part
    const parts = val.split(/[\/\-]/).map((p: string) => p.trim());
    if (parts.length === 3) {
      let [p1, p2, p3] = parts;

      // Handle 2-digit year
      if (p3.length === 2) p3 = '20' + p3;

      // Determine if DD/MM/YYYY or MM/DD/YYYY
      if (Number.parseInt(p1, 10) > 12) {
        // DD/MM/YYYY
        return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
      } else {
        // MM/DD/YYYY
        return `${p3}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
      }
    }
    return null;
  }

  filter(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.dataSource.filter = value.trim().toLowerCase();
  }
  dynamicDates: string[] = [];
  buildExcelView(data: any[]) {

    const result: any = {};
    const dates = new Set<string>();

    data.forEach(row => {

      const key = row.Measure_Name + '_' + row.Measure_Code + '_' + row.Statistics;

      if (!result[key]) {
        result[key] = {
          Measure_Name: row.Measure_Name,
          Measure_Code: row.Measure_Code,
          Statistics: row.Statistics
        };
      }

      const date = this.formatDate(row.Measure_Date);
      dates.add(date);

      result[key][date] = row.Measure_Value;

    });

    return {
      rows: Object.values(result),
      dates: Array.from(dates).sort((a, b) => a.localeCompare(b))
    };

  }
  formatDate(date: string) {

    const d = new Date(date);

    const m = (d.getMonth() + 1).toString().padStart(2,'0');
    const day = d.getDate().toString().padStart(2,'0');
    const y = d.getFullYear();

    return `${m}/${day}/${y}`;

  }
}
