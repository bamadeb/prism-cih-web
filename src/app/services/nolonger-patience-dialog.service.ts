import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigService } from './api.service';
import { CallListRequest } from '../models/requests/dashboardRequest';
import { ActionDialog } from '../dialogs/action-dialog/action-dialog';

@Injectable({
  providedIn: 'root'
})
export class CallListDialogService {

  constructor(
    private apiService: ConfigService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer
  ) {}

  showcallListDialog(row: any): Promise<void> {
    const request: CallListRequest = {
      medicaid_id: row.medicaid_id
    };

    return this.apiService.callList<any>(request)
      .then(res => {
        const callList = res?.data || [];
        this.openDialog(row, callList);
      })
      .catch(err => {
        console.error('Risk gap error:', err);
      });
  }

  private openDialog(row: any, callList: any[]) {

  let html = '';

  if (callList && callList.length) {

    html = `
      <table class="table table-striped txupper" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th>Sl.No</th>
            <th>DATE</th>
            <th>ACTION</th>
            <th>OUTCOME</th>
            <th>NOTE</th> 
          </tr>
        </thead>
        <tbody>
          ${callList.map((q, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${this.formatDate(q.action_date)}</td>
              <td>${this.escapeHtml(q.action_type)}</td>
              <td>${this.escapeHtml(q.action_result)}</td>
              <td>${this.escapeHtml(q.action_note)}</td> 
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  } else {
    html = `<p style="text-align:center;color:#777">No call list available</p>`;
  }

  const title = `CALL LIST - ${row.FIRST_NAME} ${row.LAST_NAME} (#${row.MEM_NO})`;

  this.dialog.open(ActionDialog, {
    width: '80vw',
    maxWidth: '900px',
    panelClass: 'xl-dialog',
    data: {
      title,
      htmlContent: this.sanitizer.bypassSecurityTrustHtml(html)
    }
  });
}

private formatDate(date: any): string {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

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
