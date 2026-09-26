import {
  getTodayDateString,
  getFutureDateString,
  normalizeCalendarDate,
  validateDepartureDate,
  validateReturnDate,
} from './dateValidation';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runDateValidationTests() {
  console.log('Running TRAVORA Date Validation Tests...');

  // 1. Dynamic Today
  const todayStr = getTodayDateString();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(todayStr), `Today date format valid: ${todayStr}`);
  const now = new Date();
  assert(todayStr.startsWith(String(now.getFullYear())), 'Today starts with current year');

  // 2. Normalization
  assert(normalizeCalendarDate('2026-09-26') === '2026-09-26', 'Normalize YYYY-MM-DD');
  assert(normalizeCalendarDate('09/25/2026') === '2026-09-25', 'Normalize MM/DD/YYYY');
  assert(normalizeCalendarDate('2026-09-26T10:00:00Z') === '2026-09-26', 'Normalize ISO string');

  // 3. Past dates -> REJECTED with exact error message
  const dYesterday = new Date();
  dYesterday.setDate(dYesterday.getDate() - 1);
  const yesterdayStr = `${dYesterday.getFullYear()}-${String(dYesterday.getMonth() + 1).padStart(2, '0')}-${String(dYesterday.getDate()).padStart(2, '0')}`;

  const resYesterday = validateDepartureDate(yesterdayStr);
  assert(resYesterday.isValid === false, 'Yesterday is invalid');
  assert(resYesterday.error === 'Please select today or a future date.', 'Yesterday error message exact');

  // 4. Manual date entry in past -> REJECTED
  const resManualPast = validateDepartureDate('01/01/2020');
  assert(resManualPast.isValid === false, 'Manual past date invalid');
  assert(resManualPast.error === 'Please select today or a future date.', 'Manual past error message exact');

  // 5. Today -> ACCEPTED
  const resToday = validateDepartureDate(todayStr);
  assert(resToday.isValid === true, 'Today departure valid');
  assert(resToday.error === null, 'Today error null');

  // 6. Future date -> ACCEPTED
  const tomorrowStr = getFutureDateString(1);
  const resTomorrow = validateDepartureDate(tomorrowStr);
  assert(resTomorrow.isValid === true, 'Tomorrow departure valid');

  // 7. Return date before departure date -> REJECTED with exact error message
  const dayAfterTomorrowStr = getFutureDateString(2);
  const resBeforeDep = validateReturnDate(tomorrowStr, dayAfterTomorrowStr);
  assert(resBeforeDep.isValid === false, 'Return date before departure date invalid');
  assert(resBeforeDep.error === 'Return date must be on or after your departure date.', 'Return date error message exact');

  // 8. Return date on/after departure date -> ACCEPTED
  const resSameDay = validateReturnDate(tomorrowStr, tomorrowStr);
  assert(resSameDay.isValid === true, 'Same day return date valid');

  const resAfterDep = validateReturnDate(dayAfterTomorrowStr, tomorrowStr);
  assert(resAfterDep.isValid === true, 'After departure return date valid');

  console.log('✅ ALL TRAVORA Date Validation Tests Passed Successfully!');
}

if (typeof window === 'undefined') {
  runDateValidationTests();
}
