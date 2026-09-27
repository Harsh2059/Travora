from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import routers.auth as auth

router = APIRouter(prefix="/api/feedback", tags=["Feedback"])

VALID_EVENT_TYPES = {
    "JOURNEY_CREATED",
    "DISRUPTION_INFORMATION",
    "RECOVERY_RECOMMENDATION",
    "JOURNEY_COMPLETED"
}

@router.post("", response_model=schemas.FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_micro_feedback(
    payload: schemas.FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Submit a contextual micro-feedback response.
    Secured to authenticated user with journey ownership verification.
    """
    event_type = payload.event_type.strip().upper()
    if event_type not in VALID_EVENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid event_type. Must be one of: {', '.join(sorted(VALID_EVENT_TYPES))}"
        )

    # Validate rating if provided
    if payload.rating is not None:
        if not (1 <= payload.rating <= 5):
            raise HTTPException(status_code=400, detail="Rating must be an integer between 1 and 5.")

    # Validate message length
    message = payload.message.strip() if payload.message else None
    if message and len(message) > 500:
        message = message[:500]

    # Verify journey ownership if journey_id is provided
    if payload.journey_id is not None:
        trip = db.query(models.Trip).filter(models.Trip.id == payload.journey_id).first()
        if trip:
            if str(trip.user_id) != str(current_user.id) and getattr(current_user, "role", "") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You cannot attach feedback to another user's journey."
                )

    feedback_record = models.Feedback(
        user_id=str(current_user.id),
        journey_id=payload.journey_id,
        event_type=event_type,
        rating=payload.rating,
        response_type=payload.response_type,
        response_value=payload.response_value,
        message=message,
        context=payload.context or {},
        created_at=datetime.now(timezone.utc)
    )

    db.add(feedback_record)
    db.commit()
    db.refresh(feedback_record)
    return feedback_record


@router.get("/status", response_model=schemas.FeedbackCheckResponse)
def check_feedback_status(
    event_type: str = Query(..., description="Event type to check"),
    journey_id: Optional[int] = Query(None, description="Optional journey ID"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Check if the current user has already provided feedback for a specific event / journey.
    """
    query = db.query(models.Feedback).filter(
        models.Feedback.user_id == str(current_user.id),
        models.Feedback.event_type == event_type.strip().upper()
    )

    if journey_id is not None:
        query = query.filter(models.Feedback.journey_id == journey_id)

    existing = query.order_by(models.Feedback.created_at.desc()).first()
    if existing:
        return schemas.FeedbackCheckResponse(has_feedback=True, feedback=existing)
    
    return schemas.FeedbackCheckResponse(has_feedback=False, feedback=None)
