import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfigService } from './api.service';
import { TaskDialog } from '../views/dialogs/taskdialog/task-dialog/task-dialog';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TaskListDialogService {

  constructor(
    private dialog: MatDialog,
    private apiService: ConfigService
  ) {}

  async showtaskListDialog(row: any): Promise<MatDialogRef<TaskDialog>> {

    const request = { medicaid_id: row.medicaid_id };

    const res = await this.apiService.taskList<any>(request);

    return this.dialog.open(TaskDialog, {
      width: '80vw',
      maxWidth: '1400px',
      panelClass: 'xxl-dialog',
      data: {
        title: `MANAGE TASK - ${row.FIRST_NAME} ${row.LAST_NAME} (#${row.MEM_NO})`,
        member: row,
        taskList: res?.data || []
      }
    });
  }
}
