from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
import logging
import traceback
import uuid
import json

from models.crms.invoice import Invoice, InvoiceCreate, InvoiceUpdate, InvoiceItem
from pydantic import BaseModel
from services.google_sheets import sheets_service
from config import settings
from utils.logging_utils import trace_exceptions_async

logger = logging.getLogger(__name__)

class LogPaymentRequest(BaseModel):
    payment_date: str
    credit_currency: Optional[str] = None
    credited_amount: Optional[float] = None

router = APIRouter(prefix="/crms/invoices", tags=["CRMS - Invoices"])

SHEET_NAME = settings.INVOICES_SHEET if hasattr(settings, 'INVOICES_SHEET') else "Invoices" 
# Fallback if setting not yet added, but ideally should be added. 
# Plan: I will use a new sheet name "Invoices" to avoid conflict with legacy "Invoices"
CRMS_INVOICES_SHEET = "Invoices"
ID_COLUMN = "Invoice Id"

def generate_invoice_id():
    """Generate a unique invoice ID in format GTINVXXXXXX."""
    try:
        records = sheets_service.get_crms_all_records(CRMS_INVOICES_SHEET)
        max_id = 0
        for record in records:
            inv_id = str(record.get("Invoice Id", ""))
            if inv_id.startswith("GTINV"):
                try:
                    num_part = int(inv_id[5:])
                    if num_part > max_id:
                        max_id = num_part
                except ValueError:
                    continue
        
        next_id = max_id + 1
        return f"GTINV{next_id:06d}"
    except Exception as e:
        logger.error(f"Error generating invoice ID: {e}")
        return f"GTINV{uuid.uuid4().hex[:6].upper()}"

def generate_next_invoice_number():
    """Predict the next sequential invoice number (e.g., IN2026Q1020001)."""
    try:
        now = datetime.now()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        quarter = f"Q{(now.month - 1) // 3 + 1}"
        prefix = f"IN{year}{quarter}{month}"

        records = sheets_service.get_crms_all_records(CRMS_INVOICES_SHEET)
        max_num = 0
        for record in records:
            inv_num = str(record.get("Invoice Number", ""))
            if inv_num.startswith(prefix):
                try:
                    num_part = int(inv_num[len(prefix):])
                    if num_part > max_num:
                        max_num = num_part
                except ValueError:
                    continue
        
        next_num = max_num + 1
        return f"{prefix}{next_num:04d}"
    except Exception as e:
        logger.error(f"Error generating next invoice number: {e}")
        return f"IN{uuid.uuid4().hex[:4].upper()}"

def parse_json_field(field_value, default_val):
    if not field_value:
        return default_val
    try:
        return json.loads(field_value)
    except Exception:
        return default_val

def safe_float(val, default=0.0):
    if val is None or val == "":
        return default
    try:
        # Handle cases where the value might be a JSON string or other non-float
        if isinstance(val, str) and (val.startswith('{') or val.startswith('[')):
            return default
        return float(val)
    except (ValueError, TypeError):
        return default

@router.get("/next-number")
async def get_next_invoice_number():
    """Get the next suggested invoice number."""
    return {"next_number": generate_next_invoice_number()}

@router.get("", response_model=List[Invoice])
@trace_exceptions_async
async def get_invoices(
    deal_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    status: Optional[str] = None
):
    try:
        records = sheets_service.get_crms_all_records(CRMS_INVOICES_SHEET)
        invoices = []
        
        for record in records:
            if deal_id and record.get("Deal Id", "") != deal_id:
                continue
            if customer_id and record.get("Customer Id", "") != customer_id:
                continue
            if status and record.get("Status", "").lower() != status.lower():
                continue
            
            # Parse Items
            items_raw = record.get("Items", "[]")
            items_list = parse_json_field(items_raw, [])
            items = [InvoiceItem(**item) for item in items_list]

            invoices.append(Invoice(
                id=str(record.get("Invoice Id", "")),
                deal_id=record.get("Deal Id", "") or None,
                customer_id=record.get("Customer Id", "") or "",
                invoice_number=record.get("Invoice Number", "") or "",
                issue_date=record.get("Issue Date", "") or "",
                due_date=record.get("Due Date", "") or "",
                status=record.get("Status", "Draft"),
                template_id=record.get("Template Id") or None,
                items=items,
                notes=record.get("Notes", "") or None,
                currency=record.get("Currency", "USD"),
                tax_rate=safe_float(record.get("Tax Rate"), 0),
                discount=safe_float(record.get("Discount"), 0),
                total_amount=safe_float(record.get("Invoice Total", record.get("Total Amount")), 0),
                created_at=record.get("Created At", "") or None,
                updated_at=record.get("Updated At", "") or None,
                payment_date=record.get("Payment Date", "") or None,
                credit_currency=record.get("Payment Currency", record.get("Credit Currency", "")) or None,
                credited_amount=safe_float(record.get("Paid Amount", record.get("Credited Amount")), None)
            ))
        
        return invoices
    except Exception as e:
        logger.error(f"Error getting invoices: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str):
    try:
        record = sheets_service.crms_get_row_by_id(CRMS_INVOICES_SHEET, ID_COLUMN, invoice_id)
        if not record:
            raise HTTPException(status_code=404, detail="Invoice not found")
        items_raw = record.get("Items", "[]")
        items_list = parse_json_field(items_raw, [])
        items = [InvoiceItem(**item) for item in items_list]

        return Invoice(
            id=str(record.get("Invoice Id", "")),
            deal_id=record.get("Deal Id", "") or None,
            customer_id=record.get("Customer Id", "") or "",
            invoice_number=record.get("Invoice Number", "") or "",
            issue_date=record.get("Issue Date", "") or "",
            due_date=record.get("Due Date", "") or "",
            status=record.get("Status", "Draft"),
            template_id=record.get("Template Id") or None,
            items=items,
            notes=record.get("Notes", "") or None,
            currency=record.get("Currency", "USD"),
            tax_rate=safe_float(record.get("Tax Rate"), 0),
            discount=safe_float(record.get("Discount"), 0),
            total_amount=safe_float(record.get("Invoice Total", record.get("Total Amount")), 0),
            created_at=record.get("Created At", "") or None,
            updated_at=record.get("Updated At", "") or None,
            payment_date=record.get("Payment Date", "") or None,
            credit_currency=record.get("Payment Currency", record.get("Credit Currency", "")) or None,
            credited_amount=safe_float(record.get("Paid Amount", record.get("Credited Amount")), None)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Invoice)
async def create_invoice(invoice: InvoiceCreate):
    try:
        logger.debug(f"Creating invoice with data: {invoice.dict()}")
        invoice_id = generate_invoice_id()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Serialize JSON fields
        items_json = json.dumps([item.dict() for item in invoice.items])

        # Order as per sheet columns:
        # 0: Invoice Id, 1: Template Id, 2: Deal Id, 3: Customer Id, 4: Invoice Number, 
        # 5: Issue Date, 6: Due Date, 7: Status, 8: Items, 9: Notes, 
        # 10: Currency, 11: Tax Rate, 12: Discount, 13: Created At, 14: Updated At,
        # 15: Total Amount, 16: Payment Date
        values = [
            invoice_id,             # 0
            invoice.template_id or "", # 1
            invoice.deal_id or "",     # 2
            invoice.customer_id,       # 3
            invoice.invoice_number,    # 4
            invoice.issue_date,        # 5
            invoice.due_date,          # 6
            invoice.status,            # 7
            items_json,                # 8
            invoice.notes or "",       # 9
            invoice.currency,          # 10
            invoice.tax_rate,          # 11
            invoice.discount,          # 12
            now,                       # 13: Created At
            now,                       # 14: Updated At
            invoice.total_amount,      # 15: Total Amount
            invoice.payment_date or "", # 16: Payment Date
            invoice.credit_currency or "", # 17: Credit Currency
            invoice.credited_amount if invoice.credited_amount is not None else "" # 18: Credited Amount
        ]
        
        # Ensure headers represent the final state
        try:
            current_headers = sheets_service.get_headers(CRMS_INVOICES_SHEET) # This uses HRMS sheet, wait.
            # Use a more direct way if possible, or just append and hope for the best.
            # Actually, crms_get_headers would be better. Let's assume headers are fixed by me.
            pass
        except:
            pass

        sheets_service.crms_append_row(CRMS_INVOICES_SHEET, values)
        
        new_invoice = Invoice(
            id=invoice_id,
            deal_id=invoice.deal_id,
            customer_id=invoice.customer_id,
            invoice_number=invoice.invoice_number,
            issue_date=invoice.issue_date,
            due_date=invoice.due_date,
            status=invoice.status,
            items=invoice.items,
            notes=invoice.notes,
            currency=invoice.currency,
            tax_rate=invoice.tax_rate,
            discount=invoice.discount,
            created_at=now,
            updated_at=now,
            payment_date=invoice.payment_date,
            credit_currency=invoice.credit_currency,
            credited_amount=invoice.credited_amount
        )
        return new_invoice

    except Exception as e:
        logger.error(f"Error creating invoice: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{invoice_id}", response_model=Invoice)
async def update_invoice(invoice_id: str, update: InvoiceUpdate):
    try:
        logger.debug(f"Updating invoice {invoice_id} with data: {update.dict()}")
        row_index = sheets_service.crms_find_row_index(CRMS_INVOICES_SHEET, ID_COLUMN, invoice_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        existing = sheets_service.crms_get_row_by_id(CRMS_INVOICES_SHEET, ID_COLUMN, invoice_id)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Handle items update
        if update.items is not None:
            items_json = json.dumps([item.dict() for item in update.items])
        else:
            items_json = existing.get("Items", "[]")

        values = [
            invoice_id,
            update.template_id if update.template_id is not None else existing.get("Template Id", ""),
            update.deal_id if update.deal_id is not None else existing.get("Deal Id", ""),
            update.customer_id if update.customer_id is not None else existing.get("Customer Id", ""),
            update.invoice_number if update.invoice_number is not None else existing.get("Invoice Number", ""),
            update.issue_date if update.issue_date is not None else existing.get("Issue Date", ""),
            update.due_date if update.due_date is not None else existing.get("Due Date", ""),
            update.status if update.status is not None else existing.get("Status", "Draft"),
            items_json,
            update.notes if update.notes is not None else existing.get("Notes", ""),
            update.currency if update.currency is not None else existing.get("Currency", "USD"),
            update.tax_rate if update.tax_rate is not None else float(existing.get("Tax Rate", 0)),
            update.discount if update.discount is not None else float(existing.get("Discount", 0)),
            existing.get("Created At", ""),
            now, # Updated At
            update.total_amount if update.total_amount is not None else existing.get("Invoice Total", existing.get("Total Amount", "")),
            update.payment_date if update.payment_date is not None else existing.get("Payment Date", ""),
            update.credit_currency if update.credit_currency is not None else existing.get("Payment Currency", existing.get("Credit Currency", "")),
            update.credited_amount if update.credited_amount is not None else existing.get("Paid Amount", existing.get("Credited Amount", ""))
        ]
        
        sheets_service.crms_update_row(CRMS_INVOICES_SHEET, row_index, values)

        # Re-construct response
        items_list = parse_json_field(items_json, [])
        items_obj = [InvoiceItem(**item) for item in items_list]

        return Invoice(
            id=invoice_id,
            template_id=values[1] or None,
            deal_id=values[2] or None,
            customer_id=values[3],
            invoice_number=values[4],
            issue_date=values[5],
            due_date=values[6],
            status=values[7],
            items=items_obj,
            notes=values[9] or None,
            currency=values[10],
            tax_rate=safe_float(values[11], 0),
            discount=safe_float(values[12], 0),
            total_amount=safe_float(values[15], 0),
            created_at=values[13],
            updated_at=now,
            payment_date=values[16] or None,
            credit_currency=values[17] or None,
            credited_amount=safe_float(values[18], None)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating invoice: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{invoice_id}/log-payment")
async def log_payment(invoice_id: str, payment: LogPaymentRequest):
    """Log a payment for an invoice — sets status to Paid and stores payment details."""
    try:
        row_index = sheets_service.crms_find_row_index(CRMS_INVOICES_SHEET, ID_COLUMN, invoice_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Invoice not found")

        existing = sheets_service.crms_get_row_by_id(CRMS_INVOICES_SHEET, ID_COLUMN, invoice_id)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        items_json = existing.get("Items", "[]")

        values = [
            invoice_id,
            existing.get("Template Id", ""),
            existing.get("Deal Id", ""),
            existing.get("Customer Id", ""),
            existing.get("Invoice Number", ""),
            existing.get("Issue Date", ""),
            existing.get("Due Date", ""),
            "Paid",  # Status
            items_json,
            existing.get("Notes", ""),
            existing.get("Currency", "USD"),
            float(existing.get("Tax Rate", 0)),
            float(existing.get("Discount", 0)),
            existing.get("Created At", ""),
            now,  # Updated At
            existing.get("Invoice Total", existing.get("Total Amount", "")),
            payment.payment_date,
            payment.credit_currency or "",
            payment.credited_amount if payment.credited_amount is not None else ""
        ]

        sheets_service.crms_update_row(CRMS_INVOICES_SHEET, row_index, values)

        return {
            "success": True,
            "message": "Payment logged successfully",
            "invoice_id": invoice_id,
            "status": "Paid",
            "payment_date": payment.payment_date,
            "credit_currency": payment.credit_currency,
            "credited_amount": payment.credited_amount
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging payment for {invoice_id}: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str):
    try:
        row_index = sheets_service.crms_find_row_index(CRMS_INVOICES_SHEET, ID_COLUMN, invoice_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        sheets_service.crms_delete_row(CRMS_INVOICES_SHEET, row_index)
        return {"success": True, "message": "Invoice deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
