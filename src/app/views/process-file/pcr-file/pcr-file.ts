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
import { CsvRowError, CsvRowRules, checkCsvFile, parseCsv, validateCsvRows } from '../../../utilities/csv-import';
import { MatDialog } from '@angular/material/dialog';
import { confirmProcessImport } from '../../../utilities/confirm';
import { CsvErrorsComponent } from '../../../shared/components/csv-errors/csv-errors.component';



 const expectedHeaders = [
      'MEASURE_KEY','SUBMEASURE_KEY','MEMBER_NAME', 'AGE','BIRTH_DATE', 'PHONE_NUMBER', 'ADDRESSLINE1',
      'ADDRESSLINE2','CITY', 'STATECODE','ZIPCODE', 'PCP_ID','PCP_NPI','PCP_TIN', 'PCP_Name', 'PCP_GROUP',
      'CLSSDT', 'DENOM','DISCHARGE_CC_DESC_1', 'DISCHARGE_CC_DESC_2', 'DISCHARGE_CC_DESC_3', 'DISCH_ORDER',
      'INDEX_ADMIT_DT', 'INDEX_DISCH_DT','INDEX_STAY', 'MEMBERKEY','NUMER','READMISSION', 'READMT_ADMIT_DT','READMT_DISCH_DT'
    ]; 
 const TABLE = 'MEM_CIH_PCR_TEMP';

// Row checks before upload: the record's key columns.
const ROW_RULES: CsvRowRules = {
  required: ['MEMBERKEY', 'MEASURE_KEY']
};

@Component({
  selector: 'app-pcr-file',
 standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CsvErrorsComponent, MatCardModule, MatFormField, MatFormFieldModule, ReactiveFormsModule, MatInputModule, MatProgressSpinnerModule,
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule, MatIcon],
  providers: [provideNativeDateAdapter()], 
  templateUrl: './pcr-file.html',
  styleUrl: './pcr-file.css',
})
export class PcrFile implements OnInit, AfterViewInit {

  
        /* ---------- FORM & FILE ---------------------------- */
        processPcrFormGroup!: FormGroup;
        selectedFile: File | null = null;
      
        /* ----------- TABLE --------------------------------- */
        dataSource = new MatTableDataSource<any>([]);
        displayedColumns: string[] = [
            'MEMBERKEY','MEASURE_KEY','SUBMEASURE_KEY','MEMBER_NAME','PCP_TIN', 'PCP_Name', 'DENOM', 'DISCH_ORDER',
      'INDEX_ADMIT_DT', 'INDEX_DISCH_DT','INDEX_STAY','NUMER','READMISSION', 'READMT_ADMIT_DT','READMT_DISCH_DT','1'];  
      
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
          private readonly headerService: HeaderService ,
          private readonly titleService: Title,private readonly router: Router,private readonly auth: UserDataService
          
        ) {
          this.processPcrFormGroup = this.fb.group({
            file: [null, Validators.required]
          });
        }
      
        /* ============================ LIFECYCLE ============================ */
      
        async ngOnInit() { 
          this.titleService.setTitle('PRISM :: PROCESS PCR FILE');
          this.headerService.setTitle('PROCESS PCR FILE');
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
      this.processPcrFormGroup.patchValue({ file: file });
    } else {
      this.selectedFile = null;
      this.processPcrFormGroup.get('file')?.reset();
      if (this.fileInput) this.fileInput.nativeElement.value = '';
      if (file) this.csvErrors = [{ row: 0, message: 'Only .csv files are allowed.' }];
    }
    this.cdr.markForCheck();
  }
      
       private resetFile(): void {
          if (this.fileInput) {
            this.fileInput.nativeElement.value = ''; // ✅ allowed
          }
          this.processPcrFormGroup.get('file')?.reset();
          this.selectedFile = null;
        }
      
  /* ============================ UPLOAD ============================ */
  async pcrFileSubmit(): Promise<void> {
  
    if (!this.processPcrFormGroup.valid || !this.selectedFile) {
      this.processPcrFormGroup.markAllAsTouched();
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

      if (JSON.stringify(parsed.fields) !== JSON.stringify(expectedHeaders)) {
        alert("File header mismatch.");
        return;
      }

      const errors = [...parsed.errors, ...validateCsvRows(parsed.rows, ROW_RULES)];
      if (errors.length) {
        this.csvErrors = errors;
        this.resetFile();
        return;
      }

      this.sessionId = Math.floor(Date.now() / 1000).toString();

      const insertDataArray = parsed.rows.map((row: any) => {
        row.INSERT_SESSION_ID = this.sessionId;
        return row;
      });

      // ------------------ Batch processing ------------------
      await this.uploadInBatches(insertDataArray);

      // ------------------ Fetch temp records ------------------
      await this.loadTempPcr();

      // Reset form + file
      this.processPcrFormGroup.reset();
      this.selectedFile = null;
      this.resetFile();

    } catch (error) {
      console.error("CSV upload failed:", error);
      alert("Unexpected error while processing PCR file.");
    } finally {
      this.isUpload = false;
      this.cdr.markForCheck();
    }
  }
         
    /* ============================ PROCESS FILE ============================ */
      
    async processPCRFile(): Promise<void> {
        if (!this.sessionId) return;

        if (!(await confirmProcessImport(this.dialog, 'PCR', this.totalRecords, this.error_count))) {
          return;
        }
    
        this.isProcessing = true;
        try {
          const res = await this.apiService.processPCRdataSessionID<any>({
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
      
      private async loadTempPcr(): Promise<void> {
        const res = await this.apiService.getTempCihPcrBySessionID<any>({
          session_id: this.sessionId
        });
    

      
        this.tempMemberList = res?.data ?? [];
        this.dataSource.data = this.tempMemberList;
      
        this.totalRecords = this.tempMemberList.length;
        this.exist_count = this.tempMemberList.filter(m => m.pcr_exist).length;
        this.error_count = this.tempMemberList.filter(m => !m.member_exist).length;

        // 🔥 FIX pagination
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
        }
        if (this.sort) {
          this.dataSource.sort = this.sort;
        }
        
        this.cdr.markForCheck();   // 👈 CRITICAL
      } 
       
  /* ============================ UTILS ============================ */      
        
    private chunkArray<T>(arr: T[], size: number): T[][] {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    } 
    filter(event: Event): void {
      const value = (event.target as HTMLInputElement).value ?? '';
      this.dataSource.filter = value.trim().toLowerCase();
    }  

}
