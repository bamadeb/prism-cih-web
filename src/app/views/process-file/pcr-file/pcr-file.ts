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
import * as Papa from 'papaparse';



 const expectedHeaders = [
      'MEASURE_KEY','SUBMEASURE_KEY','MEMBER_NAME', 'AGE','BIRTH_DATE', 'PHONE_NUMBER', 'ADDRESSLINE1',
      'ADDRESSLINE2','CITY', 'STATECODE','ZIPCODE', 'PCP_ID','PCP_NPI','PCP_TIN', 'PCP_Name', 'PCP_GROUP',
      'CLSSDT', 'DENOM','DISCHARGE_CC_DESC_1', 'DISCHARGE_CC_DESC_2', 'DISCHARGE_CC_DESC_3', 'DISCH_ORDER',
      'INDEX_ADMIT_DT', 'INDEX_DISCH_DT','INDEX_STAY', 'MEMBERKEY','NUMER','READMISSION', 'READMT_ADMIT_DT','READMT_DISCH_DT'
    ]; 
 const TABLE = 'MEM_CIH_PCR_TEMP';

@Component({
  selector: 'app-pcr-file',
 standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatFormField, MatFormFieldModule, ReactiveFormsModule, MatInputModule, MatProgressSpinnerModule,
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule, MatIcon],
  providers: [provideNativeDateAdapter()], 
  templateUrl: './pcr-file.html',
  styleUrl: './pcr-file.css',
})
export class PcrFile {

  
        /* ---------- FORM & FILE ---------------------------- */
        processMembersFormGroup!: FormGroup;
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
  async pcrFileSubmit(): Promise<void> {
  
    if (!this.processMembersFormGroup.valid || !this.selectedFile) {
      this.processMembersFormGroup.markAllAsTouched();
      return;
    }
  
    if (this.isUpload) return;
    this.isUpload = true;
    this.processLogList = [];
  
    const file = this.selectedFile;
    const ext = file.name.split('.').pop()?.toLowerCase();
  
    if (ext !== 'csv') {
      alert('Only .csv files are allowed.');
      this.resetFile();    
      this.isUpload = false; 
      return;
    }
  
    try {
      this.sessionId = Math.floor(Date.now() / 1000).toString();
  
      // Parse CSV using PapaParse
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
  
        complete: async (result) => {
          const rows: any[] = result.data;  
          const parsedHeaders: string[] = result.meta.fields || [];
  
          const expectedHeaders = [
            'MEASURE_KEY','SUBMEASURE_KEY','MEMBER_NAME', 'AGE','BIRTH_DATE', 'PHONE_NUMBER', 'ADDRESSLINE1',
            'ADDRESSLINE2','CITY', 'STATECODE','ZIPCODE', 'PCP_ID','PCP_NPI','PCP_TIN', 'PCP_Name', 'PCP_GROUP',
            'CLSSDT', 'DENOM','DISCHARGE_CC_DESC_1', 'DISCHARGE_CC_DESC_2', 'DISCHARGE_CC_DESC_3', 'DISCH_ORDER',
            'INDEX_ADMIT_DT', 'INDEX_DISCH_DT','INDEX_STAY', 'MEMBERKEY','NUMER','READMISSION', 'READMT_ADMIT_DT','READMT_DISCH_DT'
          ];         
  
          // Validate header
          if (JSON.stringify(parsedHeaders) !== JSON.stringify(expectedHeaders)) {
            alert("File header mismatch.");
            this.isUpload = false;
            return;
          }
  
          // Build array for inserting
          const insertDataArray: any[] = [];
  
          rows.forEach((row: any) => {
            if (!row || Object.keys(row).length === 0) return; 
  
            row.INSERT_SESSION_ID = this.sessionId;
            insertDataArray.push(row);
          });
  
          //console.log("Insert Data:", insertDataArray);
          // ------------------ Batch processing ------------------
          await this.uploadInBatches(insertDataArray);  
  
          // ------------------ Fetch temp members ------------------
          await this.loadTempMembers();
  
          // Reset form + file
          this.processMembersFormGroup.reset();
          this.selectedFile = null;
          this.resetFile();
          this.isUpload = false;
        },
  
        error: (err) => {
          console.error("CSV Parse Error:", err);
          alert("Unable to read CSV file.");
          this.isUpload = false;
        }
      });
  
    } catch (error) {
      console.error("Unexpected Error:", error);
      alert("Unexpected error while processing quality gaps file.");
      this.isUpload = false;
    }
  }
         
    /* ============================ PROCESS FILE ============================ */
      
    async processPCRFile(): Promise<void> {
        if (!this.sessionId) return;
    
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
            console.log(`✅ Batch ${i + 1}/${batches.length} completed.`);
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
          console.log(payload);
          await this.apiService.insert<any, MemberFileRequest>(payload);
      }
      
      private async loadTempMembers(): Promise<void> {
        const res = await this.apiService.getTempCihPcrBySessionID<any>({
          session_id: this.sessionId
        });
    
        // console.log('sessionId:'+this.sessionId);
        // console.log(res);
      
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
