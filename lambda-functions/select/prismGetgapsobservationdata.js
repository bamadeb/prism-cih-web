const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200, {}, event);
    }
    const body = JSON.parse(event.body || "{}");
    const start_date = body.start_date;
    const end_date   = body.end_date;
    const gaps_type  = body.gaps_type;
    const tin = body.tin || '';

    // This report is intentionally available to every authenticated user,
    // not just Admins -- confirmed as a business requirement. Still requires
    // a valid caller that exists in MEM_USERS (not just a valid JWT).
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
            .query('SELECT ID FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { message: "Unauthorized" }, event);
        }

        const request = pool.request();
        request.input('start_date', sql.Date, start_date);
        request.input('end_date', sql.Date, end_date);
        request.input('gaps_type', sql.VarChar(20), gaps_type);
        request.input('tin', sql.VarChar(50), tin);

        const query = `
IF (@gaps_type = 'risk')
BEGIN
    SELECT DISTINCT
          obs.id,
          obs.[medicaid_id],
          m.RECIP_NO,
          m.FIRST_NAME,
          m.LAST_NAME,
          m.MEDICARE_NO,
          CONVERT(VARCHAR, m.BIRTH, 101) AS BIRTH,
          obs.[Type],
          CASE
            WHEN obs.updated_date BETWEEN @start_date AND @end_date THEN 'MODIFIED'
            WHEN obs.added_date BETWEEN @start_date AND @end_date
                 AND (obs.updated_date NOT BETWEEN @start_date AND @end_date OR obs.updated_date IS NULL)
                 THEN 'NEW'
          END AS mode,
          obs.[Gap_Code],
          risk.DIAG_DESC AS MEASURE_DESC,
          risk.PROCESS_STATUS,
          risk.SUBSCRIBER_NUMBER,
          obs.[Observation_Date],
          CASE
              WHEN obs.Observation_Date = '1900-01-01' THEN ''
              ELSE CONVERT(VARCHAR, obs.Observation_Date, 101)
          END AS ObservationDate,
          obs.[Observation_Year],
          obs.[Observation_Code],
          obs.[CPT_Code_Modifier],
          obs.[Observation_Code_Set],
          obs.[Observation_Result],
          obs.[Service_Provider_NPI],
          obs.[Service_Provider_Taxonomy_Code],
          obs.[Service_Provider_Name],
          obs.[Service_Provider_Type],
          obs.[Service_Provider_RxProviderFlag],
          obs.[Provider_Group_NPI],
          obs.[Provider_Group_Taxonomy_Code],
          obs.[Provider_Group_Name],
          obs.[Source],
          obs.[added_date],
          obs.[updated_date],
          obs.[note],
          obs.[is_deleted],
          obs.[added_by]
    FROM MEM_GAP_OBSERVATION_DATA AS obs
    JOIN MEM_MEMBERS AS m
         ON obs.medicaid_id = m.RECIP_NO
    JOIN MEM_RISK_GAP AS risk
         ON risk.SUBSCRIBER_NUMBER = m.SUBSCRIBER_NUMBER
        AND risk.DIAG_CODE = obs.Gap_Code
        AND risk.PROCESS_STATUS = '1'
    WHERE obs.status = '0' AND obs.is_deleted = 0
      AND (
            obs.Observation_Date BETWEEN @start_date AND @end_date
          );
END
ELSE IF (@gaps_type = 'quality')
BEGIN
    SELECT DISTINCT
          obs.id,
          obs.[medicaid_id],
          m.RECIP_NO,
          m.FIRST_NAME,
          m.LAST_NAME,
          m.MEDICARE_NO,
          CONVERT(VARCHAR, m.BIRTH, 101) AS BIRTH,
          obs.[Type],
          CASE
            WHEN obs.updated_date BETWEEN @start_date AND @end_date THEN 'MODIFIED'
            WHEN obs.added_date BETWEEN @start_date AND @end_date
                 AND (obs.updated_date NOT BETWEEN @start_date AND @end_date OR obs.updated_date IS NULL)
                 THEN 'NEW'
          END AS mode,
          obs.[Gap_Code],
          quality.MEASURE_NAME AS MEASURE_DESC,
          quality.PROCESS_STATUS,
          quality.SUBSCRIBER_ID AS SUBSCRIBER_NUMBER,
          quality.PROVIDER_ID,
          qua.PROVIDER_NAME,
          obs.[Observation_Date],
          CASE
              WHEN obs.Observation_Date = '1900-01-01' THEN ''
              ELSE CONVERT(VARCHAR, obs.Observation_Date, 101)
          END AS ObservationDate,
          CASE
              WHEN obs.DOSThru = '1900-01-01' THEN ''
              ELSE CONVERT(VARCHAR, obs.DOSThru, 101)
          END AS DOSThru,
          obs.[Observation_Year],
          CASE
              WHEN obs.RxProviderFlag = '1' THEN 'YES'
			  WHEN obs.RxProviderFlag = '0' THEN 'NO'
              ELSE ''
          END AS RxProviderFlag,
		  CASE
              WHEN obs.PCPFlag = '1' THEN 'YES'
			  WHEN obs.PCPFlag = '0' THEN 'NO'
              ELSE ''
          END AS PCPFlag,
          obs.[Service_Provider_Taxonomy_Code],
          obs.[Service_Provider_Type],
          obs.[CPTPx]
		  ,obs.[HCPCSPx]
		  ,obs.[LOINC]
		  ,obs.[SNOMED]
		  ,obs.[ICDDX]
		  ,obs.[ICDDX10]
          ,obs.[ICDDX_2]
		  ,obs.[ICDDX10_2]
		  ,obs.[RxNorm]
		  ,obs.[CVX]
		  ,obs.[Modifier]
		  ,obs.[ReferenceID]
		  ,obs.[ICDPx]
          ,obs.[ICDPx10]
		  ,obs.[QuantityDispensed]
		  ,obs.[SuppSource]
		  ,obs.[Observation_Result]
          ,obs.[provider_id]
          ,obs.Result
		  ,obs.[LOINCAnswer],
          obs.[added_date],
          obs.[updated_date],
          obs.[note],
          obs.[is_deleted],
          obs.[added_by]
    FROM MEM_GAP_OBSERVATION_DATA AS obs
    JOIN MEM_MEMBERS AS m
         ON obs.medicaid_id = m.RECIP_NO
    JOIN MEM_CIH_QUALITY AS quality
         ON quality.SUBSCRIBER_ID = m.SUBSCRIBER_NUMBER
        AND quality.SUB_MEASURE = obs.Gap_Code
        AND quality.PROCESS_STATUS = '1'
        AND (@tin = '' OR obs.tin = @tin)

    OUTER APPLY
    (
        SELECT TOP 1
            q.PROVIDER_NAME
        FROM MEM_CIH_QUALITY AS q
        WHERE q.PROVIDER_ID = obs.provider_id
    ) AS qua

    WHERE obs.status = '0' AND obs.is_deleted = 0
      AND (
            obs.Observation_Date BETWEEN @start_date AND @end_date
          );
END
`;
        const result = await request.query(query);

        return buildResponse(200,{data: result.recordset},event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ message: "Internal Server Error" },event);
    }
};
