import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  ChevronDown,
  HelpCircle,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { fetchSupportFaqs } from '../services/supportApi';
import type { SupportFaqItem } from '../services/supportApi';


export default function SkyWayFaqScreen() {
  const [faqs, setFaqs] = useState<SupportFaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  useEffect(() => {
    fetchSupportFaqs()
      .then((data) => {
        setFaqs(data);
        if (data.length > 0) {
          setExpandedId(data[0].id); // Expand first by default for quick discoverability
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const list = Array.from(new Set(faqs.map((f) => f.category)));
    return ['ALL', ...list];
  }, [faqs]);

  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchCat = activeCategory === 'ALL' || faq.category === activeCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchQuery =
        !query ||
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.category.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });
  }, [faqs, activeCategory, searchQuery]);

  const toggleAccordion = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-[#f8fbff] flex flex-col font-sans text-slate-800 antialiased">
      <SkyWayNavbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* ── Header ── */}
        <Link
          to="/support"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-sky-600 transition-colors mb-4 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Support Hub</span>
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-600 flex items-center justify-center shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Everything you need to know about Travora travel management and disruption recovery.
            </p>
          </div>
        </div>

        {/* ── Search ── */}
        <div className="relative mb-6">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search questions (e.g., flight disrupted, recovery option, rebooking)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200/90 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 shadow-2xs transition-all placeholder:text-slate-400"
          />
        </div>

        {/* ── Category Filter Pills ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
                  isActive
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200/90 hover:bg-slate-50'
                }`}
              >
                {cat === 'ALL' ? 'All Questions' : cat}
              </button>
            );
          })}
        </div>

        {/* ── FAQ List ── */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 rounded-full animate-spin border-2 border-slate-200 border-t-sky-500 mx-auto mb-3" />
            <span>Loading FAQs...</span>
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 border border-slate-200/90 text-center shadow-xs">
            <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800">No questions match your search</p>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your query or report your specific question to our team.
            </p>
            <Link
              to="/support/report-issue"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100/80 px-4 py-2 rounded-xl transition-colors"
            >
              <span>Report an Issue</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden shadow-xs">
            {filteredFaqs.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <div key={item.id} className="transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleAccordion(item.id)}
                    className="w-full text-left px-5 sm:px-7 py-4 sm:py-5 flex items-start justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <div className="space-y-1 pr-2">
                      <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 mb-1">
                        {item.category}
                      </span>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        {item.question}
                      </h2>
                    </div>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-slate-400 bg-slate-50 transition-transform duration-200 shrink-0 mt-1 ${
                        isExpanded ? 'rotate-180 bg-sky-50 text-sky-600' : ''
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 sm:px-7 pb-6 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed bg-[#f8fbff]/50 animate-fade-in border-t border-slate-100/60">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Quick Links ── */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-slate-100/70 border border-slate-200 text-xs">
          <span className="text-slate-600 font-medium">Need more specific help with a flight or trip?</span>
          <div className="flex items-center gap-3">
            <Link
              to="/support/report-issue"
              className="text-rose-600 font-bold hover:underline"
            >
              Report an Issue →
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              to="/support/contact"
              className="text-indigo-600 font-bold hover:underline flex items-center gap-1"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Contact Support</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
