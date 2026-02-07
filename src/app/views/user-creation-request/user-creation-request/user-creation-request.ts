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
import { ConfigService } from '../../../services/api.service';
import { HeaderService } from '../../../services/header.service';
//import { PlansDialogService } from '../../../services/plans-dialog.service';
import { FileAttachService } from '../../../services/fileattach.service';
import { UserCreationRequestDialogService } from '../../../services/user-creation-service';

@Component({
  selector: 'app-user-creation-request',
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
  templateUrl: './user-creation-request.html',
  styleUrl: './user-creation-request.css',
})
export class UserCreationRequest  implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
    'FIRST_NAME',
    'LAST_NAME',
    'ROLE',
    'PHONE',
    'EMAIL',
    'DATE_OF_REQUEST',    
    'FistName',
    'STATUS',
    'ADDED_DATE','1'
  ];

  statusMap: { [key: number]: string } = {
    0: 'NEW',
    1: 'IN-PROCESS',
    2: 'COMPLETED',
    3: 'CANCEL'
  };

  dataSource = new MatTableDataSource<any>([]);
  selection = new SelectionModel<any>(true, []); 
  attachments: any[] = []; 
  isLoading = false;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private apiService: ConfigService,
    //private plansDialogService: PlansDialogService,
    private UserCreationDialogService: UserCreationRequestDialogService,    
    private fileAttachService: FileAttachService,
    private titleService: Title,
    private headerService: HeaderService
  ) {}

  /* ---------------- LIFE CYCLE ---------------- */

  ngOnInit(): void {
    this.titleService.setTitle('PRISM :: USER CREATION REQUESTS');
    this.headerService.setTitle('USER CREATION REQUESTS');
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
      const res = await this.apiService.userRequestList<any>();
      this.dataSource.data = res?.data?.plans ?? [];  
      //console.log(this.dataSource.data);
      // this.dataSource.data = plans.map((u: any) => ({ 
      //   ID: u.ID,
      //   FIRST_NAME: u.FIRST_NAME ?? '',
      //   start_date: u.start_date ?? '',
      //   end_date: u.end_date ?? '', 
      //   status: u.status,
      //   planstatus: u.status === 1 ? 'In-active' : 'Active',
      // }));

      this.selection.clear();

    } catch (err) {
      console.error('❌ Failed to load users', err);
    } finally {
      this.isLoading = false;
    }
  }

  /* ---------------- DIALOGS ---------------- */

  add(): void {
    this.openPlanDialog();
  }  

  editPlan(plan: any): void {
    this.openPlanDialog(plan);
  }

  attach(entity: any, type: string): void {
  this.isLoading = true;
  

  this.fileAttachService
    .openAttachDialog({ entity, type })
    .then(dialogRef => {

      // ✅ HIDE LOADER as soon as dialog is opened
      this.isLoading = false;

      dialogRef.afterClosed().subscribe(result => {
        if (result?.uploaded) {
          console.info('📎 File attached successfully');
        }
      });

    })
    .catch(() => (this.isLoading = false));
}


  private openPlanDialog(plan?: any): void {
    //this.isLoading = true;
    const dialogRef = plan
      ? this.UserCreationDialogService.editPlansDialog(plan)
      : this.UserCreationDialogService.addPlansDialog();

    dialogRef.afterClosed().subscribe(result => {
      this.isLoading = false;

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
