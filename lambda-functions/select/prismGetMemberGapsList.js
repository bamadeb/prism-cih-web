const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// const conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//     user: conn.dbuser,
//     password: conn.dbpassword,
//     server: conn.dbhost,
//     database: conn.dbname,
//     port: 1433,
//     pool: {
//         max: 10,
//         min: 1,
//         idleTimeoutMillis: 30000
//     },
//     options: {
//         encrypt: true,                // for Azure; keep as needed
//         trustServerCertificate: true // set appropriately for your environment
//     }
// };

// // Start connecting at module load time (during Lambda init)
// let connectionPoolPromise = sql.connect(config)
//     .then(pool => {
//         console.log('DB connection pool established during init.');
//         // Optional: attach error handler to the pool
//         pool.on('error', err => {
//             console.error('Pool error:', err);
//             // if you want to force recreate on error:
//             connectionPoolPromise = recreatePoolPromise();
//         });
//         return pool;
//     })
//     .catch(err => {
//         console.error('Initial pool creation failed:', err);
//         // Keep the rejected promise so handler can attempt recreate.
//         // Optionally replace with a recreated promise:
//         connectionPoolPromise = recreatePoolPromise();
//         return connectionPoolPromise;
//     });

// // Helper to recreate the pool if needed
// function recreatePoolPromise() {
//     console.log('Recreating DB connection pool...');
//     return sql.connect(config)
//         .then(pool => {
//             console.log('Recreated DB connection pool.');
//             pool.on('error', err => {
//                 console.error('Pool error:', err);
//                 connectionPoolPromise = recreatePoolPromise();
//             });
//             return pool;
//         })
//         .catch(err => {
//             console.error('Recreate pool failed:', err);
//             // Wait a bit before trying again to avoid tight loop (optional)
//             return new Promise((resolve, reject) => {
//                 setTimeout(() => {
//                     recreatePoolPromise().then(resolve).catch(reject);
//                 }, 2000);
//             });
//         });
// }

// Finding 3.1.2: returns a member's quality/risk gaps and activity history
// for any medicaid_id supplied, with no check that the caller is that
// member's assigned care coordinator.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
    }
    const body = JSON.parse(event.body || "{}");
    const medicaid_id = body.medicaid_id;
    const previousYear = body.previousYear;
    const currentYear = body.currentYear;

    if (!medicaid_id) {
        return buildResponse(400, { message: "medicaid_id is required" }, event);
    }

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { message: "Unauthorized" }, event);
    }

    try {
        // Await the pool promise (either initial or recreated)
      const  pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { message: "Unauthorized" }, event);
        }

        if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
            const assignmentLookup = await pool.request()
                .input('medicaid_id', sql.VarChar(20), medicaid_id)
                .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
            const member = assignmentLookup.recordset[0];
            if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
                return buildResponse(403, { message: "Forbidden" }, event);
            }
        }

        // Queries
        const queries = {
            prismQualityList: ` SELECT A.SUB_MEASURE,A.MEASURE_NAME,A.PROCESS_STATUS,obs.*, CONVERT(VARCHAR,obs.Observation_Date,101) as ObservationDate
FROM(
SELECT DISTINCT  qua.SUB_MEASURE,qua.MEASURE_NAME,qua.PROCESS_STATUS
 FROM MEM_CIH_QUALITY as qua
 LEFT JOIN  MEM_MEMBERS AS m  ON(qua.SUBSCRIBER_ID= m.SUBSCRIBER_NUMBER)
 WHERE  m.RECIP_NO = @medicaid_id) AS A
LEFT JOIN MEM_GAP_OBSERVATION_DATA AS obs ON(A.SUB_MEASURE=obs.Gap_Code AND obs.[Type]='quality' AND obs.is_deleted = 0 AND obs.medicaid_id = @medicaid_id)`,
            prismGapList: `SELECT 
                    A.ID,
                    A.DIAG_CODE,
                    A.DIAG_DESC,
                    A.PROCESS_STATUS,
                    CONVERT(VARCHAR, A.PLAN_YEAR, 101) AS PLAN_YEAR,
                    CONVERT(VARCHAR, A.RELEVANT_DATE, 101) AS RELEVANT_DATE,
                    A.HCC_CATEGORY,
                    A.HCC_MODEL,
                    obs.*,
                    CONVERT(VARCHAR, obs.Observation_Date, 101) AS ObservationDate
                FROM (
                    SELECT *
                    FROM (
                        SELECT  
                            gap.ID,
                            gap.DIAG_CODE,
                            gap.DIAG_DESC,
                            gap.PROCESS_STATUS,
                            gap.PLAN_YEAR,
                            gap.RELEVANT_DATE,
                            gap.HCC_CATEGORY,
                            gap.HCC_MODEL,
                            ROW_NUMBER() OVER (
                                PARTITION BY gap.DIAG_CODE
                                ORDER BY gap.RELEVANT_DATE DESC, gap.ID DESC
                            ) AS rn
                        FROM MEM_MEMBERS AS m
                        JOIN MEM_RISK_GAP AS gap 
                            ON m.SUBSCRIBER_NUMBER = gap.SUBSCRIBER_NUMBER
                        WHERE m.RECIP_NO = @medicaid_id
                    ) t
                    WHERE rn = 1
                ) AS A
                LEFT JOIN MEM_GAP_OBSERVATION_DATA AS obs 
                    ON A.DIAG_CODE = obs.Gap_Code
                    AND obs.[Type] = 'risk'
                    AND obs.is_deleted = 0
                    AND obs.medicaid_id = @medicaid_id`,
            prismCihPcrList: ` SELECT 
    [DISCHARGE_CC_DESC_1],
    [DISCHARGE_CC_DESC_2],
    [DISCHARGE_CC_DESC_3],
    [DISCH_ORDER],
	CASE 
        WHEN [INDEX_ADMIT_DT] = '1900-01-01' THEN '' 
        ELSE CONVERT(VARCHAR, [INDEX_ADMIT_DT], 101)
    END AS [INDEX_ADMIT_DT],
	CASE 
        WHEN [INDEX_DISCH_DT] = '1900-01-01' THEN '' 
        ELSE CONVERT(VARCHAR, [INDEX_DISCH_DT], 101)
    END AS [INDEX_DISCH_DT], 
    [INDEX_STAY],
    [NUMER],
    [READMISSION],
    CASE 
        WHEN [READMT_ADMIT_DT] = '1900-01-01' THEN '' 
        ELSE CONVERT(VARCHAR, [READMT_ADMIT_DT], 101)
    END AS [READMT_ADMIT_DT],

    CASE 
        WHEN [READMT_DISCH_DT] = '1900-01-01' THEN '' 
        ELSE CONVERT(VARCHAR, [READMT_DISCH_DT], 101)
    END AS [READMT_DISCH_DT]

FROM MEM_CIH_PCR_TEMP AS P
JOIN MEM_MEMBERS AS M ON P.MEMBERKEY = M.[SUBSCRIBER_NUMBER]
WHERE M.RECIP_NO = @medicaid_id `,
                prismActivityList: ` SELECT ma.[medicaid_id],
                        a.[Panel_Name],
                        CASE 
                            WHEN p.action_type = 'Call Received' THEN 'In-Bound Call'
                            WHEN p.action_type = 'Phone call' THEN 'Out-Bound Call'
                            WHEN p.action_type = 'Home visit' THEN 'Face-to-Face'
                            ELSE p.action_type
                        END AS action_type,
                        r.[action_result],
                        CONVERT(VARCHAR, ma.[action_date], 101) AS action_date,
                        ma.[action_status],
                        ma.[action_note],
                        CONCAT(u.FistName, ' ', u.LastName) AS username
                FROM MEM_MEMBER_ACTION_FOLLOW_UP AS ma
                LEFT JOIN ACTION_FOLLOWUP_RESULT AS r ON ma.action_result_id = r.id
                LEFT JOIN MEM_MEMBER_PANEL_ACTION AS p ON ma.panel_id = p.id
                LEFT JOIN MEMBER_ACTION AS a ON ma.action_id = a.id
                LEFT JOIN MEM_USERS AS u ON ma.add_by = u.ID
                WHERE ma.medicaid_id = @medicaid_id `

        };


        // Run queries in parallel using the same pool
        const [prismQualityList, prismGapList,prismCihPcrList,prismActivityList] = await Promise.all([
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismQualityList),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismGapList),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismCihPcrList),
            pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(queries.prismActivityList)
        ]);

        // return {
        //     statusCode: 200,
        //     data: {
        //         prismQualityList: prismQualityList.recordset,
        //         prismGapList: prismGapList.recordset,
        //         prismCihPcrList: prismCihPcrList.recordset
        //     }
        // };
        return buildResponse(200,{data: {
            prismQualityList: prismQualityList.recordset,
            prismGapList: prismGapList.recordset,
            prismCihPcrList: prismCihPcrList.recordset,
            prismActivityList: prismActivityList.recordset
        }},event);
    } catch (err) {
        console.error('Handler error:', err);
        // return {
        //     statusCode: 500,
        //     data: JSON.stringify({ error: "Internal Server Error", details: err.message }),
        // };
        return buildResponse(500,{ error: "", message: "Internal server error" },event);
    }
};
