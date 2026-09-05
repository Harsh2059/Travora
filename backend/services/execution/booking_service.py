import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

class BookingConfirmation(BaseModel):
    confirmation_code: str
    provider: str
    item_type: str
    booking_reference: str
    seat_or_room: Optional[str] = None
    status: str = "CONFIRMED"
    cost: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CancellationConfirmation(BaseModel):
    confirmation_code: str
    provider: str
    original_booking_id: Optional[str] = None
    refund_amount: float = 0.0
    cancellation_fee: float = 0.0
    refund_transaction_id: str
    status: str = "CANCELLED"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MockBookingService:
    """
    Executes real stateful booking/cancellation simulation workflow with
    seat allocations, room assignments, voucher generation, and refund slips.
    """

    @classmethod
    def execute_booking(cls, item: Dict[str, Any]) -> BookingConfirmation:
        item_type = item.get("type", "FLIGHT").upper()
        provider = item.get("provider", "Replacement Provider")
        unique_id = uuid.uuid4().hex[:6].upper()
        conf_code = f"CONF-{item_type[:3]}-{unique_id}"

        seat_or_room = None
        if item_type == "FLIGHT":
            # Realistic seat allocation
            row = (hash(conf_code) % 28) + 1
            seat_letter = ["A", "B", "C", "D", "E", "F"][hash(conf_code) % 6]
            seat_or_room = f"Seat {row}{seat_letter}"
        elif item_type == "HOTEL":
            room_no = 200 + (hash(conf_code) % 500)
            seat_or_room = f"Deluxe King Room #{room_no}"
        elif item_type == "TRANSFER":
            seat_or_room = f"Express Priority Carriage {1 + (hash(conf_code) % 4)}"
        elif item_type == "EVENT":
            seat_or_room = f"Delegate VIP Pass #{unique_id}"

        return BookingConfirmation(
            confirmation_code=conf_code,
            provider=provider,
            item_type=item_type,
            booking_reference=item.get("booking_id", conf_code),
            seat_or_room=seat_or_room,
            status="CONFIRMED",
            cost=float(item.get("cost", 0.0))
        )

    @classmethod
    def execute_cancellation(cls, item: Dict[str, Any], refund_amount: float, fee_applied: float) -> CancellationConfirmation:
        provider = item.get("provider", "Original Provider")
        trx_id = f"RF-TRX-{uuid.uuid4().hex[:8].upper()}"
        conf_code = f"CANC-{uuid.uuid4().hex[:6].upper()}"

        return CancellationConfirmation(
            confirmation_code=conf_code,
            provider=provider,
            original_booking_id=item.get("booking_id"),
            refund_amount=max(0.0, float(refund_amount)),
            cancellation_fee=max(0.0, float(fee_applied)),
            refund_transaction_id=trx_id,
            status="CANCELLED"
        )
