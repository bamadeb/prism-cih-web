import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppEnvService } from './app-env.service';
import { LoginRequest } from '../models/requests/loginRequest';  
import { commonPostApi } from '../utilities/functions'; 
import { BenefitsRequest,CallListRequest,TaskRequest,TaskListRequest, QualitygapRequest,RiskgapRequest, DashboardRequest, AlterPhoneListRequest, AlterAddressListRequest, PlanexistRequest, UserListRequest} from '../models/requests/dashboardRequest';   
import { UserIdRequest, MedicaidIdRequest, MultipleRowInsertRequest, MultipleRowAndFieldUpdateRequest, Actionresultfollowup, navigatorListRequest } from '../models/requests/commonRequest' 
import { unSetMemberGapsStatusRequest, updategapRequest, updatequalitygapRequest } from '../models/requests/memberGapsRequest';
import { StarPerformanceRequest } from '../models/requests/StarPerformanceRequest';
import { RiskGapApiResponse, RiskGapReport, RiskGapsRequest } from '../models/requests/RiskGapsRequest';
import { UsernameRequest, UserRequest } from '../models/requests/userRequest';
import { attachmentRequest, attchFileremoveRequest, fileAttachRequest } from '../models/requests/planRequest';
import { actionLogRequest } from '../models/requests/actionLogRequest';
  
 
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

  async alternateaddressList<TResponse>(request: AlterAddressListRequest): Promise<TResponse> {
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

  async users<TResponse>(): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismUserslist',
      {}   
    );
  }

  async plans<TResponse>(): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prsmPlandetails',
      {}   
    );
  }

  async checkuserexist<TResponse>(request: UsernameRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismAuthentication',
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
 async getStarPerformanceByYear<TResponse>(request: StarPerformanceRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetStarPerformanceByYear',
      request   
    );
  }
   async getGapsObservationData(request: RiskGapsRequest): Promise<RiskGapApiResponse> {
    return await commonPostApi<RiskGapApiResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetgapsobservationdata',
      request
    );
  }

  async checkplanexist<TResponse>(request: PlanexistRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismPlanexist',
      request   
    ); 
  } 

  async getUsersByDepartment<TResponse>(request: UserListRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismGetusersbydeptid',
      request   
    ); 
  }

  async s3fileupload<TResponse>(request: fileAttachRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismUploadplandocument',
      request   
    ); 
  }

  async attachments<TResponse>(request: attachmentRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismGetattachmentListbytypeId',
      request   
    ); 
  }

  async deleteAttachment<TResponse>(request: attchFileremoveRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismdeleteAttachment',
      request   
    ); 
  }

  async navigatorList<TResponse>(request: navigatorListRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismUsers',
      request   
    ); 
  }

  async getActionlogData<TResponse>(request: actionLogRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismLogbyuserid',
      request   
    );
  } 

  async getmemberRiskData<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismMemberriskprofile',
      request   
    );
  } 

   async getTempMembersBySeccionID<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetTempMembersBySeccionID',
      request   
    );
  } 


  async processmembersSeccionID<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismProcessMembersSeccionID',
      request   
    );
  } 

  async getTempRiskGapsBySeccionID<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetTempRiskGapsBySeccionID',
      request   
    );
  } 

  async processRiskGapsSeccionID<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismProcessRiskGapsSeccionID',
      request   
    );
  } 
}