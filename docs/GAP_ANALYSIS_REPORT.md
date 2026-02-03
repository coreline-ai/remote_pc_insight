# Documentation vs Implementation Gap Analysis

This report summarizes the features defined in the project documentation ([PRD.md](file:///Users/hwanchoi/projects/remote_pc_insight/docs/PRD.md), [FUNCTIONAL_SPEC.md](file:///Users/hwanchoi/projects/remote_pc_insight/docs/FUNCTIONAL_SPEC.md), [MASTER_PLAN.md](file:///Users/hwanchoi/projects/remote_pc_insight/MASTER_PLAN.md)) that are **currently missing** or **incomplete** in the implementation.

## 🚨 Critical Gaps (P0 - Operating Essentials)

### 1. Agent Auto-Start Installers
- **Applies to**: [agent](file:///Users/hwanchoi/projects/remote_pc_insight/server/app/api/v1/routers/agent.py#21-66)
- **Missing**: No `pc-insight install-agent` command found.
- **Requirement**: `F1` in Functional Spec. "macOS LaunchAgent / Windows Task Scheduler integration".
- **Current State**: Agent must be manually started via terminal (`pc-insight agent`).
- **Impact**: If the user restarts their PC, the agent will not come back online automatically.

### 2. Device Settings & Privacy Policies (Upload Level)
- **Applies to**: [server](file:///Users/hwanchoi/projects/remote_pc_insight/server/tests/e2e/conftest.py#23-58), `web`, [agent](file:///Users/hwanchoi/projects/remote_pc_insight/server/app/api/v1/routers/agent.py#21-66)
- **Missing**: No "Upload Level" (0/1/2) configuration logic/UI.
- **Requirement**: `B5`, `D2`, `PRV-2` in Spec. "Server enforces upload policies (masking paths)".
- **Current State**: Hardcoded behavior (likely Level 0 or 1). No way for user to change generic masking policy.
- **Impact**: Users cannot opt-in to seeing file paths if they want detailed debugging.

### 3. Checklist Persistence Logic
- **Applies to**: [server](file:///Users/hwanchoi/projects/remote_pc_insight/server/tests/e2e/conftest.py#23-58), `web`
- **Missing**: No `checklists` table/API or UI.
- **Requirement**: `E1`, `E2`, `E3`. "Convert report items to checklist", "Add file items".
- **Current State**: Report viewer shows raw data or summary, but no actionable "To-Do" list creation.
- **Impact**: The "Analysis -> Action" loop is broken. Users see the problem but can't track the fix.

---

## ⚠️ Important Gaps (P1 - Product Completeness)

### 4. Command Retry / Cancel
- **Applies to**: `web`
- **Missing**: "Retry" button for failed commands. "Cancel" button for queued commands.
- **Requirement**: `C5`.
- **Current State**: Only "Create New Command" is possible.
- **Impact**: Poor UX if a command fails due to temporary network issues.

### 5. Proper Rate Limiting & Monitoring
- **Applies to**: [server](file:///Users/hwanchoi/projects/remote_pc_insight/server/tests/e2e/conftest.py#23-58)
- **Missing**: Explicit middleware for Rate Limiting. Sentry/Logging integration not fully configured.
- **Requirement**: `NFR-10`.
- **Current State**: Basic FastAPI app without strict throttle protection.

---

## ✅ Implemented Features (Verified)

- **Authentication**: Login/Signup/JWT (Web & API).
- **Device Management**: Enroll, Link, Revoke, Delete (Hard Delete).
- **Command Execution**: Allowlist (Run Full, Ping, etc), Polling, Status Updates.
- **Reporting**: Disk Usage, Report Upload, Raw JSON storage.
- **Agent Basics**: Config Store, Outbox (Retry Queue), Processed Store (Dedup).
