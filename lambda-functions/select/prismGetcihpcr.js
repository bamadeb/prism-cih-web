const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

// Read-only counterpart of prismProcessPCRdataSessionId.js (already
// Admin-only). Query was already parameterized correctly; just had no
// auth check.
exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
      }
      const body = JSON.parse(event.body || "{}");
    const session_id = body.session_id;

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { message: "Unauthorized" }, event);
    }

    let pool;
    try {
        pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
            return buildResponse(403, { message: "Forbidden" }, event);
        }

        const result = await pool.request()
        .input('session_id', sql.VarChar, session_id)
        .query(`SELECT pt.[id] ,pt.[MEASURE_KEY] ,pt.[SUBMEASURE_KEY] ,pt.[MEMBER_NAME] ,pt.[AGE]
          ,CONVERT(VARCHAR,pt.BIRTH_DATE,101) AS BIRTH_DATE ,pt.[PHONE_NUMBER] ,pt.[ADDRESSLINE1] ,pt.[ADDRESSLINE2]
          ,pt.[CITY] ,pt.[STATECODE] ,pt.[ZIPCODE] ,pt.[PCP_ID] ,pt.[PCP_NPI] ,pt.[PCP_TIN] ,pt.[PCP_Name]
          ,pt.[PCP_GROUP] ,pt.[CLSSDT] ,pt.[DENOM] ,pt.[DISCHARGE_CC_DESC_1] ,pt.[DISCHARGE_CC_DESC_2]
          ,pt.[DISCHARGE_CC_DESC_3] ,pt.[DISCH_ORDER]
          ,CONVERT(VARCHAR,pt.INDEX_ADMIT_DT,101) AS INDEX_ADMIT_DT
          ,CONVERT(VARCHAR,pt.INDEX_DISCH_DT,101) AS INDEX_DISCH_DT
          ,pt.[INDEX_STAY] ,pt.[MEMBERKEY] ,pt.[NUMER] ,pt.[READMISSION]
          ,CONVERT(VARCHAR,pt.[READMT_ADMIT_DT],101) AS READMT_ADMIT_DT
          ,CONVERT(VARCHAR,pt.READMT_DISCH_DT,101) AS READMT_DISCH_DT
          ,pt.[INSERT_SESSION_ID] ,pt.[PROCESS_STATUS] ,CONVERT(VARCHAR,pt.ADDED_ON,101) AS ADDED_ON
          ,m.SUBSCRIBER_NUMBER AS member_exist ,p.[MEMBERKEY] AS pcr_exist
          FROM MEM_CIH_PCR_TEMP as pt
          LEFT JOIN ( SELECT DISTINCT MEMBERKEY, INDEX_ADMIT_DT, READMT_ADMIT_DT FROM MEM_CIH_PCR ) AS p
            ON pt.MEMBERKEY = p.MEMBERKEY AND ( (CAST(pt.INDEX_ADMIT_DT AS date) = CAST(p.INDEX_ADMIT_DT AS date) AND CAST(pt.INDEX_ADMIT_DT AS date) <> '1900-01-01' AND CAST(p.INDEX_ADMIT_DT AS date) <> '1900-01-01') OR (CAST(pt.READMT_ADMIT_DT AS date) = CAST(p.READMT_ADMIT_DT AS date) AND CAST(pt.READMT_ADMIT_DT AS date) <> '1900-01-01' AND CAST(p.READMT_ADMIT_DT AS date) <> '1900-01-01') )
          LEFT JOIN MEM_MEMBERS AS m ON pt.[MEMBERKEY] = m.SUBSCRIBER_NUMBER
          WHERE Pt.INSERT_SESSION_ID = @session_id`);
        return buildResponse(200,{data: result.recordset, totalRecords: result.recordset.length},event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ error: "", message: "Internal server error" },event);
    }
};
