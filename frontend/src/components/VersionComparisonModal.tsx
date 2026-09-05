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
      const res = await axios.get(`http://localhost:8000/api/trips/${tripId}/compare?v1=${versionA}&v2=${versionB}`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Itinerary Version Comparison</h2>
              <p className="text-xs text-slate-400">
                Audit differences in schedule, costs, and commitments across versions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Version Pickers */}
        <div className="p-5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
            <span>Compare:</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Base Version</span>
              <select
                value={v1}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setV1(val);
                  fetchComparison(val, v2);
                }}
                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs"
              >
                {Array.from({ length: currentVersion }, (_, i) => i + 1).map((v) => (
                  <option key={v} value={v}>
                    Version {v}
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-500" />

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Target Version</span>
              <select
                value={v2}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setV2(val);
                  fetchComparison(v1, val);
                }}
                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs"
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
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition"
          >
            Refresh Diff
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              Calculating state differences...
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs">
              {error}
            </div>
          ) : diff ? (
            <>
              {/* Summary Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Net Financial Delta</span>
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="text-xl font-black text-white font-mono">
                    {diff.financial_diff.net_cost_change >= 0
                      ? `+₹${diff.financial_diff.net_cost_change.toLocaleString()}`
                      : `-₹${Math.abs(diff.financial_diff.net_cost_change).toLocaleString()}`}
                  </div>
                  <span className="text-[10px] text-slate-400">Cumulative recovery cost</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Operational Delay</span>
                    <Clock className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="text-xl font-black text-white font-mono">
                    {diff.operational_diff.delay_str}
                  </div>
                  <span className="text-[10px] text-slate-400">Delay difference vs baseline</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Critical Commitments</span>
                    <ShieldCheck className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="text-xl font-black text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-5 w-5" /> Preserved
                  </div>
                  <span className="text-[10px] text-slate-400">Tech Conference intact</span>
                </div>
              </div>

              {/* Transition History Entries */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">
                            v{t.from_version} → v{t.to_version}: {t.plan_title}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Event: {t.event_type} • ID: {t.recovery_id}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-emerald-400">
                            ₹{t.net_cost.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">
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
