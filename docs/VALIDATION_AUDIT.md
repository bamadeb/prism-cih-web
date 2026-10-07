# PRISM CIH Web – Validation & Restriction Audit

Audit date: 2026-10-03 · Branch: `dev` · Scope: Angular app (`src/app`) + Lambda sources in `lambda-functions/`

Legend: ✅ Done · ⚠️ Partial / inconsistent · ❌ Missing
Priority: **P1** = security hole, fix first · **P2** = data integrity / policy gap · **P3** = UX / hygiene

---

## 0. Top priority gaps (P1)

| # | Gap | Where | Impact |
|---|-----|-------|--------|
| 1 | No caller / role check on the generic **update** endpoint | `prismMultiplefieldupdate.js` | Any user can update `ROLE_PAGE_ACCESS` (grant own role any page), `MEM_MEMBERS` (no-longer-patient flag), plans, attachments, tasks |
| 2 | No caller / role check on the bulk **update** endpoint | `prismMultipleRowAndFieldUpdate.js` | Any user can set `MEM_OUTREACH_MEMBERS.Care_Coordinator_id` to themselves, which bypasses every ownership check in the select/gap Lambdas |
| 3 | No caller check on `prismMultipleRowInsert.js` (it also lists `ROLE_PAGE_ACCESS`) | `prismMultipleRowInsert.js` | Anonymous inserts; non-admin can insert page-access rows (the admin gate exists only in `prismMultipleinsert.js`) |
| 4 | Password reset of any account with no auth | `prismUpdateCognitoUser.js` (TODO in code) | Account takeover: anyone can set any user's Cognito password |
| 5 | DB password update with no ownership check | `prismUserPasswordUpdate.js` (TODO in code) | Any user can change any user's DB password by `ID` |
| 6 | User creation with no admin check | `prismCreateCognitoUser.js`, `prismCreateUser.js` (TODO in code) | Anyone can create login-capable accounts with any `role_id` (including Admin = 7) |
| 7 | Attachment delete with no auth/ownership | `prismdeleteAttachment.js` (TODO in code) | Delete any attachment + S3 object by enumerating ids |
| 8 | Lockout reset is unauthenticated | `loginSuccessReset.js` | Anyone can clear the failed-attempt counter for any user, so lockout is ineffective |
| 9 | Stored XSS | `calllist-dialog.service.ts` builds HTML with unescaped `action_note`, `action_type`, `action_result`, then `bypassSecurityTrustHtml` | A note typed in Add Action runs script for anyone viewing call history |
| 10 | Cognito **client secret** shipped in the browser bundle | `environments/environment.ts` → `auth.service.ts calculateSecretHash` | Secret is public; app client should be a public client (no secret) |
| 11 | No route guards; role/page access is client-only | `app.routes.ts` (0 `canActivate`), `header.service.ts` | Page access is checked after the component loads, from `localStorage` (user-editable). The real protection is only the per-Lambda checks, and items 1–7 lack them |
| 12 | Expired password not enforced | `login.ts` stores user + Cognito tokens **before** the expiry check; `prismAuthentication.js` still returns 200 | User with an expired password can browse straight to `/dashboard` |
| 13 | `prismUpdatePlanyearForRiskgap.js` has no auth or member ownership check | Lambda | Any caller can change PLAN_YEAR on any member's risk gaps |
| 14 | Audit fields trusted from client | All inserts (`added_by`, `add_by`, `log_by`, `refer_by`, `ADDED_BY`) | `MEM_SYSTEM_LOG` and ownership columns can be spoofed; should be set from caller `sub` server-side |

---

## 1. Client-side validation – page by page

### 1.1 Login (`/login`)
| Field / rule | Status | Notes / missing |
|---|---|---|
| Username, password required | ✅ | HTML `required` |
| OTP 6 digits | ✅ | `maxlength=6`, `pattern=[0-9]*`, auto-submit at 6 |
| MFA (TOTP setup + verify) | ✅ | Via Cognito |
| Failed-attempt counter + lock message | ⚠️ | Driven by the **client** (`loginFailedIncrement` → `prismLockedCognitoUser`). Skipped if the API is called directly. `prismLockedCognitoUser` now requires Admin, so a non-logged-in user's call will get 401/403. **Verify that lockout still disables the Cognito user.** |
| Username email-format / trim | ❌ | Add `Validators.email` + trim |
| Expired password blocks login | ❌ | See P1 #12. Do not call `setUser` (or keep tokens) until the expiry check passes |

### 1.2 Change Password (`/change-password`)
| Rule | Status | Notes / missing |
|---|---|---|
| New = Confirm | ✅ | |
| ≥15 chars, upper, lower, digit, special | ✅ | In `validatePasswordPolicy` |
| HTML `minlength="8"` | ⚠️ | Conflicts with the 15-char policy; change it to 15 |
| Special-char set | ⚠️ | Client allows only `!@#$%^&*`; server accepts any non-alphanumeric character. Align them |
| Current password required | ❌ | |
| New ≠ old / password history | ❌ | |
| Password must not contain name/email | ❌ | |

### 1.3 Manage Users – Add/Edit User dialog
| Field | Status | Notes / missing |
|---|---|---|
| First / Last name required | ✅ | Trimmed on submit |
| Role, Department, Status required | ✅ | |
| Email required + format | ⚠️ | `Validators.email` accepts `a@b`; server requires a dot. Use the same regex |
| Email duplicate check | ✅ | `checkuserexist` (server also returns 409 on unique violation) |
| Password | ⚠️ | Only `minLength(6)`, but the hint and server require 15 + complexity. Add the same policy validator |
| Confirm password | ❌ | |
| Name max length (100) / email (150) | ❌ | Server enforces it; client should too |
| Name pattern (letters, space, `-`, `'`) | ❌ | |
| Whitespace-only names | ⚠️ | Pass `required`; rejected by server after trim |
| Admin cannot deactivate self or remove own Admin role | ❌ | |

### 1.4 New User Account Request dialog
| Field | Status | Notes / missing |
|---|---|---|
| First, last, email, phone, role, date, status required | ✅ | |
| Email format | ✅ | Same `a@b` weakness |
| Phone auto-format `(xxx) xxx-xxxx`, maxlength 14 | ✅ | |
| Phone exactly 10 digits | ❌ | `(12` passes `required` |
| Duplicate email (existing user / pending request) | ❌ | |
| Request date not in future | ❌ | |
| Status should not be selectable on create | ❌ | |
| Names length / pattern / trim | ❌ | |
| Error shown to user | ❌ | `handleError` only logs to the console |

### 1.5 Alternate Address dialog
| Field | Status | Notes / missing |
|---|---|---|
| Address, city, state, zip required | ✅ | |
| Zip auto-format, maxlength 10 | ✅ | |
| Zip exactly 5 or 9 digits | ❌ | `123` passes |
| State = valid 2-letter code (dropdown) | ❌ | Free text |
| Length limits, trim, whitespace-only | ❌ | |
| Duplicate address check | ❌ | |
| Failure message to user | ❌ | Console only |

### 1.6 Alternate Phone dialog
| Rule | Status | Notes / missing |
|---|---|---|
| Required, auto-format, maxlength 14 | ✅ | |
| Exactly 10 digits | ❌ | |
| Not duplicate of primary/other alt phone | ❌ | |
| Failure message to user | ❌ | |

### 1.7 Manage Plans – Plan dialog
| Field | Status | Notes / missing |
|---|---|---|
| Name, start, end, status required | ✅ | |
| Start ≤ End | ✅ | Via `alert()`, not a form validator |
| Duplicate plan name | ❌ | |
| Name length / trim | ❌ | |

### 1.8 Assign Plan dialog
| Rule | Status | Notes / missing |
|---|---|---|
| Plan required | ✅ | |
| Already-assigned check | ✅ | `checkplanexist` per member (stops at first hit, but doesn't say which member) |
| Only active / in-date plans selectable | ❌ | |

### 1.9 File Attachment dialog (Plans / User requests)
| Rule | Status | Notes / missing |
|---|---|---|
| File required (new), status required | ✅ | |
| File type allow-list (`accept` + extension check) | ❌ | Any file can be uploaded |
| Max file size / empty file | ❌ | |
| Delete confirm | ⚠️ | Native `confirm()` |

### 1.10 Task dialog
| Field | Status | Notes / missing |
|---|---|---|
| Activity, date, assign-to, status required | ✅ | |
| Task date not in past (new task) | ❌ | |
| Note max length | ❌ | |

### 1.11 Transfer Member dialog
| Field | Status | Notes / missing |
|---|---|---|
| Department, user required | ✅ | |
| Cannot transfer to current owner | ❌ | |
| Reason required / length | ❌ | Optional today |

### 1.12 No-Longer-Patient confirm / Unlock-User confirm
| Rule | Status | Notes / missing |
|---|---|---|
| Note required, trimmed | ✅ | |
| Whitespace-only blocked on client | ⚠️ | Passes `required`; server rejects blank (no-longer-patient only) |
| Note max length | ❌ | |

### 1.13 Rolewise Page Access dialog
| Rule | Status | Notes / missing |
|---|---|---|
| Role, page, status required | ✅ | |
| Duplicate role + page combination | ❌ | |
| Prevent Admin removing own access to this page | ❌ | |

### 1.14 Add Action (member action panel)
| Rule | Status | Notes / missing |
|---|---|---|
| Action date valid; keys limited to digits and `/`; maxlength 10 | ✅ | |
| Quality gap: TIN, Provider, DOS, RxProviderFlag, PCPFlag, SuppSource required | ✅ | |
| Quality gap: at least one of CPT / HCPCS / ICD-10 | ✅ | |
| TIN/Provider conditional required | ✅ | |
| LOINC answer reset when LOINC cleared | ✅ | |
| Appointment: vendor, provider, date, time, status, place, type required | ✅ | |
| PCP visit: date + type required, valid date | ✅ | |
| Star measure: measure, date, count, TIN required + duplicate check | ✅ | |
| **Next activity date required when Next activity chosen** | ❌ | Otherwise `action_date` is null and the server returns 400 |
| Action date / DOS / PCP visit date not in future | ❌ | |
| Next action date ≥ today | ❌ | |
| Appointment date not in past | ❌ | |
| NPI = 10 digits (+ Luhn check) | ❌ | |
| Taxonomy code format (10 chars) | ❌ | |
| ICD-10 / CPT / HCPCS format | ❌ | |
| Risk-gap rows: any required fields | ❌ | Only quality gaps are validated |
| Note fields max length | ❌ | |

### 1.15 Process File pages (Member / Risk / Quality / PCR / Star Performance)
| Rule | Status | Notes / missing |
|---|---|---|
| File required, `.csv` extension | ✅ | All 5 |
| Exact header match | ✅ | Member, Risk, Quality, PCR · ❌ Star Performance (dynamic date columns) |
| Empty file (< 2 rows) | ✅ | Member |
| Date normalisation | ✅ | |
| Max file size / row count | ❌ | |
| Row-level checks (required columns, Medicaid ID format, numeric, valid dates) | ❌ | |
| Bad rows reported | ❌ | Member file silently **skips** rows whose column count differs |
| Quoted CSV values | ⚠️ | Member file uses `split(',')`, so values containing commas break. Others use Papa Parse |
| Duplicate rows within the file | ❌ | |

### 1.16 Reports
| Page | Status | Notes / missing |
|---|---|---|
| Appointments, Action Log, Outreach, Gaps, System Log | ✅ | Start/end required + end ≥ start (group validator) |
| File Log Report | ✅ | Type + list required |
| Max date range | ❌ | Only the server enforces it, and only in `prismLogdetailsbymedicaid` |
| Future dates | ❌ | |
| Member Risk, Star Performance | ❌ | No validation (year/plan) |
| CSV export formula escaping (`=`, `+`, `-`, `@`) | ❌ | CSV injection risk |

### 1.17 Global client restrictions
| Restriction | Status | Notes |
|---|---|---|
| Inactivity logout (10 min) | ✅ | `auth.service.ts` |
| Token refresh + retry on 401 | ✅ | `token.interceptor.ts` |
| Sidebar hides menus by role | ✅ | Cosmetic only |
| Page access check (`HeaderService.setTitle`) | ⚠️ | Runs after the component loads; reads `localStorage` |
| Route guards (auth + role) | ❌ | |
| Global 403 handler | ❌ | |
| Integer-only directives exist | ⚠️ | `appIntegerOnly` / `appIntegerPositiveOnly` are **never used** in any template |
| Storage encryption | ❌ | `storageEncryption: false`; key derived from a function name; `CryptoService` hard-coded key |
| `console.log` in source | ⚠️ | 18 occurrences; remove any PHI from them |

---

## 2. Server-side validation – Lambda by Lambda

| Lambda | Auth (caller `sub`) | Role / ownership | Input validation done | Missing |
|---|---|---|---|---|
| `prismAuthentication` | n/a (login) | – | username/password required; bcrypt; lock check (423); active users only | Doesn't increment failed attempts itself; returns 200 when password expired; returns all roles' page access |
| `loginSuccessReset` | ❌ | ❌ | username required | **P1 #8** |
| `prismLockedCognitoUser` | ✅ | ✅ Admin | username required | Conflicts with the login lockout flow (see 1.1) |
| `prismAdminUnLockedCognitoUser` | ✅ | ✅ Admin | username required | – |
| `prismUserPasswordUpdate` | ❌ | ❌ | ID, password required; 15-char policy | **P1 #5**; ID integer check |
| `prismUpdateCognitoUser` | ❌ | ❌ | username required; attribute allow-list; policy | **P1 #4**; returns 500 for missing username (should be 400) |
| `prismCreateCognitoUser` | ❌ | ❌ | email format; policy; numeric role | **P1 #6** |
| `prismCreateUser` | ❌ | ❌ | required; trim; length; email; ints; status ∈ {0,1}; policy; 409 on duplicate | **P1 #6**; role/department exist in master tables |
| `prismUpdateUser` | ✅ | ✅ Admin | required; ints; status; optional policy | Name length/trim; role/department exist; Admin can't demote self |
| `prismMultipleinsert` | ✅ | ⚠️ Admin only for `ROLE_PAGE_ACCESS` | table allow-list; required fields per table; identifier check; batching | Column allow-list per table; member ownership for `medicaid_id` rows; audit fields from caller; type/format/length checks (phone, zip, email, dates); max rows; `MEM_GAP_OBSERVATION_DATA` and `*_TEMP` have no required fields; temp tables not Admin-gated |
| `prismMultipleRowInsert` | ❌ | ❌ | table allow-list; required fields | **P1 #3** (same gaps as above) |
| `prismMultiplefieldupdate` | ❌ | ❌ | table + id-column allow-list; required fields; no blank values | **P1 #1**; column allow-list (any column of an allowed table can be set) |
| `prismMultipleRowAndFieldUpdate` | ❌ | ❌ | table + id-column allow-list; identifier check | **P1 #2**; column allow-list; max rows; values not checked |
| `prismUploadplandocument` | ✅ | ✅ Admin, or page access + owner | filename safe; directory allow-list; id integer; env pattern; bucket fixed | `fileType` / extension allow-list; size limit (use presigned POST with `content-length-range`); prod code allows `http://` dev + localhost origins |
| `prismdeleteAttachment` | ❌ | ❌ | id integer | **P1 #7** |
| `prismdeleteGapObservations` | ✅ | ⚠️ owner by subscriber | ≤500 records; id integer; subscriber required; Type ∈ risk/quality | Record `id` is not verified to belong to its `subscriber_number` (pair an owned subscriber with any id); Admin gets 403 (no Admin bypass) |
| `prismUpdategapStatus` / `prismUpdatequalityStatus` | ✅ | ✅ Admin or owner | medicaid_id required; diag codes non-empty | `action_id` integer check; code format |
| `prismUnSetMemberGapsStatus` / `prismUnSetqualityStatus` | ✅ | ✅ Admin or owner | medicaid_id required | `action_id` type (bound as VarChar in one) |
| `prismUpdatePlanyearForRiskgap` | ❌ | ❌ | required; year range 2000…current+1 | **P1 #13** |
| `prismProcess{Members,PCR,QualityGaps,RiskGaps}…` | ✅ | ✅ Admin | session_id numeric | Validation of staged rows before commit |
| `prismProcessStarPerformanceSeccionID` | ? | ? | ? | **Source not in repo** (stub only) |
| `prismGetUserMemberList` | ✅ | ✅ non-admin forced to self | – | – |
| `prismGetMemberGapsList`, `prismGetcallhistory`, `prismMemberAllDetails` | ✅ | ✅ Admin or owner | medicaid_id required | year params unchecked (gaps) |
| `prismGetappointmentList` | ✅ | ✅ Admin or owner | dates parsed | Max range |
| `prismGetMemberUpcommingTaskList` | ✅ | ✅ non-admin forced to self | – | – |
| `prismLogdetailsbymedicaid` | ✅ | ✅ Admin | dates required, valid, end ≥ start, max range | – |
| `prismGetPageAccessList`, `prismUserslist` | ✅ | ✅ Admin | – | – |
| `prismGetproviderIdByTin` | ❌ | ❌ | TIN = 9 digits | Auth (low risk, reference data) |

### 2.1 Endpoints called by the UI with **no source in this repo** (cannot be verified)
`loginFailedIncrement`, `loginOtpInput`, `pismGetbenefits`, `prismActionresultfollowup`, `prismFileProcessLoglistBySession`, `prismFileProcesslistByType`, `prismGetAddActionMasterData`, `prismGetMemberPCPVisitList`, `prismGetProviderListByVendorId`, `prismGetStarPerformanceByYear`, `prismGetTemp{Members,QualityGaps,RiskGaps,StarPerformance}BySeccionID`, `prismGetUserByEmail`, `prismGetattachmentListbytypeId`, `prismGetcihpcr`, `prismGetgapList`, `prismGetgapsobservationdata`, `prismGetqualityList`, `prismGetuserlistbyrole`, `prismGetusersbydeptid`, `prismLogbyuserid`, `prismMemberriskprofile`, `prismOutreachmemberSP`, `prismPlanexist`, `prismUserRequestList`, `prismUsers`, `prismVendorListByplan`, `prismVendorMasterlist`

→ Add their source to the repo, then apply the same auth / ownership checks to each. `prismGetUserByEmail` is an unauthenticated email-enumeration risk if it is open.

---

## 3. System-wide restriction checklist

| Area | Restriction | Status |
|---|---|---|
| Authentication | Cognito login + TOTP MFA | ✅ |
| | Cognito authorizer on API Gateway for all routes | ⚠️ Confirmed on some; login-flow routes have none |
| | Client secret not in browser | ❌ |
| Session | 10-min inactivity logout | ✅ |
| | Token refresh | ✅ |
| | Tokens in `localStorage` (XSS-exposed) | ⚠️ |
| Password | 15+ chars & complexity on server (create / update / reset) | ✅ |
| | Same policy on client (Add User) | ❌ (6 chars) |
| | Expiry warning + expiry | ⚠️ Shown, not enforced |
| | History / no-reuse | ❌ |
| Lockout | Lock after N failures | ⚠️ Client-driven; reset endpoint is open |
| | Admin unlock with note | ✅ |
| Authorization | Role-based menu | ✅ (UI only) |
| | Route guards | ❌ |
| | Server role checks | ⚠️ Done on ~60% of the Lambdas in the repo; missing on the generic update/insert and user/password endpoints |
| | Member ownership (navigator sees only own members) | ⚠️ Done on reads; bypassable through P1 #2; missing on member-level inserts |
| Data input | SQL parameterisation | ✅ Everywhere reviewed |
| | Table / id-column allow-lists | ✅ |
| | Column allow-lists | ❌ |
| | Format checks (phone / zip / email / NPI / codes / dates) on server | ❌ Mostly missing |
| | Length limits on server | ⚠️ Users only |
| Files | Upload: safe filename, fixed bucket, owner check | ✅ |
| | Upload: type / size limits | ❌ |
| | Delete: auth / owner | ❌ |
| | CSV import: header check | ✅ (4 of 5) |
| | CSV import: row validation / size limit | ❌ |
| Output | Angular auto-escaping | ✅ |
| | `bypassSecurityTrustHtml` with raw data | ❌ Call list (XSS) |
| | CSV export injection escaping | ❌ |
| Errors | Generic 500s, no SQL leak | ✅ Mostly (`prismLockedCognitoUser` echoes `error.message`) |
| Audit | System log written for key actions | ✅ |
| | Audit identity set server-side | ❌ |
| CORS | Origin allow-list | ⚠️ Upload Lambda falls back to `http://localhost:4200`; others depend on the shared `responseHelper` layer (not in repo) |

---

## 4. Suggested fix order

1. **P1 #1–#8, #13**: add the existing `callerSub → MEM_USERS → role/ownership` block (already used in `prismUpdateUser.js`) to every Lambda listed.
2. **P1 #9**: escape fields in `calllist-dialog.service.ts` (reuse `escapeHtml` from `benefits-dialog.service.ts`).
3. **P1 #10–#12**: remove the client secret (public app client), add `authGuard` + `roleGuard` on routes, and block the session when the password has expired.
4. **P1 #14**: set `added_by` / `log_by` / `refer_by` from the caller on the server; add per-table column allow-lists.
5. **P2**: align the client password validator, phone/zip/NPI/date validators, file type/size limits, CSV row validation, next-activity date rule.
6. **P3**: duplicate checks, length limits, user-visible error messages, CSV export escaping, remove `console.log`.
