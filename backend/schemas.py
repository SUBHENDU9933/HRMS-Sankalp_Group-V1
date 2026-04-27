"""Pydantic schemas — request/response models."""
from datetime import datetime, date
from typing import List, Optional, Any
from pydantic import BaseModel, EmailStr, ConfigDict, Field


# ===== Auth =====
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "EmployeeOut"


# ===== Employee =====
class EmployeeBase(BaseModel):
    name: str
    phone: Optional[str] = None
    role: str = "employee"
    employee_code: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    joining_date: Optional[date] = None
    salary_type: str = "monthly"
    daily_rate: float = 0
    monthly_salary: float = 0
    working_days: int = 26
    photo_url: Optional[str] = None
    address: Optional[str] = None
    bank_account: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    documents: List[Any] = Field(default_factory=list)
    status: str = "active"


class EmployeeCreate(EmployeeBase):
    email: EmailStr
    password: str


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    employee_code: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    joining_date: Optional[date] = None
    salary_type: Optional[str] = None
    daily_rate: Optional[float] = None
    monthly_salary: Optional[float] = None
    working_days: Optional[int] = None
    photo_url: Optional[str] = None
    address: Optional[str] = None
    bank_account: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    documents: Optional[List[Any]] = None
    status: Optional[str] = None
    password: Optional[str] = None


class EmployeeOut(EmployeeBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    created_at: Optional[datetime] = None


TokenResponse.model_rebuild()


# ===== Attendance =====
class AttendanceCreate(BaseModel):
    employee_id: Optional[str] = None  # admin can pass; employee uses self
    date: date
    status: str  # present/absent/half_day
    selfie_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    notes: Optional[str] = None


class AttendanceUpdate(BaseModel):
    status: Optional[str] = None
    selfie_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    notes: Optional[str] = None


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    date: date
    status: str
    check_in_time: Optional[datetime] = None
    selfie_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


# ===== Visit =====
class VisitCreate(BaseModel):
    visit_type: str  # lead/project
    lead_name: Optional[str] = None
    lead_phone: Optional[str] = None
    lead_location: Optional[str] = None
    customer_requirement: Optional[str] = None
    budget: Optional[str] = None
    measurement_details: Optional[str] = None
    requirement_sheet: Optional[str] = None
    project_name: Optional[str] = None
    project_location: Optional[str] = None
    project_status: Optional[str] = None
    notes: Optional[str] = None
    selfie_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    site_photos: List[str] = Field(default_factory=list)
    floor_plan_url: Optional[str] = None
    documents: List[Any] = Field(default_factory=list)
    status: str = "completed"


class VisitUpdate(BaseModel):
    lead_name: Optional[str] = None
    lead_phone: Optional[str] = None
    lead_location: Optional[str] = None
    customer_requirement: Optional[str] = None
    budget: Optional[str] = None
    measurement_details: Optional[str] = None
    requirement_sheet: Optional[str] = None
    project_name: Optional[str] = None
    project_location: Optional[str] = None
    project_status: Optional[str] = None
    notes: Optional[str] = None
    site_photos: Optional[List[str]] = None
    floor_plan_url: Optional[str] = None
    documents: Optional[List[Any]] = None
    status: Optional[str] = None


class VisitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    visit_type: str
    visit_date: Optional[datetime] = None
    lead_name: Optional[str] = None
    lead_phone: Optional[str] = None
    lead_location: Optional[str] = None
    customer_requirement: Optional[str] = None
    budget: Optional[str] = None
    measurement_details: Optional[str] = None
    requirement_sheet: Optional[str] = None
    project_name: Optional[str] = None
    project_location: Optional[str] = None
    project_status: Optional[str] = None
    notes: Optional[str] = None
    selfie_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    site_photos: List[str] = Field(default_factory=list)
    floor_plan_url: Optional[str] = None
    documents: List[Any] = Field(default_factory=list)
    status: str
    created_at: Optional[datetime] = None


# ===== Payroll =====
class PayrollGenerate(BaseModel):
    employee_id: str
    month: int
    year: int
    incentive: float = 0
    bonus: float = 0
    overtime: float = 0
    extra_deductions: float = 0
    notes: Optional[str] = None


class PayrollOverride(BaseModel):
    base_salary: Optional[float] = None
    incentive: Optional[float] = None
    bonus: Optional[float] = None
    overtime: Optional[float] = None
    deductions: Optional[float] = None
    notes: Optional[str] = None


class PayrollOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    month: int
    year: int
    present_days: float
    half_days: float
    absent_days: float
    base_salary: float
    incentive: float
    bonus: float
    overtime: float
    deductions: float
    net_salary: float
    notes: Optional[str] = None
    generated_at: Optional[datetime] = None


# ===== Ledger =====
class LedgerCreate(BaseModel):
    employee_id: str
    entry_type: str  # advance/allowance/deduction
    amount: float
    description: Optional[str] = None
    entry_date: date


class LedgerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    entry_type: str
    amount: float
    description: Optional[str] = None
    entry_date: date
    created_at: Optional[datetime] = None


# ===== Expense =====
class ExpenseCreate(BaseModel):
    category: str
    amount: float
    description: Optional[str] = None
    expense_date: date
    paid_by: Optional[str] = None
    receipt_url: Optional[str] = None


class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    expense_date: Optional[date] = None
    paid_by: Optional[str] = None
    receipt_url: Optional[str] = None


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    category: str
    amount: float
    description: Optional[str] = None
    expense_date: date
    paid_by: Optional[str] = None
    receipt_url: Optional[str] = None
    created_at: Optional[datetime] = None
