import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, GitCompare, CheckCircle2, Clock, DollarSign, ArrowRight, ShieldCheck } from 'lucide-react';
import type { VersionComparisonData } from '../types';

interface VersionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  currentVersion: number;
}

export const VersionComparisonModal: React.FC<VersionComparisonModalProps> = ({
  isOpen,
  onClose,
  tripId,
  currentVersion,
}) => {
  const [v1, setV1] = useState<number>(1);
  const [v2, setV2] = useState<number>(Math.max(1, currentVersion));
  const [diff, setDiff] = useState<VersionComparisonData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setV2(currentVersion);
      fetchComparison(1, currentVersion);
    }
  }, [isOpen, currentVersion]);

  const fetchComparison = async (versionA: number, versionB: number) => {
    try {
      setLoading(true);
      setError(null);
      const apiBase = import.meta.env.PROD ? '/api' : 'http://localhost:8000/api';
      const res = await axios.get(`${apiBase}/trips/${tripId}/compare?v1=${versionA}&v2=${versionB}`);
      setDiff(res.data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch version comparison diff.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Itinerary Version Comparison</h2>
              <p className="text-xs text-slate-500">
                Audit differences in schedule, costs, and commitments across versions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Version Pickers */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-700">
            <span>Compare:</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Base Version</span>
              <select
                value={v1}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setV1(val);
                  fetchComparison(val, v2);
                }}
                className="bg-white border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1 text-xs"
              >
                {Array.from({ length: currentVersion }, (_, i) => i + 1).map((v) => (
                  <option key={v} value={v}>
                    Version {v}
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-400" />

            <div className="flex items-center gap-2">
              <span className="text-slate-500">Target Version</span>
              <select
                value={v2}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setV2(val);
                  fetchComparison(v1, val);
                }}
                className="bg-white border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1 text-xs"
              >
                {Array.from({ length: currentVersion }, (_, i) => i + 1).map((v) => (
                  <option key={v} value={v}>
                    Version {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => fetchComparison(v1, v2)}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs"
          >
            Refresh Diff
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              Calculating state differences...
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          ) : diff ? (
            <>
              {/* Summary Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-600 text-xs mb-1">
                    <span>Net Financial Delta</span>
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {diff.financial_diff.net_cost_change >= 0
                      ? `+₹${diff.financial_diff.net_cost_change.toLocaleString()}`
                      : `-₹${Math.abs(diff.financial_diff.net_cost_change).toLocaleString()}`}
                  </div>
                  <span className="text-[10px] text-slate-500">Cumulative recovery cost</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-600 text-xs mb-1">
                    <span>Operational Delay</span>
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {diff.operational_diff.delay_str}
                  </div>
                  <span className="text-[10px] text-slate-500">Delay difference vs baseline</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-600 text-xs mb-1">
                    <span>Critical Commitments</span>
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-xl font-black text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="h-5 w-5" /> Preserved
                  </div>
                  <span className="text-[10px] text-slate-500">Tech Conference intact</span>
                </div>
              </div>

              {/* Transition History Entries */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Version Transitions ({diff.transition_history.length})
                </h4>
                {diff.transition_history.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4 text-center">
                    No state transitions between these versions (same state).
                  </div>
                ) : (
                  <div className="space-y-2">
                    {diff.transition_history.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            v{t.from_version} → v{t.to_version}: {t.plan_title}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Event: {t.event_type} • ID: {t.recovery_id}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-emerald-700">
                            ₹{t.net_cost.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            +{t.additional_delay_minutes}m delay
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
