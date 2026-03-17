// Toast Container Component
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <XCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getToastStyles = (type: string): { accent: string; iconWrap: string; icon: string } => {
    switch (type) {
      case 'success':
        return {
          accent: 'from-emerald-500 to-emerald-400',
          iconWrap: 'bg-emerald-500/12 ring-1 ring-emerald-500/30',
          icon: 'text-emerald-600 dark:text-emerald-300',
        };
      case 'error':
        return {
          accent: 'from-rose-500 to-red-400',
          iconWrap: 'bg-rose-500/12 ring-1 ring-rose-500/30',
          icon: 'text-rose-600 dark:text-rose-300',
        };
      case 'warning':
        return {
          accent: 'from-amber-500 to-yellow-400',
          iconWrap: 'bg-amber-500/12 ring-1 ring-amber-500/30',
          icon: 'text-amber-700 dark:text-amber-300',
        };
      case 'info':
        return {
          accent: 'from-sky-500 to-blue-400',
          iconWrap: 'bg-sky-500/12 ring-1 ring-sky-500/30',
          icon: 'text-sky-700 dark:text-sky-300',
        };
      default:
        return {
          accent: 'from-slate-500 to-slate-400',
          iconWrap: 'bg-slate-500/12 ring-1 ring-slate-500/30',
          icon: 'text-slate-700 dark:text-slate-300',
        };
    }
  };

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-9999 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:w-full">
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 56, scale: 0.96, filter: 'blur(2px)' }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: 60, scale: 0.95, filter: 'blur(2px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.65 }}
            className="pointer-events-auto relative overflow-hidden rounded-2xl border border-white/40 bg-white/90 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85"
          >
            <div
              className={`absolute left-0 top-0 h-full w-1.5 bg-linear-to-b ${getToastStyles(toast.type).accent}`}
              aria-hidden="true"
            />

            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${getToastStyles(toast.type).iconWrap}`}>
              <span className={getToastStyles(toast.type).icon}>{getIcon(toast.type)}</span>
            </div>

            <div className="min-w-0 flex-1 pr-8">
              <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {toast.title}
              </p>
              {toast.message && (
                <p className="mt-1.5 line-clamp-3 text-[13px] leading-5 text-slate-600 dark:text-slate-300/90">
                  {toast.message}
                </p>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition-all hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
