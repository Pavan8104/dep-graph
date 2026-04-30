import type { UserInputDef } from "./types.ts";

/**
 * Per-tool user-supplied parameters.
 * These are inputs the agent cannot derive from any other tool — the user (or
 * the agent's caller) MUST provide them before the tool can execute.
 *
 * Agent decision logic:
 *   1. If a required parameter is in `provides` of another tool → add that tool
 *      as a dependency and run it first.
 *   2. If a required parameter is listed here (source = "user") → prompt the
 *      user / use context from the conversation.
 *   3. If both options exist (e.g. `email` can come from Contacts OR be typed
 *      by the user) → prefer the tool route; fall back to user prompt.
 */
export const userInputsByTool: Record<string, UserInputDef[]> = {
  // ── Gmail ──────────────────────────────────────────────────────────────────
  GOOGLESUPER_GMAIL_SEND_EMAIL: [
    { param: "to", type: "string", description: "Recipient email (alternative: derive via Search Contacts)", required: false, example: "alice@example.com" },
    { param: "subject", type: "string", description: "Email subject line", required: true, example: "Meeting notes" },
    { param: "body", type: "string", description: "Email message body", required: true },
  ],
  GOOGLESUPER_GMAIL_REPLY_TO_THREAD: [
    { param: "body", type: "string", description: "Reply message text", required: true },
  ],
  GOOGLESUPER_GMAIL_CREATE_DRAFT: [
    { param: "to", type: "string", description: "Recipient email address", required: false },
    { param: "subject", type: "string", description: "Draft subject", required: false },
    { param: "body", type: "string", description: "Draft body", required: false },
  ],
  GOOGLESUPER_GMAIL_CREATE_LABEL: [
    { param: "name", type: "string", description: "Label display name", required: true, example: "Urgent" },
  ],
  GOOGLESUPER_CONTACTS_SEARCH: [
    { param: "query", type: "string", description: "Person's name or partial email to search for", required: true, example: "John Smith" },
  ],

  // ── Calendar ───────────────────────────────────────────────────────────────
  GOOGLESUPER_CALENDARS_INSERT: [
    { param: "summary", type: "string", description: "Calendar title", required: true, example: "Work" },
    { param: "timeZone", type: "string", description: "IANA timezone (e.g. America/New_York)", required: false },
  ],
  GOOGLESUPER_EVENTS_INSERT: [
    { param: "summary", type: "string", description: "Event title", required: true, example: "Team standup" },
    { param: "start_time", type: "string", description: "Start datetime ISO 8601 (e.g. 2024-06-01T10:00:00Z)", required: true },
    { param: "end_time", type: "string", description: "End datetime ISO 8601", required: true },
    { param: "description", type: "string", description: "Event description", required: false },
    { param: "location", type: "string", description: "Event location", required: false },
  ],
  GOOGLESUPER_EVENTS_UPDATE: [
    { param: "summary", type: "string", description: "New event title", required: false },
    { param: "start_time", type: "string", description: "New start datetime", required: false },
    { param: "end_time", type: "string", description: "New end datetime", required: false },
  ],
  GOOGLESUPER_ACL_INSERT: [
    { param: "role", type: "string", description: "Access role: reader | writer | owner", required: true },
    { param: "scope_type", type: "string", description: "Scope type: user | group | domain", required: true },
    { param: "scope_value", type: "string", description: "Email address or domain to grant access", required: true },
  ],

  // ── Drive ──────────────────────────────────────────────────────────────────
  GOOGLESUPER_DRIVE_CREATE_FILE: [
    { param: "name", type: "string", description: "File name", required: true, example: "report.pdf" },
    { param: "content", type: "string", description: "File content or URL to upload", required: false },
    { param: "mimeType", type: "string", description: "MIME type (e.g. application/pdf)", required: false },
  ],
  GOOGLESUPER_ADD_FILE_SHARING_PREFERENCE: [
    { param: "role", type: "string", description: "Permission role: reader | writer | commenter | owner", required: true },
    { param: "type", type: "string", description: "Principal type: user | group | domain | anyone", required: true },
    { param: "email_address", type: "string", description: "Email of user/group to share with", required: false },
  ],
  GOOGLESUPER_CREATE_COMMENT: [
    { param: "content", type: "string", description: "Comment text", required: true },
  ],

  // ── Sheets ─────────────────────────────────────────────────────────────────
  GOOGLESUPER_SHEETS_CREATE_SPREADSHEET: [
    { param: "title", type: "string", description: "Spreadsheet title", required: true, example: "Budget 2024" },
  ],
  GOOGLESUPER_ADD_SHEET: [
    { param: "title", type: "string", description: "New sheet tab name", required: false, example: "Q2 Data" },
  ],
  GOOGLESUPER_BATCH_UPDATE: [
    { param: "values", type: "array", description: "2D array of cell values to write", required: true },
    { param: "range", type: "string", description: "A1 notation range (e.g. Sheet1!A1:C5)", required: true },
  ],
  GOOGLESUPER_CLEAR_VALUES: [
    { param: "range", type: "string", description: "A1 notation range to clear", required: true, example: "A1:Z100" },
  ],
  GOOGLESUPER_AGGREGATE_COLUMN_DATA: [
    { param: "operation", type: "string", description: "Operation: sum | average | count | min | max", required: true },
    { param: "target_column", type: "string", description: "Column letter to aggregate (e.g. B)", required: true },
    { param: "sheet_name", type: "string", description: "Sheet tab name", required: true },
  ],

  // ── Tasks ──────────────────────────────────────────────────────────────────
  GOOGLESUPER_TASKS_CREATE_TASKLIST: [
    { param: "title", type: "string", description: "Task list name", required: true, example: "Sprint 5" },
  ],
  GOOGLESUPER_TASKS_INSERT_TASK: [
    { param: "title", type: "string", description: "Task title", required: true, example: "Review pull request" },
    { param: "notes", type: "string", description: "Task notes/description", required: false },
    { param: "due", type: "string", description: "Due date ISO 8601", required: false },
  ],
  GOOGLESUPER_TASKS_UPDATE_TASK: [
    { param: "title", type: "string", description: "Updated task title", required: false },
    { param: "status", type: "string", description: "New status: needsAction | completed", required: false },
    { param: "notes", type: "string", description: "Updated notes", required: false },
  ],
  GOOGLESUPER_BULK_INSERT_TASKS: [
    { param: "tasks", type: "array", description: "Array of task objects [{title, notes?, due?}]", required: true },
  ],

  // ── Photos ─────────────────────────────────────────────────────────────────
  GOOGLESUPER_CREATE_ALBUM: [
    { param: "title", type: "string", description: "Album name", required: true, example: "Vacation 2024" },
  ],
  GOOGLESUPER_BATCH_CREATE_MEDIA_ITEMS: [
    { param: "urls", type: "array", description: "Image/video URLs to upload", required: false },
    { param: "media_files", type: "array", description: "Local file paths to upload", required: false },
  ],
  GOOGLESUPER_ADD_ENRICHMENT: [
    { param: "text", type: "string", description: "Text enrichment content for album", required: false },
    { param: "location", type: "object", description: "Location data {lat, lon, name}", required: false },
  ],

  // ── Analytics ──────────────────────────────────────────────────────────────
  GOOGLESUPER_ANALYTICS_LIST_PROPERTIES: [
    { param: "account_id", type: "string", description: "GA4 account ID (if filtering by account)", required: false },
  ],
  GOOGLESUPER_BATCH_RUN_REPORTS: [
    { param: "dateRanges", type: "array", description: "Date range(s): [{startDate, endDate}] e.g. [{startDate:'7daysAgo',endDate:'today'}]", required: true },
    { param: "metrics", type: "array", description: "Metric names e.g. ['sessions','users','pageviews']", required: true },
    { param: "dimensions", type: "array", description: "Dimension names e.g. ['city','browser']", required: false },
  ],
  GOOGLESUPER_BATCH_RUN_PIVOT_REPORTS: [
    { param: "dateRanges", type: "array", description: "Date range(s) for the pivot report", required: true },
    { param: "pivots", type: "array", description: "Pivot definitions [{fieldNames, limit}]", required: true },
    { param: "metrics", type: "array", description: "Metric names", required: true },
  ],
  GOOGLESUPER_CREATE_CUSTOM_DIMENSION: [
    { param: "displayName", type: "string", description: "Human-readable dimension name (max 82 chars)", required: true },
    { param: "scope", type: "string", description: "Scope: EVENT | USER | ITEM", required: true },
    { param: "description", type: "string", description: "Dimension description (max 150 chars)", required: false },
  ],

  // ── GitHub: Repos ──────────────────────────────────────────────────────────
  GITHUB_CREATE_REPO: [
    { param: "name", type: "string", description: "Repository name", required: true, example: "my-project" },
    { param: "description", type: "string", description: "Repository description", required: false },
    { param: "private", type: "boolean", description: "Whether repository is private", required: false },
  ],

  // ── GitHub: Issues ─────────────────────────────────────────────────────────
  GITHUB_CREATE_ISSUE: [
    { param: "title", type: "string", description: "Issue title", required: true, example: "Bug: login fails on Safari" },
    { param: "body", type: "string", description: "Issue description (markdown)", required: false },
  ],
  GITHUB_UPDATE_ISSUE: [
    { param: "title", type: "string", description: "Updated issue title", required: false },
    { param: "body", type: "string", description: "Updated issue body", required: false },
    { param: "state", type: "string", description: "Issue state: open | closed", required: false },
  ],
  GITHUB_CREATE_LABEL: [
    { param: "name", type: "string", description: "Label text", required: true, example: "bug" },
    { param: "color", type: "string", description: "Hex color without # (e.g. d73a4a)", required: true },
    { param: "description", type: "string", description: "Label description", required: false },
  ],

  // ── GitHub: PRs ────────────────────────────────────────────────────────────
  GITHUB_CREATE_PULL_REQUEST: [
    { param: "title", type: "string", description: "Pull request title", required: true },
    { param: "body", type: "string", description: "PR description (markdown)", required: false },
    { param: "base", type: "string", description: "Target branch to merge into (e.g. main)", required: true },
  ],

  // ── GitHub: Commits ────────────────────────────────────────────────────────
  GITHUB_CREATE_A_BLOB: [
    { param: "content", type: "string", description: "File content to store as a Git blob", required: true },
    { param: "encoding", type: "string", description: "Content encoding: utf-8 | base64", required: false },
  ],
  GITHUB_CREATE_A_TREE: [
    { param: "tree", type: "array", description: "Tree entries [{path, mode, type, sha or content}]", required: true },
    { param: "base_tree", type: "string", description: "SHA of existing base tree (optional)", required: false },
  ],
  GITHUB_CREATE_A_COMMIT: [
    { param: "message", type: "string", description: "Commit message", required: true, example: "fix: resolve null pointer in auth" },
    { param: "author__name", type: "string", description: "Author display name", required: false },
    { param: "author__email", type: "string", description: "Author email", required: false },
  ],
  GITHUB_COMMIT_MULTIPLE_FILES: [
    { param: "message", type: "string", description: "Commit message", required: true },
    { param: "upserts", type: "array", description: "Files to create/update [{path, content}]", required: false },
    { param: "deletes", type: "array", description: "File paths to delete", required: false },
  ],
  GITHUB_CREATE_A_COMMIT_COMMENT: [
    { param: "body", type: "string", description: "Comment text (supports markdown)", required: true },
  ],
  GITHUB_CREATE_A_COMMIT_STATUS: [
    { param: "state", type: "string", description: "CI status: error | failure | pending | success", required: true },
    { param: "description", type: "string", description: "Short human-readable status description", required: false },
    { param: "context", type: "string", description: "CI context identifier (e.g. ci/build)", required: false },
    { param: "target_url", type: "string", description: "URL linking to build details", required: false },
  ],

  // ── GitHub: Actions ────────────────────────────────────────────────────────
  GITHUB_TRIGGER_WORKFLOW: [
    { param: "ref", type: "string", description: "Branch or tag to run workflow on", required: true, example: "main" },
    { param: "inputs", type: "object", description: "Workflow dispatch inputs as key-value pairs", required: false },
  ],
  GITHUB_CREATE_A_CHECK_RUN: [
    { param: "name", type: "string", description: "Check run display name (e.g. Unit Tests)", required: true },
    { param: "status", type: "string", description: "Check status: queued | in_progress | completed", required: false },
    { param: "conclusion", type: "string", description: "Conclusion when completed: success | failure | neutral | cancelled", required: false },
    { param: "output__title", type: "string", description: "Check output title", required: false },
    { param: "output__summary", type: "string", description: "Check output summary (markdown)", required: false },
  ],

  // ── GitHub: Deployments ────────────────────────────────────────────────────
  GITHUB_CREATE_DEPLOYMENT: [
    { param: "environment", type: "string", description: "Target environment name (e.g. production, staging)", required: false, example: "production" },
    { param: "description", type: "string", description: "Deployment description", required: false },
    { param: "auto_merge", type: "boolean", description: "Auto-merge default branch into requested ref", required: false },
  ],
  GITHUB_CREATE_DEPLOYMENT_STATUS: [
    { param: "state", type: "string", description: "Deployment state: error | failure | inactive | in_progress | queued | pending | success", required: true },
    { param: "log_url", type: "string", description: "URL of deployment log", required: false },
    { param: "environment_url", type: "string", description: "URL of deployed environment", required: false },
    { param: "description", type: "string", description: "Status description", required: false },
  ],

  // ── GitHub: Releases ───────────────────────────────────────────────────────
  GITHUB_CREATE_RELEASE: [
    { param: "tag_name", type: "string", description: "Git tag for this release (e.g. v1.2.0)", required: true },
    { param: "name", type: "string", description: "Release title", required: false, example: "v1.2.0 — Performance improvements" },
    { param: "body", type: "string", description: "Release notes (markdown)", required: false },
    { param: "draft", type: "boolean", description: "Create as unpublished draft", required: false },
    { param: "prerelease", type: "boolean", description: "Mark as pre-release", required: false },
  ],

  // ── GitHub: Org / Teams ────────────────────────────────────────────────────
  GITHUB_CREATE_TEAM: [
    { param: "name", type: "string", description: "Team name", required: true },
    { param: "description", type: "string", description: "Team description", required: false },
    { param: "privacy", type: "string", description: "Visibility: secret | closed", required: false },
  ],
  GITHUB_ADD_A_REPOSITORY_COLLABORATOR: [
    { param: "permission", type: "string", description: "Access level: pull | triage | push | maintain | admin", required: false },
  ],
  GITHUB_ADD_OR_UPDATE_TEAM_MEMBERSHIP_FOR_USER: [
    { param: "role", type: "string", description: "Team role: member | maintainer", required: false },
  ],
};
