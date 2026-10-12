-- Password history for prismUserPasswordUpdate (no reuse of the last 5 passwords:
-- the current one in MEM_USERS.Password plus up to 4 kept here).
-- Run once per environment before deploying the updated prismUserPasswordUpdate.
-- The Lambda tolerates this table being absent (it then checks only the current password).

IF OBJECT_ID('dbo.MEM_USER_PASSWORD_HISTORY', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MEM_USER_PASSWORD_HISTORY (
        id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        user_id       INT           NOT NULL,   -- MEM_USERS.ID
        password_hash VARCHAR(255)  NOT NULL,   -- bcrypt hash, same format as MEM_USERS.Password
        changed_at    DATETIME      NOT NULL CONSTRAINT DF_MEM_USER_PASSWORD_HISTORY_changed_at DEFAULT (GETDATE())
    );

    CREATE INDEX IX_MEM_USER_PASSWORD_HISTORY_user
        ON dbo.MEM_USER_PASSWORD_HISTORY (user_id, changed_at DESC);
END
