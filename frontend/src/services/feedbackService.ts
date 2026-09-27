import axios from 'axios';
import { API_BASE_URL } from '../store/journeyStore';

export type FeedbackEventType =
  | 'JOURNEY_CREATED'
  | 'DISRUPTION_INFORMATION'
  | 'RECOVERY_RECOMMENDATION'
  | 'JOURNEY_COMPLETED';

export type FeedbackResponseType = 'RATING' | 'YES_NO' | 'MULTI_OPTION';

export interface FeedbackContext {
  recovery_plan_id?: string;
  transport_type?: string;
  disruption_type?: string;
  source_screen?: string;
  [key: string]: any;
}

export interface FeedbackSubmissionPayload {
  journey_id?: number | null;
  event_type: FeedbackEventType;
  rating?: number | null;
  response_type?: FeedbackResponseType | null;
  response_value?: string | null;
  message?: string | null;
  context?: FeedbackContext;
}

export interface FeedbackOption {
  label: string;
  value: string;
}

export interface FeedbackPromptConfig {
  eventType: FeedbackEventType;
  journeyId?: number | null;
  title: string;
  subtitle?: string;
  question?: string;
  responseType: FeedbackResponseType;
  options?: Array<FeedbackOption | string>;
  followUpOptions?: Array<FeedbackOption | string>;
  followUpQuestion?: string;
  context?: FeedbackContext;
  delayMs?: number;
}

const STORAGE_KEY = 'travora_feedback_history';
const SESSION_PROMPT_KEY = 'travora_last_feedback_prompt_ts';

// Priority weight: Recovery > Disruption > Journey Completed > Journey Created
const EVENT_PRIORITY: Record<FeedbackEventType, number> = {
  RECOVERY_RECOMMENDATION: 4,
  DISRUPTION_INFORMATION: 3,
  JOURNEY_COMPLETED: 2,
  JOURNEY_CREATED: 1,
};

interface LocalFeedbackHistory {
  [key: string]: {
    answered: boolean;
    dismissedAt?: number;
    rating?: number;
    value?: string;
  };
}

function getHistory(): LocalFeedbackHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHistory(history: LocalFeedbackHistory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Could not save feedback history:', err);
  }
}

function getEventKey(eventType: FeedbackEventType, journeyId?: number | null): string {
  return `${eventType}_${journeyId ?? 'global'}`;
}

/**
 * Throttling & Anti-Spam Check:
 * - Never show if already answered for this event + journey
 * - Never show if dismissed within the last 1 hour
 * - Never show if any feedback was prompted within the last 45 seconds (session throttle)
 */
export function canShowFeedback(eventType: FeedbackEventType, journeyId?: number | null): boolean {
  const history = getHistory();
  const key = getEventKey(eventType, journeyId);
  const entry = history[key];

  // Rule 3 & 4: If answered, do not ask again
  if (entry?.answered) {
    return false;
  }

  // Rule 2: If dismissed recently (within 1 hour), do not show
  if (entry?.dismissedAt && Date.now() - entry.dismissedAt < 60 * 60 * 1000) {
    return false;
  }

  // Rule 1: Never show more than one prompt in rapid succession (minimum 45s window)
  try {
    const lastPromptStr = sessionStorage.getItem(SESSION_PROMPT_KEY);
    if (lastPromptStr) {
      const lastPromptTime = Number(lastPromptStr);
      if (Date.now() - lastPromptTime < 45 * 1000) {
        return false;
      }
    }
  } catch {}

  return true;
}

export function recordPromptDisplayed(): void {
  try {
    sessionStorage.setItem(SESSION_PROMPT_KEY, String(Date.now()));
  } catch {}
}

export function recordDismissal(eventType: FeedbackEventType, journeyId?: number | null): void {
  const history = getHistory();
  const key = getEventKey(eventType, journeyId);
  history[key] = {
    ...(history[key] || {}),
    answered: false,
    dismissedAt: Date.now(),
  };
  saveHistory(history);
}

export function recordAnswered(
  eventType: FeedbackEventType,
  journeyId?: number | null,
  rating?: number | null,
  value?: string | null
): void {
  const history = getHistory();
  const key = getEventKey(eventType, journeyId);
  history[key] = {
    answered: true,
    rating: rating ?? undefined,
    value: value ?? undefined,
  };
  saveHistory(history);
}

export async function submitFeedback(payload: FeedbackSubmissionPayload): Promise<void> {
  // Record answered immediately in local state to prevent duplicate prompts
  recordAnswered(payload.event_type, payload.journey_id, payload.rating, payload.response_value);

  try {
    await axios.post(`${API_BASE_URL}/feedback`, payload);
  } catch (err) {
    // Fail gracefully: micro-feedback is non-blocking secondary telemetry
    console.warn('Micro-feedback submission failed (cached locally):', err);
  }
}

/**
 * Event-Driven Trigger helper:
 * Dispatches a CustomEvent to prompt the MicroFeedbackCard.
 */
let activePrompt: FeedbackPromptConfig | null = null;

export function triggerMicroFeedback(config: FeedbackPromptConfig): void {
  if (!canShowFeedback(config.eventType, config.journeyId)) {
    return;
  }

  // Priority collision check: if another prompt is active, only replace if higher priority
  if (activePrompt) {
    const currentPriority = EVENT_PRIORITY[activePrompt.eventType] || 0;
    const newPriority = EVENT_PRIORITY[config.eventType] || 0;
    if (newPriority <= currentPriority) {
      return;
    }
  }

  const delay = config.delayMs ?? 1500;
  setTimeout(() => {
    // Re-validate canShow before actual rendering
    if (!canShowFeedback(config.eventType, config.journeyId)) {
      return;
    }
    activePrompt = config;
    recordPromptDisplayed();
    window.dispatchEvent(
      new CustomEvent('travora_micro_feedback_prompt', { detail: config })
    );
  }, delay);
}

export function clearActivePrompt(): void {
  activePrompt = null;
}
