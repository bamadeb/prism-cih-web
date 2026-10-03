const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// var conn = require('/opt/config.json')
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//     user: conn.dbuser, 
//     password: conn.dbpassword,
//     server: conn.dbhost,
//     database: conn.dbname,
//     port: 1433, 
//     options: {
//         encrypt: true, // Required for Azure SQL; set to false for on-premises
//         trustServerCertificate: true // Set true if using self-signed certificates
//     }
// };

// let poolPromise;

// async function getDBConnection() {
//     if (!poolPromise) {
//         poolPromise = sql.connect(config);
//     }
//     return poolPromise;
// }

// Query has a deliberate `@user_id = 0` branch meaning "every member" -- a
// security review confirmed any authenticated caller could pass user_id=0 and
// get the full 765-member roster (with PHI), or pass another navigator's
// user_id and get THEIR assigned list, since user_id was trusted straight
// from the request body with no check against the caller's own identity.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
	const body = JSON.parse(event.body || "{}");
    let user_id = body.user_id;
    let pool;
    try {
		if (event.httpMethod === "OPTIONS") {
            return buildResponse(200,{},event);

        }

        // API Gateway has a Cognito User Pool authorizer ("CognitoProd") in
        // front of sibling routes -- claims land in
        // event.requestContext.authorizer.claims; `sub` is the Cognito user's
        // UUID, stored in MEM_USERS.cognito_username.
        const claims = event.requestContext?.authorizer?.claims || {};
        const callerSub = claims.sub;
        if (!callerSub) {
            return buildResponse(401, { data: 'Unauthorized' }, event);
        }

        pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { data: 'Unauthorized' }, event);
        }

        // Only Admin may request another navigator's list or the user_id=0
        // "all members" view. Everyone else gets their own list regardless of
        // what user_id was supplied in the request -- this can't be bypassed
        // by sending a different value since it's overridden here, not just
        // validated.
        if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
            user_id = caller.ID;
        }

        const result = await pool.request()
            .input('user_id', sql.Int, user_id) // Ensure it's treated as a string
            .query(`WITH MemberActionFollowUp AS (
		SELECT 
			medicaid_id, 
			action_date,
			ROW_NUMBER() OVER (PARTITION BY medicaid_id ORDER BY action_date DESC) AS rn
		FROM MEM_MEMBER_ACTION_FOLLOW_UP
		WHERE action_status = 'Success'
	),
	TodoDates AS (
		SELECT 
			medicaid_id, 
			MIN(action_date) AS todo_date
		FROM MEM_MEMBER_ACTION_FOLLOW_UP
		WHERE action_status = 'Scheduled'
		  AND action_date >= CAST(GETDATE() AS DATE)
		GROUP BY medicaid_id
	),
	Appointment AS (
		SELECT 
			medicaid_id,
			MIN(CASE WHEN (appiontment_type IS NULL OR LTRIM(RTRIM(appiontment_type)) = '') THEN action_date END) AS appointment_date,
			MIN(CASE WHEN appiontment_type = 'rsvp' THEN action_date END) AS rsvp_appointment_date
		FROM MEM_SCHEDULE_APPOINTMENT_ACTION
		WHERE action_date BETWEEN '2014-04-15' AND '2026-10-15'
		GROUP BY medicaid_id
	),
	TaskAgg AS (
		SELECT 
			medicaid_id,
			COUNT(*) AS total_tasks,
			COUNT(CASE WHEN [status] IN ('Open', 'In-Process') THEN 1 END) AS open_tasks,
			MIN(CASE WHEN [status] IN ('Open', 'In-Process') THEN action_date END) AS upcoming_task_date,
			MAX(CASE WHEN [status] = 'Successful' THEN action_date END) AS last_success_date,
			MAX(CASE WHEN [status] IN ('Open','In-Process') AND action_date < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS has_overdue,
			MAX(CASE WHEN [status] IN ('Open','In-Process') AND action_date BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY,3,CAST(GETDATE() AS DATE)) THEN 1 ELSE 0 END) AS has_soon
		FROM MEM_TASK_FOLLOW_UP
		GROUP BY medicaid_id
	),
	RiskQualityAgg AS (
		SELECT 
			SUBSCRIBER_NUMBER,
			COUNT(DISTINCT DIAG_CODE) AS risk_gap_count,
			COUNT(DISTINCT CASE WHEN PROCESS_STATUS = 1 THEN DIAG_CODE END) AS risk_comp_count
		FROM MEM_RISK_GAP
		GROUP BY SUBSCRIBER_NUMBER
	),
	QualityAgg AS (
		SELECT 
			SUBSCRIBER_ID,
			COUNT(DISTINCT SUB_MEASURE) AS quality_count,
			COUNT(DISTINCT CASE WHEN PROCESS_STATUS = 1 THEN SUB_MEASURE END) AS quality_comp_count
		FROM MEM_CIH_QUALITY 
		GROUP BY SUBSCRIBER_ID
	),
	CallCountAgg AS (
		SELECT 
			medicaid_id,
			COUNT(*) AS Call_count
		FROM MEM_MEMBER_ACTION_FOLLOW_UP
		GROUP BY medicaid_id
	),
	LatestPCPVisit AS (
    SELECT
        MEDICAID_ID,
        MAX(VISIT_DATE) AS last_visit_date,
        MAX(CASE 
                WHEN YEAR(VISIT_DATE) = YEAR(GETDATE()) 
                THEN 1 
                ELSE 0 
            END) AS has_visit_current_year
    FROM MEM_MEMBER_PCP_VISIT
	WHERE YEAR(VISIT_DATE) = YEAR(GETDATE())
    GROUP BY MEDICAID_ID
),
LatestPCPVisitPre AS (
        SELECT
            MEDICAID_ID,
            MAX(VISIT_DATE) AS last_visit_date_previous_year,
            MAX(
                CASE
                    WHEN YEAR(VISIT_DATE) = YEAR(GETDATE()) - 1
                    THEN 1
                    ELSE 0
                END
            ) AS has_visit_previous_year
        FROM MEM_MEMBER_PCP_VISIT
		WHERE YEAR(VISIT_DATE) = YEAR(GETDATE()) - 1
        GROUP BY MEDICAID_ID
    )
	SELECT 
		MT.medicaid_id,
		M.FIRST_NAME,
		M.LAST_NAME,
		M.MEM_NO,
		CONVERT(VARCHAR,M.BIRTH,101) AS BIRTH,
		M.OTHER_ADDR1,
		APN.alt_phone_no AS latest_alt_phone,
		MAA.alt_address AS latest_alt_address,
		M.SEX,
		M.PCP_TAX_ID,
		M.OTHER_PHONE,
		M.PRIORITY_FLAG,
		CASE 
    WHEN lpv.has_visit_current_year = 1 THEN 1
    ELSE 0
END AS PCP_VISIT_FLAG,
CONVERT(VARCHAR(10), lpv.last_visit_date, 101) AS PCP_VISIT_DATE,
CASE 
    WHEN lpvPre.has_visit_previous_year = 1 THEN 1
    ELSE 0
END AS PCP_VISIT_PRE_FLAG,
CONVERT(VARCHAR(10), lpvPre.last_visit_date_previous_year, 101) AS PCP_VISIT_PRE_DATE,
		E.ELIG_EXP_DT,
		M.INS_DT,
		S.ADDR1, 
		S.CITY, 
		S.STATE, 
		S.ZIP, 
		S.HOME_PHONE,
		td.todo_date,
		CASE 
        WHEN MT.Care_Coordinator_id <> MT.Assign_Care_Coordinator_id 
            	THEN 1   -- or 'true'
        	ELSE 0       -- or 'false'
    	END AS transfer_flag,
		-- 🧮 RISK PERFORMANCE
		ISNULL(rg.risk_gap_count, 0) AS risk_gap_count,
		ISNULL(rg.risk_comp_count, 0) AS risk_comp_count,
		ISNULL(
			ROUND(
				CASE 
					WHEN rg.risk_gap_count = 0 THEN 0
					ELSE (CAST(rg.risk_comp_count AS FLOAT) / rg.risk_gap_count) * 100
				END, 2
			), 0
		) AS risk_perf,
		CASE
			WHEN rg.risk_gap_count = 0 THEN 'gray'
			WHEN (CAST(rg.risk_comp_count AS FLOAT) / rg.risk_gap_count) * 100 < 50 THEN 'red'
			WHEN (CAST(rg.risk_comp_count AS FLOAT) / rg.risk_gap_count) * 100 < 80 THEN '#FFAE42'
			ELSE 'green'
		END AS risk_perf_color,

		-- 🧮 QUALITY PERFORMANCE
		ISNULL(cq.quality_count, 0) AS quality_count,
		ISNULL(cq.quality_comp_count, 0) AS quality_comp_count,
		ISNULL(
			ROUND(
				CASE 
					WHEN cq.quality_count = 0 THEN 0
					ELSE (CAST(cq.quality_comp_count AS FLOAT) / cq.quality_count) * 100
				END, 2
			), 0
		) AS quality_perf,
		CASE
			WHEN cq.quality_count = 0 THEN 'gray'
			WHEN (CAST(cq.quality_comp_count AS FLOAT) / cq.quality_count) * 100 < 50 THEN 'red'
			WHEN (CAST(cq.quality_comp_count AS FLOAT) / cq.quality_count) * 100 < 80 THEN '#FFAE42'
			ELSE 'green'
		END AS quality_perf_color,

		

		-- 🧭 ACTION HISTORY
		mafData.action_date_1 AS last_action_date,
		mafData.action_date_2 AS second_last_action_date,
		mafData.action_date_3 AS third_last_action_date,
		DATEDIFF(DAY, mafData.action_date_3, mafData.action_date_2) AS diff_3_2,
		DATEDIFF(DAY, mafData.action_date_2, mafData.action_date_1) AS diff_2_1,

		-- 🧩 TASKS
		tf.total_tasks,
		CONVERT(varchar,tf.upcoming_task_date,101) AS upcoming_task_date,
		CASE
		   WHEN tf.has_overdue = 1 THEN 'red'
		   WHEN tf.has_soon = 1 THEN 'yellow'
		   WHEN tf.last_success_date IS NOT NULL THEN 'green'
		   ELSE 'gray'
		END AS task_color,
		ISNULL(cc.Call_count, 0) AS Call_count

	FROM MEM_OUTREACH_MEMBERS MT
	OUTER APPLY (
		SELECT TOP 1 alt_phone_no, id
		FROM MEM_ALT_PHONE
		WHERE medicaid_id = MT.medicaid_id
		ORDER BY id DESC
	) AS APN

	OUTER APPLY (
		SELECT TOP 1 alt_address, id
		FROM MEM_ALT_ADDRESS
		WHERE medicaid_id = MT.medicaid_id
		ORDER BY id DESC
	) AS MAA

	LEFT JOIN MEM_MEMBERS M 
		ON MT.medicaid_id = M.MEM_NO
	LEFT JOIN [dm].[SUBSCRIBERS] S 
		ON M.SUBSCRIBER_NUMBER = S.SUBSCRIBER_NUMBER
	LEFT JOIN TodoDates td 
		ON MT.medicaid_id = td.medicaid_id
	
	LEFT JOIN RiskQualityAgg rg 
		ON rg.SUBSCRIBER_NUMBER = M.SUBSCRIBER_NUMBER
	LEFT JOIN QualityAgg cq 
		ON cq.SUBSCRIBER_ID = M.SUBSCRIBER_NUMBER
	LEFT JOIN TaskAgg tf 
		ON tf.medicaid_id = MT.medicaid_id
	LEFT JOIN CallCountAgg cc 
		ON cc.medicaid_id = MT.medicaid_id 
	LEFT JOIN LatestPCPVisit lpv
		ON lpv.MEDICAID_ID = MT.medicaid_id
	LEFT JOIN LatestPCPVisitPre lpvPre
		ON lpvPre.MEDICAID_ID = MT.medicaid_id
	OUTER APPLY (
		SELECT 
			MAX(CASE WHEN rn = 1 THEN action_date END) AS action_date_1,
			MAX(CASE WHEN rn = 2 THEN action_date END) AS action_date_2,
			MAX(CASE WHEN rn = 3 THEN action_date END) AS action_date_3
		FROM MemberActionFollowUp maf
		WHERE maf.medicaid_id = MT.medicaid_id
	) AS mafData
	OUTER APPLY (
		SELECT TOP 1 
			TRY_CONVERT(date, ELIG_EXP_DT) AS ELIG_EXP_DT
		FROM [dm].[WD_ENROLLMENT]
		WHERE MEM_ID = M.MEM_NO
		ORDER BY ELIG_EXP_DT DESC
	) AS E
	WHERE (@user_id = 0 OR MT.Care_Coordinator_id = @user_id) AND (M.NO_LONGER_PATIENT_FLAG != 1 OR M.NO_LONGER_PATIENT_FLAG IS NULL)`);  // Correct usage of parameter

        // return {
        //     statusCode: 200,			
        //     data: result.recordset,
        // };
		return buildResponse(200,{data: result.recordset},event);

    } catch (err) {
        //console.error('Database connection error:', err);
        
		return buildResponse(401,{data: 'Interna server error.'},event);
    }
};

