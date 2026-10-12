import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserDataService } from '../../../services/user-data-service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { ConfigService } from '../../../services/api.service';
import { AppEnvService } from '../../../services/app-env.service';
import {
  attchFileremoveRequest,
  fileAttachRequest,
  FileRequest,
  S3UploadResponse,
  UpdateFileRequest,
  UpdateFileStatusRequest
} from '../../../models/requests/planRequest';
interface Attachment {
  id: number;
  attachment: string;
  status: number;
}

// Documents and images only -- no executables, scripts, HTML or archives.
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'png', 'jpg', 'jpeg'];
const MAX_FILE_SIZE_MB = 10;

@Component({
  selector: 'app-fileattach-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinner
  ],
  templateUrl: './fileattach-dialog.html',
  styleUrls: ['./fileattach-dialog.css']
})
 
export class FileattachDialog implements OnInit {

  uploadForm!: FormGroup;
  selectedFile: File | null = null;
  isLoading = false;
  currentId: number | null = null; 
  isAddMode = true; 
  isStatusOnlyUpdate = false;
  /** The attachment row being edited (null = adding a new file). */
  editingRow: Attachment | null = null;
  fileError = '';
  readonly acceptTypes = ALLOWED_EXTENSIONS.map(e => '.' + e).join(',');
  readonly allowedTypesLabel = ALLOWED_EXTENSIONS.join(', ').toUpperCase();
  readonly maxFileSizeMb = MAX_FILE_SIZE_MB;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {
      attachments: Attachment[];
      entity: any;
      type: string;
    },
    private readonly fb: FormBuilder,
    private readonly apiService: ConfigService,
    private readonly envService: AppEnvService,
    private readonly userData: UserDataService,
    private readonly dialogRef: MatDialogRef<FileattachDialog>,
    private readonly dialog: MatDialog
  ) {
    
  }

  ngOnInit(): void {
    
    this.uploadForm = this.fb.group({
      file: [null, Validators.required],
      status: [0, Validators.required]
    });
    
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Clear so choosing the same file again still fires (change) after a rejection.
    input.value = '';
    if (!file) return;

    this.fileError = this.validateFile(file);
    if (this.fileError) return;

    this.setFileRequired(true); 
    this.selectedFile = file;
    this.isStatusOnlyUpdate = false; // 🔁 now file + status
    this.uploadForm.patchValue({ file });

  }


  // The `accept` attribute is only a picker hint, so the extension and size
  // are checked here too.
  private validateFile(file: File): string {
    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `File type not allowed. Allowed: ${this.allowedTypesLabel}.`;
    }
    if (file.size === 0) {
      return 'The selected file is empty.';
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File is larger than ${MAX_FILE_SIZE_MB} MB.`;
    }
    return '';
  }

 upload(): void {
   if (this.isLoading) return;
  const { status } = this.uploadForm.getRawValue();

  // 🔹 STATUS ONLY UPDATE
  if (this.isStatusOnlyUpdate) {
    this.updateStatusOnly(status);
    return;
  }

  // 🔹 FILE REQUIRED (add / replace)
  if (!this.selectedFile || this.uploadForm.invalid) return;

  this.fileupload(status);
}

private async updateStatusOnly(status: number): Promise<void> {
  if (this.currentId == null) return;

  this.isLoading = true;

  try {
    const payload: UpdateFileStatusRequest = {
      table_name: 'MEM_ATTACHMENT',
      id_field_name: 'id',
      id_field_value: this.currentId,
      updateData: { status }
    };

    await this.apiService.update<any, UpdateFileStatusRequest>(payload);

    // 🔄 Update UI immediately
    const item = this.data.attachments.find(a => a.id === this.currentId);
    if (item) item.status = status;

   

  } catch (err) {
    console.error('❌ Status update failed', err);
  } finally {
    this.isLoading = false;
    this.resetForm();
  }
}

  // ===============================
  // S3 UPLOAD
  // ===============================
  private async fileupload(fileStatus: number): Promise<void> {
    if (!this.selectedFile) return;

    this.isLoading = true;
    const file = this.selectedFile;
    const uploadType = this.data.type;  

    const request: fileAttachRequest = {
      fileName: file.name,
      fileType: file.type,
      directory: uploadType,
      id: this.data.entity.id,
      env: this.envService.envType(),
      bucket: this.envService.s3bucket()
    };

    try {
      const res = await this.apiService.s3fileupload<S3UploadResponse>(request);
      const parsed = res.body ? JSON.parse(res.body) : res;

      await this.uploadToS3(parsed.uploadUrl, file);

      if (this.isAddMode) {
        await this.insertFiletoDB(fileStatus, parsed.fileUrl);
      } else {
        await this.updateFileUrlToDB(fileStatus, parsed.fileUrl);
      }

      // 🔁 refresh list from DB
        await this.loadAttachments();

     

    } catch (error) {
      console.error('❌ File upload failed:', error);
    } finally {
      this.isLoading = false;
      this.selectedFile = null;
      this.uploadForm.reset({ status: 0 });
    }
  }

  private async loadAttachments(): Promise<void> {
  try {
    const res = await this.apiService.attachments<any>({
      type: this.data.type,
      type_id: this.data.entity.id
    });

    this.data.attachments = res.data;
  } catch (err) {
    console.error('❌ Failed to load attachments', err);
  }
}

  private async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    });

    if (!response.ok) {
      throw new Error('S3 upload failed');
    }
  }

  // ===============================
  // DB INSERT
  // ===============================
  private async insertFiletoDB(fileStatus: number, fileUrl: string): Promise<void> { 
    const user = this.userData.getUser();
    const payload: FileRequest = {
      table_name: 'MEM_ATTACHMENT',
      insertDataArray: [{
        type: this.data.type,
        type_id: this.data.entity.id,
        attachment: fileUrl,
        title: 'Add Attachment',
        added_by: user.ID,
        status: fileStatus
      }]
    };

    await this.apiService.insert<any, FileRequest>(payload);
  }

  // ===============================
  // DB UPDATE
  // ===============================
private async updateFileUrlToDB(
  fileStatus: number,
  fileUrl: string
): Promise<void> {

  if (this.currentId == null) {
    throw new Error('currentId is not set. Cannot update attachment.');
  }

  // Points the row at the new file and deletes the previous file from S3
  await this.apiService.deleteAttachment<any>({
    id: this.currentId,
    replace_url: fileUrl
  });

  const payload: UpdateFileRequest = {
    table_name: 'MEM_ATTACHMENT',
    id_field_name: 'id',
    id_field_value: this.currentId, // ✅ now guaranteed number
    updateData: {
      title: 'Update Attachment',
      status: fileStatus
    }
  };

  await this.apiService.update<any, UpdateFileRequest>(payload);
}


  // ===============================
  // UI ACTIONS
  // ===============================
  edit(row: any): void {

    this.isAddMode = false;
    this.currentId = row.id;
    this.editingRow = row;
    this.isStatusOnlyUpdate = true; 
    this.setFileRequired(false);

    this.uploadForm.patchValue({
      status: row.status, 
    });

    this.selectedFile = null;
  }

  private setFileRequired(required: boolean): void {
    const fileCtrl = this.uploadForm.get('file');
    if (!fileCtrl) return;

    if (required) {
      fileCtrl.setValidators(Validators.required);
    } else {
      fileCtrl.clearValidators(); // ❗ remove required in edit mode
    }

    fileCtrl.updateValueAndValidity();
  }

  async remove(row: Attachment): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete attachment',
          message: `Delete "${this.fileDisplayName(row.attachment)}"? The file will be permanently removed.`,
          confirmButtonName: 'Delete'
        }
      }).afterClosed()
    );
    if (!confirmed) return;

    this.isLoading = true;

    try {
      await this.apiService.deleteAttachment({ id: row.id });
      this.data.attachments =
        this.data.attachments.filter(a => a.id !== row.id);
      if (this.currentId === row.id) {
        this.resetForm();
      }
    } catch (err) {
      console.error('❌ Delete failed', err);
    } finally {
      this.isLoading = false;
    }
  }

  deleteAttachment(request: attchFileremoveRequest): Promise<any> {
       return this.apiService.deleteAttachment<attchFileremoveRequest>(request);
  }

  private resetForm(): void {
    this.uploadForm.reset({ status: 0 });
    this.selectedFile = null;
    this.currentId = null;
    this.editingRow = null;
    this.isAddMode = true;
    this.isStatusOnlyUpdate = false;
    this.fileError = '';
    this.setFileRequired(true);
  }

  /** Leave edit mode and go back to adding a new file (dialog stays open). */
  cancelEdit(): void {
    this.resetForm();
  }

  /**
   * Readable name from a stored S3 URL: last path segment, URL-decoded, without
   * the "<timestamp>-" prefix prismUploadplandocument adds to every key.
   */
  fileDisplayName(url: string | null | undefined): string {
    if (!url) return '';
    let name = String(url).split('?')[0].split('/').pop() || '';
    try { name = decodeURIComponent(name); } catch { /* keep raw */ }
    return name.replace(/^\d{10,}-/, '');
  }

  close(): void {
    this.isLoading = false;
    this.dialogRef.close();
  }
}
