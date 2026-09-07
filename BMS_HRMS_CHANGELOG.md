# BMS + HRMS Change Log / AI Handover

> Purpose: This file is the shared source of truth for approved decisions, verified current behavior, planned work, and implemented changes.

## 0. Non-Negotiable Rules
- Read-only inspection first unless explicitly approved.
- **Improve now, merge later.** BMS and HRMS remain separate.
- Preserve existing working functionality and multi-user Lead/Project assignments.
- Security/permission changes must be enforced server-side/database-side where appropriate.

## 1. Verified BMS Baseline
- React SPA on Vercel.
- Supabase Auth + Postgres + Storage are the active business-data architecture.
- Legacy FastAPI/MongoDB code exists but is not treated as the active BMS business backend.

### Functional roles agreed
1. Admin
2. Relationship Manager (RM)
3. Relationship Executive (RE)

### Agreed access model
- Admin: company-wide control.
- RM: own/team/assigned business scope.
- RE: permitted assigned/co-assigned business scope.
- An RE may relate to one or more RMs.
- Employee salary/payroll/bank information remains a separate sensitive domain in HRMS.
- View/Create/Edit/Delete/Approve remain separate permission concepts.

### Existing assignment mechanisms to preserve
- `lead_assignees`
- `project_members`

## 2. Audit / Planning Completed
The BMS permission audit mapped UI → services → Supabase tables/RPCs → RLS and identified the highest-risk areas: Vendor Bills, Receipts, Vendor Payments, Audit Log, Notifications, plus broader Customer/Estimate/Agreement/Project authorization gaps.

The authorization blueprint uses Role + Relationship + Scope + Action + Sensitivity.

## 3. HRMS Rules
- Admin / RM / RE functional model.
- RM may access operational team attendance/field visits.
- RM/RE must not see down-level employee salary/payroll/bank information by default.
- HRMS remains separate from BMS for now.

## 4. Future BMS ↔ HRMS Direction
- Controlled employee identity mapping.
- Lead → Field Visit connection.
- Customer → Project → Employee lifecycle.
- Integration first; database merge only as a later, separately approved project.

## CHANGE LOG

### CHANGE #001 — Project Baseline / Permission Architecture
- **Date:** 2026-09-07
- **System:** BMS + HRMS
- **Status:** BASELINE COMPLETE
- **Approved:** Yes
- **Behavior changed:** No
- **Summary:** Established the three-role model, scoped business access, HRMS operational-vs-salary separation, preservation of multi-user assignments, and the implementation roadmap.

### CHANGE #002 — P0 Authorization Hardening
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** DATABASE IMPLEMENTED
- **Approved:** Yes — explicit user authorization received.
- **Scope:** High-risk financial, audit and notification access.
- **Database changes implemented:**
  - Added private RLS helper functions for project, lead and customer access with pinned search paths and no direct Data API execution.
  - `vendor_bills`: project-scoped SELECT/INSERT; creator/admin UPDATE; admin-only direct DELETE.
  - `vendor_payments`: project-scoped SELECT/INSERT; creator/admin UPDATE/DELETE.
  - `receipts`: SELECT follows project/lead/customer/creator scope; INSERT requires authenticated creator plus matching scope, while preserving unlinked manual receipt creation.
  - `audit_log`: direct INSERT restricted to admin or authenticated actor; existing SECURITY DEFINER audit trigger remains available.
  - `notifications`: direct INSERT restricted to self/admin; privileged server-side notification functions remain available.
  - Pinned `search_path` for `set_updated_at` and `set_receipt_si_no`.
  - Anonymous execution of privileged `admin_send_notification` revoked; authenticated execution retained for the existing server-side admin email check.
- **Preserved:** Lead assignment/co-assignment, project membership, soft-delete workflows and public token workflows.

### CHANGE #003 — Vendor Sensitive/KYC Access Hardening
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** DATABASE + APPLICATION IMPLEMENTED
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Vendor master data and sensitive KYC/bank information.
- **Changes:** Direct vendor access hardened; safe `vendor_directory` created for operational/non-KYC lookup; sensitive PAN/Aadhaar/UPI/bank/IFSC/vendor-ID fields excluded from ordinary directory reads; vendor service updated accordingly.

### CHANGE #004 — Private Vendor Document Storage
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** DATABASE + APPLICATION IMPLEMENTED
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Vendor photos, ID cards and visiting cards.
- **Changes:** `vendor-docs` bucket made private; public-read removed; vendor-scoped Storage policies added; private vendor access helper added; application switched to short-lived signed URLs while preserving existing object paths/references.

### CHANGE #005 — Centralized UI Permission Matrix
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Changes:** Central Admin/RM/RE role matrix, VIEW/CREATE/EDIT/DELETE/ASSIGN/SEND/RESTORE/PURGE actions, `usePermissions`, `PermissionRoute`, and protected module routes. Reports remain Admin-only conservatively. Supabase RLS remains authoritative.

### CHANGE #006 — Reusable Action Permission Gate / Customer Actions
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Changes:** Reusable `PermissionGate`; Customer create/edit/delete-request and receipt shortcut controls plus matching form authorization.

### CHANGE #007 — Lead Action-Level Permission Controls
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Changes:** Lead create/edit/status/assignment/conversion/import/bulk controls aligned to the permission matrix; unauthorized actions hidden and form actions independently checked.

### CHANGE #008 — Project Action-Level Permission Controls
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Changes:** Project create/edit/delete UI controls and form enforcement aligned to the permission matrix; existing project membership preserved.

### CHANGE #009 — Agreement Action-Level Permission Controls
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Changes:** Agreement create/edit/send/void/delete UI actions aligned to permissions; public signing/token workflows preserved; templates remain Admin-only.

### CHANGE #010 — Service-Level Action Authorization: Receipts, Vendors and Digital Approvals
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Changes:** Receipt, vendor, vendor-payment/bill and digital-approval service calls now enforce the centralized action matrix in addition to UI and RLS; public signing/response workflows preserved.

### CHANGE #011 — Final Authorization Regression Hardening
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** DATABASE IMPLEMENTED / FINAL VERIFICATION COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Remaining direct database/RPC bypasses found during final regression.
- **Changes:** Vendor master writes and sensitive destructive operations restricted appropriately; receipt attachments now follow receipt access rules; delete-request/cancel RPCs enforce authentication and scope; internal expiration/reminder RPC execution removed from end users; `get_receipt_attachments_by_receipt(uuid)` locked from anon/authenticated execution; vendor direct SELECT remains Admin-only with RM/RE using the safe directory.
- **Verification:** Critical RLS policies and SECURITY DEFINER execution ACLs were re-read after migration. Public agreement/approval signing and receipt verification workflows remain intentionally available.
- **Production:** Latest BMS Vercel deployment remains READY/Production; runtime error query returned no logs for the checked criteria.

## AI HANDOVER
Before any further change, re-check current Git/Supabase/Vercel state. Never infer organizational role solely from historical database role values. Keep BMS and HRMS separate until a future explicit merge project is approved.
