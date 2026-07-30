import { ChangeDetectorRef,
  Component,
  OnInit,
  AfterViewInit,
  ViewChild, 
  ChangeDetectionStrategy} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ConfigService } from '../../../services/api.service';
import { Title } from '@angular/platform-browser';
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";
import { MatTableDataSource } from '@angular/material/table';
import { MatDatepickerModule } from "@angular/material/datepicker";
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HeaderService } from '../../../services/header.service';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common'; 
import { MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
interface RiskSummaryRow {
  medicaid_id?: string;
  member_name?: string;
  Care_Coordinator_name?: string;
  last_action_date?: string;
  next_upcoming_date?: string;
  newriskcategory?: string;
  risk_category?: string;
  sub_category_name?: string;
  sub_category2_name?: string;
  to_date?: string;
  score?: number;
  level?: 'high' | 'medium' | 'low';
}
@Component({
  selector: 'app-risk-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    ReactiveFormsModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './risk-profile.html',
  styleUrl: './risk-profile.css',
})
export class RiskProfile implements AfterViewInit, OnInit {
  displayedColumns: string[] = [ ]; 
  dynamicDateColumns: string[] = []; 

statusCards = [
  { count: 0, label: 'IN CRISIS L3' },
  { count: 0, label: 'STRUGGLING L2' },
  { count: 0, label: 'AT RISK L1' },
  { count: 0, label: 'STABLE HEALTHY L2' },
  { count: 0, label: 'STABLE HEALTHY L1' }
];

 
dataSource = new MatTableDataSource<any>([]);
selection = new SelectionModel<any>(true, []);

@ViewChild('mainPaginator') paginator!: MatPaginator;
@ViewChild('mainSort') sort!: MatSort;

actionLogFormGroup!: FormGroup;
isLoading = false; 
user_list: any[] = [];
riskLevel: any[] = []; 
newRiskCategoryCount: Record<string, number> = {};

  // ✅ Status constants
  ACTION_STATUS = {
    SUCCESS: 'SUCCESS',
    SCHEDULED: 'SCHEDULED',
    FAILURE: 'FAILURE'
  };

  constructor(
    private readonly apiService: ConfigService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly headerService: HeaderService,
    private readonly titleService: Title
  ) {
  
    // ✅ All required controls added
    this.actionLogFormGroup = this.fb.group({
      user_id: [''],
    });
  }

  async ngOnInit() {
  this.titleService.setTitle('PRISM :: MEMBER RISK PROFILE');
  this.headerService.setTitle('MEMBER RISK PROFILE');
 
  await this.applyFilter();
}

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    this.dataSource.sortingDataAccessor = (item, property) => {
      const value = item[property];
      return typeof value === 'string' ? value.toLowerCase() : value;
    };
  }

  async applyFilter() {
  this.isLoading = true;

  try {
    const { data } = await this.apiService.getmemberRiskData<any>({
      ...this.actionLogFormGroup.value
    });

    const rawData: RiskSummaryRow[] = data?.riskSummary ?? [];
    // Only populate the dropdown from the initial, unfiltered load so selecting
    // a single user doesn't shrink the list to just that user's own record.
    if (!this.user_list.length) {
      this.user_list = data?.userlist ?? [];
    }
    this.riskLevel = data?.riskLevel ?? [];

    /* =====================================================
       1️⃣ LATEST RISK PER MEMBER (FAST + SAFE)
    ===================================================== */
    const latestRiskMap = new Map<string, any>();

    for (const r of rawData) {
      if (!r.medicaid_id || !r.to_date) continue;

      const prev = latestRiskMap.get(r.medicaid_id);

      if (
        !prev ||
        new Date(r.to_date) > new Date(prev.to_date) ||
        (
          new Date(r.to_date).getTime() === new Date(prev.to_date).getTime() &&
          !prev.newriskcategory &&
          r.newriskcategory
        )
      ) {
        latestRiskMap.set(r.medicaid_id, r);
      }
    }

    /* =====================================================
       2️⃣ RESET + COUNT STATUS CARDS (O(1))
    ===================================================== */
    const statusCountMap = new Map<string, number>();

    for (const r of latestRiskMap.values()) {
      if (!r.newriskcategory) continue;
      statusCountMap.set(
        r.newriskcategory,
        (statusCountMap.get(r.newriskcategory) ?? 0) + 1
      );
    }

    this.statusCards.forEach(card => {
      card.count = statusCountMap.get(card.label) ?? 0;
    });

    /* =====================================================
       3️⃣ COLLECT UNIQUE DATES
    ===================================================== */
    const dateSet = new Set<string>();
    rawData.forEach(r => r.to_date && dateSet.add(r.to_date));
    this.dynamicDateColumns = Array.from(dateSet).sort((a, b) => a.localeCompare(b));

    /* =====================================================
       4️⃣ GROUP TABLE ROWS
    ===================================================== */
    const groupedMap = new Map<string, any>();

    for (const r of rawData) {
      const key = `${r.medicaid_id}|${r.newriskcategory}|${r.sub_category_name}|${r.sub_category2_name}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          member_name: r.member_name,
          medicaid_id: r.medicaid_id,
          Care_Coordinator_name: r.Care_Coordinator_name,
          last_action_date: this.formatYMD(r.last_action_date),
          next_upcoming_date: r.next_upcoming_date,
          category: r.newriskcategory ?? '',
          risk_category: r.risk_category ?? '',
          sub_category_name: r.sub_category_name ?? '',
          sub_category2_name: r.sub_category2_name ?? '',
          dateValues: {},
          dateLevels: {}
        });
      }

      if (r.to_date) {
        const row = groupedMap.get(key);
        row.dateValues[r.to_date] = r.score;
        row.dateLevels[r.to_date] = r.level;
      }
    }

    /* =====================================================
       5️⃣ BIND TABLE
    ===================================================== */
    this.dataSource.data = Array.from(groupedMap.values());

    this.displayedColumns = [
      'member_name',
      'Care_Coordinator_name',
      'last_action_date',
      'next_upcoming_date',
      'risk_category',
      'category',
      'sub_category_name',
      'sub_category2_name',
      ...this.dynamicDateColumns
    ];

    this.paginator?.firstPage();

  } finally {
    this.isLoading = false;
    this.cdr.markForCheck();
  }
}




getRiskClass(level: string): string {
  if (!level) return '';

  const v = level.toLowerCase();

  if (v === 'high') return 'risk-high';
  if (v === 'medium') return 'risk-medium';
  if (v === 'low') return 'risk-low';

  return '';
}

formatYMD(date: any): string {
  if (!date) return '';

  const d = new Date(date);

  // ❌ Invalid date OR epoch date
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) {
    return '';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${month}/${day}/${year}`;
}
trackByLabel(_: number, item: any) {
  return item.label;
}

trackByDate(_: number, d: string) {
  return d;
}

/* ---------------- FILTER ---------------- */

  filter(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.dataSource.filter = value.trim().toLowerCase();
  }

}
