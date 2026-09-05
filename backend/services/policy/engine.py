from typing import Dict, Any, List, Optional
from datetime import datetime
from .models import PolicyResult, FinancialBreakdown

class PolicyEngine:
    @staticmethod
    def evaluate_cancellation(item: Dict[str, Any], reference_time: Optional[datetime] = None) -> PolicyResult:
        item_id = item.get("id", 0)
        cost = float(item.get("cost", 0.0))
        refundable = bool(item.get("refundable", False))
        refund_pct = float(item.get("refund_percentage", 0.0))
        canc_fee = float(item.get("cancellation_fee", 0.0))
        canc_deadline = item.get("cancellation_deadline")

        if isinstance(canc_deadline, str):
            canc_deadline = datetime.fromisoformat(canc_deadline)

        ref_time = reference_time or datetime.now()

        # Check deadline
        if canc_deadline and ref_time > canc_deadline:
            return PolicyResult(
                item_id=item_id,
                allowed=False,
                action="CANCEL",
                fee=0.0,
                refund_amount=0.0,
                lost_amount=cost,
                reason="Cancellation deadline expired"
            )

        if not refundable:
            return PolicyResult(
                item_id=item_id,
                allowed=True,
                action="CANCEL",
                fee=0.0,
                refund_amount=0.0,
                lost_amount=cost,
                reason="Non-refundable item: total cost forfeited"
            )

        refund = round(cost * (refund_pct / 100.0), 2)
        lost = round(cost - refund, 2)
        return PolicyResult(
            item_id=item_id,
            allowed=True,
            action="CANCEL",
            fee=canc_fee,
            refund_amount=refund,
            lost_amount=lost,
            reason=f"Refundable ({refund_pct}% refund eligible, fee: ₹{canc_fee})"
        )

    @staticmethod
    def evaluate_change(item: Dict[str, Any], reference_time: Optional[datetime] = None) -> PolicyResult:
        item_id = item.get("id", 0)
        changeable = bool(item.get("changeable", False))
        change_fee = float(item.get("change_fee", 0.0))
        change_deadline = item.get("change_deadline")

        if isinstance(change_deadline, str):
            change_deadline = datetime.fromisoformat(change_deadline)

        ref_time = reference_time or datetime.now()

        if change_deadline and ref_time > change_deadline:
            return PolicyResult(
                item_id=item_id,
                allowed=False,
                action="CHANGE",
                fee=0.0,
                refund_amount=0.0,
                lost_amount=0.0,
                reason="Change deadline expired"
            )

        if not changeable:
            return PolicyResult(
                item_id=item_id,
                allowed=False,
                action="CHANGE",
                fee=0.0,
                refund_amount=0.0,
                lost_amount=0.0,
                reason="Item policy does not permit changes (non-changeable)"
            )

        return PolicyResult(
            item_id=item_id,
            allowed=True,
            action="CHANGE",
            fee=change_fee,
            refund_amount=0.0,
            lost_amount=0.0,
            reason=f"Change permitted with ₹{change_fee} modification fee"
        )

    @classmethod
    def calculate_net_cost(
        cls,
        removed_items: List[Dict[str, Any]],
        added_items: List[Dict[str, Any]],
        modified_items: List[Dict[str, Any]],
        reference_time: Optional[datetime] = None
    ) -> FinancialBreakdown:
        """
        Dynamically computes net cost:
        net_cost = new_booking_cost + change_fee + cancellation_fee + lost_non_refundable_amount - refund_received
        """
        item_policies: Dict[int, PolicyResult] = {}
        new_booking_cost = sum(float(it.get("cost", 0.0)) for it in added_items)
        
        cancellation_fees = 0.0
        refund_received = 0.0
        lost_non_refundable = 0.0

        for it in removed_items:
            res = cls.evaluate_cancellation(it, reference_time)
            item_policies[it.get("id", 0)] = res
            cancellation_fees += res.fee
            refund_received += res.refund_amount
            lost_non_refundable += res.lost_amount

        change_fees = 0.0
        for it in modified_items:
            res = cls.evaluate_change(it, reference_time)
            item_policies[it.get("id", 0)] = res
            change_fees += res.fee

        net_cost = (
            new_booking_cost
            + change_fees
            + cancellation_fees
            + lost_non_refundable
            - refund_received
        )

        return FinancialBreakdown(
            new_booking_cost=round(new_booking_cost, 2),
            change_fees=round(change_fees, 2),
            cancellation_fees=round(cancellation_fees, 2),
            refund_received=round(refund_received, 2),
            lost_non_refundable_amount=round(lost_non_refundable, 2),
            net_cost=round(net_cost, 2),
            currency=added_items[0].get("currency", "INR") if added_items else "INR",
            item_policies=item_policies
        )
