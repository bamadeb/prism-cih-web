import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { RouterModule } from '@angular/router';
import { UserDataService } from '../../../services/user-data-service';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatExpansionModule,
    RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})


export class Sidebar {
  userRole: any;
    constructor(     
    private userData: UserDataService 
  ) {}

  ngOnInit(): void {
      const user = this.userData.getUser();
      this.userRole = user.role_id;
  }  
     
     
}
