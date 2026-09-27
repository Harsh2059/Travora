import React, { useState, useEffect, useRef } from 'react';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  X,
  CheckCircle2,
  Send,
  MessageSquareHeart
} from 'lucide-react';
import {
  type FeedbackPromptConfig,
  type FeedbackOption,
  submitFeedback,
  recordDismissal,
  clearActivePrompt
} from '../services/feedbackService';

export const MicroFeedbackCard: React.FC = () => {
  const [prompt, setPrompt] = useState<FeedbackPromptConfig | null>(null);
  const [step, setStep] = useState<'INITIAL' | 'FOLLOW_UP' | 'SUCCESS'>('INITIAL');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedBinary, setSelectedBinary] = useState<'HELPFUL' | 'NOT_HELPFUL' | null>(null);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dismissTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handlePrompt = (e: Event) => {
      const customEvent = e as CustomEvent<FeedbackPromptConfig>;
      if (customEvent.detail) {
        setPrompt(customEvent.detail);
        setStep('INITIAL');
        setSelectedRating(null);
        setHoverRating(null);
        setSelectedBinary(null);
        setSelectedChip(null);
        setCustomText('');
        setShowCustomInput(false);
        setIsSubmitting(false);
      }
    };

    window.addEventListener('travora_micro_feedback_prompt', handlePrompt);
    return () => {
      window.removeEventListener('travora_micro_feedback_prompt', handlePrompt);
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
    };
  }, []);

  if (!prompt) return null;

  const rawOptions = prompt.followUpOptions || prompt.options || [];
  const normalizedOptions: FeedbackOption[] = rawOptions.map((opt) => {
    if (typeof opt === 'string') {
      return { label: opt, value: opt };
    }
    return opt;
  });

  const handleDismiss = () => {
    if (prompt) {
      recordDismissal(prompt.eventType, prompt.journeyId);
    }
    clearActivePrompt();
    setPrompt(null);
  };

  const handleStarSelect = async (rating: number) => {
    setSelectedRating(rating);
    // If follow-up options exist, transition to follow-up, otherwise submit directly
    if (normalizedOptions.length > 0) {
      setStep('FOLLOW_UP');
    } else {
      await finalizeSubmission({
        rating,
        response_type: 'RATING',
        response_value: String(rating),
      });
    }
  };

  const handleBinarySelect = async (val: 'HELPFUL' | 'NOT_HELPFUL') => {
    setSelectedBinary(val);
    if (val === 'NOT_HELPFUL' && normalizedOptions.length > 0) {
      setStep('FOLLOW_UP');
    } else {
      await finalizeSubmission({
        response_type: 'YES_NO',
        response_value: val,
      });
    }
  };

  const handleChipSelect = (opt: FeedbackOption) => {
    setSelectedChip(opt.value);
    if (opt.value.toUpperCase().includes('OTHER') || opt.label.toLowerCase().includes('other') || opt.label.toLowerCase().includes('something else')) {
      setShowCustomInput(true);
    } else {
      setShowCustomInput(false);
    }
  };

  const finalizeSubmission = async (extra: {
    rating?: number | null;
    response_type?: 'RATING' | 'YES_NO' | 'MULTI_OPTION';
    response_value?: string | null;
    message?: string | null;
  }) => {
    if (!prompt) return;
    setIsSubmitting(true);

    const payload = {
      journey_id: prompt.journeyId,
      event_type: prompt.eventType,
      rating: extra.rating ?? selectedRating,
      response_type: extra.response_type ?? (prompt.responseType === 'RATING' ? 'RATING' : 'YES_NO'),
      response_value: extra.response_value ?? (selectedChip || selectedBinary || String(selectedRating || '')),
      message: extra.message ?? (customText.trim() || undefined),
      context: prompt.context,
    };

    await submitFeedback(payload);
    setIsSubmitting(false);
    setStep('SUCCESS');

    dismissTimerRef.current = window.setTimeout(() => {
      handleDismiss();
    }, 2500);
  };

  return (
    <div
      role="complementary"
      aria-label="Feedback Prompt"
      className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-88 bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xl p-4 sm:p-5 text-slate-800 animate-slide-up transition-all duration-200"
    >
      {/* ── Success State ── */}
      {step === 'SUCCESS' ? (
        <div className="flex items-center gap-3 py-2 text-center sm:text-left animate-fade-in">
          <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900">Thank you!</p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              Thanks for helping us improve Travora.
            </p>
          </div>
        </div>
      ) : (
        <div>
          {/* Header & Dismiss Button */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
                <MessageSquareHeart className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50/80 px-2 py-0.5 rounded-full border border-sky-100">
                Quick Feedback
              </span>
            </div>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss feedback (Not now)"
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

            {/* Prompt Title & Subtitle */}
            <div className="mb-3">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                {step === 'FOLLOW_UP' ? (prompt.followUpQuestion || 'What could we improve?') : prompt.title}
              </h4>
              {(prompt.subtitle || prompt.question) && step === 'INITIAL' && (
                <p className="text-[11px] text-slate-500 mt-0.5">{prompt.subtitle || prompt.question}</p>
              )}
            </div>

          {/* Step 1: Initial Response (Stars or Yes/No) */}
          {step === 'INITIAL' && (
            <div>
              {prompt.responseType === 'RATING' && (
                <div className="flex items-center justify-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = (hoverRating ?? selectedRating ?? 0) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleStarSelect(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        aria-label={`Rate ${star} out of 5 stars`}
                        className="p-1.5 rounded-xl hover:bg-amber-50 text-slate-300 hover:text-amber-400 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                      >
                        <Star
                          className={`w-6 h-6 transition-all duration-150 ${
                            isFilled ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-300'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {prompt.responseType === 'YES_NO' && (
                <div className="grid grid-cols-2 gap-2.5 py-1">
                  <button
                    type="button"
                    onClick={() => handleBinarySelect('HELPFUL')}
                    aria-label="Yes, helpful"
                    className="px-3 py-2 rounded-2xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200/80 text-xs font-bold text-slate-700 hover:text-emerald-700 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Yes, helpful</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBinarySelect('NOT_HELPFUL')}
                    aria-label="No, not helpful"
                    className="px-3 py-2 rounded-2xl bg-slate-50 hover:bg-rose-50 hover:border-rose-300 border border-slate-200/80 text-xs font-bold text-slate-700 hover:text-rose-700 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <ThumbsDown className="w-3.5 h-3.5 text-rose-500" />
                    <span>No</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Follow-up Options / Chips */}
          {step === 'FOLLOW_UP' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex flex-wrap gap-1.5">
                {normalizedOptions.map((opt) => {
                  const isSelected = selectedChip === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChipSelect(opt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {showCustomInput && (
                <div className="relative">
                  <input
                    type="text"
                    maxLength={500}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Tell us more (optional)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-sky-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  Skip
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || (!selectedChip && !customText.trim())}
                  onClick={() =>
                    finalizeSubmission({
                      response_value: selectedChip,
                      message: customText.trim() || undefined,
                    })
                  }
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>Done</span>
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Footer: "Not now" button for Step 1 */}
          {step === 'INITIAL' && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded transition-colors"
              >
                Not now
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
