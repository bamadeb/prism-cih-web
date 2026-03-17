import { Component, ViewChild, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { SelectionModel } from '@angular/cdk/collections';
import { Title } from '@angular/platform-browser';
import { ConfigService } from '../../services/api.service';
import { HeaderService } from '../../services/header.service';
import { PlansDialogService } from '../../services/plans-dialog.service';
import { FileAttachService } from '../../services/fileattach.service';

@Component({
  selector: 'app-plans',
   standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatDialogModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    MatTooltipModule,
    MatProgressSpinner
  ],
  templateUrl: './plans.html',
  styleUrl: './plans.css',
})
export class Plans implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
    'plan_name',
    'start_date',
    'end_date',
    'status',
    '1'
  ];

  dataSource = new MatTableDataSource<any>([]);
  selection = new SelectionModel<any>(true, []); 
  attachments: any[] = []; 
  isLoading = false;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private apiService: ConfigService,
    private plansDialogService: PlansDialogService,
    private fileAttachService: FileAttachService,
    private titleService: Title,
    private headerService: HeaderService
  ) {}

  /* ---------------- LIFE CYCLE ---------------- */

  ngOnInit(): void {
    this.titleService.setTitle('PRISM :: MANAGE PLANS');
    this.headerService.setTitle('MANAGE PLANS');
    this.loadTableData();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    this.dataSource.sortingDataAccessor = (item, property) =>
      property === 'plan_name' ? item.plan_name : item[property];
  }

  /* ---------------- API ---------------- */

  async loadTableData(): Promise<void> {
    this.isLoading = true;

    try {
      const res = await this.apiService.plans<any>();
      const plans = res?.data?.plans ?? []; 

      this.dataSource.data = plans.map((u: any) => ({ 
        id: u.id,
        plan_name: u.plan_name ?? '',
        start_date: u.start_date ?? '',
        end_date: u.end_date ?? '', 
        status: u.status,
        planstatus: u.status === 1 ? 'In-active' : 'Active',
      }));

      this.selection.clear();

    } catch (err) {
      console.error('❌ Failed to load users', err);
    } finally {
      this.isLoading = false;
    }
  }

  /* ---------------- DIALOGS ---------------- */

  addPlan(): void {
    this.openPlanDialog();
  }  

  editPlan(plan: any): void {
    this.openPlanDialog(plan);
  }

  attach(entity: any, type: string): void {
    this.isLoading = true;
    this.fileAttachService
      .openAttachDialog({ entity, type })
      .then(dialogRef =>
        dialogRef.afterClosed().subscribe(result => {
          this.isLoading = false;

          if (result?.uploaded) {
            console.info('📎 File attached successfully');
          }
        })
      )
      .catch(() => (this.isLoading = false));
  }

  private openPlanDialog(plan?: any): void {
    this.isLoading = true;

    const dialogRef = plan
      ? this.plansDialogService.editPlansDialog(plan)
      : this.plansDialogService.addPlansDialog();

    // ⬇ Hide loader as soon as dialog opens
    this.isLoading = false;

    dialogRef.afterClosed().subscribe(result => {
      if (result?.refresh) {
        console.info('🔄 Reloading plans');
        this.loadTableData();
      }
    });
}


  /* ---------------- FILTER ---------------- */
  applyFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.dataSource.filter = value.trim().toLowerCase();
  } 

}
