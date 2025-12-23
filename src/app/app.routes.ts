import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthLayout } from './core/layout/auth-layout/auth-layout';
import { Login } from './views/auth/login/login';
import { MainLayout } from './core/layout/main-layout/main-layout';
import { Dashboard } from './views/dashboard/dashboard';
import { Users } from './views/users/users';
import { StarPerformance } from './views/star-performance/star-performance';
import { RisksGapReport } from './views/risks-gap-report/risks-gap-report';
import { Plans } from './views/plans/plans';

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
    component: MainLayout,
    children: [
      { path: 'dashboard', component: Dashboard },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'users', component: Users },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'plans', component: Plans },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'starperformance', component: StarPerformance },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'riskgapsreport', component: RisksGapReport },
    ]
  },
  { path: '**', redirectTo: 'login' }
];


