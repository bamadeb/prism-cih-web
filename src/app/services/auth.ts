import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LoginRequest } from '../models/requests/loginRequest';
import { AppEnvService } from './app-env.service';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  constructor(
    private httpClient: HttpClient,
    private environmentService: AppEnvService
  ) {}

  async login<TResponse>(request: LoginRequest): Promise<TResponse> {
    const body = JSON.stringify(request);
    const requestUrl = `${this.environmentService.endpointUrl()}/prismAuthentication-dev`;
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    try {
      const result = await firstValueFrom(
        this.httpClient.post<TResponse>(requestUrl, body, { headers })
      );
      return result;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }
}
