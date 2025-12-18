import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppEnvService } from './app-env.service';
import { LoginRequest } from '../models/requests/loginRequest';  
import { commonPostApi } from '../utilities/functions';
import { UserIdRequest, MedicaidIdRequest, MultipleRowInsertRequest, MultipleRowAndFieldUpdateRequest, Actionresultfollowup } from '../models/requests/commonRequest' 
import { unSetMemberGapsStatusRequest, updategapRequest, updatequalitygapRequest } from '../models/requests/memberGapsRequest';
import { BenefitsRequest,CallListRequest,TaskListRequest, QualitygapRequest,RiskgapRequest, DashboardRequest} from '../models/requests/dashboardRequest';  
@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  constructor(
    private httpClient: HttpClient,
    private environmentService: AppEnvService,

  ) { }

  async login<TResponse>(request: LoginRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismAuthentication',
      request   
    );
  }

  async dashboard<TResponse>(request: DashboardRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetUserMemberList',
      request   
    );
  }

   async poweroverview<TResponse>(request: DashboardRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      //'prismOutreachAllmyworkspaceSP',
      'prismOutreachmemberSP',
      request   
    ); 
  }

  async benefitsList<TResponse>(request: BenefitsRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'pismGetbenefits',
      request   
    );
  }

  async gualitygapList<TResponse>(request: QualitygapRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismGetqualityList',
      request   
    );
  }

  async riskgapList<TResponse>(request: RiskgapRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismGetgapList',
      request   
    );
  }

  async calllistList<TResponse>(request: CallListRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismGetcallhistory',
      request   
    );
  }

  async tasklistList<TResponse>(request: TaskListRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismGetMemberUpcommingTaskList',
      request   
    );
  }

  async addActionMaster<TResponse>(): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetAddActionMasterData',
      {}   
    );
  }

  async getMemberGapsList<TResponse>(request: MedicaidIdRequest): Promise<TResponse> {
   return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetMemberGapsList',
      request   
    );

  }
  async getMemberTaskList<TResponse>(request: MedicaidIdRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetMemberUpcommingTaskList',
      request   
    );
  }
  async multipleRowInsert<TResponse>(request: MultipleRowInsertRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismMultipleinsert',
      request   
    );
  }
  async unSetMemberGapsStatus<TResponse>(request: unSetMemberGapsStatusRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismUnSetMemberGapsStatus',
      request   
    );
  }
  async updategapStatus<TResponse>(request: updategapRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismUpdategapStatus',
      request   
    );
  }
 async updatequalityStatus<TResponse>(request: updatequalitygapRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismUpdatequalityStatus',
      request   
    );
  }
 async multipleRowAndFieldUpdate<TResponse>(request: MultipleRowAndFieldUpdateRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismMultipleRowAndFieldUpdate',
      request   
    );
  }
 async getActionresultfollowup<TResponse>(request: Actionresultfollowup): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismActionresultfollowup',
      request   
    );
  }


  
 


}