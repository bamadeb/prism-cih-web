import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserDataService } from '../../services/user-data-service';

/**
 * Same check HeaderService.setTitle() does after a page loads: the user's role
 * has an active ROLE_PAGE_ACCESS row whose page_name matches.
 */
export function hasPageAccess(user: any, pageName: string): boolean {
  if (!Array.isArray(user?.pageAccess)) return false;
  return user.pageAccess.some((p: any) =>
    p.role_id === user.role_id &&
    String(p.page_name ?? '').toUpperCase() === pageName.toUpperCase());
}

/**
 * App pages (MainLayout). Runs before the page component loads:
 *  - no stored user                    -> /login
 *  - password change pending (expired) -> /change-password
 *  - route data.page not allowed for the user's role -> /access-denied
 *
 * This only controls navigation in the browser. The data itself is protected
 * by the role/ownership checks in each Lambda.
 */
export const authGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const user = inject(UserDataService).getUser<any>();

  if (!user) {
    return router.createUrlTree(['/login']);
  }
  if (user.password_change_required) {
    return router.createUrlTree(['/change-password']);
  }

  const page = route.data?.['page'] as string | undefined;
  if (page && !hasPageAccess(user, page)) {
    return router.createUrlTree(['/access-denied']);
  }
  return true;
};

/** /change-password needs someone who has just logged in. */
export const changePasswordGuard: CanActivateFn = () => {
  const router = inject(Router);
  const user = inject(UserDataService).getUser<any>();
  return user?.ID ? true : router.createUrlTree(['/login']);
};
