import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigService } from './api.service';
import { QualitygapRequest } from '../models/requests/dashboardRequest';
import { ActionDialog } from '../dialogs/action-dialog/action-dialog';

@Injectable({
  providedIn: 'root'
})
export class QualitygapDialogService {

  constructor(
    private apiService: ConfigService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer
  ) {}

  showQualitygapDialog(row: any): Promise<void> {
    const request: QualitygapRequest = {
      medicaid_id: row.medicaid_id
    };

    return this.apiService.gualitygapList<any>(request)
      .then(res => {
        const gualitygapList = res?.data || [];
        this.openDialog(row, gualitygapList);
      })
      .catch(err => {
        console.error('Quality gap error:', err);
      });
  }

  private openDialog(row: any, qualitygapList: any[]) {

  let html = '';

  if (qualitygapList && qualitygapList.length) {

    html = `
      <table class="table table-striped txupper" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th>SL. NO</th>
            <th>MEASURE NAME</th>
            <th>SUB MEASURE</th>
            <th>PROVIDER ID</th>
            <th>PROVIDER NAME</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          ${qualitygapList.map((q, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${this.escapeHtml(q.MEASURE_NAME)}</td>
              <td>${this.escapeHtml(q.SUB_MEASURE)}</td>
              <td>${this.escapeHtml(q.PROVIDER_ID)}</td>
              <td>${this.escapeHtml(q.PROVIDER_NAME)}</td>
              <td>${q.PROCESS_STATUS == 1 ? 'Complete' : 'Open'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

  } else {
    html = `<p style="text-align:center;color:#777">No quality gap list available</p>`;
  }

  const title = `QUALITY GAPS LIST - ${row.FIRST_NAME} ${row.LAST_NAME} (#${row.MEM_NO})`;

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


  private escapeHtml(text: string = ''): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
