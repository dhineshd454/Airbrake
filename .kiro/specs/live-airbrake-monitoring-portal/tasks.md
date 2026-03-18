# Implementation Plan: Live Airbrake Monitoring Portal

## Overview

Incremental implementation of the portal in TypeScript, building from data models and parsing through backend services, REST API, WebSocket server, alert engine, and React frontend. Each task wires into the previous, ending with a fully integrated application.

## Tasks

- [x] 1. Set up project structure, data models, and core interfaces
  - Scaffold monorepo with `backend/` and `frontend/` directories
  - Configure TypeScript, ESLint, and Jest with fast-check in both packages
  - Define all shared TypeScript interfaces: `LogRecord`, `Break`, `BreakGroup`, `User`, `AlertRule`, `SavedFilter`, `RetentionPolicy`, `NotificationChannel`
  - Set up PostgreSQL schema migrations (users, breaks, break_groups, alert_rules, saved_filters, retention_policies, parse_errors, audit_log)
  - Set up Elasticsearch/OpenSearch index mappings for logs and breaks
  - _Requirements: 1.1, 2.1, 3.1, 6.2, 9.1, 10.1, 10.2_

- [x] 2. Implement log and error payload parsing
  - [x] 2.1 Implement `parseLogRecord` and `serializeLogRecord` functions
    - Parse raw Airbrake/pipeline payloads into normalized `LogRecord`
    - Serialize `LogRecord` back to JSON
    - On malformed/missing-field payloads, return an error result and write to `parse_errors` table without throwing
    - _Requirements: 10.1, 10.3, 10.4_

  - [x] 2.2 Write property test for `parseLogRecord` / `serializeLogRecord` — Property 22
    - **Property 22: Parsing Produces Valid Normalized Records**
    - **Validates: Requirements 10.1, 10.2**

  - [x] 2.3 Write property test for malformed payload handling — Property 23
    - **Property 23: Malformed Payload Handled Without Crash**
    - **Validates: Requirements 10.3**

  - [x] 2.4 Write property test for parse-serialize-parse round-trip — Property 24
    - **Property 24: Parse-Serialize-Parse Round-Trip**
    - **Validates: Requirements 10.4, 10.5**

  - [x] 2.5 Implement `parseBreak` and `serializeBreak` functions
    - Parse raw error payloads into normalized `Break` records
    - Serialize `Break` back to JSON
    - Handle malformed payloads identically to log parsing
    - _Requirements: 10.2, 10.3, 10.4_

  - [x] 2.6 Write unit tests for parser edge cases
    - Empty payload, null fields, maximum-length strings, invalid JSON
    - _Requirements: 10.3_

- [x] 3. Checkpoint — Ensure all parser tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Error Aggregator
  - [x] 4.1 Implement fingerprint computation for `Break` records
    - Compute a deterministic fingerprint from error message, stack trace, and application identifier
    - _Requirements: 2.2_

  - [x] 4.2 Implement `ErrorAggregator.aggregate(b: Break): AggregationResult`
    - Look up existing `BreakGroup` by fingerprint in PostgreSQL
    - Classify as `new` if no group exists, `regression` if group is resolved, `existing` otherwise
    - Create or update `BreakGroup` record; write `Break` record
    - Index both in Elasticsearch
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 4.3 Write property test for fingerprint grouping — Property 4
    - **Property 4: Fingerprint Grouping**
    - **Validates: Requirements 2.2**

  - [x] 4.4 Write property test for new error classification — Property 5
    - **Property 5: New Error Classification**
    - **Validates: Requirements 2.3**

  - [x] 4.5 Write property test for regression classification — Property 6
    - **Property 6: Regression Classification**
    - **Validates: Requirements 2.4**

  - [x] 4.6 Write unit tests for `ErrorAggregator`
    - Known Break payload produces expected group; PostgreSQL write verified
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 5. Implement Airbrake Client
  - [x] 5.1 Implement `AirbrakeClient` with configurable poll interval
    - Poll Airbrake REST API, normalize responses via `parseBreak`
    - Publish normalized `Break` records to Redis `breaks` channel
    - Wrap API calls with 3-attempt exponential backoff retry
    - Store API key encrypted at rest; never include in logs or responses
    - _Requirements: 2.6, 7.3_

  - [x] 5.2 Write unit tests for `AirbrakeClient`
    - Verify retry logic, encryption of API key, and publish to Redis
    - _Requirements: 2.6, 7.3_

- [x] 6. Implement Log Pipeline
  - [x] 6.1 Implement `LogPipeline.ingest(raw: unknown): Promise<void>`
    - Parse raw payload via `parseLogRecord`
    - Write valid records to PostgreSQL and index in Elasticsearch
    - On parse error, write to `parse_errors` and continue
    - Publish valid records to Redis `logs` channel
    - _Requirements: 1.1, 10.1, 10.3_

  - [x] 6.2 Write unit tests for `LogPipeline`
    - Valid payload written to PG and ES; malformed payload written to parse_errors
    - _Requirements: 10.1, 10.3_

- [x] 7. Checkpoint — Ensure all aggregator, client, and pipeline tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement RBAC middleware and authentication
  - [x] 8.1 Implement OAuth 2.0 / OIDC authentication flow
    - OAuth callback endpoint, session creation, and session storage in Redis
    - On session expiry, redirect to OAuth flow preserving original URL as `redirect_uri`
    - Enforce HTTPS for all endpoints
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 8.2 Implement RBAC middleware
    - Enforce role permissions: Viewer (read-only), Developer (+ alerts, saved filters), Admin (+ user mgmt, app config, retention)
    - Return HTTP 403 and write to audit log on unauthorized access
    - Return HTTP 401 for unauthenticated requests
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 7.1_

  - [x] 8.3 Write property test for RBAC enforcement — Property 15
    - **Property 15: RBAC Enforcement**
    - **Validates: Requirements 5.5, 6.3, 6.4, 6.5, 6.6**

  - [x] 8.4 Write property test for unauthenticated access rejection — Property 16
    - **Property 16: Unauthenticated Access Rejection**
    - **Validates: Requirements 7.1**

  - [x] 8.5 Write property test for session expiry redirect — Property 18
    - **Property 18: Session Expiry Preserves Redirect URL**
    - **Validates: Requirements 7.4**

  - [x] 8.6 Write unit tests for RBAC boundary conditions
    - Viewer/Developer/Admin permission boundaries; audit log entries verified
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

- [x] 9. Implement REST API endpoints
  - [x] 9.1 Implement Breaks endpoints
    - `GET /breaks` (list, paginated, filterable), `GET /breaks/:id` (detail with correlated logs)
    - Apply RBAC middleware; return 404 with clear message when data unavailable
    - _Requirements: 2.1, 4.1, 4.2, 4.3, 4.4_

  - [x] 9.2 Implement Log search and export endpoints
    - `GET /logs` with keyword, tag, severity, application, time-range filters
    - `GET /logs/export?format=csv|json` and `GET /breaks/export?format=csv|json`
    - Return results within 3 seconds for queries up to 90 days
    - _Requirements: 1.4, 1.5, 1.6, 8.1, 8.2, 8.5, 9.4_

  - [x] 9.3 Write property test for filter correctness — Property 1
    - **Property 1: Filter Correctness**
    - **Validates: Requirements 1.4, 1.6**

  - [x] 9.4 Write property test for search result correctness — Property 2
    - **Property 2: Search Result Correctness**
    - **Validates: Requirements 1.5, 8.1**

  - [x] 9.5 Write property test for export completeness — Property 20
    - **Property 20: Export Contains All Records**
    - **Validates: Requirements 8.5, 9.4**

  - [x] 9.6 Implement Saved Filters endpoints
    - `POST /filters`, `GET /filters/:id`, `PUT /filters/:id`, `DELETE /filters/:id`
    - Apply RBAC (Developer+ only for create/edit/delete)
    - _Requirements: 8.3, 8.4_

  - [x] 9.7 Write property test for saved filter round-trip — Property 19
    - **Property 19: Saved Filter Round-Trip**
    - **Validates: Requirements 8.3, 8.4**

  - [x] 9.8 Implement Dashboard aggregation endpoints
    - Break counts (24h, 7d), error rate trend, top failing services, time-series buckets, severity breakdown
    - Include deployment event overlay when available from Airbrake API
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 9.9 Write property test for dashboard break count aggregation — Property 7
    - **Property 7: Dashboard Break Count Aggregation**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 9.10 Write property test for top services ranking — Property 8
    - **Property 8: Top Services Ranking**
    - **Validates: Requirements 3.3**

  - [x] 9.11 Write property test for bucketing preserves total count — Property 9
    - **Property 9: Bucketing Preserves Total Count**
    - **Validates: Requirements 3.4, 3.5**

  - [x] 9.12 Implement Alert Rule management endpoints
    - `POST /alerts`, `GET /alerts`, `PUT /alerts/:id`, `DELETE /alerts/:id`
    - Apply RBAC (Admin/Developer only)
    - _Requirements: 5.5_

  - [x] 9.13 Implement User management and Retention Policy endpoints
    - `GET/POST/PUT/DELETE /users`, `GET/PUT /retention`
    - Apply RBAC (Admin only)
    - _Requirements: 6.1, 6.5, 9.1_

  - [x] 9.14 Write property test for API key not exposed — Property 17
    - **Property 17: API Key Not Exposed in Responses**
    - **Validates: Requirements 7.3**

- [x] 10. Checkpoint — Ensure all API and RBAC tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Alert Engine
  - [x] 11.1 Implement `AlertEngine.evaluate()` tick
    - Query PostgreSQL for Break counts within each active rule's rolling window
    - Trigger dispatch when count >= threshold or when a new-error Break is received
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 11.2 Implement `AlertEngine.dispatch()` with retry logic
    - Dispatch to Email, Slack, Teams, and generic Webhook channels
    - Retry up to 3 times with exponential backoff (1s, 2s, 4s); mark as `failed` after exhaustion
    - _Requirements: 5.4, 5.6_

  - [x] 11.3 Write property test for alert threshold triggering — Property 13
    - **Property 13: Alert Threshold Triggering**
    - **Validates: Requirements 5.1, 5.2**

  - [x] 11.4 Write property test for new error alert triggering — Property 14
    - **Property 14: New Error Alert Triggering**
    - **Validates: Requirements 5.3**

  - [x] 11.5 Write unit tests for `AlertEngine`
    - Retry logic, exponential backoff timing, failed notification marking
    - _Requirements: 5.6_

- [x] 12. Implement Retention Purge service
  - [x] 12.1 Implement scheduled purge job
    - Delete `LogRecord` and `Break` records older than the configured `retentionDays` from PostgreSQL and Elasticsearch
    - Run on a daily schedule; log purge counts
    - _Requirements: 9.1, 9.2_

  - [x] 12.2 Write property test for retention purge correctness — Property 21
    - **Property 21: Retention Purge Correctness**
    - **Validates: Requirements 9.1, 9.2**

- [x] 13. Implement WebSocket server
  - [x] 13.1 Implement WebSocket server with Redis pub/sub fan-out
    - Subscribe to Redis `logs` and `breaks` channels
    - Fan out messages to all connected authenticated clients within 2 seconds
    - _Requirements: 1.1, 1.2_

  - [x] 13.2 Implement disconnection handling and reconnection notification
    - Detect client disconnection; send "Disconnected" state message
    - On reconnect, replay missed events within configurable window
    - _Requirements: 1.3_

  - [x] 13.3 Write unit tests for WebSocket server
    - Fan-out to multiple clients; disconnection state message; replay on reconnect
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 14. Checkpoint — Ensure all backend service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement React frontend — core layout and authentication
  - [x] 15.1 Set up React + TypeScript app with routing and theme support
    - Configure React Router, global theme context (dark/light), and persist preference to localStorage
    - Implement OAuth redirect flow and protected route wrapper
    - _Requirements: 3.7, 7.1, 7.4_

  - [x] 15.2 Write property test for theme preference round-trip — Property 10
    - **Property 10: Theme Preference Round-Trip**
    - **Validates: Requirements 3.7**

- [x] 16. Implement Dashboard view
  - [x] 16.1 Implement dashboard widgets
    - Break count widget (24h, 7d), error rate trend widget, top failing services widget
    - Time-series graph with hourly/daily granularity toggle and deployment event overlays
    - Severity breakdown chart
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 16.2 Write unit tests for dashboard widget rendering
    - Verify correct data binding and "Airbrake API unreachable" warning display
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 17. Implement Log Stream view
  - [x] 17.1 Implement live log stream with WebSocket client
    - Connect via WebSocket, display incoming log entries in real time
    - Show persistent "Disconnected — reconnecting…" banner on connection loss with exponential backoff reconnect
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 17.2 Implement log stream filter controls
    - Filter by application, environment, severity, timestamp range; full-text search input
    - Apply all active filters simultaneously; update stream on filter change
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 17.3 Write unit tests for log stream filter UI
    - Filter state updates, WebSocket reconnection banner display
    - _Requirements: 1.3, 1.4, 1.6_

- [x] 18. Implement Breaks List and Break Detail views
  - [x] 18.1 Implement Breaks List view
    - Paginated, filterable list with status badges ("New", "Regression"), color-coded Critical severity indicators
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 18.2 Implement Break Detail view
    - Display error message, full stack trace, endpoint, request payload, user session, lifecycle (first/last occurrence, count, status)
    - Correlated log entries section filtered by timestamp and application
    - Render "Data not available" placeholder when `requestPayload` or `userSession` is null
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 18.3 Write property test for break detail required fields — Property 3
    - **Property 3: Break Detail View Contains Required Fields**
    - **Validates: Requirements 2.1, 4.1, 4.3**

  - [x] 18.4 Write property test for log correlation correctness — Property 11
    - **Property 11: Log Correlation Correctness**
    - **Validates: Requirements 4.2**

  - [x] 18.5 Write property test for missing data graceful handling — Property 12
    - **Property 12: Missing Data Graceful Handling**
    - **Validates: Requirements 4.4**

  - [x] 18.6 Write unit tests for Break Detail view
    - Known Break renders all required fields; null payload shows placeholder
    - _Requirements: 4.1, 4.4_

- [x] 19. Implement Alert Management and Settings views
  - [x] 19.1 Implement Alert Management view (Admin/Developer only)
    - Create, edit, delete alert rules with threshold, time window, and notification channel configuration
    - Hide view and controls for Viewer role
    - _Requirements: 5.5, 6.3, 6.4_

  - [x] 19.2 Implement Settings view (Admin only)
    - User management table, application configuration, retention policy selector (30/60/90 days)
    - _Requirements: 6.5, 9.1_

  - [x] 19.3 Write unit tests for role-gated UI components
    - Verify Alert Management hidden for Viewer; Settings hidden for non-Admin
    - _Requirements: 6.3, 6.4, 6.5_

- [x] 20. Final integration and wiring
  - [x] 20.1 Wire all backend services together
    - Connect `AirbrakeClient` → Redis → `ErrorAggregator` → PostgreSQL/Elasticsearch → WebSocket fan-out
    - Connect `LogPipeline` → PostgreSQL/Elasticsearch → Redis → WebSocket fan-out
    - Connect `AlertEngine` tick to PostgreSQL Break counts and dispatch channels
    - Connect purge job to retention policy settings
    - _Requirements: 1.1, 2.6, 5.1, 9.2_

  - [x] 20.2 Wire frontend to backend
    - Connect all React views to REST API endpoints and WebSocket server
    - Verify RBAC-gated routes redirect correctly for each role
    - _Requirements: 6.3, 6.4, 6.5, 7.1, 7.4_

  - [x] 20.3 Write integration tests for end-to-end flows
    - Log ingestion → stream delivery; Break ingestion → aggregation → alert dispatch
    - _Requirements: 1.1, 2.2, 5.1_

- [x] 21. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- All 24 correctness properties have a corresponding property-based test sub-task
- Property tests use fast-check with a minimum of 100 iterations
- Unit tests target 80% line coverage for backend services
