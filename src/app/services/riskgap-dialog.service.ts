import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigService } from './api.service';
import { RiskgapRequest } from '../models/requests/dashboardRequest';
import { ActionDialog } from '../dialogs/action-dialog/action-dialog';

@Injectable({
  providedIn: 'root'
})
export class RiskgapDialogService {

  constructor(
    private apiService: ConfigService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer
  ) {}

  showRiskgapDialog(row: any): Promise<void> {
    const request: RiskgapRequest = {
      medicaid_id: row.medicaid_id
    };

    return this.apiService.riskgapList<any>(request)
      .then(res => {
        const riskgapList = res?.data || [];
        this.openDialog(row, riskgapList);
      })
      .catch(err => {
        console.error('Risk gap error:', err);
      });
  }

  private openDialog(row: any, riskgapList: any[]) {

  let html = '';

  if (riskgapList && riskgapList.length) {

    html = `
      <table class="table table-striped txupper" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th>SL. NO</th>
            <th>RELEVANT DATE</th>
            <th>HCC CATEGORY</th>
            <th>HCC MODEL</th>
            <th>DIAG CODE</th>
            <th>DIAG DESC</th>
            <th>STATUS</th> 
          </tr>
        </thead>
        <tbody>
          ${riskgapList.map((q, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${this.formatDate(q.RELEVANT_DATE)}</td>
              <td>${this.escapeHtml(q.HCC_CATEGORY)}</td>
              <td>${this.escapeHtml(q.HCC_MODEL)}</td>
              <td>${this.escapeHtml(q.DIAG_CODE)}</td>
              <td>${this.escapeHtml(q.DIAG_DESC)}</td>
              <td>${q.PROCESS_STATUS == 1 ? 'COMPLETE' : 'OPEN'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  } else {
    html = `<p style="text-align:center;color:#777">No risk gap list available</p>`;
  }

  const title = `RISK GAPS LIST - ${row.FIRST_NAME} ${row.LAST_NAME} (#${row.MEM_NO})`;

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
