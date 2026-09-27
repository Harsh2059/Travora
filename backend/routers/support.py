import os
import random
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import routers.auth as auth

router = APIRouter(prefix="/api/support", tags=["Support"])

SUPPORT_CATEGORIES = [
    "Flight / Transport Issue",
    "Hotel / Stay Issue",
    "Journey / Timeline Issue",
    "Notification / SMS Issue",
    "Recovery Issue",
    "App / Technical Issue",
    "Account / Security Issue",
    "Other"
]

FAQ_DATA = [
    # ── Journey ─────────────────────────────────────────────────────────────
    {
        "id": "faq-journey-1",
        "category": "Journey",
        "question": "How do I create a journey?",
        "answer": "You can create a journey by navigating to the Home or Trip Builder screen, entering your origin, destination, travel dates, and transport legs (flights, trains, cabs, hotels), and confirming your itinerary."
    },
    {
        "id": "faq-journey-2",
        "category": "Journey",
        "question": "How do I view my journey timeline?",
        "answer": "Visit 'My Trips' or select 'Journey Timeline' from the top navigation. There you will find an interactive chronological timeline showing all upcoming and completed legs of your travel."
    },
    {
        "id": "faq-journey-3",
        "category": "Journey",
        "question": "How does Travora track my journey?",
        "answer": "Travora continuously monitors real-time airline schedules, rail operational statuses, and live atmospheric / weather conditions along your route using the Digital Twin engine."
    },

    # ── Disruptions ─────────────────────────────────────────────────────────
    {
        "id": "faq-disruptions-1",
        "category": "Disruptions",
        "question": "What happens when my flight is disrupted?",
        "answer": "When a flight delay, cancellation, or missed connection occurs, Travora instantly identifies the downstream impact and alerts you with high-priority notifications across Web, SMS, and WhatsApp."
    },
    {
        "id": "faq-disruptions-2",
        "category": "Disruptions",
        "question": "How does Travora detect disruptions?",
        "answer": "Travora integrates with aviation status feeds, ATC ground delay programs, and predictive weather simulation nodes to detect disruptions before they cause cascading travel bottlenecks."
    },
    {
        "id": "faq-disruptions-3",
        "category": "Disruptions",
        "question": "What should I do when a disruption occurs?",
        "answer": "Open your Disruption Alert banner or navigate to the 'Disruptions & Recovery' screen. Review the AI-generated recovery plans tailored to your timeline, and tap to confirm your preferred alternative."
    },

    # ── Recovery ────────────────────────────────────────────────────────────
    {
        "id": "faq-recovery-1",
        "category": "Recovery",
        "question": "How does Travora provide recovery options?",
        "answer": "The multi-modal recovery engine calculates optimal replacement routes combining flights, high-speed rail, express transfers, and emergency hotel stays while preserving downstream bookings."
    },
    {
        "id": "faq-recovery-2",
        "category": "Recovery",
        "question": "How do I select a recovery option?",
        "answer": "On the Disruption screen or via WhatsApp interactive prompt, review the comparison cards (Speed, Cost, Directness). Tap 'Select Recovery Option' to re-validate and rebook your itinerary seamlessly."
    },
    {
        "id": "faq-recovery-3",
        "category": "Recovery",
        "question": "What happens after I select a recovery option?",
        "answer": "Your trip version updates immediately, replacement digital tickets are issued with new booking references and seat assignments, and notifications are sent with your new itinerary."
    },

    # ── Notifications ───────────────────────────────────────────────────────
    {
        "id": "faq-notifications-1",
        "category": "Notifications",
        "question": "How do Travora notifications work?",
        "answer": "Travora sends multi-channel alerts including in-app status updates, SMS dispatch, and interactive WhatsApp recovery messages directly to your registered mobile number."
    },
    {
        "id": "faq-notifications-2",
        "category": "Notifications",
        "question": "What happens if I don't receive a notification?",
        "answer": "Verify that your phone number and WhatsApp number are correctly saved in your Profile settings. You can also view all active alerts anytime directly on your Travora web dashboard."
    },

    # ── Account ─────────────────────────────────────────────────────────────
    {
        "id": "faq-account-1",
        "category": "Account",
        "question": "How do I manage my account?",
        "answer": "Click your profile avatar in the top right corner of the navigation bar and select 'Profile & Travel Preferences' to view and modify your account details."
    },
    {
        "id": "faq-account-2",
        "category": "Account",
        "question": "How do I update my information?",
        "answer": "In your Profile modal, update your full name, email address, mobile number, or WhatsApp contact number, then click 'Save Changes' to synchronize across your account."
    }
]


def generate_ticket_number(db: Session) -> str:
    """Generate a unique reference number formatted as TRV-XXXXX."""
    for _ in range(10):
        candidate = f"TRV-{random.randint(10000, 99999)}"
        exists = db.query(models.SupportTicket).filter(models.SupportTicket.ticket_number == candidate).first()
        if not exists:
            return candidate
    return f"TRV-{int(datetime.utcnow().timestamp()) % 100000:05d}"


@router.get("/faqs", response_model=List[schemas.SupportFaqItem])
def get_faqs():
    """Retrieve organized FAQ topics."""
    return FAQ_DATA


@router.get("/contact", response_model=schemas.SupportContactInfo)
def get_contact_info():
    """Retrieve official Travora support contact information."""
    support_email = os.getenv("TRAVORA_SUPPORT_EMAIL") or os.getenv("SUPPORT_EMAIL")
    support_phone = os.getenv("TRAVORA_SUPPORT_PHONE") or os.getenv("SUPPORT_PHONE")
    whatsapp_helpline = os.getenv("TRAVORA_WHATSAPP_HELPLINE") or os.getenv("WHATSAPP_PHONE")
    
    return schemas.SupportContactInfo(
        support_email=support_email or "support@travora.travel",
        support_phone=support_phone,
        whatsapp_helpline=whatsapp_helpline,
        operating_hours="24/7 Operations Desk for Active Disruptions",
        note="For active travel emergencies, support tickets submitted via Report an Issue receive priority triage."
    )


@router.post("/tickets", response_model=schemas.SupportTicketResponse, status_code=status.HTTP_201_CREATED)
def create_support_ticket(
    payload: schemas.SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Submit a support issue ticket.
    Authenticated users only. Associates ticket with current user securely.
    """
    category = payload.category.strip()
    if not category:
        raise HTTPException(status_code=400, detail="Category is required.")
    
    description = payload.description.strip()
    if not description or len(description) < 5:
        raise HTTPException(status_code=400, detail="Please provide a detailed description (at least 5 characters).")

    # If journey_id is provided, verify it belongs to current user
    if payload.journey_id is not None:
        trip = db.query(models.Trip).filter(models.Trip.id == payload.journey_id).first()
        if trip:
            if str(trip.user_id) != str(current_user.id) and getattr(current_user, "role", "") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to associate another user's journey with this ticket."
                )

    ticket_number = generate_ticket_number(db)
    
    ticket = models.SupportTicket(
        ticket_number=ticket_number,
        user_id=str(current_user.id),
        journey_id=payload.journey_id,
        category=category,
        description=description,
        attachment_url=payload.attachment_url,
        status="OPEN",
        priority=payload.priority or "MEDIUM",
        created_at=datetime.utcnow()
    )

    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/tickets/my", response_model=List[schemas.SupportTicketResponse])
def get_my_support_tickets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Retrieve all support tickets filed by the authenticated user."""
    tickets = db.query(models.SupportTicket).filter(
        models.SupportTicket.user_id == str(current_user.id)
    ).order_by(models.SupportTicket.created_at.desc()).all()
    return tickets


@router.get("/tickets/{ticket_identifier}", response_model=schemas.SupportTicketResponse)
def get_support_ticket_details(
    ticket_identifier: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Retrieve single ticket by id or ticket_number.
    Enforces authorization: users can only see their own tickets.
    """
    query = db.query(models.SupportTicket)
    if ticket_identifier.isdigit():
        ticket = query.filter(models.SupportTicket.id == int(ticket_identifier)).first()
    else:
        ticket = query.filter(models.SupportTicket.ticket_number == ticket_identifier).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found.")

    if str(ticket.user_id) != str(current_user.id) and getattr(current_user, "role", "") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to access this support ticket.")

    return ticket


