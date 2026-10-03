
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// const conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//   user: conn.dbuser,
//   password: conn.dbpassword,
//   server: conn.dbhost,
//   database: conn.dbname,
//   port: 1433,
//   options: {
//     encrypt: true,
//     trustServerCertificate: true
//   },
//   pool: {
//     max: 20,
//     min: 1,
//     idleTimeoutMillis: 300000,
//     acquireTimeoutMillis: 10000
//   }
// };

// // Create pool outside handler, once per container
// let connectionPoolPromise = sql.connect(config);

// async function getDBConnection() {
//   try {
//     return await connectionPoolPromise;
//   } catch (err) {
//     console.error("Reconnecting to SQL Server...", err.message);
//     connectionPoolPromise = sql.connect(config);
//     return await connectionPoolPromise;
//   }
// }

// IDOR (Finding 3.1.2/3.1.3 family): returns a member's full profile --
// PHI, quality/risk gaps, activity history -- for any medicaid_id supplied,
// with no check that the caller is that member's assigned care coordinator.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    //event.medicaid_id ="100153683";
    if (event.httpMethod === "OPTIONS") {
      return buildResponse(200,{},event);
  }
  const body = JSON.parse(event.body || "{}");
    let medicaid_id = body.medicaid_id;

    if (!medicaid_id) {
        return buildResponse(400, { message: 'medicaid_id is required' }, event);
    }

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { message: 'Unauthorized' }, event);
    }

    let pool;
    try {
        pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { message: 'Unauthorized' }, event);
        }

        if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
            const assignmentLookup = await pool.request()
                .input('medicaid_id', sql.VarChar(20), medicaid_id)
                .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
            const member = assignmentLookup.recordset[0];
            if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
                return buildResponse(403, { message: 'Forbidden' }, event);
            }
        }

        // Define SQL queries
        const queries = {
            memberDetails: `SELECT MMT.medicaid_id ,MMT.mem_type,MMT.action_needed ,MMT.Team_id ,MMT.Care_Coordinator_id ,MMT.HOMELESS ,MMT.HIGH_DRUG_USE ,MMT.SUBSTANCE_ABUSE 
            ,M.RECIP_NO, M.MEM_NO, M.FIRST_NAME, M.LAST_NAME, M.SSN, M.SEX, M.OTHER_ADDR1, M.OTHER_CITY, M.OTHER_STATE
            , M.OTHER_ZIP, M.PRIMARY_LANG, M.OTHER_PHONE, M.BIRTH,M.PRIMARY_LANG as language,  
            M.PHYSICIAN, PCP.provider_details AS Provider_Name,
            CONCAT(P.FIRST_NAME, ' ', P.LAST_NAME) AS PHYSICIAN,P.PRIMARY_BUSINESS_ADDR1,
            ALT_PHONE.alt_phone_no, ALT_ADRS.alt_address, ALT_ADRS.alt_city, ALT_ADRS.alt_state, ALT_ADRS.alt_zip,MMT.risk,MMT.preferred_call_time,MMT.HRA,MMT.EPSDT
            ,MMT.recert_month,MMT.WELCOME,MMT.incarcerated_flag,MMT.deceased_flag,MMT.homeless_flag,MMT.hard_to_reach
            ,MMT.ER,MMT.dnc_reason,MMT.CONTACT_STATUS,MMT.[COVID-19],MMT.[GAPS-IN-CARE],MMT.RECERT
        
            FROM MEM_OUTREACH_MEMBERS MMT 
            left join MEM_MEMBERS M ON MMT.medicaid_id=M.RECIP_NO 
            LEFT JOIN MEM_PHYSICIAN AS P ON (M.PHYSICIAN = P.PROVIDER_ID AND M.MEM_LOB = P.LOB)
            LEFT JOIN
            (
            SELECT TOP 1 medicaid_id, provider_details, add_date
            FROM MEM_PCP_CHANGE
            WHERE medicaid_id = @medicaid_id
            ORDER BY add_date DESC
            ) PCP ON (PCP.medicaid_id = MMT.medicaid_id)
        
            LEFT JOIN
            (
            SELECT TOP 1 medicaid_id, alt_phone_no, add_date
            FROM MEM_ALT_PHONE
            WHERE medicaid_id = @medicaid_id
            ORDER BY add_date DESC
            ) ALT_PHONE ON (ALT_PHONE.medicaid_id = MMT.medicaid_id)
            LEFT JOIN
            (
            SELECT TOP 1 medicaid_id, alt_address, alt_city, alt_state, alt_zip
            FROM MEM_ALT_ADDRESS
            WHERE medicaid_id = @medicaid_id
            ORDER BY add_date DESC
            ) ALT_ADRS ON (ALT_ADRS.medicaid_id = MMT.medicaid_id)
            WHERE MMT.medicaid_id = @medicaid_id `,

            alertList: `SELECT AL.[id]
            ,AL.[medicaid_id]
            ,AL.[alert_id]
            ,AL.[alert_type] as alert_type_id
            ,AL.[alert_status] as alert_status_id
            ,AL.[alert_assign_user]
            ,AL.[alert_note]
            ,AL.[due_date]
            ,AL.[created_date]				 
            ,MAS.alert_status
            ,A.alert
            ,A1.alert as alert_type
            ,U.FistName,U.member_role,U1.FistName as 'added_by'
        FROM MEM_ALERTLIST as AL
        LEFT JOIN MEM_ALERT_STATUS as MAS ON AL.[alert_status] = MAS.id
        LEFT JOIN MEM_ALERTS as A ON AL.alert_id = A.id
        LEFT JOIN MEM_ALERTS as A1 ON AL.[alert_type] = A1.id
        LEFT JOIN MEM_USERS AS U ON AL.[alert_assign_user] = U.ID
        LEFT JOIN MEM_USERS AS U1 ON AL.[added_by] = U1.ID
        WHERE AL.medicaid_id = @medicaid_id 
        ORDER BY AL.id DESC`,

            logDetails: `SELECT   L.[id]
            ,L.[medicaid_id]
            ,L.[log_name]
            ,L.[log_details]
            ,L.[log_status]
            ,L.[log_by]
            ,L.[add_date]
            ,L.[action_id]
            ,L.[action_type]
            ,concat(U.FistName,' ',U.lastName) as name
        FROM MEM_SYSTEM_LOG as L
        LEFT JOIN MEM_USERS as U ON (L.[log_by]=U.ID)
        WHERE L.[medicaid_id] =@medicaid_id
        ORDER BY L.[id] DESC`,
        hedisDetails: `SELECT  [year] AS Year ,[month] AS Month ,[AAB] ,[AAP-20 to 44] ,[AAP-45 to 64] ,[AAP-65 +] ,[AAP-Total] ,[ABA] ,[ADD-Initiation Phase] ,[ADV-11 to 14] 
		, [ADV-15 to 18] ,[ADV-19 to 20] ,[ADV-2 to 3] ,[ADV-4 to 6] ,[ADV-7 to 10] ,[ADV-Total] ,[AMM-Acute Phase] ,[AMM-Continuation Phase] 
		,[AMR-12 to 18 Ratio > 50%] ,[AMR-18 to 50 Ratio > 50%] ,[AMR-19 to 50 Ratio > 50%] ,[AMR-5 to 11 Ratio > 50%] ,[AMR-12 to 18 Exclusion] 
		,[AMR-19 to 20 Ratio > 50%] ,[AMR-2 to 4 Ratio > 50%] ,[AMR-19 to 50 Exclusion] ,[AMR-51 to 64 Exclusion] ,[AMR-51 to 64 Ratio > 50%] 
		,[AMR-Total 5 to 64 Exclusion] ,[AMR-5 to 11 Exclusion] ,[AMR-Total 2 to 20 Exclusion] ,[AMR-Total 2 to 20 Ratios > 50%] 
		,[AMR-Total 18 to 85 Ratio > 50%] ,[AMR-Total 5 to 64 Ratio > 50%] ,[AMR-Total 5 to 85 Ratio > 50%]  ,[APP-Age 12 to 17] ,[APP-Age 6 to 11] 
		,[APP-Total] ,[ART],[AWC]      ,[BCS]      ,[CAP-12 - 24 Mo]      ,[CAP-12 to 19]      ,[CAP-2 to 6]      ,[CAP-7 to 11]      ,[CAP-All Members]
      ,[CBP-Total],[CCS],[CDC-A1c Test],[CDC-A1c<=9],[CDC-A1c<7],[CDC-A1c<8],[CDC-A1c>9],[CDC-All],[CDC-BP<140/90],[CDC-Eye Exam],[CDC-Neph Attn],[CHL-16 to 20]
	  ,[CHL-21 to 24],[CHL-Total],[CIS-Combo 10],[CIS-Combo 2],[CIS-Combo 3],[CIS-Combo 4],[CIS-Combo 5],[CIS-Combo 6],[CIS-Combo 7],[CIS-Combo 8],[CIS-Combo 9]
	  ,[CIS-DTaP],[CIS-Hep A],[CIS-Hep B],[CIS-HiB],[CIS-Influenza],[CIS-L-Combo 10],[CIS-L-Combo 2],[CIS-L-Combo 3],[CIS-L-Combo 4],[CIS-L-Combo 5]
	  ,[CIS-L-Combo 6],[CIS-L-Combo 7],[CIS-L-Combo 8],[CIS-L-Combo 9],[CIS-L-DTaP],[CIS-L-Hep A],[CIS-L-Hep B],[CIS-L-HiB],[CIS-L-Influenza],[CIS-L-Lead]
	  ,[CIS-L-MMR],[CIS-L-PCV],[CIS-L-Polio],[CIS-L-Rotavirus],[CIS-L-Total],[CIS-L-VZV],[CIS-MMR],[CIS-PCV],[CIS-Polio],[CIS-Rotavirus],[CIS-VZV],[CPC],[CWP]
	  ,[FPC-0-20%],[FPC-21-40%],[FPC-41-60%],[FPC-61-80%],[FPC-81-100%],[FUA-30 Day Age 18+],[FUA-30 Day Total],[FUA-7 Day Age 18+],[FUA-7 Day Total]
	  ,[FUH-30 Days],[FUH-7 Days],[FUM-Total Ages 30 Day],[FUM-Total Ages 7 Day],[IET-Egmt 13-17],[IET-Egmt 18+],[IET-Egmt Total],[IET-Init 13-17],[IET-Init 18+]
	  ,[IET-Init Total]      ,[IMA-Combo 1]      ,[IMA-Combo 2]      ,[IMA-HPV Immunizations]      ,[IMA-Meningococcal]      ,[IMA-Tdap]      
	  ,[LBP-Imaging for Low Back Pain]      ,[LSC]      ,[MMA-12 to 18 50% Covered]      ,[MMA-12 to 18 75% Covered]      ,[MMA-18 to 50 50% Covered]      
	  ,[MMA-18 to 50 75% Covered]      ,[MMA-19 to 50 50% Covered]      ,[MMA-19 to 50 75% Covered]      ,[MMA-5 to 11 50% Covered]      
	  ,[MMA-5 to 11 75% Covered]      ,[MMA-12 to 18 Exclusion]      ,[MMA-19 to 20 50% Covered]      ,[MMA-19 to 20 75% Covered]      
	  ,[MMA-19 to 20 Exclusion]      ,[MMA-2 to 4 50% Covered]      ,[MMA-2 to 4 75% Covered]      ,[MMA-19 to 50 Exclusion]      ,[MMA-5 to 11 Exclusion]      
	  ,[MMA-51 to 64 50% Covered]      ,[MMA-51 to 64 75% Covered]      ,[MMA-51 to 64 Exclusion]      ,[MMA-Total 5 to 64 Exclusion]      
	  ,[MMA-2 to 4 Exclusion]      ,[MMA-Total 2 to 20 50% Covered]      ,[MMA-Total 2 to 20 75% Covered]      ,[MMA-Total 2 to 20 Exclusion]      
	  ,[MMA-Total 18 to 85 50% Covered]      ,[MMA-Total 18 to 85 75% Covered]      ,[MMA-Total 5 to 64 50% Covered]      ,[MMA-Total 5 to 64 75% Covered]      
	  ,[MMA-Total 5 to 85 50% Covered]      ,[MMA-Total 5 to 85 75% Covered]      ,[MPM-Combined Rate]      ,[MPM-Diuretics]     
	  ,[NCS-Non-Rec Cerv Cancer Scr Adol Females]      ,[PBH]      ,[PCE-Bronchodilators]      ,[PCE-Systemic Corticosteroids]      ,[PPC-All]      
	  ,[PPC-Postpartum]      ,[PPC-Prenatal]      ,[SAA-80% Coverage]      ,[SMD]      ,[SPC-Adherence Females]      ,[SPC-Adherence Males]     
	  ,[SPC-Statin Therapy Females]      ,[SPC-Statin Therapy Males]      ,[SPC-Total Adherence]      ,[SPC-Total Statin Therapy]      ,[SPD-Statin Adherence]      ,[SPD-Statin Therapy]      ,[SPR]      ,[SSD-Diab Screen]      ,[URI]      ,[W15-0 visits]      ,[W15-1 visit]      ,[W15-2 visits]      ,[W15-3 visits]      ,[W15-4 visits]      ,[W15-5 visits]      ,[W15-6 + visits]      ,[W34]      ,[WCC-All - Total]      ,[WCC-All 12 to 17]      ,[WCC-All 3 to 11]      ,[WCC-BMI 12 to 17]      ,[WCC-BMI 3 to 11]      ,[WCC-BMI Total]      ,[WCC-Nutrition 12 to 17]      ,[WCC-Nutrition 3 to 11]      ,[WCC-Nutrition Total]      ,[WCC-Phys Act 12 to 17]      ,[WCC-Phys Act 3 to 11]      ,[WCC-Phys Act Total]  ,[# Measures]      ,[# Compliant]      
	  ,alert_status.alert_status AS ActionStatus 

  FROM MEM_HEDIS_MEASURES_MAR2019_ACTIONABLE AS HEDIS 
  LEFT JOIN MEM_ALERTLIST AS ALERT ON(HEDIS.id=ALERT.hedis_id) 
  LEFT JOIN MEM_ALERT_STATUS AS ALERT_STATUS ON(ALERT.alert_status=ALERT_STATUS.id)
  WHERE [Medicaid ID]=@medicaid_id ORDER BY year DESC,month DESC `,
  altaddress: `SELECT A.* FROM(
SELECT   '' AS id,
    RECIP_NO AS medicaid_id,
    OTHER_ADDR1 AS alt_address,
    '' AS alt_city,
    '' AS alt_state,
    '' AS alt_zip,
    '' AS add_date,
    '' AS add_by,
    '' AS FirstName,
    '' AS LastName,
    '(ROSTER)' AS initial
FROM  MEM_MEMBERS
WHERE RECIP_NO = @medicaid_id
UNION ALL
SELECT AP.[id]
  ,AP.[medicaid_id]
  ,AP.[alt_address]
  ,AP.[alt_city]
  ,AP.[alt_state]
  ,AP.[alt_zip]
  ,CONVERT(VARCHAR, AP.[add_date], 101) AS add_date
  ,AP.[add_by]
  ,US.FistName, US.LastName, US.FistName as initial
FROM MEM_ALT_ADDRESS AS AP
JOIN MEM_USERS AS US ON (AP.add_by = US.ID) 
WHERE AP.medicaid_id = @medicaid_id) AS A 
ORDER BY id DESC`,
medicalClaim: `SELECT  M.MEM_NO,M.MEM_LOB,MC.DOCUMENT,MC.FIRST_DOS,MC.PRIMARY_DIAGNOSIS,RDC.CodeDesc ,CONCAT(PHY.TITLE,' ',PHY.FIRST_NAME,' ',PHY.LAST_NAME) as doctor_name
FROM MEM_MEMBERS AS M 
JOIN MASTER_CLAIM AS MC ON M.MEM_NO=MC.MEMBER 
LEFT JOIN MEM_PHYSICIAN AS PHY ON (MC.PROVIDER=PHY.PROVIDER_ID) 
LEFT JOIN REF_DIAGNOSISCODE AS RDC ON RDC.DiagnosisCode=MC.PRIMARY_DIAGNOSIS 
WHERE M.RECIP_NO=@medicaid_id 
ORDER BY MC.FIRST_DOS DESC`,
prismAlerts: `SELECT  [id],[parent_id],[alert],[status]
FROM MEM_ALERTS WHERE parent_id='0' ORDER BY [alert] ASC`,
prismAlertStatus: `SELECT  [id]
,[alert_id]
,[alert_status]
,[status]
FROM MEM_ALERT_STATUS 
where [status]=0`,
prismUsers: `SELECT  [ID],[initial],[FistName],[LastName],[EmailID],[member_role]
FROM MEM_USERS  ORDER BY [FistName] ASC`,
prismMasterLanguage: `SELECT  distinct [LANGUAGE_CD] ,[LANGUAGE_DESC] 
FROM [dm].[R_LANGUAGE]
order by [LANGUAGE_DESC]`,
prismPrismClaim: `SELECT  
[DOCUMENT]
,[LOB]
,[REGION]
,[CL_STATUS]
,convert(varchar,[FIRST_DOS],101) as FIRST_DOS
,[PRIMARY_DIAGNOSIS]
,[CLM_TYPE] 
,[INS_DT] 
,[PHYSICIAN]
,[CodeDesc]
,[claim_note]
,U.[FistName]
FROM [PRISM_CLAIM] as P
LEFT JOIN MEM_USERS as U ON P.[add_by]=U.ID
WHERE P.[medicaid_id] =@medicaid_id
ORDER BY convert(varchar,[FIRST_DOS],101) DESC`,
prismCrispInBound: `SELECT  
[SOURCE_PTCLASS]                         
,[EVENT]
,convert(varchar,[EVENT_TIME],101) as EVENT_TIME                         
,[PATIENT_COMPLAINT]                      
,[HOSPITAL_SERVICE]                       
,[PAST_EMERGENCY_VISITS]
,[PAST_INPATIENT_VISITS]                  
FROM  CRISP_INBOUND
WHERE [DEST_MRN]=@medicaid_id
ORDER BY [EVENT_TIME] DESC`,
prismRxClaims: `SELECT MeriClaim.[Rx number], NDC, [Drug name], [Service Date], [Store Name], [Pharmacy NPI Num]  
FROM MERIDIAN_RX_CLAIMS MeriClaim
WHERE MeriClaim.[Member ID] =@medicaid_id
ORDER BY [Service Date] DESC`,
prismRxClaimsNew: `SELECT MeriClaim.[Rx number] as Rx_number, NDC, [Drug name] as Drug_name, [Service Date] as Service_Date, [Store Name] as Store_Name, [Pharmacy NPI Num] as  Pharmacy_NPI_Num
FROM MERIDIAN_RX_CLAIMS MeriClaim
WHERE MeriClaim.[Member ID] =@medicaid_id
ORDER BY [Service Date] DESC`,
prismMemberPCPListOld: `SELECT distinct top 5  PHY.LAST_NAME,PHY.FIRST_NAME,PHY.PROVIDER_ID,max(MC.FIRST_DOS) as DOS,PHY.P_S_FLAG
,PHY.NPI_NUM,PHY.PRIMARY_SPECIALTY,S.SPEC_DESC
FROM MASTER_CLAIM MC WITH(NOLOCK) 
JOIN MEM_MEMBERS MEB WITH(NOLOCK) ON MC.MEMBER=MEB.MEM_NO  
JOIN MEM_PHYSICIAN PHY  ON (MC.PROVIDER=PHY.PROVIDER_ID AND MEB.MEM_LOB=PHY.LOB)
JOIN dm.[R_SPECIALTY] S  ON (PHY.PRIMARY_SPECIALTY=S.SPEC_CD)
WHERE (MC.CLM_TYPE='M') AND MEB.RECIP_NO=@medicaid_id
GROUP BY PHY.LAST_NAME,PHY.FIRST_NAME,PHY.PROVIDER_ID,PHY.P_S_FLAG,PHY.NPI_NUM, PHY.PRIMARY_SPECIALTY,S.SPEC_DESC
ORDER BY max(MC.FIRST_DOS) DESC`,
prismMemberPCPList: `SELECT DISTINCT
      [PROVIDER_ID]
      ,[PROVIDER_NAME]  
  FROM MEM_CIH_QUALITY WHERE MEDICAID_ID=@medicaid_id`,
prismPlanDetails: `SELECT P1.plan_name,PLANITEM.item_name 
,concat(U.FistName,' ',U.LastName) as assignto
,concat(U1.FistName,' ',U1.LastName) as assignby      
,convert(varchar,P.[added_on],101) as addeddate,P.id as item_plan_id
,P.[status] as item_status,R.ROLE_NAME as role,P.completed_date
        
FROM  MEMBER_PLAN as P 		 
left join  PLAN_ITEM as PLANITEM ON P.plan_item_id=PLANITEM.id
left join  PLANS as P1 ON P.plan_id=P1.id
left join  MEM_USERS as U ON P.assign_to=U.ID
left join  MEM_USERS as U1 ON P.assign_by=U1.ID
left join  MEM_ROLE as R ON U.role_id =R.ID
where P.[medicaid_id]=@medicaid_id
ORDER BY P.[added_on] ASC`,
prismCrispProblems: `SELECT [id], [medicaid_id], [Type], [Condition], [ICD9-CMCode], [ICD10-CMCode], 
[OnsetDates], [ConditionStatus], [W/UStatus], [Risk], [SNOMEDCode], 
[Notes], [status], [added_date]
FROM CRISP_PROBLEMS
WHERE [medicaid_id] = @medicaid_id`,
prismCrispEncounters: `SELECT [id]
,[medicaid_id]
,[Encounter]
,[Location]
,[Date]
,[Provider]
,[Diagnosis]
,[status]
,[added_date]
FROM CRISP_ENCOUNTERS
WHERE [medicaid_id] = @medicaid_id`,
prismMemberAction: `SELECT [id]
,[Panel_Name] 
,[Panel_Desc]
,[Panel_Order]
,[Inactive]
,[add_date]
FROM MEMBER_ACTION
WHERE [Inactive]='0' 
ORDER BY [Panel_Name] ASC`,
prismMemberAction: `SELECT [id]
,[Panel_Name] 
,[Panel_Desc]
,[Panel_Order]
,[Inactive]
,[add_date]
FROM MEMBER_ACTION
WHERE [Inactive]='0' 
ORDER BY [Panel_Name] ASC`,
prismMemberActionType: `SELECT [id]
,[action_type]
,[Inactive]
,[action_order]
,[add_date]
FROM MEM_MEMBER_PANEL_ACTION
WHERE [Inactive]='0'
ORDER BY [action_order] ASC`,
prismAlertMaster: `SELECT  [id],[parent_id],[alert],[status]
FROM MEM_ALERTS WHERE parent_id='0' AND status=0 ORDER BY [alert] ASC`,
prismMemberlastalert: `SELECT al.id,a.alert ,a1.alert as alert_type
,convert(varchar,LIST.[created_date],101) [created_date],LIST.alert_type as alert_type_id,al.alert_id
FROM
(SELECT max(id)	as id ,[medicaid_id],[alert_id]	
FROM MEM_ALERTLIST   
WHERE [medicaid_id]=@medicaid_id				  
GROUP BY [medicaid_id],[alert_id]) as al
LEFT JOIN MEM_ALERTS as a ON al.alert_id=a.id
JOIN MEM_ALERTLIST AS LIST ON (al.id = LIST.id AND LIST.[alert_status] IN('1','2','3'))
LEFT JOIN MEM_ALERTS as a1 ON LIST.[alert_type]=a1.id`,
prismMemberaltphone: ` SELECT A.* FROM(
                    SELECT   '' AS id,
                        RECIP_NO AS medicaid_id,
                        OTHER_PHONE  AS alt_phone_no,
                        '' AS add_date,
                        '' AS add_by,
                        '(ROSTER)' AS FistName,
                        '' AS LastName,
                        '' AS initial
                    FROM  MEM_MEMBERS
                    WHERE RECIP_NO = @medicaid_id  
                    UNION ALL
                    SELECT AP.[id]
                        ,AP.[medicaid_id]
                        ,AP.[alt_phone_no]
                        ,CONVERT(VARCHAR, AP.[add_date], 101) AS add_date
                        ,AP.[add_by]
                        ,US.FistName, US.LastName, US.initial
                    FROM MEM_ALT_PHONE AS AP 
                    JOIN MEM_USERS AS US ON (AP.add_by = US.ID) 
                    WHERE AP.medicaid_id = @medicaid_id) AS A 
                    ORDER BY id DESC`,
prismMemberaltlanguage: ` SELECT AP.[id]
,AP.[medicaid_id]
,AP.[alt_language]
,AP.[code]
,CONVERT(VARCHAR, AP.[add_date], 101) AS add_date
,AP.[add_by]
,US.FistName, US.LastName, US.initial
FROM MEM_ALT_LANGUAGE AS AP
JOIN MEM_USERS AS US ON (AP.add_by = US.ID) 
WHERE AP.medicaid_id = @medicaid_id ORDER BY AP.[id] DESC`,
prismMembershiprisk: ` SELECT [id]
,[medicaid_id]
,[added_by]
,[risk]
,[note]
,[add_date]
,[status]
FROM MEM_CM_MEMBERSHIP_RISK
WHERE medicaid_id =@medicaid_id`,
prismCrispImmunization: ` SELECT [id]
,[medicaid_id]
,[Vaccine]
,[Route]
,[AdministrationDate]
,[Status]
,[added_date]
FROM CRISP_IMMUNIZATIONS
WHERE [medicaid_id]=@medicaid_id`,
prismCrispMedication: ` SELECT [id]
,[medicaid_id]
,[Medication]
,[SIG]
,[Notes]
,[StartDate]
,[EndDate]
,[Status]
,[added_date]
FROM CRISP_MEDICATION
WHERE [medicaid_id]=@medicaid_id`,
prismCrispInsuranceProvider: ` SELECT [id]
,[medicaid_id]
,[PayerName]
,[PayerAddress]
,[PayerPhone]
,[InsuredName]
,[PatientRelationshiptoInsured]
,[CoverageStartDate]
,[CoverageEndDate]
,[SubscriberNumber]
,[GroupNumber]
,[status]
,[added_date]
FROM CRISP_INSURANCE_PROVIDERS
WHERE [medicaid_id]=@medicaid_id`,
prismCrispMedicationAdministered: ` SELECT  [id]
,[medicaid_id]
,[Medication]
,[Instructions]
,[DateofAdministration]
,[Dosage]
,[status]
,[added_date]
FROM CRISP_MEDICATIONS_ADMINISTERED
WHERE [medicaid_id]=@medicaid_id`,
prismCrispPlanofTreatment: ` SELECT  [id]
,[medicaid_id]
,[note]
,[status]
,[added_date]
FROM CRISP_PLANOFTREATMENT
WHERE [medicaid_id]=@medicaid_id`,
prismCrispSocialhistoryObservation: ` SELECT [id]
,[medicaid_id]
,[Observation]
,[Description]
,[Date]
,[status]
,[added_date]
FROM CRISP_SOCIAL_HISTORY_OBSERVATION 
WHERE [medicaid_id]=@medicaid_id`,
prismCrispSocialhistory: ` SELECT  [id]
,[medicaid_id]
,[Question]
,[Answer]
,[Notes]
,[status]
,[added_date]
FROM CRISP_SOCIAL_HISTORY
WHERE [medicaid_id]=@medicaid_id`,
prismGiftcard: ` SELECT  [ID]
,[MEDICAID_ID]
,[LAST_NAME]
,[FIRST_NAME]
,[COMPLETED_ACTIVITY]
,[DATE_OF_SERVICE]
,[INCENTIVE_AMOUNT_FOR_EVENT]
,[GIFT_CARD_TYPE]
,[GIFT_CARD_NO]      
FROM GIFT_CARD
WHERE [MEDICAID_ID]  = @medicaid_id ORDER BY [DATE_OF_SERVICE] DESC `,
prismMemberallergy: ` SELECT d.CodeDesc,[DOCUMENT]
,[LOB]
,[REGION]
,[CL_STATUS]
,[FIRST_DOS]
,[VENDOR]
,[CLM_TYPE] 
,[PRIMARY_DIAGNOSIS]
,mc.MEMBER 
FROM MEM_MEMBERS as m 
left join [MASTER_CLAIM] as mc ON m.MEM_NO=mc.MEMBER
join REF_DIAGNOSISCODE as d ON mc.PRIMARY_DIAGNOSIS=d.DiagnosisCode
where d.CodeDesc like 'ALLERGY%'
AND m.RECIP_NO=@medicaid_id `,
prismQualityList: ` SELECT A.SUB_MEASURE,A.MEASURE_NAME,A.PROCESS_STATUS,obs.*, CONVERT(VARCHAR,obs.Observation_Date,101) as ObservationDate
FROM(
SELECT DISTINCT  qua.SUB_MEASURE,qua.MEASURE_NAME,qua.PROCESS_STATUS
 FROM  MEM_MEMBERS AS m 
 LEFT JOIN MEM_CIH_QUALITY as qua ON(m.SUBSCRIBER_NUMBER  = qua.SUBSCRIBER_ID) 
 WHERE  m.RECIP_NO =@medicaid_id  AND NUMERATOR_GAP='0') AS A
LEFT JOIN MEM_GAP_OBSERVATION_DATA AS obs ON(A.SUB_MEASURE=obs.Gap_Code AND obs.[Type]='quality') `,
prismGapList: `SELECT A.DIAG_CODE,A.DIAG_DESC,A.PROCESS_STATUS,obs.* , CONVERT(VARCHAR,obs.Observation_Date,101) as ObservationDate
FROM(
SELECT DISTINCT  gap.DIAG_CODE,gap.DIAG_DESC,gap.PROCESS_STATUS
 FROM  MEM_MEMBERS AS m 
 LEFT JOIN MEM_RISK_GAP as gap ON(m.SUBSCRIBER_NUMBER  = gap.SUBSCRIBER_NUMBER) 
 WHERE  m.RECIP_NO =@medicaid_id) AS A
LEFT JOIN MEM_GAP_OBSERVATION_DATA AS obs ON(A.DIAG_CODE=obs.Gap_Code AND obs.[Type]='risk') `,
MemberactionType: ` SELECT [id] ,[action_type]  
FROM [MEM_MEMBER_PANEL_ACTION]
where [status] ='0'  `,
prismResultoutcome: ` SELECT [id]
,[engagement_method_id]
,[result]
,[status]
,[engaged_status]
FROM [MEM_ENGAGEMENT_REASON_RESULT] `,
memberActionList: ` SELECT ma.id, ma.action_type_source
      
      ,ma.action_date
      ,ma.action_time
      ,ma.action_status
      ,ma.add_date
      ,ma.add_by
	  ,ma.action_note
      ,ma.action_result_id
      ,p.action_type
	  ,ac.Panel_Name
	  ,ar.action_result
  FROM MEM_MEMBER_ACTION_FOLLOW_UP  AS ma LEFT JOIN MEM_MEMBER_PANEL_ACTION AS p ON(ma.panel_id = p.id)
  LEFT JOIN MEMBER_ACTION AS ac ON(ma.action_id = ac.id) 
  LEFT JOIN ACTION_FOLLOWUP_RESULT AS ar ON(ma.action_result_id = ar.id)
  WHERE ma.medicaid_id =@medicaid_id ORDER BY ma.action_date DESC`,
  // benefitsList: `  SELECT M.plan_name
  //       ,CONVERT(VARCHAR,M.start_date,101) as start_date
	//     ,CONVERT(VARCHAR,M.end_date,101) as end_date 
  //       ,MPD.plan_id
  //       ,MPD.file_name
  //   FROM MEM_PLAN_MEMBERS as PM
  //   LEFT JOIN MEM_PLAN_MASTER as M ON PM.plan_id=M.id
  //   LEFT JOIN MEM_PLAN_DOCUMENTS AS MPD ON PM.plan_id=MPD.plan_id AND MPD.status='0'
  //   WHERE PM.[medicaid_id]=@medicaid_id AND PM.status='0' `

        };

        // Run queries in parallel
        

const [memberDetails, alertList, logDetails, prismAlerts, prismAlertStatus, prismUsers, prismMemberAction, prismMemberActionType, prismAlertMaster, prismMemberlastalert, MemberactionType, prismQualityList, prismGapList, memberActionList, prismMemberaltphone, prismMemberPCPList, altaddress, prismMasterLanguage, prismMemberaltlanguage] = await Promise.all([
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.memberDetails),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.alertList),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.logDetails),
           // pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.hedisDetails),
           // pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.altaddress),
           // pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.medicalClaim),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismAlerts),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismAlertStatus),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismUsers),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMasterLanguage),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismPrismClaim),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispInBound),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismRxClaims),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismRxClaimsNew),            
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberPCPList),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismPlanDetails),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispProblems),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispEncounters),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberAction), 
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberActionType),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismAlertMaster),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberlastalert), 
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberaltphone), 
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberaltlanguage),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMembershiprisk),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispImmunization),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispMedication),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispInsuranceProvider),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispMedicationAdministered),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispPlanofTreatment),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispSocialhistoryObservation),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispSocialhistory),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismGiftcard),
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberallergy),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.MemberactionType),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismQualityList),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismGapList),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.memberActionList),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberaltphone),            
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberPCPList),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.altaddress),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMasterLanguage),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberaltlanguage)
            //pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.benefitsList)
            
        ]);

        // return {
        //     statusCode: 200,
        //     data: {
        //         memberDetails: memberDetails.recordset,
        //         alertList: alertList.recordset,
        //         logDetails: logDetails.recordset,
        //         //hedisDetails: hedisDetails.recordset,
        //         //altaddress: altaddress.recordset,
        //         //medicalClaim: medicalClaim.recordset,
        //         prismAlerts: prismAlerts.recordset,
        //         prismAlertStatus: prismAlertStatus.recordset,
        //         prismUsers: prismUsers.recordset,
        //         //prismMasterLanguage: prismMasterLanguage.recordset,
        //         //prismPrismClaim: prismPrismClaim.recordset,
        //         //prismCrispInBound: prismCrispInBound.recordset,
        //         //prismRxClaims: prismRxClaims.recordset,
        //         //prismRxClaimsNew: prismRxClaimsNew.recordset,
        //         //prismMemberPCPList: prismMemberPCPList.recordset,
        //         //prismPlanDetails: prismPlanDetails.recordset,
        //         //prismCrispProblems: prismCrispProblems.recordset,
        //         //prismCrispEncounters: prismCrispEncounters.recordset,
        //         prismMemberAction: prismMemberAction.recordset,
        //         prismMemberActionType: prismMemberActionType.recordset,
        //         prismAlertMaster: prismAlertMaster.recordset,
        //         prismMemberlastalert: prismMemberlastalert.recordset,                
        //         prismMemberaltphone: prismMemberaltphone.recordset,              
        //         //prismMemberaltlanguage: prismMemberaltlanguage.recordset,
        //         //prismMembershiprisk: prismMembershiprisk.recordset,
        //         //prismCrispImmunization: prismCrispImmunization.recordset,
        //         //prismCrispMedication: prismCrispMedication.recordset,
        //         //prismCrispInsuranceProvider: prismCrispInsuranceProvider.recordset,
        //         //prismCrispMedicationAdministered: prismCrispMedicationAdministered.recordset,
        //         //prismCrispPlanofTreatment: prismCrispPlanofTreatment.recordset,
        //         //prismCrispSocialhistoryObservation: prismCrispSocialhistoryObservation.recordset,
        //         //prismCrispSocialhistory: prismCrispSocialhistory.recordset,
        //         //prismGiftcard: prismGiftcard.recordset,
        //         //prismMemberallergy: prismMemberallergy.recordset,
        //         MemberactionType: MemberactionType.recordset,
        //         prismQualityList: prismQualityList.recordset,
        //         prismGapList: prismGapList.recordset,
        //         memberActionList: memberActionList.recordset,
        //         prismMemberPCPList: prismMemberPCPList.recordset,
        //         altaddress: altaddress.recordset,
        //         prismMasterLanguage: prismMasterLanguage.recordset,
        //         prismMemberaltlanguage: prismMemberaltlanguage.recordset
        //         //benefitsList: benefitsList.recordset
        //     }
        // };
        return buildResponse(200,{ data: { memberDetails: memberDetails.recordset,
          alertList: alertList.recordset,
          logDetails: logDetails.recordset,prismAlerts: prismAlerts.recordset,
          prismAlertStatus: prismAlertStatus.recordset,
          prismUsers: prismUsers.recordset,prismMemberAction: prismMemberAction.recordset,
          prismMemberActionType: prismMemberActionType.recordset,
          prismAlertMaster: prismAlertMaster.recordset,
          prismMemberlastalert: prismMemberlastalert.recordset,                
          prismMemberaltphone: prismMemberaltphone.recordset,MemberactionType: MemberactionType.recordset,
          prismQualityList: prismQualityList.recordset,
          prismGapList: prismGapList.recordset,
          memberActionList: memberActionList.recordset,
          prismMemberPCPList: prismMemberPCPList.recordset,
          altaddress: altaddress.recordset,
          prismMasterLanguage: prismMasterLanguage.recordset,
          prismMemberaltlanguage: prismMemberaltlanguage.recordset} },event);
 /*       const [memberDetails, alertList, logDetails, hedisDetails, altaddress, medicalClaim, prismAlerts, prismAlertStatus, prismUsers, prismMasterLanguage, prismPrismClaim, prismCrispInBound, prismRxClaims,prismRxClaimsNew, prismMemberPCPList, prismPlanDetails, prismCrispProblems, prismCrispEncounters, prismMemberAction, prismMemberActionType, prismAlertMaster, prismMemberlastalert, prismMemberaltphone, prismMemberaltlanguage,prismMembershiprisk,prismCrispImmunization,prismCrispMedication,prismCrispInsuranceProvider,prismCrispMedicationAdministered,prismCrispPlanofTreatment,prismCrispSocialhistoryObservation,prismCrispSocialhistory,prismGiftcard,prismMemberallergy,MemberactionType,prismResultoutcome] = await Promise.all([
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.memberDetails),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.alertList),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.logDetails),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.hedisDetails),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.altaddress),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.medicalClaim),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismAlerts),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismAlertStatus),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismUsers),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMasterLanguage),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismPrismClaim),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispInBound),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismRxClaims),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismRxClaimsNew),            
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberPCPList),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismPlanDetails),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispProblems),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispEncounters),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberAction), 
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberActionType),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismAlertMaster),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberlastalert), 
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberaltphone), 
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberaltlanguage),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMembershiprisk),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispImmunization),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispMedication),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispInsuranceProvider),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispMedicationAdministered),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispPlanofTreatment),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispSocialhistoryObservation),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCrispSocialhistory),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismGiftcard),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismMemberallergy),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.MemberactionType),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismResultoutcome)
        ]);

        return {
            statusCode: 200,
            data: {
                memberDetails: memberDetails.recordset,
                alertList: alertList.recordset,
                logDetails: logDetails.recordset,
                hedisDetails: hedisDetails.recordset,
                altaddress: altaddress.recordset,
                medicalClaim: medicalClaim.recordset,
                prismAlerts: prismAlerts.recordset,
                prismAlertStatus: prismAlertStatus.recordset,
                prismUsers: prismUsers.recordset,
                prismMasterLanguage: prismMasterLanguage.recordset,
                prismPrismClaim: prismPrismClaim.recordset,
                prismCrispInBound: prismCrispInBound.recordset,
                prismRxClaims: prismRxClaims.recordset,
                prismRxClaimsNew: prismRxClaimsNew.recordset,
                prismMemberPCPList: prismMemberPCPList.recordset,
                prismPlanDetails: prismPlanDetails.recordset,
                prismCrispProblems: prismCrispProblems.recordset,
                prismCrispEncounters: prismCrispEncounters.recordset,
                prismMemberAction: prismMemberAction.recordset,
                prismMemberActionType: prismMemberActionType.recordset,
                prismAlertMaster: prismAlertMaster.recordset,
                prismMemberlastalert: prismMemberlastalert.recordset,                
                prismMemberaltphone: prismMemberaltphone.recordset,              
                prismMemberaltlanguage: prismMemberaltlanguage.recordset,
                prismMembershiprisk: prismMembershiprisk.recordset,
                prismCrispImmunization: prismCrispImmunization.recordset,
                prismCrispMedication: prismCrispMedication.recordset,
                prismCrispInsuranceProvider: prismCrispInsuranceProvider.recordset,
                prismCrispMedicationAdministered: prismCrispMedicationAdministered.recordset,
                prismCrispPlanofTreatment: prismCrispPlanofTreatment.recordset,
                prismCrispSocialhistoryObservation: prismCrispSocialhistoryObservation.recordset,
                prismCrispSocialhistory: prismCrispSocialhistory.recordset,
                prismGiftcard: prismGiftcard.recordset,
                prismMemberallergy: prismMemberallergy.recordset,
                MemberactionType: MemberactionType.recordset,
                prismResultoutcome: prismResultoutcome.recordset
            }
        };*/        
    } catch (err) {
        console.error('Database connection error:', err);
        
        return buildResponse(500,{ message: "Internal Server Error" },event);
    }
};
