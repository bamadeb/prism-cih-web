import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router'; 
import { MatIconModule, MatIcon } from '@angular/material/icon';  
import { MatMenuModule, MatMenu } from '@angular/material/menu';
import { MatDivider } from '@angular/material/divider'; 
import { CommonModule } from '@angular/common'; 
import { MatSidenav } from '@angular/material/sidenav';



@Component({
  selector: 'app-header',
  imports: [MatToolbarModule, MatButtonModule, MatIcon, MatMenu, MatDivider,CommonModule,MatMenuModule, MatIconModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
 @Input() drawer!: MatSidenav;

  pageTitle = 'Dashboard';
  userName = 'Admin';
  Name:any;
 
  constructor(private router: Router) {}

  logout() {
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}
