const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// var conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//     user: conn.dbuser, 
//     password: conn.dbpassword,
//     server: conn.dbhost,
//     database: conn.dbname,
//     port: 1433, 
//     options: {
//         encrypt: true,
//         trustServerCertificate: true
//     }
// };

// let poolPromise;

// async function getDBConnection() {
//     if (!poolPromise) {
//         poolPromise = sql.connect(config);
//     }
//     return poolPromise;
// }

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
   // event.medicaid_id = '23146459'
   if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
    }
    const body = JSON.parse(event.body || "{}");
    let medicaid_id = body.medicaid_id;

    // if (isNaN(medicaid_id)) {
    //     return {
    //         statusCode: medicaid_id,
    //         data: JSON.stringify({ error: "Invalid medicaid_id format" }),
    //     };
    // }

    // Finding: this returns member PHI (demographics, claims/billing/diagnosis
    // data) for ANY medicaid_id with no check that the caller is that
    // member's assigned care coordinator. Admin bypasses, same pattern as the
    // rest of the member-detail cluster (e.g. prismUpdatePlanyearForRiskgap.js).
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
                .input('medicaid_id', sql.VarChar, String(medicaid_id))
                .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
            const member = assignmentLookup.recordset[0];
            if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
                return buildResponse(403, { message: 'Forbidden' }, event);
            }
        }

        // Define SQL queries
        const queries = {
            member_details: ` SELECT m.[MEM_NO]
                            ,m.[SUBSCRIBER_NUMBER]      
                            ,m.[LAST_NAME]
                            ,m.[FIRST_NAME]  
                            ,m.[SEX]      
                            ,m.[CASE_NO]
                            ,m.[RECIP_NO]
                            ,S.ADDR1
                            ,S.CITY
                            ,S.STATE
                            ,S.ZIP
                            ,m.BIRTH
                            ,m.INS_DT
                            ,S.HOME_PHONE
                            , CONCAT(P.FIRST_NAME, ' ', P.LAST_NAME) AS PHYSICIAN,P.PRIMARY_BUSINESS_ADDR1,P.NPI_NUM
                            ,L.LANGUAGE_DESC
                            ,u.EmailID
                            ,u.profile_image
                        FROM [MEM_MEMBERS] as m
                        left join [dm].[SUBSCRIBERS] as S ON m.SUBSCRIBER_NUMBER=S.SUBSCRIBER_NUMBER
                        left join [MEM_USERS] as u ON m.RECIP_NO=u.medicaid_id
                        LEFT JOIN [MEM_PHYSICIAN] AS P ON (m.PHYSICIAN = P.PROVIDER_ID AND m.MEM_LOB = P.LOB)
                        LEFT JOIN [dm].[R_LANGUAGE] L ON m.PRIMARY_LANG=L.LANGUAGE_CD
                        where m.[RECIP_NO] =@medicaid_id `,
            roadmap_member_log: ` SELECT [id]
                        ,[medicaid_id]
                        ,[log_name]
                        ,[log_details]
                        ,[log_status]
                        ,[log_by]
                        ,[add_date]
                        ,[action_id]
                        ,[action_type]
                        ,[alert_status_id]
                        ,[alert_status]
                        ,[roadmap_flag]
                    FROM MEM_SYSTEM_LOG 
                    WHERE roadmap_flag=1  
                    AND [medicaid_id] =@medicaid_id
                    ORDER BY add_date DESC `,
        claim_details: ` SELECT top 15 A.DOCUMENT,convert(varchar,A.FIRST_DOS,101) as FIRST_DOS,A.Provider,A.CLM_TYPE,A.BILL_AMT,A.TOTAL_PAY_AMT,A.CL_STATUS,A.[desc],A.PRIMARY_DIAGNOSIS
                        FROM(
                        SELECT DISTINCT MC.DOCUMENT,MC.FIRST_DOS,CONCAT(P.FIRST_NAME,' ',P.LAST_NAME) AS 'Provider',MC.CLM_TYPE ,MC.BILL_AMT,MC.TOTAL_PAY_AMT,MC.CL_STATUS,MCD.PL_CODE,MC.TYPE_BILL,p.P_S_FLAG,CC.[desc],MC.PRIMARY_DIAGNOSIS
                            
                        FROM [MEM_MEMBERS] as M
                        LEFT JOIN [dm].[MASTER_CLAIM] AS MC ON  M.MEM_NO=MC.MEMBER
                        LEFT JOIN [MEM_PHYSICIAN] AS P ON (MC.PROVIDER=P.PROVIDER_ID)
                        JOIN [dm].[MASTER_CLAIM_DETAIL] MCD ON MC.DOCUMENT=MCD.DOCUMENT
                        LEFT JOIN CLAIM_TYPE_CODE AS CC ON MC.CLM_TYPE=CC.code
                        WHERE   M.RECIP_NO = @medicaid_id ) AS A 
                        ORDER BY A.FIRST_DOS DESC `,
        log_type_list: `  SELECT DISTINCT action_type 
                            FROM MEM_SYSTEM_LOG 
                            WHERE  [medicaid_id] = @medicaid_id
                            ORDER BY action_type ASC ` 
        };
        // Run queries in parallel        

const [member_details,roadmap_member_log,claim_details,log_type_list] = await Promise.all([
             pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.member_details),
             pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.roadmap_member_log),
             pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.claim_details),
             pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.log_type_list)
        ]);

        // return {
        //     statusCode: 200,
        //     data: {
        //         member_details: member_details.recordset,
        //         roadmap_member_log: roadmap_member_log.recordset,
        //         claim_details: claim_details.recordset,
        //         log_type_list: log_type_list.recordset 
        //     }
        // };
        return buildResponse(200,{data: {
            member_details: member_details.recordset,
            roadmap_member_log: roadmap_member_log.recordset,
            claim_details: claim_details.recordset,
            log_type_list: log_type_list.recordset 
        }},event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ message: "Internal server error" },event);
    }
};
