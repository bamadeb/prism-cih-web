import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { fromEvent, merge, Subscription, timer } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { UserDataService } from './user-data-service';
import { SystemLogService } from './system-log';

@Injectable({
  providedIn: 'root'
})
export class IdleTimeoutService {

  private readonly idleTime = 60 * 60 * 1000; // 10 minutes
  private subscription!: Subscription;

  constructor(
    private readonly router: Router,
    private readonly userData: UserDataService,
    private readonly ngZone: NgZone,
    private readonly systemLogService: SystemLogService
  ) {}

  startWatching() {

    // stop old watcher if exists
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    const activityEvents$ = merge(
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'click'),
      fromEvent(document, 'scroll'),
      fromEvent(document, 'touchstart')
    );

    this.ngZone.runOutsideAngular(() => {

      this.subscription = activityEvents$
        .pipe(
          startWith(null), // start timer immediately
          switchMap(() => {

            // update last activity time
            localStorage.setItem('lastActivity', Date.now().toString());

            return timer(this.idleTime);
          })
        )
        .subscribe(() => {

          this.ngZone.run(() => {
            this.logout();
          });

        });

    });

  }

  stopWatching() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  checkSession() {

    const lastActivity = localStorage.getItem('lastActivity');

    if (!lastActivity) {
      return;
    }

    const now = Date.now();
    const diff = now - Number(lastActivity);

    if (diff > this.idleTime) {
      this.logout();
    }
  }

  logout() {

    const user = this.userData.getUser();

    if (user) {
      this.systemLogService.addSystemLog({
        log_name: 'LOGOUT',
        log_details: `Auto Logout ${user.EmailID}`,
        log_status: 'SUCCESS',
        log_by: user.ID,
        action_type: user.EmailID
      }).catch(() => {});
    }

    // clear session
    this.userData.clearUser();
    localStorage.removeItem('lastActivity');

    this.stopWatching();

    this.router.navigate(['/login']);

  }

}