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
import { NolongerPatientDialogService } from '../../services/nolonger-patience-dialog.service';
import { ConfigService } from '../../services/api.service';
import { HeaderService } from '../../services/header.service';
import { UsersDialogService } from '../../services/users-dialog.service';

@Component({
  selector: 'app-users',
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
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit, AfterViewInit {

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
    private readonly apiService: ConfigService,
    private readonly usersDialogService: UsersDialogService,
    private readonly titleService: Title,
    private readonly headerService: HeaderService,
    private readonly noLongerPatientService:NolongerPatientDialogService
  ) {}

  /* ---------------- LIFE CYCLE ---------------- */

  ngOnInit(): void {
    this.titleService.setTitle('PRISM :: MANAGE USERS');
    this.headerService.setTitle('MANAGE USERS');
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
        status: u.status,
        cognito_username: u.cognito_username,
        locked: u.LOCKED === true || u.LOCKED === 1
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
    const dialogRef = user
      ? this.usersDialogService.editUsersDialog(this.roles, this.departments, user)
      : this.usersDialogService.addUsersDialog(this.roles, this.departments);

    dialogRef.afterClosed().subscribe(result => {
      if (result?.refresh) {
        this.loadTableData();
      }
    });
  }

  /* ---------------- UNLOCK ---------------- */
  async unlockUser(user: any): Promise<void> {
    const result = await this.noLongerPatientService.confirmUnlockUser(user);
    if (result?.refresh) {
      this.loadTableData();
    }
  }
  applyFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.dataSource.filter = value.trim().toLowerCase();
  }

  /* ---------------- DISPLAY HELPERS ---------------- */

  getStatusClass(row: any): string {
    if (row.locked) {
      return 'status-locked';
    }

    const status = (row.status ?? '').toString().trim().toLowerCase();
    if (status === 'in-active' || status === 'inactive' || status === '1') {
      return 'status-inactive';
    }

    return 'status-active';
  }
}
