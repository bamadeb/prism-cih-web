import {
  Component,
  OnInit
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select'; 
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; 
import { MatTableModule } from '@angular/material/table'; 
import { provideNativeDateAdapter } from '@angular/material/core';
import { ConfigService } from '../../../services/api.service';
import { HeaderService } from '../../../services/header.service';

@Component({
  selector: 'app-file-log-report',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule, 
    MatTableModule, 
    MatProgressSpinnerModule
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './file-log-report.html',
  styleUrl: './file-log-report.css'
})
export class FileLogReport implements OnInit {
  logDisplayedColumns: string[] = ['slno','message','count','date'];
  actionLogFormGroup!: FormGroup;
  isLoading = false; 
  processList: any[] = [];
  logDetails: any[] = []; 
  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ConfigService,
    private readonly headerService: HeaderService,
    private readonly titleService: Title
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('PRISM :: FILE PROCESS REPORT');
    this.headerService.setTitle('FILE PROCESS REPORT');

    this.actionLogFormGroup = this.fb.group({
      process_type: ['', Validators.required],
      process_list: ['', Validators.required]
    });
  }

  async onProcessTypeChange(): Promise<void> {
    const log_for = this.actionLogFormGroup.get('process_type')?.value;

    this.processList = [];
    this.logDetails = [];
    this.actionLogFormGroup.get('process_list')?.reset();

    if (!log_for) return;

    this.isLoading = true;
    try {
      const result = await this.apiService.getFIleprocesslist<any>({ log_for });
      this.processList = result?.data ?? [];
    } finally {
      this.isLoading = false;
    }
  }

  async onProcessSelect(): Promise<void> {
    const session_id = this.actionLogFormGroup.get('process_list')?.value;
    this.logDetails = [];

    if (!session_id) return;

    this.isLoading = true;
    try {
      const result = await this.apiService.getfileprocessLoglist<any>({ session_id });
      this.logDetails = result?.data ?? [];
    } finally {
      this.isLoading = false;
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

    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${hours}:${minutes}:${seconds} ${ampm}`;
  }
}
