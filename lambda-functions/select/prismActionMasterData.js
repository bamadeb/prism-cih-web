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
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    // event.user_id ='1';
    // if (!event.user_id) {
    //     return {
    //         statusCode: 400,
    //         data: JSON.stringify({ error: "Missing user_id in request" }),
    //     };
    // }
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
      }
      const body = JSON.parse(event.body || "{}");
    let user_id = parseInt(body.user_id, 10);
    if (isNaN(user_id)) {
        // return {
        //     statusCode: 400,
        //     data: JSON.stringify({ error: "Invalid user_id format" }),
        // };
        return buildResponse(400,{error: "Invalid user_id format"},event);
    }

    // Finding: full workspace dashboard (members, alerts, tasks, referrals)
    // for ANY user_id with no check that it's the caller's own. Non-admins
    // are pinned to their own ID; Admins may view any navigator's dashboard.
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { error: 'Unauthorized' }, event);
    }

    let pool;
    try {
        pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { error: 'Unauthorized' }, event);
        }
        if (Number(caller.role_id) !== ADMIN_ROLE_ID && Number(user_id) !== Number(caller.ID)) {
            return buildResponse(403, { error: 'Forbidden' }, event);
        }

        // Define SQL queries
        const queries = {
            members: ` WITH MemberActionFollowUp AS (
                SELECT 
                    medicaid_id,
                    action_date,
                    action_status,
                    ROW_NUMBER() OVER (PARTITION BY medicaid_id ORDER BY action_date DESC) AS row_num
                FROM MEM_MEMBER_ACTION_FOLLOW_UP  WHERE action_status = 'Success' 
                ),
                TodoDates AS (
                    SELECT 
                        medicaid_id,
                        MIN(action_date) AS todo_date
                    FROM MEM_MEMBER_ACTION_FOLLOW_UP
                    WHERE action_status = 'Scheduled' 
                          AND action_date >= CAST(GETDATE() AS DATE) 
                    GROUP BY medicaid_id
                )
                SELECT 
                    MT.[medicaid_id],
                    M.FIRST_NAME,
                    M.LAST_NAME,
                    M.MEM_NO,
                    M.OTHER_PHONE,
                    M.PRIORITY_FLAG,
                    M.PCP_VISIT_FLAG,
					(SELECT top 1 convert(date,ELIG_EXP_DT, 101) AS ELIG_EXP_DT 
					FROM  [dm].[WD_ENROLLMENT] WHERE MEM_ID = M.MEM_NO 
					ORDER BY ELIG_EXP_DT DESC) AS ELIG_EXP_DT,
                    M.INS_DT,
                    S.ADDR1,
                    S.CITY,
                    S.STATE,
                    S.ZIP,
                    S.HOME_PHONE,
                    td.todo_date,
                    ISNULL(rg.risk_gap_count,0) AS risk_gap_count,
					ISNULL(rg.risk_comp_count,0)AS risk_comp_count,
					ISNULL(ROUND(CASE 
					WHEN rg.risk_gap_count = 0 THEN 0
						ELSE (CAST(rg.risk_comp_count AS FLOAT) / rg.risk_gap_count)*100
					END,2),0) AS risk_perf,
					CASE 
						WHEN rg.risk_gap_count = 0 THEN 'gray'  -- no denominator case
						WHEN (CAST(rg.risk_comp_count AS FLOAT) / rg.risk_gap_count) * 100 < 50 THEN 'red'
						WHEN (CAST(rg.risk_comp_count AS FLOAT) / rg.risk_gap_count) * 100 < 80 THEN '#FFAE42'
						ELSE 'green'
					END AS risk_perf_color,
                    ISNULL(cq.quality_count,0) AS quality_count,
					ISNULL(cq.quality_comp_count,0)AS quality_comp_count,
					ISNULL(ROUND(CASE 
					WHEN cq.quality_count = 0 THEN 0
						ELSE (CAST(cq.quality_comp_count AS FLOAT) / cq.quality_count)*100
					END,2),0) AS quality_perf,
					CASE 
						WHEN cq.quality_count = 0 THEN 'gray'  -- no denominator case
						WHEN (CAST(cq.quality_comp_count AS FLOAT) / cq.quality_count) * 100 < 50 THEN 'red'
						WHEN (CAST(cq.quality_comp_count AS FLOAT) / cq.quality_count) * 100 < 80 THEN '#FFAE42'
						ELSE 'green'
					END AS quality_perf_color,
                    (SELECT MIN([action_date]) 
                     FROM MEM_SCHEDULE_APPOINTMENT_ACTION 
                     WHERE medicaid_id = MT.medicaid_id 
                      AND appiontment_type is null
                       AND action_date BETWEEN '2014-04-15' AND '2025-10-15') AS appointment_date,
                    (SELECT MIN([action_date]) 
                     FROM MEM_SCHEDULE_APPOINTMENT_ACTION 
                     WHERE medicaid_id = MT.medicaid_id 
                        AND appiontment_type = 'rsvp'
                       AND action_date BETWEEN '2014-04-15' AND '2025-10-15') AS rsvp_appointment_date,
                    maf1.action_date AS last_action_date,
                    maf2.action_date AS second_last_action_date,
                    maf3.action_date AS third_last_action_date,
                    DATEDIFF(DAY, maf3.action_date, maf2.action_date) AS day_diff_between_3rd_and_2nd,
                    DATEDIFF(DAY, maf2.action_date, maf1.action_date) AS day_diff_between_2nd_and_1st,
                (SELECT COUNT(*) 
                 FROM MEM_MEMBER_ACTION_FOLLOW_UP 
                 WHERE medicaid_id = MT.medicaid_id) AS Call_count
                FROM MEM_OUTREACH_MEMBERS AS MT
                LEFT JOIN 
                    MEM_MEMBERS AS M ON MT.medicaid_id = M.RECIP_NO
                LEFT JOIN 
                    [dm].[SUBSCRIBERS] AS S ON M.SUBSCRIBER_NUMBER = S.SUBSCRIBER_NUMBER
                LEFT JOIN 
                    TodoDates td ON MT.medicaid_id = td.medicaid_id
                LEFT JOIN 
                    (SELECT medicaid_id, action_date, action_status
                     FROM MemberActionFollowUp 
                     WHERE row_num = 1) maf1 ON MT.medicaid_id = maf1.medicaid_id AND maf1.action_status = 'Success'
                LEFT JOIN 
                    (SELECT medicaid_id, action_date, action_status 
                     FROM MemberActionFollowUp 
                     WHERE row_num = 2) maf2 ON MT.medicaid_id = maf2.medicaid_id AND maf2.action_status = 'Success'
                LEFT JOIN (
                        SELECT SUBSCRIBER_NUMBER, COUNT(distinct DIAG_CODE) AS risk_gap_count,
						COUNT(DISTINCT CASE WHEN PROCESS_STATUS = 1 THEN DIAG_CODE END) AS risk_comp_count
                        FROM MEM_RISK_GAP
                        GROUP BY SUBSCRIBER_NUMBER
                    ) rg ON rg.SUBSCRIBER_NUMBER = M.SUBSCRIBER_NUMBER
                LEFT JOIN (
                        SELECT SUBSCRIBER_ID, COUNT(distinct SUB_MEASURE) AS quality_count,
						COUNT(DISTINCT CASE WHEN PROCESS_STATUS = 1 THEN SUB_MEASURE END) AS quality_comp_count
                        FROM MEM_CIH_QUALITY WHERE NUMERATOR_GAP = 0
                        GROUP BY SUBSCRIBER_ID
                    ) cq ON cq.SUBSCRIBER_ID = M.SUBSCRIBER_NUMBER
                LEFT JOIN 
                    (SELECT medicaid_id, action_date, action_status 
                     FROM MemberActionFollowUp 
                     WHERE row_num = 3) maf3 ON MT.medicaid_id = maf3.medicaid_id AND maf3.action_status = 'Success'
                WHERE MT.Care_Coordinator_id = @user_id `,
            alertCount: `SELECT A.id,A.alert,count(AL.id) AS alert_count  
            FROM MEM_ALERTS AS A 
            LEFT JOIN MEM_ALERTLIST AS AL ON(A.id=al.alert_id)
            JOIN MEM_OUTREACH_MEMBERS as MOM ON(AL.medicaid_id=MOM.medicaid_id)
            WHERE AL.alert_status IN ('1','2','3') AND A.parent_id = 0 
            AND MOM.Care_Coordinator_id = @user_id  
            GROUP BY A.id,A.alert ORDER BY count(AL.id) DESC`,
            alertList: `SELECT AL.medicaid_id,A.alert,A1.alert AS alert_type,MAS.alert_status,AL.due_date
            FROM MEM_ALERTS AS A 
            LEFT JOIN MEM_ALERTLIST AS AL ON(A.id=al.alert_id)
            JOIN MEM_OUTREACH_MEMBERS as MOM ON(AL.medicaid_id=MOM.medicaid_id)
            JOIN MEM_ALERT_STATUS AS MAS ON AL.alert_status=MAS.id
            LEFT JOIN MEM_ALERTS AS A1 ON AL.alert_type=A1.id
            WHERE AL.alert_status IN ('1','2','3') AND A.parent_id = 0 
            AND MOM.Care_Coordinator_id = @user_id `,
            recentActivity: `SELECT top 6 medicaid_id, log_name, log_details, add_date
                FROM MEM_SYSTEM_LOG
                WHERE log_by = @user_id
                ORDER BY add_date DESC `,
            kpisData: ` SELECT COUNT(A.medicaid_id) AS totalCount
            ,SUM(CASE  WHEN A.enrolledCnt > 0 THEN 1 ELSE 0 END) AS engagedCnt 
            ,(COUNT(A.medicaid_id)-SUM(CASE  WHEN A.enrolledCnt > 0 THEN 1 ELSE 0 END)) as enrolledCnt
            FROM
            (SELECT  mmt.[medicaid_id]
            ,(SELECT COUNT(act.id)
            FROM MEM_MEMBER_ACTION_FOLLOW_UP  as act 
			left join MEM_ENGAGEMENT_REASON_RESULT as res ON act.action_result_id=res.id AND res.engaged_status='10'
            WHERE medicaid_id=mmt.medicaid_id) as enrolledCnt			       
            FROM MEM_OUTREACH_MEMBERS as mmt
            WHERE mmt.Care_Coordinator_id= @user_id) as A `,
            taskList: ` SELECT f.[id]
            ,f.[medicaid_id]
            ,f.[action_id]
            ,f.[action_date]
            ,f.[assign_to]
            ,f.[action_note]
            ,f.[attachment]
            ,f.[status]
            ,f.[add_by]
            ,f.[add_date]
            ,CONVERT(varchar,f.[completed_date],101) as completed_date
            ,u.FistName
            ,u.LastName
            ,us.initial					  
        FROM MEM_TASK_FOLLOW_UP as f
        left join MEM_USERS as u ON (u.ID=f.assign_to)
        left join MEM_USERS as us ON (us.ID=f.add_by)
        where f.[add_by] = @user_id OR 
        f.[assign_to]	= @user_id			  
        ORDER BY f.[action_date] DESC `,
        referrerList: ` SELECT R.[medicaid_id]
        ,R.[referring_department]      
        ,R.[referring_reason]      
        ,R.[add_date]      
        ,R.[refer_id]
        ,R.[refer_by]
        ,concat(RU.FistName,' ',RU.LastName) as medical_user
        ,concat(U.FistName,' ',U.LastName) as user_name
    FROM MEM_REFERRING  as R
    left join MEM_USERS as RU on (R.refer_id=RU.ID)
    left join MEM_USERS as U on (R.refer_by=U.ID)
    where [refer_by]= @user_id ORDER BY R.[add_date] DESC `,
    transportList: ` SELECT SAA.[type],
    SAA.[method]      
    ,SAA.[action_date]
    ,SAA.[action_time]
    ,SAA.[status]
    ,SAA.[action_status]
    ,SAA.[place_of_appointment]
    ,SAA.[location_of_event]      
    ,SAA.[medicaid_id]
    ,M.FIRST_NAME
    ,M.LAST_NAME
    ,M.OTHER_PHONE
    ,S.ADDR1
    ,S.ADDR2
    ,S.HOME_PHONE
    ,ST.schedule_type
FROM MEM_SCHEDULE_APPOINTMENT_ACTION as SAA 
left join  MEM_MEMBERS as M on (SAA.medicaid_id=M.RECIP_NO)
left join  [dm].[SUBSCRIBERS] as S on (M.SUBSCRIBER_NUMBER=S.SUBSCRIBER_NUMBER)
left join  SCHEDULE_TYPE as ST on(SAA.method=ST.id)
where SAA.[added_by]= @user_id and SAA.[type]='3' AND SAA.action_date BETWEEN '2019-01-01' AND '2019-12-31'
order by SAA.id DESC `,
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
ORDER BY [action_type] ASC`,
prismRoleList: ` SELECT [ID]
,[ROLE_NAME]
,[SHORT_ORDER]
,[STATUS]
FROM MEM_ROLE
WHERE [ID] NOT IN('3','4','5','6','7','8','9')
ORDER BY [ROLE_NAME] `,
prismPlanlist: ` SELECT [id] ,[plan_name] ,[status] ,[added_date] 
FROM PLANS WHERE status=0 ORDER BY plan_name ASC `,
prismWorkspacekpi: ` 
SELECT 
    COUNT(CASE WHEN e2.id IS NOT NULL THEN 1 END) AS called,
    COUNT(CASE WHEN e1.id IS NOT NULL THEN 1 END) AS reached,
    COUNT(CASE WHEN e.id IS NOT NULL THEN 1 END) AS engaged,
    'LAST 60 DAYS' AS period
FROM MEM_MEMBER_ACTION_FOLLOW_UP m
LEFT JOIN MEM_ENGAGEMENT_REASON_RESULT e ON m.action_result_id = e.id AND e.engaged_status = '10'
LEFT JOIN MEM_ENGAGEMENT_REASON_RESULT e1 ON m.action_result_id = e1.id AND e1.engaged_status = '11'
LEFT JOIN MEM_ENGAGEMENT_REASON_RESULT e2 ON m.action_result_id = e2.id
WHERE m.add_by = @user_id 
AND m.action_date BETWEEN DATEADD(DAY, -60, CAST(GETDATE() AS DATE)) AND CAST(GETDATE() AS DATE)

UNION ALL

SELECT 
    COUNT(CASE WHEN e2.id IS NOT NULL THEN 1 END) AS called,
    COUNT(CASE WHEN e1.id IS NOT NULL THEN 1 END) AS reached,
    COUNT(CASE WHEN e.id IS NOT NULL THEN 1 END) AS engaged,
    'LAST 30 DAYS' AS period
FROM MEM_MEMBER_ACTION_FOLLOW_UP m
LEFT JOIN MEM_ENGAGEMENT_REASON_RESULT e ON m.action_result_id = e.id AND e.engaged_status = '10'
LEFT JOIN MEM_ENGAGEMENT_REASON_RESULT e1 ON m.action_result_id = e1.id AND e1.engaged_status = '11'
LEFT JOIN MEM_ENGAGEMENT_REASON_RESULT e2 ON m.action_result_id = e2.id
WHERE m.add_by = @user_id 
AND m.action_date BETWEEN DATEADD(DAY, -30, CAST(GETDATE() AS DATE)) AND CAST(GETDATE() AS DATE)
  
 UNION ALL
 SELECT 
    COUNT(CASE WHEN e2.id IS NOT NULL THEN 1 END) AS called,
    COUNT(CASE WHEN e1.id IS NOT NULL THEN 1 END) AS reached,
    COUNT(CASE WHEN e.id IS NOT NULL THEN 1 END) AS engaged,
    'CURRENT WEEK' AS period
    FROM MEM_MEMBER_ACTION_FOLLOW_UP m
    LEFT JOIN MEM_ENGAGEMENT_REASON_RESULT e ON m.action_result_id = e.id AND e.engaged_status = '10'
    LEFT JOIN MEM_ENGAGEMENT_REASON_RESULT e1 ON m.action_result_id = e1.id AND e1.engaged_status = '11'
    LEFT JOIN MEM_ENGAGEMENT_REASON_RESULT e2 ON m.action_result_id = e2.id
WHERE m.[add_by] = @user_id  
  AND m.[action_date] BETWEEN 
      DATEADD(DAY, 1 - DATEPART(WEEKDAY, GETDATE()), CAST(GETDATE() AS DATE))  
      AND 
      DATEADD(DAY, 7 - DATEPART(WEEKDAY, GETDATE()), CAST(GETDATE() AS DATE)); `

        };
        // Run queries in parallel        

const [members, alertCount, alertList, recentActivity,kpisData,taskList,referrerList,transportList,prismMemberAction,prismMemberActionType,prismRoleList,prismPlanlist,prismWorkspacekpi] = await Promise.all([
            pool.request().input('user_id', sql.Int, user_id).query(queries.members),
            pool.request().input('user_id', sql.Int, user_id).query(queries.alertCount),
            pool.request().input('user_id', sql.Int, user_id).query(queries.alertList),
            pool.request().input('user_id', sql.Int, user_id).query(queries.recentActivity),
            pool.request().input('user_id', sql.Int, user_id).query(queries.kpisData),
            pool.request().input('user_id', sql.Int, user_id).query(queries.taskList),
            pool.request().input('user_id', sql.Int, user_id).query(queries.referrerList),
            pool.request().input('user_id', sql.Int, user_id).query(queries.transportList),
            pool.request().input('user_id', sql.Int, user_id).query(queries.prismMemberAction),
            pool.request().input('user_id', sql.Int, user_id).query(queries.prismMemberActionType),
            pool.request().input('user_id', sql.Int, user_id).query(queries.prismRoleList),
            pool.request().input('user_id', sql.Int, user_id).query(queries.prismPlanlist),
            pool.request().input('user_id', sql.Int, user_id).query(queries.prismWorkspacekpi)
            
        ]);

        // return {
        //     statusCode: 200,
        //     data: {
        //         members: members.recordset,
        //         alertCount: alertCount.recordset,
        //         alertList: alertList.recordset,
        //         recentActivity: recentActivity.recordset,
        //         kpisData: kpisData.recordset,
        //         taskList: taskList.recordset,
        //         referrerList: referrerList.recordset,
        //         transportList: transportList.recordset,
        //         prismMemberAction: prismMemberAction.recordset,
        //         prismMemberActionType: prismMemberActionType.recordset,
        //         prismRoleList: prismRoleList.recordset,
        //         prismPlanlist: prismPlanlist.recordset,
        //         prismWorkspacekpi: prismWorkspacekpi.recordset
        //     }
        // };
        return buildResponse(200,{data: {
            members: members.recordset,
            alertCount: alertCount.recordset,
            alertList: alertList.recordset,
            recentActivity: recentActivity.recordset,
            kpisData: kpisData.recordset,
            taskList: taskList.recordset,
            referrerList: referrerList.recordset,
            transportList: transportList.recordset,
            prismMemberAction: prismMemberAction.recordset,
            prismMemberActionType: prismMemberActionType.recordset,
            prismRoleList: prismRoleList.recordset,
            prismPlanlist: prismPlanlist.recordset,
            prismWorkspacekpi: prismWorkspacekpi.recordset
        }},event);
    } catch (err) {
        console.error('Database connection error:', err);
        // return {
        //     statusCode: 500,
        //     data: JSON.stringify({ error: "Internal Server Error", details: err.message }),
        // };
        return buildResponse(200,{error: "Internal Server Error"},event);
    }
};
