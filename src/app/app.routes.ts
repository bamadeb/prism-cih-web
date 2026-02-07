import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthLayout } from './core/layout/auth-layout/auth-layout';
import { Login } from './views/auth/login/login';
import { MainLayout } from './core/layout/main-layout/main-layout';
import { Dashboard } from './views/dashboard/dashboard';
import { Users } from './views/users/users';
import { StarPerformance } from './views/reports/star-performance/star-performance';
import { RisksGapReport } from './views/reports/risks-gap-report/risks-gap-report';
import { Plans } from './views/plans/plans';
import { Logreport } from './views/reports/logreport/logreport';
import { RiskProfile } from './views/reports/risk-profile/risk-profile';
import { MemberFile } from './views/process-file/member-file/member-file';
import { RiskgapsFile } from './views/process-file/riskgaps-file/riskgaps-file';
import { QualitygapsFile } from './views/process-file/qualitygaps-file/qualitygaps-file';
import { SystemLog } from './views/reports/system-log/system-log';
import { FileLogReport } from './views/reports/file-log-report/file-log-report';
import { PcrFile } from './views/process-file/pcr-file/pcr-file';
import { AppointmentList } from './views/reports/appointment-list/appointment-list/appointment-list';

import { ChangePassword } from './views/change-password/change-password';

import { UserCreationRequest } from './views/user-creation-request/user-creation-request/user-creation-request';


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
      { path: 'change-password', component: ChangePassword },
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
      { path: 'usercreation-request', component: UserCreationRequest },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'starperformance', component: StarPerformance },
    ]
  },{
    path: '',
    component: MainLayout,
    children: [
      { path: 'logreport', component: Logreport },
    ]
  },{
    path: '',
    component: MainLayout,
    children: [
      { path: 'systemlogreport', component: SystemLog },
    ]
  },{
    path: '',
    component: MainLayout,
    children: [
      { path: 'filelogreport', component: FileLogReport },
    ]
  },{
    path: '',
    component: MainLayout,
    children: [
      { path: 'risk-profile', component: RiskProfile },
    ]
  },{
    path: '',
    component: MainLayout,
    children: [
      { path: 'appointment-list', component: AppointmentList },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'process-member-file', component: MemberFile },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'process-riskgaps-file', component: RiskgapsFile },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'process-qualitygaps-file', component: QualitygapsFile },
    ]
  },
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'process-pcr-file', component: PcrFile },
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


