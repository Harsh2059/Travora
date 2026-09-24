import { ArrowLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DataDeletionScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/20">
              <Trash2 className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Data Deletion Instructions
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
          <h1 className="text-3xl font-extrabold mb-6 text-slate-900 dark:text-white">Request Data Deletion</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
            Travora respects your privacy and your right to control your personal data. If you wish to have your account and associated data permanently deleted from our systems, please follow the instructions below.
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">How to Request Deletion</h2>
            <div className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-xl border border-slate-100 dark:border-slate-700">
              <ol className="list-decimal pl-5 space-y-4 text-slate-600 dark:text-slate-300">
                <li>
                  Send an email to our support team at <a href="mailto:support@travora.com" className="font-semibold text-sky-600 dark:text-sky-400 hover:underline">support@travora.com</a>.
                </li>
                <li>
                  Use the subject line: <strong>"Data Deletion Request"</strong>.
                </li>
                <li>
                  In the body of the email, include the name and email address or phone number associated with your Travora account to help us verify your identity.
                </li>
              </ol>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">What Happens Next?</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Once we receive your request, our team will process it appropriately. We will notify you via email once your data has been successfully deleted from our active systems. 
            </p>
            <p className="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed font-medium">
              Please note that some information may need to be retained where legally required, such as for tax or compliance purposes, or to resolve ongoing disputes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Questions?</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              If you have any questions regarding this process or our <a href="/privacy" className="text-sky-600 dark:text-sky-400 hover:underline">Privacy Policy</a>, please don't hesitate to contact us.
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
