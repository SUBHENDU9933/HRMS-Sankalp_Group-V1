"""Sankalp HRMS — full backend pytest suite.

Covers: auth, upload, employees CRUD, attendance, visits, ledger,
payroll generation + PDF, expenses, dashboard, role-based authorization.
"""
import os
import io
import uuid
import base64
import datetime as dt

import pytest
import requests

# Frontend backend URL (external) + /api prefix per ingress contract
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # fallback: read /app/frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"')
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = BASE_URL.rstrip("/") + "/api"

ADMIN_EMAIL = "info.subhendu@gmail.com"
ADMIN_PASSWORD = "Subhendu8958@"

# tiny 1x1 PNG
PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)
DATA_URL = f"data:image/png;base64,{PNG_B64}"


# ---------- shared state ----------
state = {}


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ============ AUTH ============
def test_health():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_login_admin_success():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "access_token" in body and len(body["access_token"]) > 20
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == ADMIN_EMAIL.lower()
    assert body["user"]["role"] == "admin"
    state["admin_token"] = body["access_token"]
    state["admin_id"] = body["user"]["id"]


def test_login_wrong_password():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": "wrong"},
        timeout=15,
    )
    assert r.status_code == 401


def test_auth_me():
    r = requests.get(f"{API}/auth/me", headers=_h(state["admin_token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL.lower()
    assert r.json()["role"] == "admin"


# ============ UPLOAD ============
def test_upload_data_url():
    r = requests.post(
        f"{API}/upload",
        json={"data_url": DATA_URL, "folder": "tests"},
        headers=_h(state["admin_token"]),
        timeout=30,
    )
    assert r.status_code == 200, r.text
    url = r.json().get("url")
    assert url and url.startswith("http")
    state["upload_url"] = url


# ============ EMPLOYEES ============
def test_create_employee():
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "email": f"TEST_emp_{suffix}@example.com",
        "password": "Pass@1234",
        "name": f"TEST Employee {suffix}",
        "phone": "9999999999",
        "role": "employee",
        "employee_code": f"TST{suffix.upper()}",
        "designation": "Designer",
        "department": "Interior",
        "salary_type": "monthly",
        "monthly_salary": 20000,
        "working_days": 26,
    }
    r = requests.post(f"{API}/employees", json=payload, headers=_h(state["admin_token"]), timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == payload["email"].lower()
    assert data["role"] == "employee"
    assert data["monthly_salary"] == 20000
    state["emp_id"] = data["id"]
    state["emp_email"] = payload["email"].lower()
    state["emp_password"] = payload["password"]


def test_list_employees_admin():
    r = requests.get(f"{API}/employees", headers=_h(state["admin_token"]), timeout=15)
    assert r.status_code == 200
    ids = [e["id"] for e in r.json()]
    assert state["emp_id"] in ids


def test_employee_login_and_self_listing():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": state["emp_email"], "password": state["emp_password"]},
        timeout=15,
    )
    assert r.status_code == 200
    state["emp_token"] = r.json()["access_token"]
    # employee should see only themselves
    r2 = requests.get(f"{API}/employees", headers=_h(state["emp_token"]), timeout=15)
    assert r2.status_code == 200
    arr = r2.json()
    assert len(arr) == 1 and arr[0]["id"] == state["emp_id"]


def test_update_employee():
    r = requests.put(
        f"{API}/employees/{state['emp_id']}",
        json={"designation": "Senior Designer", "monthly_salary": 25000},
        headers=_h(state["admin_token"]),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    assert r.json()["designation"] == "Senior Designer"
    assert r.json()["monthly_salary"] == 25000

    # GET to verify persistence
    g = requests.get(f"{API}/employees/{state['emp_id']}", headers=_h(state["admin_token"]), timeout=15)
    assert g.status_code == 200
    assert g.json()["monthly_salary"] == 25000

    # reset salary back to 20000 for payroll test predictability
    requests.put(
        f"{API}/employees/{state['emp_id']}",
        json={"monthly_salary": 20000},
        headers=_h(state["admin_token"]),
        timeout=15,
    )


# ============ ATTENDANCE ============
def test_create_attendance_today():
    today = dt.date.today().isoformat()
    payload = {
        "employee_id": state["emp_id"],
        "date": today,
        "status": "present",
        "latitude": 22.5,
        "longitude": 88.3,
        "location_address": "Kolkata",
    }
    r = requests.post(f"{API}/attendance", json=payload, headers=_h(state["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "present"
    assert data["employee_name"] is not None
    state["att_id"] = data["id"]


def test_attendance_upsert_same_day():
    today = dt.date.today().isoformat()
    r = requests.post(
        f"{API}/attendance",
        json={"employee_id": state["emp_id"], "date": today, "status": "half_day"},
        headers=_h(state["admin_token"]),
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json()["id"] == state["att_id"]
    assert r.json()["status"] == "half_day"

    # restore for payroll calc
    requests.post(
        f"{API}/attendance",
        json={"employee_id": state["emp_id"], "date": today, "status": "present"},
        headers=_h(state["admin_token"]),
        timeout=15,
    )


def test_list_attendance_with_filters():
    today = dt.date.today().isoformat()
    r = requests.get(
        f"{API}/attendance",
        params={"date_from": today, "date_to": today, "employee_id": state["emp_id"]},
        headers=_h(state["admin_token"]),
        timeout=15,
    )
    assert r.status_code == 200
    arr = r.json()
    assert any(a["id"] == state["att_id"] for a in arr)


# ============ VISITS ============
def test_create_lead_visit():
    payload = {
        "visit_type": "lead",
        "lead_name": "TEST Lead",
        "lead_phone": "9876543210",
        "lead_location": "Park Street",
        "customer_requirement": "Modular kitchen",
        "budget": "₹2L",
        "latitude": 22.55,
        "longitude": 88.36,
    }
    r = requests.post(f"{API}/visits", json=payload, headers=_h(state["emp_token"]), timeout=15)
    assert r.status_code == 200, r.text
    state["lead_id"] = r.json()["id"]
    assert r.json()["visit_type"] == "lead"
    assert r.json()["employee_id"] == state["emp_id"]


def test_create_project_visit():
    payload = {
        "visit_type": "project",
        "project_name": "TEST Project",
        "project_location": "Salt Lake",
        "project_status": "in_progress",
        "site_photos": [],
    }
    r = requests.post(f"{API}/visits", json=payload, headers=_h(state["emp_token"]), timeout=15)
    assert r.status_code == 200, r.text
    state["proj_id"] = r.json()["id"]
    assert r.json()["visit_type"] == "project"


def test_list_and_get_visits():
    r = requests.get(f"{API}/visits", headers=_h(state["admin_token"]), timeout=15)
    assert r.status_code == 200
    ids = [v["id"] for v in r.json()]
    assert state["lead_id"] in ids and state["proj_id"] in ids

    r2 = requests.get(f"{API}/visits/{state['lead_id']}", headers=_h(state["admin_token"]), timeout=15)
    assert r2.status_code == 200
    assert r2.json()["id"] == state["lead_id"]


# ============ LEDGER ============
def test_ledger_create_and_balance():
    today = dt.date.today().isoformat()
    r = requests.post(
        f"{API}/ledger",
        json={
            "employee_id": state["emp_id"],
            "entry_type": "advance",
            "amount": 1000,
            "description": "TEST advance",
            "entry_date": today,
        },
        headers=_h(state["admin_token"]),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    state["ledger_id"] = r.json()["id"]

    bal = requests.get(
        f"{API}/ledger/balance/{state['emp_id']}",
        headers=_h(state["admin_token"]),
        timeout=15,
    )
    assert bal.status_code == 200
    body = bal.json()
    assert body["advance"] >= 1000
    assert body["balance"] == round(body["advance"] + body["deduction"] - body["allowance"], 2)


# ============ PAYROLL ============
def test_payroll_generate_and_payslip():
    today = dt.date.today()
    r = requests.post(
        f"{API}/payroll/generate",
        json={
            "employee_id": state["emp_id"],
            "month": today.month,
            "year": today.year,
            "incentive": 500,
            "bonus": 0,
            "overtime": 0,
            "extra_deductions": 0,
        },
        headers=_h(state["admin_token"]),
        timeout=30,
    )
    assert r.status_code == 200, r.text
    p = r.json()
    state["payroll_id"] = p["id"]
    # 1 present day, monthly_salary=20000, working_days=26
    expected_base = round((1 / 26) * 20000, 2)
    assert abs(p["base_salary"] - expected_base) < 0.5, p
    # deductions should include the 1000 ledger advance
    assert p["deductions"] >= 1000
    expected_net = round(expected_base + 500 - p["deductions"], 2)
    assert abs(p["net_salary"] - expected_net) < 0.5

    # PDF payslip
    pdf = requests.get(
        f"{API}/payroll/{state['payroll_id']}/payslip",
        headers=_h(state["admin_token"]),
        timeout=30,
    )
    assert pdf.status_code == 200
    assert pdf.headers.get("content-type", "").startswith("application/pdf")
    assert pdf.content[:4] == b"%PDF"


# ============ EXPENSES ============
def test_create_and_filter_expense():
    today = dt.date.today().isoformat()
    r = requests.post(
        f"{API}/expenses",
        json={
            "category": "TEST_travel",
            "amount": 500,
            "description": "TEST taxi",
            "expense_date": today,
            "paid_by": "Admin",
        },
        headers=_h(state["admin_token"]),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    state["exp_id"] = r.json()["id"]

    f = requests.get(
        f"{API}/expenses",
        params={"category": "TEST_travel"},
        headers=_h(state["admin_token"]),
        timeout=15,
    )
    assert f.status_code == 200
    assert any(e["id"] == state["exp_id"] for e in f.json())


# ============ DASHBOARD ============
def test_dashboard_admin():
    r = requests.get(f"{API}/dashboard", headers=_h(state["admin_token"]), timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("total_employees", "attendance_today", "visits_today", "recent_visits", "top_employees_by_visits"):
        assert k in d, f"missing {k}"
    assert d["role"] == "admin"
    assert d["total_employees"] >= 1


def test_dashboard_employee():
    r = requests.get(f"{API}/dashboard", headers=_h(state["emp_token"]), timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["role"] == "employee"
    for k in ("today_attendance", "attendance_summary", "visits_today", "recent_visits"):
        assert k in d


# ============ AUTHORIZATION ============
def test_employee_cannot_create_employee():
    r = requests.post(
        f"{API}/employees",
        json={"email": "TEST_x@x.com", "password": "x", "name": "x"},
        headers=_h(state["emp_token"]),
        timeout=15,
    )
    assert r.status_code == 403


def test_employee_cannot_generate_payroll():
    today = dt.date.today()
    r = requests.post(
        f"{API}/payroll/generate",
        json={"employee_id": state["emp_id"], "month": today.month, "year": today.year},
        headers=_h(state["emp_token"]),
        timeout=15,
    )
    assert r.status_code == 403


def test_employee_cannot_delete_attendance():
    r = requests.delete(
        f"{API}/attendance/{state['att_id']}",
        headers=_h(state["emp_token"]),
        timeout=15,
    )
    assert r.status_code == 403


def test_employee_cannot_delete_visit():
    r = requests.delete(
        f"{API}/visits/{state['lead_id']}",
        headers=_h(state["emp_token"]),
        timeout=15,
    )
    assert r.status_code == 403


def test_employee_cannot_delete_ledger():
    r = requests.delete(
        f"{API}/ledger/{state['ledger_id']}",
        headers=_h(state["emp_token"]),
        timeout=15,
    )
    assert r.status_code == 403


# Manager-tier checks: create a manager and verify capabilities
def test_manager_capabilities():
    suffix = uuid.uuid4().hex[:8]
    r = requests.post(
        f"{API}/employees",
        json={
            "email": f"TEST_mgr_{suffix}@example.com",
            "password": "Pass@1234",
            "name": "TEST Manager",
            "role": "manager",
            "salary_type": "monthly",
            "monthly_salary": 30000,
        },
        headers=_h(state["admin_token"]),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    mgr_id = r.json()["id"]
    state["mgr_id"] = mgr_id
    login = requests.post(
        f"{API}/auth/login",
        json={"email": f"TEST_mgr_{suffix}@example.com", "password": "Pass@1234"},
        timeout=15,
    )
    assert login.status_code == 200
    mgr_tok = login.json()["access_token"]

    # manager can list employees
    lst = requests.get(f"{API}/employees", headers=_h(mgr_tok), timeout=15)
    assert lst.status_code == 200
    assert len(lst.json()) >= 2

    # manager can update attendance
    upd = requests.put(
        f"{API}/attendance/{state['att_id']}",
        json={"notes": "TEST manager note"},
        headers=_h(mgr_tok),
        timeout=15,
    )
    assert upd.status_code == 200

    # manager cannot delete employee
    deld = requests.delete(
        f"{API}/employees/{state['emp_id']}",
        headers=_h(mgr_tok),
        timeout=15,
    )
    assert deld.status_code == 403


# ============ TEARDOWN ============
def test_zzz_cleanup():
    tok = state.get("admin_token")
    if not tok:
        return
    for path in [
        f"/expenses/{state.get('exp_id','')}",
        f"/ledger/{state.get('ledger_id','')}",
        f"/visits/{state.get('lead_id','')}",
        f"/visits/{state.get('proj_id','')}",
        f"/attendance/{state.get('att_id','')}",
    ]:
        if path.endswith("/"):
            continue
        try:
            requests.delete(f"{API}{path}", headers=_h(tok), timeout=10)
        except Exception:
            pass
    # delete payroll? no endpoint; skip
    for emp_key in ("emp_id", "mgr_id"):
        eid = state.get(emp_key)
        if eid:
            requests.delete(f"{API}/employees/{eid}", headers=_h(tok), timeout=10)
