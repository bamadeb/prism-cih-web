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
import { Title } from '@angular/platform-browser';
import { take } from 'rxjs';
import { ConfigService } from '../../../services/api.service';
import { HeaderService } from '../../../services/header.service';
import { PageAccessDialogService } from '../../../services/page-access-dialog.service';

@Component({
  selector: 'app-page-access',
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
  templateUrl: './page-access.html',
  styleUrl: './page-access.css',
})
export class PageAccess implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
      'ROLE_NAME',
      'page_name', 
      'status_text',
      '1'
    ];
  
    dataSource = new MatTableDataSource<any>([]);
  
    pagelist: any[] = [];
    roleList: any[] = [];
    isLoading = false;
  
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;
  
    constructor(
      private readonly apiService: ConfigService,
      private readonly pageDialogService: PageAccessDialogService,
      private readonly titleService: Title,
      private readonly headerService: HeaderService
    ) {}
  
    /* ---------------- LIFE CYCLE ---------------- */
  
    ngOnInit(): void {
      this.titleService.setTitle('PRISM :: MANAGE PAGE ACCESS');
      this.headerService.setTitle('PAGE ACCESS');
      this.loadTableData();
    }
  
    ngAfterViewInit(): void {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort; 
      
    }
  
    /* ---------------- API ---------------- */
  
    async loadTableData(): Promise<void> {
      this.isLoading = true;
  
      try {
        const res = await this.apiService.pageaccess<any>();
        
        const pageaccess = res?.data?.PageAccessList ?? [];  
        this.pagelist = res?.data?.PageList ?? [];
        this.roleList = res?.data?.roleList ?? [];
        
        this.dataSource.data = pageaccess.map((u: any) => ({
          id: u.id,
          role_id: u.role_id ?? '',
          page_id: u.page_id ?? '',
          ROLE_NAME: u.ROLE_NAME ?? '', 
          status: u.status,
          status_text: u.status_text,
          page_name: u.page_name 
        }));
  
      } catch (err) {
        console.error('❌ Failed to load', err);
      } finally {
        this.isLoading = false;
      }
    }
  
    /* ---------------- DIALOGS ---------------- */
  
    add(): void {
      this.openDialog();
    }
  
    edit(pageaccess: any): void {
      this.openDialog(pageaccess);
    }
  
    private openDialog(pageaccess?: any): void {
      this.isLoading = true;
  
      const dialogRef = pageaccess
        ? this.pageDialogService.editDialog(this.roleList, this.pagelist, pageaccess)
        : this.pageDialogService.addDialog(this.roleList, this.pagelist);
  
      dialogRef.afterClosed().pipe(take(1)).subscribe(result => {
        this.isLoading = false;

        if (result?.refresh) {
          this.loadTableData();
        }
      });
    }
  
    /* ---------------- FILTER ---------------- */
  
    applyFilter(event: Event): void {
      const value = (event.target as HTMLInputElement).value ?? '';
      this.dataSource.filter = value.trim().toLowerCase();
    }

    /* ---------------- DISPLAY HELPERS ---------------- */

    getPageAccessStatusClass(row: any): string {
      const status = (row.status_text ?? '').toString().trim().toLowerCase();
      if (status === 'in-active' || status === 'inactive' || row.status === 1) {
        return 'status-inactive';
      }
      return 'status-active';
    }

}
