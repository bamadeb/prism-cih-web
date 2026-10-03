
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

// Finding 3.1.2: with neither medicaid_id nor assign_to supplied, every
// condition is skipped and the query returns EVERY navigator's upcoming
// tasks (PHI included). assign_to also came straight from the client, so any
// caller could pass another navigator's ID. Non-admins are now pinned to
// their own assign_to regardless of what's in the request body.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  var medicaid_id = body.medicaid_id;
  var assign_to = body.assign_to;

  const claims = event.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { message: 'Unauthorized' }, event);
  }

  try {
    const pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(401, { message: 'Unauthorized' }, event);
    }

    if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
      assign_to = caller.ID;
    }

    const request = pool.request();
    let conditions = [];

    if (typeof medicaid_id !== 'undefined') {
      conditions.push('f.medicaid_id = @medicaid_id');
      request.input('medicaid_id', sql.VarChar(20), medicaid_id);
    }

    if (typeof assign_to !== 'undefined') {
      conditions.push('f.assign_to = @assign_to');
      request.input('assign_to', sql.Int, Number(assign_to));

      conditions.push("f.[status] IN ('Open','In-Process')");
      conditions.push(
        '(f.action_date >= CAST(GETDATE() AS date) OR f.action_date < CAST(GETDATE() AS date))'
      );
      conditions.push("f.[medicaid_id] != ''");
    }

    let filter_sql = '';
    if (conditions.length > 0) {
      filter_sql = 'WHERE ' + conditions.join(' AND ');
    }

    const query = `SELECT f.[id]
            ,f.[medicaid_id]
            ,f.[action_id] 
            ,CONVERT(varchar,f.[action_date],101) as action_date
            ,CONVERT(varchar,f.[action_date],101) as task_date
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
			,mp.action_type,

    CASE 
        
        WHEN f.[status] = 'Successful'
            THEN 'green'

        
        WHEN f.[status] IN ('Open', 'In-Process') 
             AND f.[action_date] BETWEEN CAST(GETDATE() AS date) 
                                    AND DATEADD(day, 3, CAST(GETDATE() AS date))
            THEN '#ff7800'

        
        WHEN f.[status] IN ('Open', 'In-Process') 
             AND f.[action_date] < CAST(GETDATE() AS date)
            THEN 'red'

        
        ELSE ''
    END AS bg_color
        FROM MEM_TASK_FOLLOW_UP as f
		LEFT JOIN MEM_MEMBER_PANEL_ACTION AS mp ON(f.action_id = mp.id)
        LEFT JOIN MEM_USERS as u ON (u.ID=f.assign_to)
        LEFT JOIN MEM_USERS as us ON (us.ID=f.add_by)
		 ${filter_sql}		  
        ORDER BY f.[action_date]`;

    const result = await request.query(query);

    return buildResponse(200, { data: result.recordset }, event);
  } catch (err) {
    console.error('Database connection error:', err);
    return buildResponse(500, { message: 'Internal server error' }, event);
  }
};
