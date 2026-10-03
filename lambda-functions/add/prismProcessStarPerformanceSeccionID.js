/**
 * Lambda: prismProcessStarPerformanceSeccionID
 * Called from: ConfigService.processStarPerformanceSeccionID()  (src/app/services/api.service.ts)
 * Used by: star-performance-file.ts (PROCESS STAR PERFORMANCE FILE admin
 * page) -- commits rows staged in MEM_STAR_PERFORMANCE_REPORT_DATA_TEMP into
 * the real Star Performance table.
 *
 * Request body shape:
 *   { session_id: number }
 *
 * Not individually reproduced in the pentest report's occurrences list, but
 * same category as the sibling Process*SeccionID endpoints (finding 3.1.10,
 * "Missing Function-Level Authorization") -- treat as equally exposed until
 * verified otherwise once you paste the real code.
 *
 * Server-side validation/fix needed: same as prismProcessMembersSeccionID.js
 * -- Admin-only role gate via event.requestContext.authorizer.claims.sub ->
 * MEM_USERS -> role_id, session_id ownership check, and validation of staged
 * rows before committing.
 *
 * Paste the current Lambda handler code below this line.
 */
