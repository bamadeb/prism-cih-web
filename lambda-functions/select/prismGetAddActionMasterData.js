const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    const body = JSON.parse(event.body || "{}");
    const medicaid_id = body.medicaid_id;
    let pool;
    try {
        if (event.httpMethod === "OPTIONS") {
            return buildResponse(200, {}, event);
        }

        // Finding: no check that the caller is even a known logged-in user.
        // This endpoint bundles mostly non-sensitive master/reference lists
        // (roles, measure codes, vendor lists, etc.) with one member-specific
        // query (starperformanceList) -- requiring auth for the whole call,
        // and additionally checking ownership just for that one piece so a
        // non-admin can't read another member's star performance data via it.
        const claims = event.requestContext?.authorizer?.claims || {};
        const callerSub = claims.sub;
        if (!callerSub) {
            return buildResponse(401, { message: "Unauthorized" }, event);
        }

        pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { message: "Unauthorized" }, event);
        }

        let allowStarPerformance = Number(caller.role_id) === ADMIN_ROLE_ID || !medicaid_id;
        if (!allowStarPerformance) {
            const assignmentLookup = await pool.request()
                .input('medicaid_id', sql.VarChar, medicaid_id)
                .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
            const member = assignmentLookup.recordset[0];
            allowStarPerformance = !!member && Number(member.Care_Coordinator_id) === Number(caller.ID);
        }

        // Define SQL queries
        const queries = {
            actionActivityCategory: `SELECT [id]
            ,[Panel_Name]
            ,[Panel_Desc]
            ,[Panel_Order]
            ,[Inactive]
            ,[add_date]
            FROM MEMBER_ACTION
            WHERE [Inactive]='0'
            ORDER BY [Panel_Name] ASC`,
            actionActivityType: `SELECT
            [id],
            CASE
                WHEN [action_type] = 'Call Received' THEN 'In-Bound Call'
                WHEN [action_type] = 'Phone call' THEN 'Out-Bound Call'
                WHEN [action_type] = 'Home visit' THEN 'Face-to-Face'
                ELSE [action_type]
            END AS action_type,
            [Inactive],
            [action_order],
            [add_date]
        FROM MEM_MEMBER_PANEL_ACTION
        WHERE [Inactive] = '0'
        ORDER BY [action_order] ASC`,
            navigatorList: `SELECT [ID]
            ,[FistName]
            ,[LastName]
            FROM MEM_USERS
            WHERE role_id= 9 AND member_status = 0
            ORDER BY [FistName],[LastName]`,
            usersList: `SELECT  U.[ID],[initial],[FistName],[LastName]
                ,[EmailID],[member_role],member_status,role_id,R.ROLE_NAME
                ,CASE WHEN member_status=0 THEN 'Active' ELSE 'Inactive' END as status
            FROM MEM_USERS AS U
            LEFT JOIN MEM_ROLE AS R ON U.role_id=R.ID
            WHERE U.role_id NOT IN(7,20) AND member_status='0'
            ORDER BY U.role_id ASC`,
            allusersList: `SELECT  U.[ID],[initial],[FistName],[LastName]
                ,[EmailID],[member_role],member_status,role_id,R.ROLE_NAME
                ,CASE WHEN member_status=0 THEN 'Active' ELSE 'Inactive' END as status
            FROM MEM_USERS AS U
            LEFT JOIN MEM_ROLE AS R ON U.role_id=R.ID
            WHERE member_status='0'
            ORDER BY U.role_id ASC`,
            starperformanceList: `SELECT
                sm.MEASURE_CODE,   cq.SUB_MEASURE  ,
                m.PCP_TAX_ID,
                m.RECIP_NO,
                cq.NUMERATOR_GAP,
                CONVERT(VARCHAR,cq.ADDED_DATE,101) AS ADDED_DATE,
                cq.PROCESS_STATUS,'FILE' AS TYPE
            FROM MEM_CIH_QUALITY cq
            LEFT JOIN MEM_STAR_MEASURE_MASTER sm ON cq.SUB_MEASURE = sm.MEASURE_CODE
            LEFT JOIN MEM_MEMBERS m ON cq.MEDICAID_ID = m.RECIP_NO
            WHERE m.RECIP_NO= @medicaid_id UNION ALL    SELECT ''
                ,[MEASURE]
                ,[PCP_TAX_ID]
                ,[MEDICAID_ID]
                ,[NUM_COUNT]
                ,CONVERT(VARCHAR,ADDED_DATE,101) AS ADDED_DATE
                ,''
                ,'PRISM' AS TYPE
            FROM MEM_STAR_PERFORMANCE_PRISM_DATA
            WHERE [MEDICAID_ID]= @medicaid_id`,
            measureList: ` SELECT [ID]
                    ,[PART]
                    ,[MEASURE_CODE]
                    ,[MEASURE_CODE_DISPLAY]
                    ,[MEASURE_CODE_DETAILS]
                    ,[CMS_WEIGHT]
                    ,[DISPLAY_ORDER]
                    ,[2STAR_CUTUP]
                    ,[3STAR_CUTUP]
                    ,[4STAR_CUTUP]
                    ,[5STAR_CUTUP]
                    ,[BG_COLOR]
                    ,[status]
                FROM MEM_STAR_MEASURE_MASTER
                ORDER BY [MEASURE_CODE] ASC`,
            pcpType: ` SELECT [ID]
                    ,[PCP_TYPE]
                    ,[STATUS]
                FROM MST_PCP_TYPE
                WHERE [STATUS]='0'`,
            vendorList: ` SELECT distinct [VENDOR_NUM]
                    ,[LAST_NAME]
                    ,[ABBR]
                FROM dm.[VENDOR]
                WHERE [ROW_STATUS_CD] ='0'`,
            vendorPlanList: ` SELECT distinct [PLANS]
                    FROM dm.VENDOR
                    WHERE [PLANS] IS NOT NULL`,
            appointTypeList: `SELECT [id]
                        ,[type]
                        ,[status]
                    FROM APPOINTMENT_TYPE
                    WHERE [status] =0` ,
            roles: ` SELECT [ID]
                    ,[ROLE_NAME]
                    ,[SHORT_ORDER]
                    ,[STATUS]
                    ,[NEW_STATUS]
                FROM [MEM_ROLE]
                WHERE [NEW_STATUS] ='0' AND [ID] != 7 `,
            hspcsList: ` SELECT TOP 1000 [category],[subcategory],[HCPCS_Code]   FROM HCPCS`,
            cptList: ` SELECT [code],[label] FROM CPTCode`,
            taxonomyList: ` SELECT [id]
                        ,[provider_specialty]
                        ,[code]
                        ,[status]
                    FROM Provider_Taxonomy_Code
                    WHERE [status]='0' `,
            serviceProviderTypeList: ` SELECT [id]
                    ,[name]
                    ,[type]
                    ,[status]
                FROM SERVICE_PROVIDER_TYPE
                WHERE [status]='0'`,
            icdList: ` SELECT TOP 1000 [code],[label] FROM ICD10Code`
        };

        const starperformanceQuery = allowStarPerformance
            ? pool.request().input('medicaid_id', sql.VarChar, medicaid_id || '').query(queries.starperformanceList)
            : Promise.resolve({ recordset: [] });

        const [actionActivityCategory, actionActivityType, navigatorList,usersList,allusersList,starperformanceList,measureList,pcpType,vendorList,vendorPlanList,appointTypeList,roles,hspcsList,cptList,taxonomyList,serviceProviderTypeList,icdList] = await Promise.all([
            pool.request().query(queries.actionActivityCategory),
            pool.request().query(queries.actionActivityType),
            pool.request().query(queries.navigatorList),
            pool.request().query(queries.usersList),
            pool.request().query(queries.allusersList),
            starperformanceQuery,
            pool.request().query(queries.measureList),
            pool.request().query(queries.pcpType),
            pool.request().query(queries.vendorList),
            pool.request().query(queries.vendorPlanList),
            pool.request().query(queries.appointTypeList),
            pool.request().query(queries.roles),
            pool.request().query(queries.hspcsList),
            pool.request().query(queries.cptList),
            pool.request().query(queries.taxonomyList),
            pool.request().query(queries.serviceProviderTypeList),
            pool.request().query(queries.icdList),
        ]);

        return buildResponse(200,{data: {
            actionActivityCategory: actionActivityCategory.recordset,
            actionActivityType: actionActivityType.recordset,
            navigatorList: navigatorList.recordset,
            usersList: usersList.recordset,
            allusersList: allusersList.recordset,
            starperformanceList: starperformanceList.recordset,
            measureList: measureList.recordset,
            pcpType: pcpType.recordset,
            vendorList: vendorList.recordset,
            vendorPlanList: vendorPlanList.recordset,
            appointTypeList: appointTypeList.recordset,
            roles: roles.recordset,
            hspcsList: hspcsList.recordset,
            cptList: cptList.recordset,
            taxonomyList: taxonomyList.recordset,
            serviceProviderTypeList: serviceProviderTypeList.recordset,
            icdList: icdList.recordset
        }},event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{data:  'Internal Server Error.'},event);
    }
};
