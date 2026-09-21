import axios from 'axios';
import { API_BASE_URL } from '../store/journeyStore';
import type {
  Part4RecoveryPlan,
  Part4RecoveryResult,
  Part5RevalidationResult,
  Part5ExecutionResult
} from '../types';
import { notifyTripUpdated } from '../store/tripSync';

export async function analyzePart4Recovery(
  tripId: number,
  preference?: string,
  maxBudget?: number | null
): Promise<Part4RecoveryResult> {
  const payload: Record<string, any> = {};
  if (preference) payload.preference = preference;
  if (maxBudget !== undefined && maxBudget !== null) payload.max_budget = maxBudget;

  const res = await axios.post<Part4RecoveryResult>(`${API_BASE_URL}/trips/${tripId}/recovery/analyze`, payload);
  return res.data;
}

export async function getPart4Recovery(tripId: number): Promise<Part4RecoveryResult> {
  const res = await axios.get<Part4RecoveryResult>(`${API_BASE_URL}/trips/${tripId}/recovery`);
  return res.data;
}

export async function revalidatePart5Recovery(
  tripId: number,
  selectedPlan: Part4RecoveryPlan,
  disruptionFingerprint: string
): Promise<Part5RevalidationResult> {
  const res = await axios.post<Part5RevalidationResult>(`${API_BASE_URL}/trips/${tripId}/recovery/revalidate`, {
    selectedPlan,
    disruption_fingerprint: disruptionFingerprint
  });
  return res.data;
}

export async function executePart5Recovery(
  tripId: number,
  selectedPlan: Part4RecoveryPlan,
  disruptionFingerprint: string,
  executionId?: string
): Promise<Part5ExecutionResult> {
  const res = await axios.post<Part5ExecutionResult>(`${API_BASE_URL}/trips/${tripId}/recovery/execute`, {
    selectedPlan,
    disruption_fingerprint: disruptionFingerprint,
    execution_id: executionId
  });
  notifyTripUpdated(tripId, 'executePart5Recovery');
  return res.data;
}

export async function getPart5ExecutionStatus(
  tripId: number,
  executionId: string
): Promise<Part5ExecutionResult> {
  const res = await axios.get<Part5ExecutionResult>(`${API_BASE_URL}/trips/${tripId}/recovery/execution/${executionId}`);
  return res.data;
}

export async function getLatestExecution(tripId: number): Promise<any> {
  const res = await axios.get(`${API_BASE_URL}/trips/${tripId}/recovery/execution`);
  return res.data;
}

export async function restoreOriginalJourney(
  tripId: number,
  executionId?: string
): Promise<{ status: string; trip_id?: number; execution_id?: string; message?: string }> {
  const res = await axios.post(`${API_BASE_URL}/trips/${tripId}/recovery/restore`, {
    execution_id: executionId
  });
  notifyTripUpdated(tripId, 'restoreOriginalJourney');
  return res.data;
}

export async function activateRecoveredJourney(
  tripId: number,
  executionId?: string
): Promise<{ status: string; trip_id?: number; execution_id?: string; message?: string }> {
  const res = await axios.post(`${API_BASE_URL}/trips/${tripId}/recovery/activate-recovered`, {
    execution_id: executionId
  });
  notifyTripUpdated(tripId, 'activateRecoveredJourney');
  return res.data;
}
