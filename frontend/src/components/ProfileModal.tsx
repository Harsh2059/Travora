import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, CheckCircle, AlertCircle, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { getStoredUser, updateUserProfile, logoutUser } from '../services/auth';
import type { UserProfile } from '../services/auth';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (user: UserProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(getStoredUser());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [mobile, setMobile] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const u = getStoredUser();
      setCurrentUser(u);
      if (u) {
        setName(u.name || '');
        setEmail(u.email || '');

        const rawPhone = u.phone_number || '';
        if (rawPhone.startsWith('+91')) {
          setCountryCode('+91');
          setMobile(rawPhone.replace('+91', ''));
        } else if (rawPhone.startsWith('91') && rawPhone.length === 12) {
          setCountryCode('+91');
          setMobile(rawPhone.slice(2));
        } else {
          setMobile(rawPhone.replace(/\D/g, ''));
        }

        const rawWa = u.whatsapp_phone || '';
        if (rawWa.startsWith('+91')) {
          setWhatsapp(rawWa.replace('+91', ''));
        } else if (rawWa.startsWith('91') && rawWa.length === 12) {
          setWhatsapp(rawWa.slice(2));
        } else {
          setWhatsapp(rawWa.replace(/\D/g, ''));
        }
      }
      setSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const fullPhone = mobile ? `${countryCode}${mobile.replace(/\D/g, '')}` : undefined;
      const fullWa = whatsapp
        ? `${countryCode}${whatsapp.replace(/\D/g, '')}`
        : fullPhone;

      const updated = await updateUserProfile({
        name,
        email,
        phone_number: fullPhone,
        whatsapp_phone: fullWa,
      });

      setCurrentUser(updated);
      setSuccess(true);
      onProfileUpdated?.(updated);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to update profile';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold text-lg">
              {currentUser?.name ? currentUser.name[0].toUpperCase() : 'T'}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Traveler Profile</h2>
              <p className="text-slate-400 text-xs">{currentUser?.email || 'Logged in Traveler'}</p>
            </div>
          </div>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs font-medium">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Profile updated successfully! Carrier feeds & WhatsApp sync updated.</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mobile Phone (SMS & Carrier Dispatch)
            </label>
            <div className="flex gap-2">
              <div className="w-20 px-3 py-2 text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl text-slate-600 flex items-center justify-center">
                +91
              </div>
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="7710989533"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              WhatsApp Alert Phone
            </label>
            <div className="flex gap-2">
              <div className="w-20 px-3 py-2 text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl text-slate-600 flex items-center justify-center">
                +91
              </div>
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-emerald-500 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="7710989533"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Normalized format (+917710989533) linked directly to Meta WhatsApp recovery webhook.</span>
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Changes</span>}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="py-2.5 px-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 hover:border-rose-200 flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
