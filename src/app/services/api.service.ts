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
import {PasswordUpdateRequest}  from '../models/requests/passwordUpdateRequest'
 
@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  LogInsertData<T>(request: TaskRequest) {
    throw new Error('Method not implemented.');
  }

  constructor(
    private readonly httpClient: HttpClient,
    private readonly environmentService: AppEnvService,

  ) { }

  async login<TResponse>(request: LoginRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismAuthentication',
      request   
    );
  }

  async prismUserPasswordUpdate<TResponse>(request: PasswordUpdateRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismUserPasswordUpdate',
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

async insertUsers<TResponse, TRequest>(request: TRequest): Promise<TResponse> {
  return commonPostApi<TResponse>(
    this.httpClient,
    this.environmentService,
    'prismCreateUser',
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

async updateUser<TResponse, TRequest>(request: TRequest): Promise<TResponse> {
  return commonPostApi<TResponse>(
    this.httpClient,
    this.environmentService,
    'prismUpdateUser',
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

  async pageaccess<TResponse>(): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismGetPageAccessList',
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

  async userRequestList<TResponse>(): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismUserRequestList',
      {}   
    );
  }

  async checkuserexist<TResponse>(request: UsernameRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService, 
      'prismGetUserByEmail',
      request   
    );
  }  

  async addActionMaster<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetAddActionMasterData',
      request   
    );
  }
  async prismVendorMasterlist<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismVendorMasterlist',
      request   
    );
  }

  async getUserListByid<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetuserlistbyrole',
      request   
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

   async getMemberVisitList<TResponse>(request: MedicaidIdRequest): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetMemberPCPVisitList',
      request   
    );
  }


   async getTempQualityGapsBySeccionID<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetTempQualityGapsBySeccionID',
      request   
    );
  } 

  async processQualityGapsSeccionID<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismProcessQualityGapsSeccionID',
      request
    );
  }

  async processStarPerformanceSeccionID<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismProcessStarPerformanceSeccionID',
      request
    );
  }

   async getTempStarPerformanceBySeccionID<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetTempStarPerformanceBySeccionID',
      request   
    );
  } 

  async getSystemlog<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismLogdetailsbymedicaid',
      request   
    );
  } 

  async getFIleprocesslist<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismFileProcesslistByType',
      request   
    );
  } 

  async getfileprocessLoglist<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismFileProcessLoglistBySession',
      request   
    );
  } 

   async getTempCihPcrBySessionID<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetcihpcr',
      request   
    );
  }

  async processPCRdataSessionID<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismProcessPCRdataSessionId',
      request   
    );
  }

  async getProviderList<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetProviderListByVendorId',
      request   
    );
  } 

  async getAppointmentList<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetappointmentList',
      request   
    );
  }

   async getVendorListByplan<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismVendorListByplan',
      request   
    );
  }

  async getProviderListByTin<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismGetproviderIdByTin',
      request   
    );
  }

  async updatePlanyearForRiskgap<TResponse>(request: any): Promise<TResponse> {
    return await commonPostApi<TResponse>(
      this.httpClient,
      this.environmentService,
      'prismUpdatePlanyearForRiskgap',
      request   
    );
  }

  
async createCognitoUser(request: any): Promise<string> {
  // Bug fix: this used to check res.statusCode/res.data, a shape that never
  // existed on what commonPostApi actually returns (HttpClient.post<T>()
  // resolves with the parsed JSON body itself, with no statusCode/data
  // wrapper) -- so res.statusCode was always undefined, meaning this threw
  // "Failed to create user..." on EVERY call, including ones where the
  // Cognito account was actually created successfully (leaving an orphaned
  // Cognito user with no matching MEM_USERS row, since insertUsers() was
  // never reached after the throw). Angular's HttpClient rejects the promise
  // for any non-2xx status; the Lambda's real JSON body (e.g. { message })
  // lands on error.error, not on a resolved value.
  try {
    const res: any = await commonPostApi(
      this.httpClient,
      this.environmentService,
      'prismCreateCognitoUser',
      request
    );

    // Success shape: { status: 'success', message, user: { cognitoUsername, ... } }
    const cognitoUsername = res?.user?.cognitoUsername;
    if (!cognitoUsername) {
      throw new Error(res?.message || 'Cognito username not returned');
    }
    return cognitoUsername;
  } catch (error: any) {
    const message =
      error?.error?.message ||
      error?.message ||
      'Failed to create user. Password does not meet policy requirements.';
    throw new Error(message);
  }
}


  async updateCognitoUser(
    username: string,
    attributes: any,
    newPassword?: string
  ): Promise<any> {

    const cognitoPayload: any = {
      username,
      attributes
    };

    if (newPassword) {
      cognitoPayload.newPassword = newPassword;
    }

    // Same bug as createCognitoUser() above: res never had a .statusCode
    // field (commonPostApi resolves with the parsed body itself), so this
    // always threw, even on a genuine 200. Angular's HttpClient rejects the
    // promise on any non-2xx status; the real error body lands on
    // error.error.
    try {
      const res: any = await commonPostApi(
        this.httpClient,
        this.environmentService,
        'prismUpdateCognitoUser',
        cognitoPayload
      );
      return res;
    } catch (error: any) {
      const message =
        error?.error?.message ||
        error?.message ||
        'Failed to update Cognito user';
      throw new Error(message);
    }
  }

  async deleteGapObservations<TResponse, TRequest>(request: TRequest): Promise<TResponse> {
  return commonPostApi<TResponse>(
    this.httpClient,
    this.environmentService,
    'prismdeleteGapObservations',
    request
  );
}
  async unlockUser<TResponse, TRequest>(request: TRequest): Promise<TResponse> {
  return commonPostApi<TResponse>(
    this.httpClient,
    this.environmentService,
    'prismAdminUnLockedCognitoUser',
    request
  );
}

}