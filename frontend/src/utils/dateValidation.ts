/**
 * Date validation utility for TRAVORA (Part 1 - No Past Dates).
 * 
 * Rules & Requirements:
 * 1. DYNAMIC TODAY: Get today's calendar date dynamically from the user's local/system/browser timezone.
 * 2. DEPARTURE DATE: Must be >= today. Error: "Please select today or a future date."
 * 3. RETURN DATE: Must be >= departure date. Error: "Return date must be on or after your departure date."
 * 4. MANUAL DATE ENTRY: Parsed & normalized before comparison to prevent bypassing validation.
 * 5. HISTORICAL JOURNEYS: Applies ONLY to NEW journey creation. Existing historical trips are not modified.
 */

/**
 * Returns today's calendar date in local timezone as 'YYYY-MM-DD'.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns a future calendar date offset by `daysAhead` from today as 'YYYY-MM-DD'.
 */
export function getFutureDateString(daysAhead: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes various date inputs (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, ISO, Date objects)
 * into a 'YYYY-MM-DD' calendar date string in local timezone.
 */
export function normalizeCalendarDate(input?: string | Date | null): string | null {
  if (!input) return null;

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const year = input.getFullYear();
    const month = String(input.getMonth() + 1).padStart(2, '0');
    const day = String(input.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const str = String(input).trim();
  if (!str) return null;

  // 1. Direct YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 2. ISO timestamp string (e.g. 2026-09-26T10:30:00)
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str.split('T')[0];
  }

  // 3. Manual entry MM/DD/YYYY or M/D/YYYY
  const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    const year = parseInt(y, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 4. Manual entry DD/MM/YYYY or D/M/YYYY (if day > 12)
  const euMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (euMatch) {
    const [, d, m, y] = euMatch;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    const year = parseInt(y, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 5. Fallback Date.parse for text strings like "12 Jun, 2026" or "Sep 26, 2026"
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Validates departure / start date for creating a new journey or booking.
 * Returns { isValid: boolean, error: string | null }
 */
export function validateDepartureDate(startDateInput?: string | Date | null): {
  isValid: boolean;
  error: string | null;
  normalizedDate: string | null;
} {
  if (!startDateInput) {
    return {
      isValid: false,
      error: 'Please select today or a future date.',
      normalizedDate: null,
    };
  }

  const normalized = normalizeCalendarDate(startDateInput);
  const today = getTodayDateString();

  if (!normalized || normalized < today) {
    return {
      isValid: false,
      error: 'Please select today or a future date.',
      normalizedDate: normalized,
    };
  }

  return {
    isValid: true,
    error: null,
    normalizedDate: normalized,
  };
}

/**
 * Validates return / end date for creating a new journey or booking.
 * Checks against today and against departure date.
 * Returns { isValid: boolean, error: string | null }
 */
export function validateReturnDate(
  endDateInput?: string | Date | null,
  departureDateInput?: string | Date | null
): {
  isValid: boolean;
  error: string | null;
  normalizedDate: string | null;
} {
  if (!endDateInput) {
    return {
      isValid: false,
      error: 'Return date must be on or after your departure date.',
      normalizedDate: null,
    };
  }

  const normalizedEnd = normalizeCalendarDate(endDateInput);
  const today = getTodayDateString();

  if (!normalizedEnd || normalizedEnd < today) {
    return {
      isValid: false,
      error: 'Please select today or a future date.',
      normalizedDate: normalizedEnd,
    };
  }

  const normalizedDeparture = normalizeCalendarDate(departureDateInput);

  if (normalizedDeparture && normalizedEnd < normalizedDeparture) {
    return {
      isValid: false,
      error: 'Return date must be on or after your departure date.',
      normalizedDate: normalizedEnd,
    };
  }

  return {
    isValid: true,
    error: null,
    normalizedDate: normalizedEnd,
  };
}
