const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, event);
  }
  const body = JSON.parse(event.body || '{}');
  let username = body.username;
  let pool;

  try {
    pool = await getDBConnection();

    const result = await pool
      .request()
      .input('username', sql.VarChar, username)
      .query(`DECLARE @MAX_ATTEMPTS INT;
                    DECLARE @LOCK_MINUTES INT;

                    -- ✅ Fetch config values
                    SELECT @MAX_ATTEMPTS = variable_value 
                    FROM SYSTEM_VARIABLES 
                    WHERE variable_name = 'MAX_FAILED_ATTEMPTS';

                    SELECT @LOCK_MINUTES = variable_value 
                    FROM SYSTEM_VARIABLES 
                    WHERE variable_name = 'LOCK_TIME_MINUTES';


                    IF EXISTS (SELECT 1 FROM USER_LOGIN_ATTEMPTS WHERE USERNAME = @username)
                    BEGIN
                        UPDATE USER_LOGIN_ATTEMPTS
                        SET 
                            FAILED_ATTEMPTS = 
                                CASE 
                                    WHEN DATEDIFF(MINUTE, WINDOW_START_AT, GETDATE()) <= @LOCK_MINUTES
                                        THEN FAILED_ATTEMPTS + 1
                                    ELSE 1
                                END,

                            WINDOW_START_AT = 
                                CASE 
                                    WHEN DATEDIFF(MINUTE, WINDOW_START_AT, GETDATE()) <= @LOCK_MINUTES
                                        THEN WINDOW_START_AT
                                    ELSE GETDATE()
                                END,

                            LAST_FAILED_AT = GETDATE(),

                            LOCKED =
                                CASE 
                                    WHEN (
                                        CASE 
                                            WHEN DATEDIFF(MINUTE, WINDOW_START_AT, GETDATE()) <= @LOCK_MINUTES
                                                THEN FAILED_ATTEMPTS + 1
                                            ELSE 1
                                        END
                                    ) >= @MAX_ATTEMPTS THEN 1
                                    ELSE 0
                                END,

                            LOCKED_AT =
                                CASE 
                                    WHEN (
                                        CASE 
                                            WHEN DATEDIFF(MINUTE, WINDOW_START_AT, GETDATE()) <= @LOCK_MINUTES
                                                THEN FAILED_ATTEMPTS + 1
                                            ELSE 1
                                        END
                                    ) >= @MAX_ATTEMPTS THEN GETDATE()
                                    ELSE NULL
                                END,

                            UPDATED_AT = GETDATE()

                        WHERE USERNAME = @username;
                    END
                    ELSE
                    BEGIN
                        INSERT INTO USER_LOGIN_ATTEMPTS 
                            (USERNAME, FAILED_ATTEMPTS, LAST_FAILED_AT, WINDOW_START_AT)
                        VALUES 
                            (@username, 1, GETDATE(), GETDATE());
                    END;

                    -- ✅ Return result
                    SELECT FAILED_ATTEMPTS, LOCKED, @MAX_ATTEMPTS AS max_attempts  
                    FROM USER_LOGIN_ATTEMPTS 
                    WHERE USERNAME = @username;
            `);

    const attempts = result.recordset[0]?.FAILED_ATTEMPTS || 0;
    const is_locked = result.recordset[0]?.LOCKED || 0;
    const max_attempts = result.recordset[0]?.max_attempts || 0;
    // return {
    //     statusCode: 200,
    //     attempts: attempts,
    //     is_locked: is_locked,
    //     max_attempts: max_attempts
    // };
    return buildResponse(
      200,
      {
        attempts: attempts,
        is_locked: is_locked,
        max_attempts: max_attempts,
      },
      event
    );
  } catch (err) {
    console.error('Database error:', err);

    // return {
    //     statusCode: 500,
    //     body: JSON.stringify({ error: err.message }),
    // };
    return buildResponse(500, { error: 'Interna server error.' }, event);
  }
};
