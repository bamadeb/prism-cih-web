import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { fromEvent, merge, Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { UserDataService } from './user-data-service';
import { SystemLogService } from './system-log';
@Injectable({
  providedIn: 'root'
})
export class IdleTimeoutService {
  userId!: number;
  userEmail!: string;
  private idleTime = 10 * 60 * 1000; // 10 minutes
  private subscription!: Subscription;

  constructor(
    private router: Router,
    private userData: UserDataService,
    private ngZone: NgZone,
    private systemLogService:SystemLogService

  ) { 
        const user = this.userData.getUser(); 
    if(user){
      this.userId = user.ID;
      this.userEmail = user.EmailID;
    }
   }

  startWatching() {
    // User activity events
    const activityEvents$ = merge(
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'click'),
      fromEvent(document, 'scroll'),
      fromEvent(document, 'touchstart')
    );
      const user = this.userData.getUser(); 
      if(user){
        this.userId = user.ID;
        this.userEmail = user.EmailID;

      }
    this.ngZone.runOutsideAngular(() => {
      this.subscription = activityEvents$
        .pipe(switchMap(() => timer(this.idleTime)))
        .subscribe(() => {
          this.ngZone.run(() => this.logout());
        });
    });
  }

  stopWatching() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  logout() {
    this.systemLogService.addSystemLog({
      log_name: 'LOGOUT',
      log_details: `Auto Logout ${this.userEmail}`,
      log_status: 'SUCCESS',
      log_by: this.userId,
      action_type: this.userEmail
    }).catch(() => {});  
    this.userData.clearUser(); // clear local/session storage
    this.router.navigate(['/login']);
  }
}
