import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { UserDataService } from './user-data-service';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class HeaderService {

  constructor(
    private userData: UserDataService,
    private router: Router
  ) {}

  private titleSource = new BehaviorSubject<string>('Dashboard');
  title$ = this.titleSource.asObservable();

  setTitle(title: string) {
   
    this.titleSource.next(title);

    const user = this.userData.getUser();

    if (!user || !user.pageAccess) {
      this.router.navigate(['/access-denied']);
      return;
    }
    const roleId = user.role_id;

    // ✅ check if page is allowed
    const hasAccess = user.pageAccess.some(
      (p: any) =>
        p.role_id === roleId &&
        p.page_name.toUpperCase() === title.toUpperCase()
    );

    if (!hasAccess) {
        // ✅ set header title properly
      this.titleSource.next('403');
      this.router.navigate(['/access-denied']);
    }
  }
}