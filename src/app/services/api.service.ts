import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppEnvService } from './app-env.service';
import { LoginRequest } from '../models/requests/loginRequest';  
import { commonPostApi } from '../utilities/functions'; 
import { BenefitsRequest,CallListRequest,TaskRequest,TaskListRequest, QualitygapRequest,RiskgapRequest, DashboardRequest, AlterPhoneListRequest} from '../models/requests/dashboardRequest';   
import { UserIdRequest, MedicaidIdRequest, MultipleRowInsertRequest, MultipleRowAndFieldUpdateRequest, Actionresultfollowup } from '../models/requests/commonRequest' 
import { unSetMemberGapsStatusRequest, updategapRequest, updatequalitygapRequest } from '../models/requests/memberGapsRequest';
import { StarPerformanceRequest } from '../models/requests/StarPerformanceRequest';
import { RiskGapsRequest } from '../models/requests/RiskGapsRequest';
  
 
@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  LogInsertData<T>(request: TaskRequest) {
    throw new Error('Method not implemented.');
  }

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

  async callList<TResponse>(request: CallListRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismGetcallhistory',
      request   
    );
  }

  async taskList<TResponse>(request: TaskListRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismGetMemberUpcommingTaskList',
      request   
    );
  }

  async alternatephoneList<TResponse>(request: AlterPhoneListRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismMemberAllDetails',
      request   
    );
  }

 async insert<TResponse, TRequest>(request: TRequest): Promise<TResponse> {
  return commonPostApi<TResponse>(
    this.httpClient,
    this.environmentService,
    'prismMultipleinsert',
    request
  );
}

async update<TResponse, TRequest>(request: TRequest): Promise<TResponse> {
  return commonPostApi<TResponse>(
    this.httpClient,
    this.environmentService,
    'prismMultiplefieldupdate',
    request
  );
}

  async masterdata<TResponse>(): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismGetAddActionMasterData',
      {}   
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
 async getStarPerformanceByYear<TResponse>(request: StarPerformanceRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetStarPerformanceByYear',
      request   
    );
  }
   async getGapsObservationData<TResponse>(request: RiskGapsRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetgapsobservationdata',
      request   
    );
  }


  
 


}