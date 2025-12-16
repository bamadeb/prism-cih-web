import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigService } from './api.service';
import { TaskListRequest } from '../models/requests/dashboardRequest';
import { ActionDialog } from '../dialogs/action-dialog/action-dialog';

@Injectable({
  providedIn: 'root'
})
export class TaskListDialogService {

  constructor(
    private apiService: ConfigService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer
  ) {}

  showcallListDialog(row: any): Promise<void> {
    const request: TaskListRequest = {
      medicaid_id: row.medicaid_id
    };

    return this.apiService.tasklistList<any>(request)
      .then(res => {
        const tasklistList = res?.data || [];
        this.openDialog(row, tasklistList);
      })
      .catch(err => {
        console.error('Task list error:', err);
      });
  }

  private openDialog(row: any, tasklistList: any[]) {
  let html = '';
  if (tasklistList && tasklistList.length) {
    html = `<div style="text-align:right; margin-bottom:10px;">
                <a href="javascript:void(0)" 
                style="font-weight:600; color:#1976d2; cursor:pointer;"
                (click)=add_task();>
                + ADD TASK
                </a>
            </div>
      <table class="table table-striped txupper" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>             
            <th style="width:15%;">TASK TYPE</th>
            <th>TASK DATE</th>
            <th>STATUS</th>
            <th>ASSIGN TO</th>
            <th style="width:53%;">NOTE</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          ${tasklistList.map((q, i) => `
            <tr>              
              <td>${q.action_type}</td>
              <td [style.color]="q.bg_color || ''">${this.formatDate(q.task_date)}</td>
              <td>${q.status}</td>
              <td>${q.initial}</td> 
              <td>${q.action_note}</td> 
              <td>
                <a title='Edit' href="javascript:void(0);" (click)="update_task(q.id)"> <img src="assets/images/edit.png" width="20" /></a>
             </td> 
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  } else {
    html = `<p style="text-align:center;color:#777">No task list available</p>`;
  }

  const title = `MANAGE TASK - ${row.FIRST_NAME} ${row.LAST_NAME} (#${row.MEM_NO})`;
  this.dialog.open(ActionDialog, {
    width: '95vw',          // almost full screen
    maxWidth: '1400px',     // allow very wide dialogs
    height: '90vh', 
    panelClass: 'xxl-dialog',
    data: {
      title,
      htmlContent: this.sanitizer.bypassSecurityTrustHtml(html)
    }
  });
}

// private formatDate(date: any): string {
//   if (!date) return '';

//   const d = new Date(date);
//   if (isNaN(d.getTime())) return '';

//   return d.toLocaleDateString('en-US', {
//     month: 'numeric',
//     day: 'numeric',
//     year: 'numeric'
//   });
// }

private formatDate(date: any): string {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  // check for 01/01/1900
  if (
    d.getFullYear() === 1900 &&
    d.getMonth() === 0 &&
    d.getDate() === 1
  ) {
    return '';
  }

  return d.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  });
}


  private escapeHtml(text: string = ''): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
