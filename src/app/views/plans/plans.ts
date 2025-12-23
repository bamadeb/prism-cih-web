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
import { UsersDialogService } from '../../services/users-dialog.service';

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
    'firstName',
    'lastName',
    'email',
    'department',
    'role',
    'status',
    '1'
  ];

  dataSource = new MatTableDataSource<any>([]);
  selection = new SelectionModel<any>(true, []);

  roles: any[] = [];
  departments: any[] = [];
  isLoading = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private apiService: ConfigService,
    private usersDialogService: UsersDialogService,
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
      property === 'firstName' ? item.firstName : item[property];
  }

  /* ---------------- API ---------------- */

  async loadTableData(): Promise<void> {
    this.isLoading = true;

    try {
      const res = await this.apiService.users<any>();
      const users = res?.data?.users ?? [];

      this.roles = res?.data?.roles ?? [];
      this.departments = res?.data?.department ?? [];
      //console.log(users);
      this.dataSource.data = users.map((u: any) => ({
        ID: u.ID,
        firstName: u.FistName ?? '',
        lastName: u.LastName ?? '',
        email: u.EmailID ?? '',
        password: u.Password,
        department_id: u.department_id,
        department: u.department ?? '—',
        role: u.ROLE_NAME ?? '—',
        roleId: u.role_id,
        member_status: u.member_status,
        status: u.status === 1 ? 'Inactive' : 'Active',
      }));

      this.selection.clear();

    } catch (err) {
      console.error('❌ Failed to load users', err);
    } finally {
      this.isLoading = false;
    }
  }

  /* ---------------- DIALOGS ---------------- */

  addUser(): void {
    this.openUserDialog();
  }

  editUser(user: any): void {
    this.openUserDialog(user);
  }

  private openUserDialog(user?: any): void {
    this.isLoading = true;

    const dialogRef = user
      ? this.usersDialogService.editUsersDialog(this.roles, this.departments, user)
      : this.usersDialogService.addUsersDialog(this.roles, this.departments);

    dialogRef.afterClosed().subscribe(result => {
      this.isLoading = false;

      if (result?.refresh) {
        console.info('🔄 Reloading users');
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
