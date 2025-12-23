import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigService } from './api.service';
import { QualitygapRequest } from '../models/requests/dashboardRequest';
import { ActionDialog } from '../views/dialogs/action-dialog/action-dialog';

@Injectable({ providedIn: 'root' })
export class QualitygapDialogService {

  constructor(
    private apiService: ConfigService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer
  ) {}

  // ============================
  // SHOW QUALITY GAP DIALOG
  // ============================
  async showQualitygapDialog(row: any): Promise<void> {
    try {
      const request: QualitygapRequest = {
        medicaid_id: row.medicaid_id
      };

      const res = await this.apiService.gualitygapList<any>(request);
      const qualitygapList = res?.data ?? [];

      this.openDialog(row, qualitygapList);

    } catch (error) {
      console.error('Quality gap fetch failed', error);
      alert('Unable to load quality gap list. Please try again.');
    }
  }

  // ============================
  // OPEN DIALOG
  // ============================
  private openDialog(row: any, qualitygapList: any[]): void {
    const html = this.buildHtml(qualitygapList);

    const title = `QUALITY GAPS LIST - ${row.FIRST_NAME} ${row.LAST_NAME} (#${row.MEM_NO})`;

    this.dialog.open(ActionDialog, {
      width: '80vw',
      maxWidth: '1000px',
      panelClass: 'xl-dialog',
      data: {
        title,
        htmlContent: this.sanitizer.bypassSecurityTrustHtml(html)
      }
    });
  }

  // ============================
  // HTML BUILDER
  // ============================
  private buildHtml(qualitygapList: any[]): string {
    if (!qualitygapList.length) {
      return `<p style="text-align:center;color:#777">No quality gap list available</p>`;
    }

    return `
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
              <td>${q.PROCESS_STATUS === 1 ? 'Complete' : 'Open'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ============================
  // HTML ESCAPER (XSS SAFE)
  // ============================
  private escapeHtml(text: string = ''): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
