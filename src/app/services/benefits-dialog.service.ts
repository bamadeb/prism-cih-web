import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigService } from './api.service';
import { BenefitsRequest } from '../models/requests/dashboardRequest';
import { ActionDialog } from '../views/dialogs/action-dialog/action-dialog';

@Injectable({
  providedIn: 'root'
})
export class BenefitsDialogService {

  constructor(
    private apiService: ConfigService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer
  ) {}

  showBenefitsDialog(row: any): Promise<void> {
    const request: BenefitsRequest = {
      medicaid_id: row.medicaid_id
    };

    return this.apiService.benefitsList<any>(request)
      .then(res => {
        const benefitsList = res?.data || [];
        this.openDialog(row, benefitsList);
      })
      .catch(err => {
        console.error('Benefits error:', err);
      });
  }

  private openDialog(row: any, benefitsList: any[]) {
    const html = benefitsList.length
      ? benefitsList.map(b => `
          <div style="margin-bottom:12px" class="txupper">
            <div style="font-weight:600">
              ${this.escapeHtml(b.plan_name)}
              (${b.start_date} - ${b.end_date})
            </div>
            <ul>
              <li>
                <a href="${b.file_name}" target="_blank">View Link</a>
              </li>
            </ul>
          </div>
        `).join('')
      : `<p style="text-align:center;color:#777">No benefits available</p>`;

    const title = `BENEFITS - ${row.FIRST_NAME} ${row.LAST_NAME} (#${row.MEM_NO})`;

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
