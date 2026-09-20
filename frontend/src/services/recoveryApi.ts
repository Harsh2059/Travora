import axios from 'axios';
import { API_BASE_URL } from '../store/journeyStore';
import type { Part4RecoveryResult } from '../types';

export async function analyzePart4Recovery(tripId: number): Promise<Part4RecoveryResult> {
  const res = await axios.post<Part4RecoveryResult>(`${API_BASE_URL}/trips/${tripId}/recovery/analyze`, {});
  return res.data;
}

export async function getPart4Recovery(tripId: number): Promise<Part4RecoveryResult> {
  const res = await axios.get<Part4RecoveryResult>(`${API_BASE_URL}/trips/${tripId}/recovery`);
  return res.data;
}
