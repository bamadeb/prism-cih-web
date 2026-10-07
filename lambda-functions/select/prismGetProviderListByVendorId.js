const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200, {}, event);
    }
    const body = JSON.parse(event.body || "{}");
    // Live bug: vendor_id was hardcoded to a test value instead of read from
    // the request, so every call returned the same one vendor's data
    // regardless of what was actually requested.
    const vendor_id = body.vendor_id;

    if (!vendor_id || typeof vendor_id !== 'string') {
        return buildResponse(400, { data: 'Invalid vendor_id' }, event);
    }

    // Finding: no check that the caller is even a known logged-in user.
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { message: "Unauthorized" }, event);
    }

    try {
        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID FROM MEM_USERS WHERE cognito_username = @cognito_username');
        if (!callerLookup.recordset[0]) {
            return buildResponse(401, { message: "Unauthorized" }, event);
        }

        const providerListQuery = `
            SELECT
                [Provider ID] as provider_id,
                [Provider Last Name] as provider_last_name,
                [Provider First Name] as provider_first_name
            FROM PROVIDER_VENDOR_CROSSWALK
            WHERE [Vendor ID] = @vendor_id
        `;

        const vendorLocationQuery = `
            SELECT
                [BILLING_ADDR_1],
                [BILLING_ADDR_2],
                [OFFICE_ADDR_1],
                [OFFICE_ADDR_2],
                [OFFICE_ADDR_3],
                [OFFICE_ADDR_4],
                [PHONE],
                [ABBR],
                [CONTACT_PERSON],
                [BILLING_CITY],
                [BILLING_STATE],
                [BILLING_ZIP],
                [FIRST_NAME],
                [VENDOR_TYPE],
                [NPI]
            FROM dm.[VENDOR]
            WHERE [VENDOR_NUM] = @vendor_id `;

        const request1 = pool.request();
        request1.input('vendor_id', sql.VarChar(50), vendor_id);

        const request2 = pool.request();
        request2.input('vendor_id', sql.VarChar(50), vendor_id);

        const [providerList, vendorLocationList] = await Promise.all([
            request1.query(providerListQuery),
            request2.query(vendorLocationQuery)
        ]);

        return buildResponse(200,{data: {
            providerList: providerList.recordset,
            vendorLocationList: vendorLocationList.recordset
        }},event);

    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ message: "Internal Server Error" },event);
    }
};
