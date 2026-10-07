const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, event);
  }
  const body = JSON.parse(event.body || '{}');
  const role = body.role;
  let user_id = body.navigator_id;
  const action_status = body.action_status;
  const activity_type = body.activity_type;
  const start_date = body.start_date;
  const end_date = body.end_date;

  // Finding (IDOR): a caller could pass any navigator_id and see that
  // navigator's entire member-activity history (medicaid_id + action notes),
  // not just their own. Non-admins are now forced to their own ID; Admin may
  // still query any navigator (or none, for all).
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
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(401, { message: "Unauthorized" }, event);
    }
    if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
      user_id = caller.ID;
    }

    const request = pool.request();

    let query = `
                        SELECT ma.[medicaid_id],
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
                               CONCAT(u.FistName, ' ', u.LastName) AS user_name
                        FROM MEM_MEMBER_ACTION_FOLLOW_UP AS ma
                        LEFT JOIN ACTION_FOLLOWUP_RESULT AS r ON ma.action_result_id = r.id
                        LEFT JOIN MEM_MEMBER_PANEL_ACTION AS p ON ma.panel_id = p.id
                        LEFT JOIN MEMBER_ACTION AS a ON ma.action_id = a.id
                        LEFT JOIN MEM_USERS AS u ON ma.add_by = u.ID
                        WHERE ma.action_date BETWEEN @start_date AND @end_date
                        AND ma.medicaid_id IS NOT NULL
                        `;

    request.input('start_date', sql.Date, start_date);
    request.input('end_date', sql.Date, end_date);

    if (role) {
      query += ' AND u.role_id = @role';
      request.input('role', sql.Int, role);
    }

    if (user_id) {
      query += ' AND ma.add_by = @user_id';
      request.input('user_id', sql.Int, user_id);
    }

    if (activity_type) {
      query += ' AND p.id = @activity_type';
      request.input('activity_type', sql.Int, activity_type);
    }

    if (action_status) {
      query += ' AND ma.action_status = @action_status';
      request.input('action_status', sql.VarChar, action_status);
    }

    const result = await request.query(query);

    return buildResponse(200, { data: result.recordset }, event);
  } catch (err) {
    console.error('Database connection error:', err);
    return buildResponse(500, { message: 'Internal server error' }, event);
  }
};
