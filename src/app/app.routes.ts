import { Routes } from '@angular/router';
import { AuthLayout } from './core/layout/auth-layout/auth-layout';
import { Login } from './views/auth/login/login';
import { MainLayout } from './core/layout/main-layout/main-layout';
//import { AutocompleteDemo } from './views/autocomplete-demo/autocomplete-demo/autocomplete-demo';



export const routes: Routes = [
  {
    path: '',
    component: AuthLayout,
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', component: Login },
    ]
  },
  {
    path: '',
    component: AuthLayout,
    children: [
      {
        path: 'change-password',
        loadComponent: () => import('./views/change-password/change-password').then(m => m.ChangePassword),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./views/dashboard/dashboard').then(m => m.Dashboard),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'users',
        loadComponent: () => import('./views/users/users').then(m => m.Users),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'plans',
        loadComponent: () => import('./views/plans/plans').then(m => m.Plans),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'usercreation-request',
        loadComponent: () => import('./views/user-creation-request/user-creation-request/user-creation-request').then(m => m.UserCreationRequest),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'starperformance',
        loadComponent: () => import('./views/reports/star-performance/star-performance').then(m => m.StarPerformance),
      },
    ]
  },{
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'logreport',
        loadComponent: () => import('./views/reports/logreport/logreport').then(m => m.Logreport),
      },
    ]
  },{
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'systemlogreport',
        loadComponent: () => import('./views/reports/system-log/system-log').then(m => m.SystemLog),
      },
    ]
  },{
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'filelogreport',
        loadComponent: () => import('./views/reports/file-log-report/file-log-report').then(m => m.FileLogReport),
      },
    ]
  },{
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'risk-profile',
        loadComponent: () => import('./views/reports/risk-profile/risk-profile').then(m => m.RiskProfile),
      },
    ]
  },{
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'appointment-list',
        loadComponent: () => import('./views/reports/appointment-list/appointment-list/appointment-list').then(m => m.AppointmentList),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'process-member-file',
        loadComponent: () => import('./views/process-file/member-file/member-file').then(m => m.MemberFile),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'process-riskgaps-file',
        loadComponent: () => import('./views/process-file/riskgaps-file/riskgaps-file').then(m => m.RiskgapsFile),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'process-qualitygaps-file',
        loadComponent: () => import('./views/process-file/qualitygaps-file/qualitygaps-file').then(m => m.QualitygapsFile),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'process-pcr-file',
        loadComponent: () => import('./views/process-file/pcr-file/pcr-file').then(m => m.PcrFile),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'process-star-performance-file',
        loadComponent: () => import('./views/process-file/star-performance-file/star-performance-file').then(m => m.StarPerformanceFile),
      },
    ]
  },
   {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'access-denied',
        loadComponent: () => import('./views/access-denied/access-denied/access-denied').then(m => m.AccessDenied),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'page-access',
        loadComponent: () => import('./views/rolewise-page/page-access/page-access').then(m => m.PageAccess),
      },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'outreach-activity',
        loadComponent: () => import('./views/reports/outreach-activity/outreach-activity/outreach-activity').then(m => m.OutreachActivity),
      },
    ]
  },
  //  {
  //   path: '',
  //   component: MainLayout,
  //   children: [
  //     { path: 'autocomplete', component: AutocompleteDemo },
  //   ]
  // },
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'riskgapsreport',
        loadComponent: () => import('./views/reports/risks-gap-report/risks-gap-report').then(m => m.RisksGapReport),
      },
    ]
  },
  { path: '**', redirectTo: 'login' }
];

