# BMS + HRMS Change Log / AI Handover

> Purpose: This file is the shared source of truth for approved decisions, verified current behavior, planned work, and implemented changes. It is written so another AI/developer (including Claude) can continue the project safely.

## 0. Non-Negotiable Rules

- **Read-only inspection first.** Do not change code, database, RLS, RPCs, Supabase settings, or deployment configuration without explicit user approval.
- **Improve now, merge later.** BMS and HRMS remain separate systems for now. A 2-in-1 merge is a future project.
- Preserve existing working functionality unless a specific change is approved.
- In particular, preserve the existing multi-user assignment capabilities for Leads and Projects in BMS.
- Never assume a database/system role equals the user's real organizational role.
- Security/permission changes must be enforced server-side/database-side where appropriate, not only by hiding UI controls.

## 1. Verified BMS Baseline

### Architecture
- React SPA deployed through Vercel.
- Supabase Auth + Postgres + Storage are the active business-data architecture.
- Legacy FastAPI/MongoDB backend exists in the repository but is not treated as the active BMS business backend.

### Functional roles agreed by the user
1. **Admin**
2. **Relationship Manager (RM)**
3. **Relationship Executive (RE)**

### Real BMS team
- Amit Ray — Relationship Executive
- Arijit Roy — Relationship Manager
- Sarmistha Halder — Relationship Executive
- Other current BMS accounts include the owner's admin account and test/admin IDs. They are not treated as regular employees.

### BMS access model agreed
- **Admin:** full access.
- **RM:** can see/access his own and his team's business data.
- **RE:** can see/access his permitted/assigned business data.
- An RE may have **one or more RMs in parallel**.
- RM/RE access is scoped to relevant team/project/lead assignments rather than exposing unrelated teams.
- Within permitted scope, BMS users may need access to operational and associated project financial data, including Leads, Customers, Receipts, Digital Approvals, Projects, Vendors, Agreements, Logs, etc., subject to the final permission matrix.
- View/Create/Edit/Delete/Approve are separate permission concepts and must not be assumed identical.

### Existing assignment functionality to preserve
- BMS already has multi-user Lead assignment (`lead_assignees`).
- BMS already has multi-user Project assignment (`project_members`).
- These existing mechanisms should be inspected and reused as the foundation for team/project visibility rather than replaced with a duplicate assignment system.

## 2. Planned BMS Work

### Step 1 — Baseline and Change Log
- This document created in both BMS and HRMS repositories.
- Record verified architecture, users, roles, current behavior, constraints, and future plan.

### Step 2 — Audit current BMS permissions
Map:
`UI → React page → service → Supabase table/RPC → RLS → resulting access`

Audit at minimum:
- Leads
- Customers
- Estimates
- Receipts
- Projects
- Vendors
- Digital Approvals
- Agreements
- Logs/Audit Log
- Notifications and other relevant modules

### Step 3 — Audit Lead + Project assignment
Verify exactly how `lead_assignees` and `project_members` are used by the live UI/services/database and how they affect visibility and actions.

### Step 4 — Produce the approved BMS permission matrix
For Admin/RM/RE define separately:
- View
- Create
- Edit
- Delete
- Approve
- Financial visibility
- Scope: Own / Team / Selected / All where appropriate

### Step 5 — Design Admin Permission Override
Potential location: **User Profile → Access & Permissions**.

The override should extend a user's normal role without creating unnecessary new roles. Any exceptional permission should be auditable.

### Step 6 — Implement only after explicit approval
Any implementation must be reviewed before committing/deploying.

### Step 7 — Test with real scenarios
Test Amit, Arijit, Sarmistha and admin/test accounts against cross-team and project/lead scenarios.

## 3. HRMS Rules Already Agreed

HRMS uses the same three functional role names:
- Admin
- Relationship Manager
- Relationship Executive

Important difference from BMS:
- A senior RM may access operational information such as team attendance and field visits.
- **Down-level employee salary/payroll must not be visible to RM/RE.**
- Salary/payroll of down-level employees is restricted to Admin/explicitly authorized admin users.
- HRMS therefore requires separate operational and financial permission layers.

## 4. Future BMS ↔ HRMS Direction

Do not merge databases now.

Future direction, after both systems are stabilized:
- Establish controlled employee identity mapping.
- Connect BMS business assignments with HRMS employee records.
- Explore Lead → Field Visit relationships.
- Explore Customer → Project → Employee lifecycle.
- Evaluate integration architecture before any database merge.

## 5. Change Entry Format

Each implemented change must record:
- Change number
- Date
- System
- Area/module
- Reason
- Approved behavior
- Files changed
- Database/RLS/RPC changes
- Tests performed
- Deployment status
- Rollback notes if relevant

## CHANGE LOG

### CHANGE #001 — Project Baseline / Permission Architecture
- **Date:** 2026-09-07
- **System:** BMS + HRMS
- **Status:** PLANNING / BASELINE ONLY
- **Approved:** Yes, for documentation and planning
- **Code/database behavior changed:** No
- **Summary:** Established the three-role model (Admin / Relationship Manager / Relationship Executive), BMS team/project scoped access, HRMS operational-vs-salary separation, preservation of existing multi-user Lead/Project assignments, and the step-by-step audit/implementation plan.

## AI HANDOVER — IMPORTANT

Before making any change, read this file and verify the current repository/database state. If this file conflicts with a newer explicit user instruction, follow the newer instruction and update this log after approval.

Do not infer permission rules from existing database values alone. The current BMS database historically contains admin role values for users whose real organizational roles are RM/RE; the agreed business role model above is authoritative for planning.
