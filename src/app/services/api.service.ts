import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppEnvService } from './app-env.service';
import { LoginRequest } from '../models/requests/loginRequest';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  constructor(
    private httpClient: HttpClient,
    private environmentService: AppEnvService,

  ) { }

  
  async login<TResponse>(request: LoginRequest): Promise<TResponse> {
    const body = JSON.stringify(request);
    //console.log('Sending body: ' + body);

    const requestUrl = `${this.environmentService.endpointUrl}/prismAuthentication-dev`;
    const headers = new  HttpHeaders( {'content-type': 'application/json'});
    const result = firstValueFrom(this.httpClient.post<TResponse>(requestUrl, body, { headers}));
    return result;
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