import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
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
 const expectedHeaders = [
      'SUBSCRIBER_ID', 'MBR_PERIOD', 'FIRST_NM', 'MIDDLE_NM', 'LAST_NM',
      'MEDICARE_ID', 'MEDICAID_ID', 'DT_OF_BIRTH', 'SEX', 'ADDRESS_1',
      'ADDRESS_2', 'CITY', 'COUNTY', 'STATE', 'ZIP_CODE', 'HOME_TELEPHONE',
      'CELL_PHONE', 'EMAIL', 'RISK_SCORE', 'CONTRACT_NO', 'PBP', 'PCP_TAX_ID',
      'PCP_NPI', 'ENROLL_DT', 'PCP_EFF_DT_S', 'NETWORK_ID', 'NETWORK_NAME',
      'PCP_EFF_DT_E', 'PLAN_ID', 'PLAN_NAME', 'PLAN_DT_S', 'PLAN_DT_E',
      'DISENROLL_DT', 'DISENROLL_RSN_CD', 'DISENROLL_DESC',
      'AGT_REC_NM', 'AGT_REC_PH', 'AGT_REC_EM'
    ]; 
 const TABLE = 'MEM_MEMBERS_TEMP';
@Component({
  selector: 'app-member-file', 
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatFormField, MatFormFieldModule, ReactiveFormsModule, MatInputModule, MatProgressSpinnerModule,
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule, MatIcon],
  providers: [provideNativeDateAdapter()],   // <-- REQUIRED FIX
  templateUrl: './member-file.html',
  styleUrl: './member-file.css',
})
export class MemberFile {

  /* ---------- FORM & FILE ---------------------------- */
  processMembersFormGroup!: FormGroup;
  selectedFile: File | null = null;

  /* ----------- TABLE --------------------------------- */
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [
    'SUBSCRIBER_ID',
    'FIRST_NM',
    'MIDDLE_NM',
    'LAST_NM',
    'MEDICARE_ID',
    'MEDICAID_ID',
    'DT_OF_BIRTH',
    'SEX',
    'HOME_TELEPHONE',
    'PCP_TAX_ID',
    'STATUS'
  ];  

  @ViewChild(MatPaginator) paginator!: MatPaginator;
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
  processLogList: any[] = []; 
 
  constructor(
    private apiService: ConfigService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private headerService: HeaderService ,
    private titleService: Title,private router: Router,private auth: UserDataService
    
  ) {
    this.processMembersFormGroup = this.fb.group({
      file: [null, Validators.required]
    });
  }

  /* ============================ LIFECYCLE ============================ */

  async ngOnInit() { 
    this.titleService.setTitle('PRISM :: PROCESS MEMBER FILE');
    this.headerService.setTitle('PROCESS MEMBER FILE');
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

onFileSelect(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      this.selectedFile = file;
      this.processMembersFormGroup.patchValue({ file: file });
    } else { 
      this.selectedFile = null; 
      this.processMembersFormGroup.get('file')?.reset(); 
    }
  }

 private resetFile(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = ''; // ✅ allowed
    }
    this.processMembersFormGroup.get('file')?.reset();
    this.selectedFile = null;
  }

  /* ============================ UPLOAD ============================ */
 
async membersFileSubmit(): Promise<void> {
  // ------------------ Initial validation ------------------
  if (!this.processMembersFormGroup.valid || !this.selectedFile) {
    this.processMembersFormGroup.markAllAsTouched();
    return;
  }

  if (this.isUpload) return;
  this.isUpload = true;

  const file = this.selectedFile;
  this.processLogList = [];

  // ------------------ File extension check ------------------
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'csv') {
    alert('Only .csv files are allowed.');
    this.resetFile();
    this.isUpload = false;
    return;
  }

  try {
    // ------------------ Read file ------------------
    const rows = await this.readCsvFile(file); 
    this.sessionId = Math.floor(Date.now() / 1000).toString();

    // ------------------ Header parsing ------------------
    const headers = this.parseAndValidateHeaders(rows[0], expectedHeaders);

    // ------------------ Data parsing ------------------
    const insertDataArray = this.parseCsvDataRows(rows, headers, this.sessionId);

    // ------------------ Batch processing ------------------
    await this.uploadInBatches(insertDataArray); 

    // ------------------ Fetch temp members ------------------
    await this.loadTempMembers();

    // ------------------ Reset form ------------------
    this.processMembersFormGroup.reset();
    this.selectedFile = null;
    this.resetFile();

  } catch (error) {
    console.error('Error reading or uploading CSV:', error);
    alert('Error processing member file. Please check your CSV format.');
  } finally {
    this.isUpload = false;
    console.log('finally');
  }
} 

/* ============================ PROCESS FILE ============================ */

async processMembers(): Promise<void> {
    if (!this.sessionId) return;

    this.isProcessing = true;
    try {
      const res = await this.apiService.processmembersSeccionID<any>({
        session_id: this.sessionId
      });
      this.processLogList = res?.data?.loglist ?? [];
      this.clearResults();
    } finally {
      this.isProcessing = false;
    }
  }
  

  /* ============================ API ============================ */

  private async uploadInBatches(insertDataArray: any[]): Promise<void> {
   const batches = this.chunkArray(insertDataArray, 1000);

    for (let i = 0; i < batches.length; i++) {
      try {
        await this.insertTemptable(batches[i]);
        console.log(`✅ Batch ${i + 1}/${batches.length} completed.`);
      } catch (err) {
        console.error(`❌ Batch ${i + 1} failed`, err);
        throw err;
      }
    }
  }

  private async insertTemptable(insertDataArray: any[]): Promise<void> {

    const payload: MemberFileRequest = {
      table_name: TABLE,
      insertDataArray: insertDataArray   // ✅ no extra []
    };

    //console.log(payload);
    await this.apiService.insert<any, MemberFileRequest>(payload);
}

private async loadTempMembers(): Promise<void> {
  const res = await this.apiService.getTempMembersBySeccionID<any>({
    session_id: this.sessionId
  });

  this.tempMemberList = res?.data ?? [];
  this.dataSource.data = this.tempMemberList;

  this.totalRecords = this.tempMemberList.length;
  this.exist_count = this.tempMemberList.filter(m => m.exist_member).length;
  this.error_count = this.tempMemberList.filter(m => !m.SUBSCRIBER_ID).length;
}
 
  /* ============================ CSV HELPERS ============================ */

  private parseCsvDataRows(
  rows: string[],
  headers: string[],
  sessionId: string
): any[] {
  const insertDataArray: any[] = [];

  const dateFields = ['DT_OF_BIRTH', 'ENROLL_DT', 'PCP_EFF_DT_S'];
  const removeDateFields = [
    'PCP_EFF_DT_E',
    'PLAN_DT_S',
    'PLAN_DT_E',
    'DISENROLL_DT'
  ];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(',').map(c => c.trim());
    if (cols.length !== headers.length) continue;

    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] || null;
    });

    // Format required date fields
    dateFields.forEach(field => {
      if (row[field]) {
        row[field] = this.cleanDate(row[field]);
      }
    });

    // Remove unwanted date fields
    removeDateFields.forEach(field => delete row[field]);

    row.INSERT_SESSION_ID = sessionId;
    insertDataArray.push(row);
  }

  return insertDataArray;
}


  private parseAndValidateHeaders(
    headerRow: string,
    expectedHeaders: string[]
  ): string[] {
    const headers = headerRow
      .split(',')
      .map(h => h.trim().replace(/\r/g, ''));

    if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
      throw new Error('HEADER_MISMATCH');
    }

    return headers;
}


  private async readCsvFile(file: File): Promise<string[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'csv') {
    throw new Error('INVALID_FILE_TYPE');
  }

  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .filter(line => line.trim());

  if (rows.length < 2) {
    throw new Error('EMPTY_OR_INVALID_FILE');
  }

  return rows;
}   

   /* ============================ UTILS ============================ */

  private clearResults(): void {
    this.tempMemberList = [];
    this.dataSource.data = [];
    this.totalRecords = this.exist_count = this.error_count = 0;
  }

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
      if (parseInt(p1, 10) > 12) {
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
    
}
