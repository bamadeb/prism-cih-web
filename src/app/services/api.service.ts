import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppEnvService } from './app-env.service';
import { LoginRequest } from '../models/requests/loginRequest'; 
import { firstValueFrom } from 'rxjs';
import { commonPostApi } from '../utilities/functions';
import { BenefitsRequest, DashboardRequest } from '../models/requests/dashboardRequest';  
import { UserIdRequest, MedicaidIdRequest, MultipleRowInsertRequest, MultipleRowAndFieldUpdateRequest, Actionresultfollowup } from '../models/requests/commonRequest' 
import { unSetMemberGapsStatusRequest, updategapRequest, updatequalitygapRequest } from '../models/requests/memberGapsRequest';
@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  constructor(
    private httpClient: HttpClient,
    private environmentService: AppEnvService,

  ) { }

  
  // async login<TResponse>(request: LoginRequest): Promise<TResponse> {
  //   const body = JSON.stringify(request);
  //   //console.log('Sending body: ' + body);

  //   const requestUrl = `${this.environmentService.endpointUrl}/prismAuthentication-${this.environmentService.envType}`;
  //   const headers = new  HttpHeaders( {'content-type': 'application/json'});
  //   const result = firstValueFrom(this.httpClient.post<TResponse>(requestUrl, body, { headers}));
  //   return result;
  // }

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


  
  // async saveProcessorNode(request: JSON): Promise<string> {
  //   const body = JSON.stringify(request);
  //   //console.log('Sending body: ' + body);

  //   const requestUrl = `${this.environmentService.activeEngineBaseUrl}/prismAuthentication-dev`;
  //   const headers: HttpHeaders = new  HttpHeaders( {'content-type': 'application/json'});
  //   const result = this.httpClient.post<string>(requestUrl, body, { headers}).toPromise();

  //   return result;
  // }

  // async getConfigByGuidAsync(configGuid: string): Promise<DataTransformerConfig> {
  //   //console.log(`Getting config : ${configGuid}`);

  //   const requestUrl = `${this.environmentService.activeAppBaseUrl}/api/Config/${configGuid}`;
  //   const headers: HttpHeaders = new  HttpHeaders( {'content-type': 'application/json'});
  //   const result = await this.httpClient.get<string>(requestUrl, { headers}).toPromise();
  //   //console.log(result);
  //   const config: DataTransformerConfig = DataTransformerConfig.fromJSON(result);

  //   return config;
  // }

  // async deleteConfigByGuid(guid: string): Promise<boolean> {
  //   //console.log(`Deleting config : ${guid}`);

  //   const requestUrl = `${this.environmentService.activeAppBaseUrl}/api/Config/${guid}`;
  //   const headers: HttpHeaders = new  HttpHeaders( {'content-type': 'application/json'});
  //   const result = this.httpClient.delete<boolean>(requestUrl, { headers}).toPromise();

  //   return result;
  // }

}