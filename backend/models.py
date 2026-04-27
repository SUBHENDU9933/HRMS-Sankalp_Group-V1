"""SQLAlchemy ORM models — used for queries only.
Schema is created via SQL migration at /app/migrations/001_initial.sql.
Run that SQL in Supabase SQL editor before starting the backend.
"""
import uuid
from datetime import datetime, timezone, date
from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    Integer,
    Float,
    Date,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from database import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class Employee(Base):
    __tablename__ = "employees"

    id = Column(String(36), primary_key=True, default=_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(150), nullable=False)
    phone = Column(String(30))
    role = Column(String(20), nullable=False, default="employee", index=True)  # admin/manager/employee
    employee_code = Column(String(50), unique=True)
    designation = Column(String(100))
    department = Column(String(100))
    joining_date = Column(Date)
    salary_type = Column(String(20), default="monthly")  # daily/monthly
    daily_rate = Column(Float, default=0)
    monthly_salary = Column(Float, default=0)
    working_days = Column(Integer, default=26)
    photo_url = Column(Text)
    address = Column(Text)
    bank_account = Column(String(50))
    bank_name = Column(String(100))
    bank_ifsc = Column(String(20))
    documents = Column(JSONB, default=list)  # [{name, url}]
    status = Column(String(20), default="active", index=True)  # active/inactive
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(String(36), primary_key=True, default=_uuid)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), index=True, nullable=False)
    date = Column(Date, nullable=False, index=True)
    status = Column(String(20), nullable=False)  # present/absent/half_day
    check_in_time = Column(DateTime(timezone=True))
    selfie_url = Column(Text)
    latitude = Column(Float)
    longitude = Column(Float)
    location_address = Column(Text)
    notes = Column(Text)
    marked_by = Column(String(36))  # employee_id of admin/self
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    employee = relationship("Employee", lazy="joined")


class Visit(Base):
    __tablename__ = "visits"

    id = Column(String(36), primary_key=True, default=_uuid)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), index=True, nullable=False)
    visit_type = Column(String(20), nullable=False, index=True)  # lead/project
    visit_date = Column(DateTime(timezone=True), default=_now, index=True)

    # Lead fields
    lead_name = Column(String(200))
    lead_phone = Column(String(30))
    lead_location = Column(Text)
    customer_requirement = Column(Text)
    budget = Column(String(100))
    measurement_details = Column(Text)
    requirement_sheet = Column(Text)

    # Project fields
    project_name = Column(String(200))
    project_location = Column(Text)
    project_status = Column(String(30))  # site_check/in_progress/inspection/completed

    # Common
    notes = Column(Text)
    selfie_url = Column(Text)
    latitude = Column(Float)
    longitude = Column(Float)
    location_address = Column(Text)
    site_photos = Column(JSONB, default=list)  # [url, url]
    floor_plan_url = Column(Text)
    documents = Column(JSONB, default=list)
    status = Column(String(20), default="completed", index=True)  # completed/follow_up
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    employee = relationship("Employee", lazy="joined")


class Payroll(Base):
    __tablename__ = "payroll"

    id = Column(String(36), primary_key=True, default=_uuid)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), index=True, nullable=False)
    month = Column(Integer, nullable=False, index=True)  # 1-12
    year = Column(Integer, nullable=False, index=True)
    present_days = Column(Float, default=0)
    half_days = Column(Float, default=0)
    absent_days = Column(Float, default=0)
    base_salary = Column(Float, default=0)
    incentive = Column(Float, default=0)
    bonus = Column(Float, default=0)
    overtime = Column(Float, default=0)
    deductions = Column(Float, default=0)
    net_salary = Column(Float, default=0)
    notes = Column(Text)
    generated_at = Column(DateTime(timezone=True), default=_now)
    created_at = Column(DateTime(timezone=True), default=_now)

    employee = relationship("Employee", lazy="joined")


class Ledger(Base):
    __tablename__ = "ledger"

    id = Column(String(36), primary_key=True, default=_uuid)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), index=True, nullable=False)
    entry_type = Column(String(20), nullable=False, index=True)  # advance/allowance/deduction
    amount = Column(Float, nullable=False)
    description = Column(Text)
    entry_date = Column(Date, nullable=False, index=True)
    created_by = Column(String(36))
    created_at = Column(DateTime(timezone=True), default=_now)

    employee = relationship("Employee", lazy="joined")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String(36), primary_key=True, default=_uuid)
    category = Column(String(80), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    description = Column(Text)
    expense_date = Column(Date, nullable=False, index=True)
    paid_by = Column(String(150))
    receipt_url = Column(Text)
    created_by = Column(String(36))
    created_at = Column(DateTime(timezone=True), default=_now)
