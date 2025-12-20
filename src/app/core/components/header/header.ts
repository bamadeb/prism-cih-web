import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router'; 
import { MatIconModule, MatIcon } from '@angular/material/icon';  
import { MatMenuModule, MatMenu } from '@angular/material/menu';
import { MatDivider } from '@angular/material/divider'; 
import { CommonModule } from '@angular/common'; 
import { MatSidenav } from '@angular/material/sidenav';
import { UserDataService } from '../../../services/user-data-service';
import { HeaderService } from '../../../services/header.service';
import { Observable } from 'rxjs/internal/Observable';


@Component({
  selector: 'app-header',
  imports: [MatToolbarModule, MatButtonModule, MatIcon, MatMenu, MatDivider,CommonModule,MatMenuModule, MatIconModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
 @Input() drawer!: MatSidenav;

  //pageTitle = 'Dashboard';
  pageTitle$!: Observable<string>;
  userName: string | undefined;
 
  constructor(private router: Router,private userData: UserDataService,private headerService: HeaderService ) {}

   ngOnInit(): void {
    //this.pageTitle = this.headerService.title$;
      const user = this.userData.getUser(); 
      this.userName = user.FistName+' '+user.LastName+' ('+user.ROLE_NAME+')';
      //console.log(user);
  }  

  logout() {
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}
