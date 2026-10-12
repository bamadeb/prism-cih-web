import { Injectable } from '@angular/core';
import { escapeHtml } from '../utilities/html';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { ConfigService } from './api.service';
import { BenefitsRequest } from '../models/requests/dashboardRequest';
import { ActionDialog } from '../views/dialogs/action-dialog/action-dialog';

@Injectable({ providedIn: 'root' })
export class BenefitsDialogService {

  constructor(
    private readonly apiService: ConfigService,
    private readonly dialog: MatDialog,
    private readonly sanitizer: DomSanitizer
  ) {}

  // ============================
  // SHOW BENEFITS DIALOG
  // ============================
  async showBenefitsDialog(row: any): Promise<void> {
    try {
      const request: BenefitsRequest = {
        medicaid_id: row.medicaid_id
      };

      const res = await this.apiService.benefitsList<any>(request);
      const benefitsList = res?.data ?? [];

      this.openDialog(row, benefitsList);

    } catch (error) {
      console.error('Benefits fetch failed', error);
      alert('Unable to load benefits. Please try again.');
    }
  }

  // ============================
  // OPEN DIALOG
  // ============================
  private openDialog(row: any, benefitsList: any[]): void {
    const html = this.buildHtml(benefitsList);

    const title = `BENEFITS - ${row.FIRST_NAME} ${row.LAST_NAME} (#${row.MEM_NO})`;

    this.dialog.open(ActionDialog, {
      width: '80vw',
      maxWidth: '600px',
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
  private buildHtml(benefitsList: any[]): string {
    if (!benefitsList.length) {
      return `<p style="text-align:center;color:#777">No benefits available</p>`;
    }

    return benefitsList.map(b => `
      <div style="margin-bottom:12px" class="txupper">
        <div style="font-weight:600">
          ${escapeHtml(b.plan_name)}
          (${escapeHtml(b.start_date)} - ${escapeHtml(b.end_date)})
        </div>
          ${/^https:\/\//i.test(b.file_name ?? '') ? `
          <ul>
            <li>
              <a href="${escapeHtml(b.file_name)}"
                target="_blank"
                rel="noopener noreferrer">
                View Link
              </a>
            </li>
          </ul>
        ` : ``}
      </div>
    `).join('');
  }

  // ============================
  // HTML ESCAPER
  // ============================
}

