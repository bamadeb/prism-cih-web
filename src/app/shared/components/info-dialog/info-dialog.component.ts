import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

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
  selector: 'app-info-dialog',
  templateUrl: './info-dialog.component.html',
  styleUrls: ['./info-dialog.component.css']
})
export class InfoDialogComponent implements OnInit {
  viewModel?: ViewModel;

  constructor(
    @Inject(MAT_DIALOG_DATA) private data:any,
    private dialogRef: MatDialogRef<InfoDialogComponent>) { }

  ngOnInit(): void {
    this.viewModel = new ViewModel(this.data.errorMessage, this.data.title, this.data.errorDetails);
  }
}
