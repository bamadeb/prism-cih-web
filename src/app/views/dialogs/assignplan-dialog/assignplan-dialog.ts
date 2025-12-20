import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-assignplan-dialog',
  imports: [MatDialogContent, MatDialogActions,MatButtonModule],
  templateUrl: './assignplan-dialog.html',
  styleUrl: './assignplan-dialog.css',
})
export class AssignplanDialog {
 

   constructor(
    private dialogRef: MatDialogRef<AssignplanDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    //this.title = data?.title;
    //this.htmlContent = data?.htmlContent;
  }

close() {
    this.dialogRef.close(true);
  }

}
