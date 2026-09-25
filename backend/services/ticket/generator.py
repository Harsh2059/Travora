import os
import uuid
import qrcode
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors

class TicketGenerator:
    @staticmethod
    def generate_ticket_id() -> str:
        return f"TRV-TKT-{uuid.uuid4().hex[:8].upper()}"

    @staticmethod
    def _create_qr_code(data: str) -> BytesIO:
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        img_buffer = BytesIO()
        img.save(img_buffer, format="PNG")
        img_buffer.seek(0)
        return img_buffer

    @staticmethod
    def generate_pdf(ticket: dict) -> BytesIO:
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter

        # Header
        c.setFillColor(colors.HexColor("#0ea5e9")) # Sky blue
        c.rect(0, height - 1.5 * inch, width, 1.5 * inch, fill=True, stroke=False)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 24)
        c.drawString(1 * inch, height - 0.8 * inch, "TRAVORA")
        c.setFont("Helvetica", 14)
        c.drawString(1 * inch, height - 1.1 * inch, "Digital Travel Ticket")

        # Ticket Info
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(1 * inch, height - 2 * inch, "PASSENGER INFORMATION")
        c.setFont("Helvetica", 11)
        c.drawString(1 * inch, height - 2.3 * inch, f"Name: {ticket.get('passenger_name', 'N/A')}")
        c.drawString(1 * inch, height - 2.5 * inch, f"Ticket ID: {ticket.get('ticket_id')}")

        c.setFont("Helvetica-Bold", 12)
        c.drawString(1 * inch, height - 3 * inch, "TRANSPORT INFORMATION")
        c.setFont("Helvetica", 11)
        c.drawString(1 * inch, height - 3.3 * inch, f"Mode: {ticket.get('transport_mode')}")
        c.drawString(1 * inch, height - 3.5 * inch, f"Provider: {ticket.get('provider')}")
        if ticket.get('transport_identifier'):
            c.drawString(1 * inch, height - 3.7 * inch, f"Identifier: {ticket.get('transport_identifier')}")

        # Journey
        if ticket.get('origin') and ticket.get('destination'):
            c.setFont("Helvetica-Bold", 12)
            c.drawString(1 * inch, height - 4.2 * inch, "JOURNEY")
            c.setFont("Helvetica", 11)
            c.drawString(1 * inch, height - 4.5 * inch, f"From: {ticket.get('origin')}  To: {ticket.get('destination')}")
            
            if ticket.get('departure_time'):
                dept = ticket.get('departure_time')
                if isinstance(dept, str):
                    try:
                        dept = datetime.fromisoformat(dept.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M")
                    except Exception:
                        pass
                elif isinstance(dept, datetime):
                    dept = dept.strftime("%Y-%m-%d %H:%M")
                c.drawString(1 * inch, height - 4.7 * inch, f"Departure: {dept}")

        # Booking / PNR
        y_pos = height - 5.2 * inch
        if ticket.get('pnr') or ticket.get('booking_reference'):
            c.setFont("Helvetica-Bold", 12)
            c.drawString(1 * inch, y_pos, "BOOKING REFERENCE")
            c.setFont("Helvetica", 11)
            y_pos -= 0.3 * inch
            if ticket.get('pnr'):
                c.drawString(1 * inch, y_pos, f"PNR: {ticket.get('pnr')}")
                y_pos -= 0.2 * inch
            if ticket.get('booking_reference'):
                c.drawString(1 * inch, y_pos, f"Ref: {ticket.get('booking_reference')}")
                y_pos -= 0.2 * inch

        # Add-ons
        y_pos -= 0.3 * inch
        addons = []
        if ticket.get('seat'): addons.append(f"Seat: {ticket.get('seat')}")
        if ticket.get('terminal'): addons.append(f"Terminal: {ticket.get('terminal')}")
        if ticket.get('platform'): addons.append(f"Platform: {ticket.get('platform')}")
        if ticket.get('coach'): addons.append(f"Coach: {ticket.get('coach')}")
        if ticket.get('baggage_info'): addons.append(f"Baggage: {ticket.get('baggage_info')}")
        if ticket.get('meal_info'): addons.append(f"Meal: {ticket.get('meal_info')}")
        
        if addons:
            c.setFont("Helvetica-Bold", 12)
            c.drawString(1 * inch, y_pos, "ADDITIONAL INFO")
            c.setFont("Helvetica", 11)
            y_pos -= 0.3 * inch
            for addon in addons:
                c.drawString(1 * inch, y_pos, addon)
                y_pos -= 0.2 * inch

        # QR Code
        qr_buffer = TicketGenerator._create_qr_code(ticket.get('ticket_id', ''))
        qr_img = ImageReader(qr_buffer)
        c.drawImage(qr_img, width - 3 * inch, height - 4 * inch, width=2 * inch, height=2 * inch)
        
        c.setFont("Helvetica", 10)
        c.drawString(width - 2.8 * inch, height - 4.2 * inch, "Scan to Validate Ticket")

        c.showPage()
        c.save()

        buffer.seek(0)
        return buffer
