import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AppEnvService } from './app-env.service';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand
} from "@aws-sdk/client-cognito-identity-provider";
const USER_KEY = 'app_user';
@Injectable({ providedIn: 'root' })
export class AuthService {
  // Finding 3.4.3: access/ID tokens now live only in memory (cleared on a
  // full page reload) instead of localStorage. The refresh token never
  // touches browser JS at all -- prismStoreRefreshToken stores it as an
  // httpOnly cookie right after login, and only prismRefreshSession (also
  // reading it as an httpOnly cookie) ever sees its value again. A page
  // reload re-establishes these via the token interceptor's existing
  // isTokenExpired() -> refreshToken() path, since no in-memory expiry looks
  // exactly like an expired one.
  private accessToken: string | null = null;
  private idToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(
    private readonly router: Router,
    private readonly environmentService: AppEnvService
  ) {}

  // Finding (functional test): this used to run a second, uncoordinated
  // 10-minute inactivity-logout watcher alongside IdleTimeoutService's
  // 30-minute one, both keyed on the same 'app_user' localStorage entry.
  // It started unconditionally in the constructor (not gated on login
  // state) and was never stopped, so any logged-in user who went 10
  // minutes without a raw mousemove/keydown/click/scroll/touchstart event
  // (e.g. reading a report, working in another window) got silently
  // logged out client-side well short of the intended 30-minute window --
  // even though their actual session/tokens were still fully valid.
  // IdleTimeoutService (idle-timeout.ts) is the single source of truth now.

  // ✅ Get full name with role
  getUserName(): string {
    const user = this.getUser();
    return [user?.FistName, user?.LastName].filter(Boolean).join(' ')
      + (user?.ROLE_NAME ? ` (${user.ROLE_NAME})` : '');
  }

  // ✅ Get full name with role
  getName(): string {
    const user = this.getUser();
    return [user?.FistName, user?.LastName].filter(Boolean).join(' ');
  }

  // ✅ Save user data
  setUser(user: any): void {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (err) {
      console.error('Error saving user to localStorage', err);
    }
  }

  // ✅ Get stored user data
  getUser<T = any>(): T | null {
    const data = localStorage.getItem(USER_KEY);
    return data ? (JSON.parse(data) as T) : null;
  }

  // ✅ Remove user data (logout)
  clearUser(): void {
    localStorage.removeItem(USER_KEY);
  }

  // ✅ Check if logged in
  isLoggedIn(): boolean {
    return !!this.getUser();
  }

  // ✅ Logout and redirect
  logout(): void {
    this.clearUser();
    sessionStorage.clear();
    localStorage.clear();
    this.accessToken = null;
    this.idToken = null;
    this.tokenExpiry = null;
    // Best-effort, not awaited -- logout should proceed regardless of
    // whether this call succeeds. An httpOnly cookie can't be cleared from
    // JS directly, so the backend has to do it.
    this.clearSessionCookie();
    this.router.navigate(['/']); // works now
  }

  // Congito 
  private readonly client = new CognitoIdentityProviderClient({
    region: environment.cognito.region
  });

  // ------------------------
  // LOGIN
  // ------------------------
  async login(username: string, password: string) {
    const command = new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: environment.cognito.clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      }
    });

    const result: any = await this.client.send(command);

    // ➤ Case 1: Auth success (no MFA)
    if (result.AuthenticationResult) {
      await this.storeTokens(result.AuthenticationResult, username);
      return { status: "SUCCESS", tokens: result.AuthenticationResult };
    }
    // ✅ CASE 2: FIRST TIME → NEED QR CODE
    if (result.ChallengeName === "MFA_SETUP") {

      return {
        status: "MFA_SETUP",
        session: result.Session,
        username: username
      };
    }
    // ✅ CASE 3: NORMAL MFA LOGIN
    if (result.ChallengeName === "SOFTWARE_TOKEN_MFA") {

      return {
        status: "SOFTWARE_TOKEN_MFA",
        session: result.Session,
        username: username
      };
    }

    // ➤ Case 2: MFA Required (SMS sent)
    if (result.ChallengeName === "SMS_MFA") {
      return {
        status: "MFA_REQUIRED",
        session: result.Session,
        challengeName: result.ChallengeName
      };
    }

    throw new Error("Unknown authentication challenge.");
  }
  async confirmMfaCode(username: string, code: string, session: string) {
    const command = new RespondToAuthChallengeCommand({
      ClientId: environment.cognito.clientId,
      ChallengeName: "SMS_MFA",
      Session: session,
      ChallengeResponses: {
        USERNAME: username,
        SMS_MFA_CODE: code
      }
    });

    const response: any = await this.client.send(command);

    if (response.AuthenticationResult) {
      await this.storeTokens(response.AuthenticationResult, username);
      return response.AuthenticationResult;
    }

    throw new Error("MFA validation failed");
  }

  // ------------------------
  // REFRESH TOKEN
  // ------------------------
  // Finding 3.4.3: this used to read a refresh token back out of
  // localStorage and call Cognito directly. Now it calls our own backend,
  // which reads the refresh token from an httpOnly cookie the browser can't
  // see -- the cookie is sent automatically by the browser via
  // credentials:'include', never handled by this code at all.
  async refreshToken(): Promise<string | null> {
    try {
      const url = `${this.environmentService.endpointUrl()}prismRefreshSession-${this.environmentService.envType()}`;
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include'
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      this.accessToken = data.accessToken;
      this.idToken = data.idToken;
      this.tokenExpiry = Date.now() + data.expiresIn * 1000;
      return this.idToken;
    } catch (err) {
      console.error("Refresh Token Error:", err);
      return null;
    }
  }

  // ------------------------
  // STORE TOKENS
  // ------------------------
  async storeTokens(tokens: any, username: string) {

    const idToken = tokens.IdToken;

    this.accessToken = tokens.AccessToken;
    this.idToken = idToken;
    this.tokenExpiry = Date.now() + tokens.ExpiresIn * 1000;

    if (tokens.RefreshToken) {
      await this.persistRefreshToken(tokens.RefreshToken);
    }
  }

  // Hands the refresh token to the backend once, immediately after login, so
  // it can be stored as an httpOnly cookie instead of anywhere JS can read
  // it again. Best-effort: a failure here degrades to "session won't survive
  // a page reload" rather than blocking login.
  private async persistRefreshToken(refreshToken: string): Promise<void> {
    try {
      const url = `${this.environmentService.endpointUrl()}prismStoreRefreshToken-${this.environmentService.envType()}`;
      await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.idToken}`
        },
        body: JSON.stringify({ refreshToken })
      });
    } catch (err) {
      console.error('Failed to persist refresh token:', err);
    }
  }

  private async clearSessionCookie(): Promise<void> {
    try {
      const url = `${this.environmentService.endpointUrl()}prismClearSession-${this.environmentService.envType()}`;
      await fetch(url, { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Failed to clear session cookie:', err);
    }
  }

  isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    return Date.now() > this.tokenExpiry;
  }

  getAccessToken() {
    return this.accessToken;
  }
  getIdToken() {
    return this.idToken;
  }
  async associateSoftwareToken(session: string) {

    const command = new AssociateSoftwareTokenCommand({
      Session: session
    });

    const response: any = await this.client.send(command);

    return response;
  }
  async confirmMfaSetup(username: string, session: string, otp: string) {
    const command =
      new RespondToAuthChallengeCommand({
        ClientId: environment.cognito.clientId,
        ChallengeName: "MFA_SETUP",
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          SOFTWARE_TOKEN_MFA_CODE: otp
        }
      });
    const result: any =
      await this.client.send(command);
    await this.storeTokens(result.AuthenticationResult, username);
    return result;
  }
  async verifyLoginOtp(username: string, session: string, otp: string) {
      const command = new RespondToAuthChallengeCommand({
          ClientId: environment.cognito.clientId,
          ChallengeName: "SOFTWARE_TOKEN_MFA",
          Session: session,
          ChallengeResponses: {
            USERNAME: username,
            SOFTWARE_TOKEN_MFA_CODE: otp
          }
        });
      const result: any = await this.client.send(command);
      await this.storeTokens(result.AuthenticationResult, username);
      return result;
    }
    async verifySoftwareToken(session: string, otp: string) {
    const command = new VerifySoftwareTokenCommand({
      Session: session,
      UserCode: otp
    });
    return await this.client.send(command);
  }
}
