"""Sankalp HRMS — FastAPI backend with Supabase Postgres."""
import os
import io
import logging
from datetime import datetime, date, timezone, timedelta
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, engine, AsyncSessionLocal
from models import Employee, Attendance, Visit, Payroll, Ledger, Expense
import schemas
from auth_utils import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    require_roles,
)
from storage import upload_data_url, ensure_bucket

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sankalp")

app = FastAPI(title="Sankalp HRMS")
api = APIRouter(prefix="/api")


# ============================================================================
# Helpers
# ============================================================================
def emp_to_dict(emp: Employee) -> dict:
    return {
        "id": emp.id,
        "email": emp.email,
        "name": emp.name,
        "phone": emp.phone,
        "role": emp.role,
        "employee_code": emp.employee_code,
        "designation": emp.designation,
        "department": emp.department,
        "joining_date": emp.joining_date,
        "salary_type": emp.salary_type,
        "daily_rate": emp.daily_rate or 0,
        "monthly_salary": emp.monthly_salary or 0,
        "working_days": emp.working_days or 26,
        "photo_url": emp.photo_url,
        "address": emp.address,
        "bank_account": emp.bank_account,
        "bank_name": emp.bank_name,
        "bank_ifsc": emp.bank_ifsc,
        "documents": emp.documents or [],
        "status": emp.status,
        "created_at": emp.created_at,
    }


def att_to_dict(a: Attendance, name: Optional[str] = None) -> dict:
    return {
        "id": a.id,
        "employee_id": a.employee_id,
        "employee_name": name or (a.employee.name if a.employee else None),
        "date": a.date,
        "status": a.status,
        "check_in_time": a.check_in_time,
        "selfie_url": a.selfie_url,
        "latitude": a.latitude,
        "longitude": a.longitude,
        "location_address": a.location_address,
        "notes": a.notes,
        "created_at": a.created_at,
    }


def visit_to_dict(v: Visit) -> dict:
    return {
        "id": v.id,
        "employee_id": v.employee_id,
        "employee_name": v.employee.name if v.employee else None,
        "visit_type": v.visit_type,
        "visit_date": v.visit_date,
        "lead_name": v.lead_name,
        "lead_phone": v.lead_phone,
        "lead_location": v.lead_location,
        "customer_requirement": v.customer_requirement,
        "budget": v.budget,
        "measurement_details": v.measurement_details,
        "requirement_sheet": v.requirement_sheet,
        "project_name": v.project_name,
        "project_location": v.project_location,
        "project_status": v.project_status,
        "notes": v.notes,
        "selfie_url": v.selfie_url,
        "latitude": v.latitude,
        "longitude": v.longitude,
        "location_address": v.location_address,
        "site_photos": v.site_photos or [],
        "floor_plan_url": v.floor_plan_url,
        "documents": v.documents or [],
        "status": v.status,
        "created_at": v.created_at,
    }


def payroll_to_dict(p: Payroll) -> dict:
    return {
        "id": p.id,
        "employee_id": p.employee_id,
        "employee_name": p.employee.name if p.employee else None,
        "month": p.month,
        "year": p.year,
        "present_days": p.present_days or 0,
        "half_days": p.half_days or 0,
        "absent_days": p.absent_days or 0,
        "base_salary": p.base_salary or 0,
        "incentive": p.incentive or 0,
        "bonus": p.bonus or 0,
        "overtime": p.overtime or 0,
        "deductions": p.deductions or 0,
        "net_salary": p.net_salary or 0,
        "notes": p.notes,
        "generated_at": p.generated_at,
    }


# ============================================================================
# Health
# ============================================================================
@api.get("/")
async def root():
    return {"status": "ok", "app": "Sankalp HRMS"}


# ============================================================================
# Auth
# ============================================================================
@api.post("/auth/login", response_model=schemas.TokenResponse)
async def login(payload: schemas.LoginRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Employee).where(Employee.email == payload.email.lower()))
    user = res.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account inactive")
    token = create_token(user.id, user.role)
    return {"access_token": token, "token_type": "bearer", "user": emp_to_dict(user)}


@api.get("/auth/me", response_model=schemas.EmployeeOut)
async def me(user: Employee = Depends(get_current_user)):
    return emp_to_dict(user)


# ============================================================================
# Upload (data URL → Supabase Storage)
# ============================================================================
@api.post("/upload")
async def upload(
    body: dict = Body(...),
    user: Employee = Depends(get_current_user),
):
    data_url = body.get("data_url")
    folder = body.get("folder", "uploads")
    if not data_url:
        raise HTTPException(status_code=400, detail="data_url required")
    try:
        url = upload_data_url(data_url, folder=folder)
        return {"url": url}
    except Exception as e:
        logger.exception("upload failed")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")


# ============================================================================
# Employees
# ============================================================================
@api.get("/employees", response_model=List[schemas.EmployeeOut])
async def list_employees(
    q: Optional[str] = None,
    role: Optional[str] = None,
    status_: Optional[str] = Query(None, alias="status"),
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "employee":
        # employees only see themselves
        return [emp_to_dict(user)]
    stmt = select(Employee).order_by(Employee.created_at.desc())
    if q:
        ql = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Employee.name).like(ql), func.lower(Employee.email).like(ql), func.lower(Employee.employee_code).like(ql)))
    if role:
        stmt = stmt.where(Employee.role == role)
    if status_:
        stmt = stmt.where(Employee.status == status_)
    res = await db.execute(stmt)
    return [emp_to_dict(e) for e in res.scalars().all()]


@api.post("/employees", response_model=schemas.EmployeeOut)
async def create_employee(
    payload: schemas.EmployeeCreate,
    user: Employee = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Employee).where(Employee.email == payload.email.lower()))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")
    data = payload.model_dump()
    data["email"] = data["email"].lower()
    pw = data.pop("password")
    data["password_hash"] = hash_password(pw)
    emp = Employee(**data)
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return emp_to_dict(emp)


@api.get("/employees/{emp_id}", response_model=schemas.EmployeeOut)
async def get_employee(
    emp_id: str,
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "employee" and user.id != emp_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    res = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp_to_dict(emp)


@api.put("/employees/{emp_id}", response_model=schemas.EmployeeOut)
async def update_employee(
    emp_id: str,
    payload: schemas.EmployeeUpdate,
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    is_self = user.id == emp_id
    is_admin = user.role == "admin"
    if not (is_self or is_admin):
        raise HTTPException(status_code=403, detail="Forbidden")

    data = payload.model_dump(exclude_unset=True)
    # Non-admins can only update a limited set on self
    if not is_admin:
        allowed = {"name", "phone", "address", "photo_url", "bank_account", "bank_name", "bank_ifsc", "password"}
        data = {k: v for k, v in data.items() if k in allowed}

    if "password" in data and data["password"]:
        emp.password_hash = hash_password(data.pop("password"))
    elif "password" in data:
        data.pop("password")

    for k, v in data.items():
        setattr(emp, k, v)

    await db.commit()
    await db.refresh(emp)
    return emp_to_dict(emp)


@api.delete("/employees/{emp_id}")
async def delete_employee(
    emp_id: str,
    user: Employee = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    if user.id == emp_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    res = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(emp)
    await db.commit()
    return {"ok": True}


# ============================================================================
# Attendance
# ============================================================================
@api.get("/attendance", response_model=List[schemas.AttendanceOut])
async def list_attendance(
    employee_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status_: Optional[str] = Query(None, alias="status"),
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Attendance).order_by(Attendance.date.desc(), Attendance.created_at.desc())
    if user.role == "employee":
        stmt = stmt.where(Attendance.employee_id == user.id)
    elif employee_id:
        stmt = stmt.where(Attendance.employee_id == employee_id)
    if date_from:
        stmt = stmt.where(Attendance.date >= date_from)
    if date_to:
        stmt = stmt.where(Attendance.date <= date_to)
    if status_:
        stmt = stmt.where(Attendance.status == status_)
    res = await db.execute(stmt)
    return [att_to_dict(a) for a in res.scalars().all()]


@api.post("/attendance", response_model=schemas.AttendanceOut)
async def create_attendance(
    payload: schemas.AttendanceCreate,
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target_id = payload.employee_id or user.id
    if user.role == "employee" and target_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Upsert by (employee_id, date)
    res = await db.execute(
        select(Attendance).where(
            and_(Attendance.employee_id == target_id, Attendance.date == payload.date)
        )
    )
    existing = res.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if existing:
        existing.status = payload.status
        existing.selfie_url = payload.selfie_url or existing.selfie_url
        existing.latitude = payload.latitude if payload.latitude is not None else existing.latitude
        existing.longitude = payload.longitude if payload.longitude is not None else existing.longitude
        existing.location_address = payload.location_address or existing.location_address
        existing.notes = payload.notes or existing.notes
        existing.check_in_time = existing.check_in_time or now
        existing.marked_by = user.id
        await db.commit()
        await db.refresh(existing)
        return att_to_dict(existing)

    a = Attendance(
        employee_id=target_id,
        date=payload.date,
        status=payload.status,
        selfie_url=payload.selfie_url,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_address=payload.location_address,
        notes=payload.notes,
        check_in_time=now,
        marked_by=user.id,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    # Re-load with employee join
    res = await db.execute(select(Attendance).where(Attendance.id == a.id))
    a = res.scalar_one()
    return att_to_dict(a)


@api.put("/attendance/{att_id}", response_model=schemas.AttendanceOut)
async def update_attendance(
    att_id: str,
    payload: schemas.AttendanceUpdate,
    user: Employee = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Attendance).where(Attendance.id == att_id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    await db.commit()
    await db.refresh(a)
    return att_to_dict(a)


@api.delete("/attendance/{att_id}")
async def delete_attendance(
    att_id: str,
    user: Employee = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Attendance).where(Attendance.id == att_id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(a)
    await db.commit()
    return {"ok": True}


# ============================================================================
# Visits
# ============================================================================
@api.get("/visits", response_model=List[schemas.VisitOut])
async def list_visits(
    employee_id: Optional[str] = None,
    visit_type: Optional[str] = None,
    status_: Optional[str] = Query(None, alias="status"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Visit).order_by(Visit.visit_date.desc())
    if user.role == "employee":
        stmt = stmt.where(Visit.employee_id == user.id)
    elif employee_id:
        stmt = stmt.where(Visit.employee_id == employee_id)
    if visit_type:
        stmt = stmt.where(Visit.visit_type == visit_type)
    if status_:
        stmt = stmt.where(Visit.status == status_)
    if date_from:
        stmt = stmt.where(func.date(Visit.visit_date) >= date_from)
    if date_to:
        stmt = stmt.where(func.date(Visit.visit_date) <= date_to)
    res = await db.execute(stmt)
    return [visit_to_dict(v) for v in res.scalars().all()]


@api.post("/visits", response_model=schemas.VisitOut)
async def create_visit(
    payload: schemas.VisitCreate,
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.visit_type not in ("lead", "project"):
        raise HTTPException(status_code=400, detail="visit_type must be lead/project")
    v = Visit(employee_id=user.id, **payload.model_dump())
    db.add(v)
    await db.commit()
    await db.refresh(v)
    res = await db.execute(select(Visit).where(Visit.id == v.id))
    v = res.scalar_one()
    return visit_to_dict(v)


@api.get("/visits/{visit_id}", response_model=schemas.VisitOut)
async def get_visit(
    visit_id: str,
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Visit).where(Visit.id == visit_id))
    v = res.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role == "employee" and v.employee_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return visit_to_dict(v)


@api.put("/visits/{visit_id}", response_model=schemas.VisitOut)
async def update_visit(
    visit_id: str,
    payload: schemas.VisitUpdate,
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Visit).where(Visit.id == visit_id))
    v = res.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role == "employee" and v.employee_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    for k, val in payload.model_dump(exclude_unset=True).items():
        setattr(v, k, val)
    await db.commit()
    await db.refresh(v)
    return visit_to_dict(v)


@api.delete("/visits/{visit_id}")
async def delete_visit(
    visit_id: str,
    user: Employee = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Visit).where(Visit.id == visit_id))
    v = res.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(v)
    await db.commit()
    return {"ok": True}


# ============================================================================
# Payroll
# ============================================================================
async def _compute_attendance_breakdown(db: AsyncSession, emp_id: str, month: int, year: int):
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    res = await db.execute(
        select(Attendance.status, func.count(Attendance.id))
        .where(
            and_(
                Attendance.employee_id == emp_id,
                Attendance.date >= start,
                Attendance.date < end,
            )
        )
        .group_by(Attendance.status)
    )
    out = {"present": 0, "absent": 0, "half_day": 0}
    for s, c in res.all():
        if s in out:
            out[s] = c
    return out


async def _ledger_deductions(db: AsyncSession, emp_id: str, month: int, year: int) -> float:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    res = await db.execute(
        select(func.coalesce(func.sum(Ledger.amount), 0))
        .where(
            and_(
                Ledger.employee_id == emp_id,
                Ledger.entry_date >= start,
                Ledger.entry_date < end,
                Ledger.entry_type.in_(["advance", "deduction"]),
            )
        )
    )
    return float(res.scalar() or 0)


@api.post("/payroll/generate", response_model=schemas.PayrollOut)
async def generate_payroll(
    payload: schemas.PayrollGenerate,
    user: Employee = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Employee).where(Employee.id == payload.employee_id))
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    breakdown = await _compute_attendance_breakdown(db, emp.id, payload.month, payload.year)
    present = breakdown["present"]
    half = breakdown["half_day"]
    absent = breakdown["absent"]

    effective_days = present + 0.5 * half
    if (emp.salary_type or "monthly") == "daily":
        base = effective_days * (emp.daily_rate or 0)
    else:
        wd = emp.working_days or 26
        base = (effective_days / wd) * (emp.monthly_salary or 0) if wd > 0 else 0

    auto_deduction = await _ledger_deductions(db, emp.id, payload.month, payload.year)
    total_deductions = auto_deduction + (payload.extra_deductions or 0)
    net = base + (payload.incentive or 0) + (payload.bonus or 0) + (payload.overtime or 0) - total_deductions

    # Upsert
    res = await db.execute(
        select(Payroll).where(
            and_(Payroll.employee_id == emp.id, Payroll.month == payload.month, Payroll.year == payload.year)
        )
    )
    p = res.scalar_one_or_none()
    if p:
        p.present_days = present
        p.half_days = half
        p.absent_days = absent
        p.base_salary = round(base, 2)
        p.incentive = payload.incentive or 0
        p.bonus = payload.bonus or 0
        p.overtime = payload.overtime or 0
        p.deductions = round(total_deductions, 2)
        p.net_salary = round(net, 2)
        p.notes = payload.notes
        p.generated_at = datetime.now(timezone.utc)
    else:
        p = Payroll(
            employee_id=emp.id,
            month=payload.month,
            year=payload.year,
            present_days=present,
            half_days=half,
            absent_days=absent,
            base_salary=round(base, 2),
            incentive=payload.incentive or 0,
            bonus=payload.bonus or 0,
            overtime=payload.overtime or 0,
            deductions=round(total_deductions, 2),
            net_salary=round(net, 2),
            notes=payload.notes,
        )
        db.add(p)
    await db.commit()
    await db.refresh(p)
    res = await db.execute(select(Payroll).where(Payroll.id == p.id))
    p = res.scalar_one()
    return payroll_to_dict(p)


@api.get("/payroll", response_model=List[schemas.PayrollOut])
async def list_payroll(
    month: Optional[int] = None,
    year: Optional[int] = None,
    employee_id: Optional[str] = None,
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Payroll).order_by(Payroll.year.desc(), Payroll.month.desc())
    if user.role == "employee":
        stmt = stmt.where(Payroll.employee_id == user.id)
    elif employee_id:
        stmt = stmt.where(Payroll.employee_id == employee_id)
    if month:
        stmt = stmt.where(Payroll.month == month)
    if year:
        stmt = stmt.where(Payroll.year == year)
    res = await db.execute(stmt)
    return [payroll_to_dict(p) for p in res.scalars().all()]


@api.put("/payroll/{pid}", response_model=schemas.PayrollOut)
async def override_payroll(
    pid: str,
    payload: schemas.PayrollOverride,
    user: Employee = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Payroll).where(Payroll.id == pid))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    p.net_salary = round(
        (p.base_salary or 0) + (p.incentive or 0) + (p.bonus or 0) + (p.overtime or 0) - (p.deductions or 0),
        2,
    )
    await db.commit()
    await db.refresh(p)
    return payroll_to_dict(p)


@api.get("/payroll/{pid}/payslip")
async def payslip_pdf(
    pid: str,
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Payroll).where(Payroll.id == pid))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role == "employee" and p.employee_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    emp = p.employee
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.units import mm

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    h2 = styles["Heading2"]
    normal = styles["Normal"]

    story = []
    story.append(Paragraph("<b>Sankalp Interior Solution</b>", title_style))
    story.append(Paragraph("Sankalp Group & Business Solution", normal))
    story.append(Spacer(1, 6 * mm))
    months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    story.append(Paragraph(f"<b>Payslip — {months[p.month]} {p.year}</b>", h2))
    story.append(Spacer(1, 4 * mm))

    emp_tbl = Table(
        [
            ["Employee Name", emp.name or "", "Employee Code", emp.employee_code or "—"],
            ["Designation", emp.designation or "—", "Department", emp.department or "—"],
            ["Email", emp.email, "Phone", emp.phone or "—"],
            ["Bank A/C", emp.bank_account or "—", "IFSC", emp.bank_ifsc or "—"],
        ],
        colWidths=[35 * mm, 55 * mm, 30 * mm, 50 * mm],
    )
    emp_tbl.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#0F172A")),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(emp_tbl)
    story.append(Spacer(1, 6 * mm))

    att_tbl = Table(
        [
            ["Attendance Summary", ""],
            ["Present Days", f"{p.present_days:g}"],
            ["Half Days", f"{p.half_days:g}"],
            ["Absent Days", f"{p.absent_days:g}"],
        ],
        colWidths=[100 * mm, 70 * mm],
    )
    att_tbl.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4DA3FF")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(att_tbl)
    story.append(Spacer(1, 6 * mm))

    sal_tbl = Table(
        [
            ["Salary Breakdown", "Amount (INR)"],
            ["Base Salary", f"{p.base_salary:.2f}"],
            ["Incentive", f"{p.incentive:.2f}"],
            ["Bonus", f"{p.bonus:.2f}"],
            ["Overtime", f"{p.overtime:.2f}"],
            ["Deductions", f"-{p.deductions:.2f}"],
            ["Net Payable", f"{p.net_salary:.2f}"],
        ],
        colWidths=[100 * mm, 70 * mm],
    )
    sal_tbl.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FFA94D")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10),
        ("FONT", (0, -1), (-1, -1), "Helvetica-Bold", 11),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F1F5F9")),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(sal_tbl)
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(f"<font size=8 color='#64748B'>Generated on {datetime.now().strftime('%d %b %Y, %H:%M')}. This is a computer-generated payslip.</font>", normal))

    doc.build(story)
    buf.seek(0)
    fname = f"payslip_{emp.name.replace(' ', '_')}_{months[p.month]}_{p.year}.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={fname}"}
    )


# ============================================================================
# Ledger
# ============================================================================
@api.get("/ledger", response_model=List[schemas.LedgerOut])
async def list_ledger(
    employee_id: Optional[str] = None,
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Ledger).order_by(Ledger.entry_date.desc(), Ledger.created_at.desc())
    if user.role == "employee":
        stmt = stmt.where(Ledger.employee_id == user.id)
    elif employee_id:
        stmt = stmt.where(Ledger.employee_id == employee_id)
    res = await db.execute(stmt)
    out = []
    for l in res.scalars().all():
        out.append({
            "id": l.id,
            "employee_id": l.employee_id,
            "employee_name": l.employee.name if l.employee else None,
            "entry_type": l.entry_type,
            "amount": l.amount,
            "description": l.description,
            "entry_date": l.entry_date,
            "created_at": l.created_at,
        })
    return out


@api.post("/ledger", response_model=schemas.LedgerOut)
async def create_ledger(
    payload: schemas.LedgerCreate,
    user: Employee = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    if payload.entry_type not in ("advance", "allowance", "deduction"):
        raise HTTPException(status_code=400, detail="Invalid entry_type")
    l = Ledger(**payload.model_dump(), created_by=user.id)
    db.add(l)
    await db.commit()
    await db.refresh(l)
    res = await db.execute(select(Ledger).where(Ledger.id == l.id))
    l = res.scalar_one()
    return {
        "id": l.id,
        "employee_id": l.employee_id,
        "employee_name": l.employee.name if l.employee else None,
        "entry_type": l.entry_type,
        "amount": l.amount,
        "description": l.description,
        "entry_date": l.entry_date,
        "created_at": l.created_at,
    }


@api.delete("/ledger/{lid}")
async def delete_ledger(
    lid: str,
    user: Employee = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Ledger).where(Ledger.id == lid))
    l = res.scalar_one_or_none()
    if not l:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(l)
    await db.commit()
    return {"ok": True}


@api.get("/ledger/balance/{emp_id}")
async def ledger_balance(
    emp_id: str,
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "employee" and user.id != emp_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    res = await db.execute(
        select(Ledger.entry_type, func.coalesce(func.sum(Ledger.amount), 0))
        .where(Ledger.employee_id == emp_id)
        .group_by(Ledger.entry_type)
    )
    rows = {t: float(a or 0) for t, a in res.all()}
    advance = rows.get("advance", 0)
    allowance = rows.get("allowance", 0)
    deduction = rows.get("deduction", 0)
    # Balance: advance + deduction owed by employee, allowance is paid extra. We compute "outstanding"
    return {
        "advance": advance,
        "allowance": allowance,
        "deduction": deduction,
        "balance": round(advance + deduction - allowance, 2),
    }


# ============================================================================
# Expenses
# ============================================================================
@api.get("/expenses", response_model=List[schemas.ExpenseOut])
async def list_expenses(
    category: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    user: Employee = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Expense).order_by(Expense.expense_date.desc(), Expense.created_at.desc())
    if category:
        stmt = stmt.where(Expense.category == category)
    if date_from:
        stmt = stmt.where(Expense.expense_date >= date_from)
    if date_to:
        stmt = stmt.where(Expense.expense_date <= date_to)
    res = await db.execute(stmt)
    return [
        {
            "id": e.id,
            "category": e.category,
            "amount": e.amount,
            "description": e.description,
            "expense_date": e.expense_date,
            "paid_by": e.paid_by,
            "receipt_url": e.receipt_url,
            "created_at": e.created_at,
        }
        for e in res.scalars().all()
    ]


@api.post("/expenses", response_model=schemas.ExpenseOut)
async def create_expense(
    payload: schemas.ExpenseCreate,
    user: Employee = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    e = Expense(**payload.model_dump(), created_by=user.id)
    db.add(e)
    await db.commit()
    await db.refresh(e)
    return {
        "id": e.id,
        "category": e.category,
        "amount": e.amount,
        "description": e.description,
        "expense_date": e.expense_date,
        "paid_by": e.paid_by,
        "receipt_url": e.receipt_url,
        "created_at": e.created_at,
    }


@api.put("/expenses/{eid}", response_model=schemas.ExpenseOut)
async def update_expense(
    eid: str,
    payload: schemas.ExpenseUpdate,
    user: Employee = Depends(require_roles("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Expense).where(Expense.id == eid))
    e = res.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    await db.commit()
    await db.refresh(e)
    return {
        "id": e.id,
        "category": e.category,
        "amount": e.amount,
        "description": e.description,
        "expense_date": e.expense_date,
        "paid_by": e.paid_by,
        "receipt_url": e.receipt_url,
        "created_at": e.created_at,
    }


@api.delete("/expenses/{eid}")
async def delete_expense(
    eid: str,
    user: Employee = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Expense).where(Expense.id == eid))
    e = res.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(e)
    await db.commit()
    return {"ok": True}


# ============================================================================
# Dashboard
# ============================================================================
@api.get("/dashboard")
async def dashboard(
    user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    month_start = today.replace(day=1)

    if user.role in ("admin", "manager"):
        # Admin/manager dashboard
        total_emp = (await db.execute(select(func.count(Employee.id)).where(Employee.status == "active"))).scalar() or 0

        att_today = await db.execute(
            select(Attendance.status, func.count(Attendance.id))
            .where(Attendance.date == today)
            .group_by(Attendance.status)
        )
        att_breakdown = {s: c for s, c in att_today.all()}

        visits_today = (await db.execute(
            select(func.count(Visit.id)).where(func.date(Visit.visit_date) == today)
        )).scalar() or 0

        visits_total = (await db.execute(select(func.count(Visit.id)))).scalar() or 0

        v_type = await db.execute(
            select(Visit.visit_type, func.count(Visit.id)).group_by(Visit.visit_type)
        )
        visit_type_breakdown = {t: c for t, c in v_type.all()}

        exp_month = (await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0))
            .where(Expense.expense_date >= month_start)
        )).scalar() or 0

        payroll_month = (await db.execute(
            select(func.coalesce(func.sum(Payroll.net_salary), 0))
            .where(and_(Payroll.month == today.month, Payroll.year == today.year))
        )).scalar() or 0

        # Recent visits (last 5)
        rv = await db.execute(select(Visit).order_by(Visit.visit_date.desc()).limit(5))
        recent_visits = [visit_to_dict(v) for v in rv.scalars().all()]

        # Top employees by visits (this month)
        top_emp = await db.execute(
            select(Employee.id, Employee.name, func.count(Visit.id).label("c"))
            .join(Visit, Visit.employee_id == Employee.id)
            .where(func.date(Visit.visit_date) >= month_start)
            .group_by(Employee.id, Employee.name)
            .order_by(func.count(Visit.id).desc())
            .limit(5)
        )
        top = [{"employee_id": i, "name": n, "count": c} for i, n, c in top_emp.all()]

        return {
            "role": user.role,
            "total_employees": total_emp,
            "attendance_today": att_breakdown,
            "visits_today": visits_today,
            "visits_total": visits_total,
            "visit_type_breakdown": visit_type_breakdown,
            "expenses_this_month": float(exp_month),
            "payroll_this_month": float(payroll_month),
            "recent_visits": recent_visits,
            "top_employees_by_visits": top,
        }
    else:
        # Employee dashboard
        my_att_month = await db.execute(
            select(Attendance.status, func.count(Attendance.id))
            .where(and_(Attendance.employee_id == user.id, Attendance.date >= month_start))
            .group_by(Attendance.status)
        )
        my_att = {s: c for s, c in my_att_month.all()}

        my_today = (await db.execute(
            select(Attendance).where(and_(Attendance.employee_id == user.id, Attendance.date == today))
        )).scalar_one_or_none()

        my_visits_today = (await db.execute(
            select(func.count(Visit.id)).where(
                and_(Visit.employee_id == user.id, func.date(Visit.visit_date) == today)
            )
        )).scalar() or 0

        my_visits_month = (await db.execute(
            select(func.count(Visit.id)).where(
                and_(Visit.employee_id == user.id, func.date(Visit.visit_date) >= month_start)
            )
        )).scalar() or 0

        my_recent_visits = await db.execute(
            select(Visit).where(Visit.employee_id == user.id).order_by(Visit.visit_date.desc()).limit(5)
        )

        my_payroll = (await db.execute(
            select(Payroll).where(
                and_(
                    Payroll.employee_id == user.id,
                    Payroll.month == today.month,
                    Payroll.year == today.year,
                )
            )
        )).scalar_one_or_none()

        return {
            "role": "employee",
            "today_attendance": att_to_dict(my_today) if my_today else None,
            "attendance_summary": my_att,
            "visits_today": my_visits_today,
            "visits_this_month": my_visits_month,
            "recent_visits": [visit_to_dict(v) for v in my_recent_visits.scalars().all()],
            "current_payroll": payroll_to_dict(my_payroll) if my_payroll else None,
        }


# ============================================================================
# App setup
# ============================================================================
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    # Seed admin if not exists
    try:
        async with AsyncSessionLocal() as session:
            email = os.environ.get("SEED_ADMIN_EMAIL", "").lower()
            pw = os.environ.get("SEED_ADMIN_PASSWORD")
            name = os.environ.get("SEED_ADMIN_NAME", "Admin")
            if email and pw:
                res = await session.execute(select(Employee).where(Employee.email == email))
                if not res.scalar_one_or_none():
                    admin = Employee(
                        email=email,
                        password_hash=hash_password(pw),
                        name=name,
                        role="admin",
                        employee_code="ADMIN001",
                        designation="Administrator",
                        status="active",
                        salary_type="monthly",
                    )
                    session.add(admin)
                    await session.commit()
                    logger.info(f"[seed] Admin created: {email}")
                else:
                    logger.info(f"[seed] Admin already exists: {email}")
    except Exception as e:
        logger.warning(f"[seed] Could not seed admin (DB may not be ready): {e}")

    # Ensure storage bucket exists
    try:
        ensure_bucket()
    except Exception as e:
        logger.warning(f"[storage] bucket ensure failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    await engine.dispose()
