import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserDataService } from '../services/user-data-service';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  // Static config (environment.json) is fetched before the API endpoint is known,
  // and must not trigger a token refresh that needs that endpoint.
  if (req.url.startsWith('/assets/')) {
    return next(req);
  }

  const auth = inject(AuthService);
  const snackBar = inject(MatSnackBar);
  const userData = inject(UserDataService);

  return from(handle(req, next, auth, snackBar, userData));
};

async function handle(req: any, next: any, auth: AuthService, snackBar: MatSnackBar, userData: UserDataService) {
  // Refresh token if expired
  if (auth.isTokenExpired()) {
    await auth.refreshToken();
  }

  const token = auth.getIdToken();
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authReq).pipe(
    catchError((error) => {
      if (error.status === 401) {
        return from(refreshAndRetry(req, next, auth));
      }
      if (error.status === 403) {
        notifyForbidden(snackBar, userData);
      }
      return throwError(() => error);
    })
  ).toPromise();
}

async function refreshAndRetry(req: any, next: any, auth: AuthService) {
  const newToken = await auth.refreshToken();

  if (!newToken) {
    auth.logout();
    return throwError(() => 'Session expired');
  }

  const newReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${auth.getAccessToken()}`
    }
  });

  return next(newReq).toPromise();
}

// A Lambda refused the action for this user's role/ownership. The error is
// still passed on so the page can react; this just makes sure the user sees
// why. Skipped when nobody is logged in (e.g. the login page's own calls).
function notifyForbidden(snackBar: MatSnackBar, userData: UserDataService): void {
  if (!userData.getUser()) return;
  snackBar.open('You do not have permission to perform this action.', 'Close', {
    duration: 5000,
    verticalPosition: 'top'
  });
}
