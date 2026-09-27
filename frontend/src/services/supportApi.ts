import axios from 'axios';
import { API_BASE_URL } from '../store/journeyStore';

export interface SupportTicket {
  id: number;
  ticket_number: string;
  user_id: string;
  journey_id?: number | null;
  category: string;
  description: string;
  attachment_url?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  created_at: string;
  updated_at?: string | null;
  resolved_at?: string | null;
}

export interface SupportTicketCreatePayload {
  category: string;
  description: string;
  journey_id?: number | null;
  attachment_url?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
}

export interface SupportFaqItem {
  id: string;
  category: 'Journey' | 'Disruptions' | 'Recovery' | 'Notifications' | 'Account' | string;
  question: string;
  answer: string;
}

export interface SupportContactInfo {
  support_email?: string | null;
  support_phone?: string | null;
  whatsapp_helpline?: string | null;
  operating_hours: string;
  note: string;
}

// ── Built-in Fallback FAQs ──────────────────────────────────────────────────
export const FALLBACK_FAQS: SupportFaqItem[] = [
  // Journey
  {
    id: 'faq-journey-1',
    category: 'Journey',
    question: 'How do I create a journey?',
    answer: 'You can create a journey by navigating to the Home or Trip Builder screen, selecting your origin and destination, choosing flight/transport options, and confirming your itinerary.'
  },
  {
    id: 'faq-journey-2',
    category: 'Journey',
    question: 'How do I view my journey timeline?',
    answer: 'Select "My Trips" or "Journey Timeline" from the top navigation. You will see a chronological visualization of every leg of your travel with live status indicators.'
  },
  {
    id: 'faq-journey-3',
    category: 'Journey',
    question: 'How does Travora track my journey?',
    answer: 'Travora continuously monitors airline schedules, flight radar feeds, weather telemetry, and transport connection points to detect disruptions in real-time.'
  },
  // Disruptions
  {
    id: 'faq-disruptions-1',
    category: 'Disruptions',
    question: 'What happens when my flight is disrupted?',
    answer: 'Travora automatically detects the flight delay or cancellation, evaluates the impact on downstream legs (hotels, connecting trains, transfers), and generates optimal recovery itineraries.'
  },
  {
    id: 'faq-disruptions-2',
    category: 'Disruptions',
    question: 'How does Travora detect disruptions?',
    answer: 'Our system connects with civil aviation data providers, airport weather nodes, and live delay telemetry to identify schedule anomalies before they cascade.'
  },
  {
    id: 'faq-disruptions-3',
    category: 'Disruptions',
    question: 'What should I do when a disruption occurs?',
    answer: 'Open your Travora Disruption Alert banner or navigate to the "Disruptions & Recovery" screen to review curated recovery plans and select your preferred alternative.'
  },
  // Recovery
  {
    id: 'faq-recovery-1',
    category: 'Recovery',
    question: 'How does Travora provide recovery options?',
    answer: 'Travora\'s multi-modal recovery engine calculates replacement routes combining flights, high-speed rail, express road transfers, and hotel vouchers tailored to your time and budget.'
  },
  {
    id: 'faq-recovery-2',
    category: 'Recovery',
    question: 'How do I select a recovery option?',
    answer: 'On the Disruption screen or via WhatsApp interactive prompt, review the comparison cards (Speed, Cost, Directness). Tap "Select Recovery Option" to confirm your choice.'
  },
  {
    id: 'faq-recovery-3',
    category: 'Recovery',
    question: 'What happens after I select a recovery option?',
    answer: 'Your itinerary updates dynamically, digital boarding passes / tickets are regenerated, and notifications are sent with your revised schedule.'
  },
  // Notifications
  {
    id: 'faq-notifications-1',
    category: 'Notifications',
    question: 'How do Travora notifications work?',
    answer: 'Travora delivers multi-channel alerts including in-app status banners, instant SMS updates, and WhatsApp interactive messages directly to your verified phone number.'
  },
  {
    id: 'faq-notifications-2',
    category: 'Notifications',
    question: 'What happens if I don\'t receive a notification?',
    answer: 'Ensure your phone number and WhatsApp number are up to date in your Profile settings. You can also view all real-time alerts anytime on your dashboard.'
  },
  // Account
  {
    id: 'faq-account-1',
    category: 'Account',
    question: 'How do I manage my account?',
    answer: 'Click your profile avatar in the navigation bar and select "Profile & Travel Preferences" to manage your personal details and contact numbers.'
  },
  {
    id: 'faq-account-2',
    category: 'Account',
    question: 'How do I update my information?',
    answer: 'In the Profile modal, modify your name, email, phone number, or WhatsApp number, then click "Save Changes".'
  }
];

// ── API Functions ────────────────────────────────────────────────────────────

export async function fetchSupportFaqs(): Promise<SupportFaqItem[]> {
  try {
    const res = await axios.get<SupportFaqItem[]>(`${API_BASE_URL}/support/faqs`);
    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
    return FALLBACK_FAQS;
  } catch (error) {
    console.warn('Could not fetch remote FAQs, using built-in FAQs:', error);
    return FALLBACK_FAQS;
  }
}

export async function fetchSupportContactInfo(): Promise<SupportContactInfo> {
  try {
    const res = await axios.get<SupportContactInfo>(`${API_BASE_URL}/support/contact`);
    return res.data;
  } catch {
    return {
      support_email: 'support@travora.travel',
      support_phone: null,
      whatsapp_helpline: null,
      operating_hours: '24/7 Operations Desk for Active Disruptions',
      note: 'For active travel emergencies, support tickets submitted via Report an Issue receive priority triage.'
    };
  }
}

const LOCAL_TICKETS_KEY = 'travora_support_tickets';

function getLocalTickets(): SupportTicket[] {
  try {
    const raw = localStorage.getItem(LOCAL_TICKETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTicket(ticket: SupportTicket): void {
  try {
    const existing = getLocalTickets();
    const filtered = existing.filter(
      (t) => t.id !== ticket.id && t.ticket_number !== ticket.ticket_number
    );
    const updated = [ticket, ...filtered];
    localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('travora_support_ticket_created', { detail: ticket }));
  } catch (e) {
    console.error('Error saving support ticket to localStorage:', e);
  }
}

export async function createSupportTicket(payload: SupportTicketCreatePayload): Promise<SupportTicket> {
  try {
    const res = await axios.post<SupportTicket>(`${API_BASE_URL}/support/tickets`, payload);
    const ticket = res.data;
    saveLocalTicket(ticket);
    return ticket;
  } catch (err: any) {
    // If backend is unreachable, create a local offline ticket
    const localNumber = `TRV-${Math.floor(10000 + Math.random() * 90000)}`;
    const fallbackTicket: SupportTicket = {
      id: Date.now(),
      ticket_number: localNumber,
      user_id: '1',
      journey_id: payload.journey_id,
      category: payload.category,
      description: payload.description,
      attachment_url: payload.attachment_url,
      status: 'OPEN',
      priority: payload.priority || 'MEDIUM',
      created_at: new Date().toISOString(),
    };
    saveLocalTicket(fallbackTicket);
    return fallbackTicket;
  }
}

export async function fetchMySupportTickets(): Promise<SupportTicket[]> {
  const localList = getLocalTickets();
  try {
    const res = await axios.get<SupportTicket[]>(`${API_BASE_URL}/support/tickets/my`);
    const serverList = Array.isArray(res.data) ? res.data : [];
    
    // Merge server tickets and local tickets
    const seen = new Set<string>();
    const merged: SupportTicket[] = [];

    for (const t of serverList) {
      if (!seen.has(t.ticket_number)) {
        seen.add(t.ticket_number);
        merged.push(t);
      }
    }

    for (const t of localList) {
      if (!seen.has(t.ticket_number)) {
        seen.add(t.ticket_number);
        merged.push(t);
      }
    }

    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return merged;
  } catch {
    return localList;
  }
}

export async function fetchSupportTicketDetails(ticketIdentifier: string): Promise<SupportTicket> {
  const localList = getLocalTickets();
  const localMatch = localList.find(
    (t) => String(t.id) === ticketIdentifier || t.ticket_number === ticketIdentifier
  );

  try {
    const res = await axios.get<SupportTicket>(`${API_BASE_URL}/support/tickets/${ticketIdentifier}`);
    return res.data;
  } catch (err: any) {
    if (localMatch) return localMatch;
    const message = err.response?.data?.detail || 'Failed to load ticket details.';
    throw new Error(message);
  }
}

