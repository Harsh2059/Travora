import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Travora Privacy Policy
            </span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 p-8 sm:p-10">
          <h1 className="text-3xl font-extrabold mb-6 text-slate-900 dark:text-white">Privacy Policy</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
            At Travora, we prioritize the protection of your personal information. This Privacy Policy explains what data we collect, how it's used, and your rights regarding your data.
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Information We Process</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              To provide you with seamless travel recovery assistance, Travora may process the following types of information:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-300">
              <li>Name and contact information</li>
              <li>Phone/WhatsApp number when WhatsApp communication is used</li>
              <li>Trip and itinerary information</li>
              <li>Travel disruption and recovery information</li>
              <li>Messages sent through the WhatsApp integration</li>
              <li>Technical information needed to operate the service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">How We Use Your Information</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              The information we collect is strictly used to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-300">
              <li>Provide travel recovery assistance during disruptions</li>
              <li>Communicate disruption and recovery options to you in real time</li>
              <li>Process recovery actions and rebookings automatically</li>
              <li>Operate, secure, and improve our services and algorithms</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">No Sale of Personal Information</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Travora does not sell your personal information to third parties. We only share data with travel providers as necessary to secure alternative bookings on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Data Deletion Requests</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              You have the right to request the deletion of your personal data stored by Travora at any time. For full instructions on how to submit a request, please visit our <a href="/data-deletion" className="text-sky-600 dark:text-sky-400 hover:underline font-medium">Data Deletion Instructions</a> page.
            </p>
          </section>
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-slate-400 border-t border-slate-200/40 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
        &copy; {new Date().getFullYear()} Travora. All rights reserved.
      </footer>
    </div>
  );
}
