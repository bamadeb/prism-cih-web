import { Component, Inject, OnInit } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef, MatLegacyDialogConfig as MatDialogConfig, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';

class ViewModel {
  title?: string;
  message: string;
  errorDetails?: string;
  constructor(message: string, title: string, errorDetails?: string) {
    this.message = message;
    this.title = title;
    this.errorDetails = errorDetails;
  }
}

@Component({
  selector: 'app-error-dialog',
  templateUrl: './error-dialog.component.html',
  styleUrls: ['./error-dialog.component.css']
})
export class ErrorDialogComponent implements OnInit {
  viewModel?: ViewModel;

  constructor(
    @Inject(MAT_DIALOG_DATA) private data,
    private dialogRef: MatDialogRef<ErrorDialogComponent>) { }

  ngOnInit(): void {
    this.viewModel = new ViewModel(this.data.errorMessage, this.data.title, this.data.errorDetails);
  }
}
