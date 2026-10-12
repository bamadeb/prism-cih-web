import { Component, Input } from '@angular/core';
import { CsvRowError } from '../../../utilities/csv-import';

const MAX_SHOWN = 50;

/** Lists the problems found in an uploaded CSV, by line number. */
@Component({
  selector: 'app-csv-errors',
  standalone: true,
  template: `
    @if (errors.length) {
      <div class="csv-errors" role="alert">
        <div class="csv-errors__title">
          The file was not uploaded. Fix {{ errors.length === 1 ? 'this problem' : 'these ' + errors.length + ' problems' }} and upload again:
        </div>
        <ul>
          @for (e of errors.slice(0, maxShown); track $index) {
            <li>{{ e.row ? 'Line ' + e.row + ': ' : '' }}{{ e.message }}</li>
          }
        </ul>
        @if (errors.length > maxShown) {
          <div>…and {{ errors.length - maxShown }} more.</div>
        }
      </div>
    }
  `,
  styles: [`
    .csv-errors {
      margin: 8px 0 12px;
      padding: 10px 14px;
      border: 1px solid #f5c2c7;
      border-radius: 6px;
      background: #fdecee;
      color: #842029;
      font-size: 13px;
      max-height: 240px;
      overflow-y: auto;
      text-transform: none;
    }
    .csv-errors__title { font-weight: 600; margin-bottom: 4px; }
    ul { margin: 4px 0 0; padding-left: 20px; }
  `]
})
export class CsvErrorsComponent {
  @Input() errors: CsvRowError[] = [];
  readonly maxShown = MAX_SHOWN;
}
