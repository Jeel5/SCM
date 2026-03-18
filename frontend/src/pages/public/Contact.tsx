import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Truck, CheckCircle, Mail, Phone, MessageSquare, User, Building2, Tag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PublicHeader } from './components/Header';
import { PublicFooter } from './components/Footer';

const INQUIRY_TYPES = [
  'Product capabilities',
  'Pricing & plans',
  'Integration requirements',
  'Implementation timeline',
  'Custom enterprise features',
  'Other',
];

const contactOptions = [
  {
    icon: Mail,
    title: 'Email us',
    value: 'hello@twinchain.com',
    href: 'mailto:hello@twinchain.com',
    desc: 'We respond within one business day.',
  },
  {
    icon: Phone,
    title: 'Call us',
    value: '+1 (800) 555-0199',
    href: 'tel:+18005550199',
    desc: 'Mon – Fri, 9 AM – 6 PM IST.',
  },
  {
    icon: MessageSquare,
    title: 'Live chat',
    value: 'Start a chat',
    href: '#',
    desc: 'Available during business hours.',
  },
];

type FormFieldProps = {
  id: string; label: string; type?: string; placeholder?: string; required?: boolean;
  value: string; error?: string; onChange: (val: string) => void; icon?: LucideIcon;
};
function FormField({ id, label, type = 'text', placeholder = '', required = false, value, error, onChange, icon: Icon }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
            <Icon size={16} strokeWidth={1.75} />
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full h-11 ${Icon ? 'pl-10' : 'pl-4'} pr-4 rounded-lg border text-gray-900 dark:text-white text-sm outline-none transition-all bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500
            ${error
              ? 'border-red-400 focus:border-red-400 focus:bg-red-50/40 dark:focus:bg-red-950/20'
              : 'border-gray-200 dark:border-gray-700 focus:border-blue-400 focus:bg-blue-50/40 dark:focus:bg-blue-950/20'
            }`}
        />
      </div>
      {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}

export function ContactPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    workEmail: '',
    company: '',
    inquiry: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.workEmail.trim() || !/\S+@\S+\.\S+/.test(form.workEmail))
      e.workEmail = 'Enter a valid email';
    if (!form.company.trim()) e.company = 'Required';
    if (!form.message.trim()) e.message = 'Please describe what you need';
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setSubmitted(true);
  };

  return (
    <div className="h-screen overflow-y-auto overflow-x-hidden scrollbar-none bg-white dark:bg-gray-950 w-full">
      <PublicHeader />

      <div className="w-full pt-20 lg:pt-0">
        <div className="grid lg:grid-cols-2 min-h-screen">

          {/* ── Left panel ──────────────────────────────────────── */}
          <div className="relative bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-950 flex flex-col justify-center px-8 py-24 lg:py-32 lg:px-16 xl:px-24 overflow-hidden">
            <div className="absolute -top-40 -right-20 w-125 h-125 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-100 h-100 rounded-full bg-indigo-600/8 blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <Link to="/" className="inline-flex items-center gap-2.5 mb-10">
                <div className="h-10 w-10 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">TwinChain</span>
              </Link>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight mb-4">
                Talk to our<br />
                <span className="bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Team
                </span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-10 max-w-md">
                Have questions about TwinChain? We're happy to walk through capabilities,
                integrations, or implementation details.
              </p>

              {/* Contact channels */}
              <div className="space-y-4">
                {contactOptions.map(({ icon: Icon, title, value, href, desc }) => (
                  <a
                    key={title}
                    href={href}
                    className="flex items-start gap-4 group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-blue-100/70 border border-blue-200 dark:bg-white/5 dark:border-white/10 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:border-blue-600 transition-all">
                      <Icon className="h-4 w-4 text-blue-600 dark:text-gray-400 group-hover:text-white" />
                    </div>
                    <div>
                      <p className="text-gray-900 dark:text-white text-sm font-semibold group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{value}</p>
                      <p className="text-gray-600 dark:text-gray-500 text-xs mt-0.5">{title} — {desc}</p>
                    </div>
                  </a>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-blue-200 dark:border-white/10">
                <p className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  We do not share your information with third parties.
                </p>
              </div>
            </div>
          </div>

          {/* ── Right panel — form ──────────────────────────────── */}
          <div className="flex items-center justify-center px-6 py-16 lg:py-0 lg:px-12 xl:px-20 bg-linear-to-b from-white to-blue-50/40 dark:from-gray-950 dark:to-gray-950">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm p-6 sm:p-7 shadow-sm">
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-10"
                >
                  <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Message sent</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                    Someone from our team will be in touch within one business day.
                  </p>
                  <Link to="/" className="text-blue-600 font-medium text-sm hover:underline">
                    ← Back to home
                  </Link>
                </motion.div>
              ) : (
                <>
                  <div className="mb-8">
                    <p className="text-xs uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 mb-2">Contact Sales</p>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Get in touch</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Tell us what you're looking for and we'll follow up promptly.</p>
                  </div>

                  <form onSubmit={handleSubmit} noValidate className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField id="firstName" label="First Name" required placeholder="John" icon={User} value={form.firstName} error={errors.firstName} onChange={(v) => { setForm(p => ({ ...p, firstName: v })); setErrors(p => ({ ...p, firstName: '' })); }} />
                      <FormField id="lastName" label="Last Name" required placeholder="Doe" icon={User} value={form.lastName} error={errors.lastName} onChange={(v) => { setForm(p => ({ ...p, lastName: v })); setErrors(p => ({ ...p, lastName: '' })); }} />
                    </div>
                    <FormField id="workEmail" label="Work Email" type="email" placeholder="you@company.com" icon={Mail} required value={form.workEmail} error={errors.workEmail} onChange={(v) => { setForm(p => ({ ...p, workEmail: v })); setErrors(p => ({ ...p, workEmail: '' })); }} />
                    <FormField id="company" label="Company" placeholder="Acme Corp" icon={Building2} required value={form.company} error={errors.company} onChange={(v) => { setForm(p => ({ ...p, company: v })); setErrors(p => ({ ...p, company: '' })); }} />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        What are you interested in? <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none z-10">
                          <Tag size={16} strokeWidth={1.75} />
                        </span>
                        <select
                          value={form.inquiry}
                          onChange={(e) => setForm(p => ({ ...p, inquiry: e.target.value }))}
                          className="w-full h-11 pl-10 pr-4 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:border-blue-400 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 transition-all bg-white dark:bg-gray-800 appearance-none cursor-pointer"
                        >
                          <option value="">Select topic</option>
                          {INQUIRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Message<span className="text-red-400 ml-0.5">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-3 text-gray-400 dark:text-gray-500 pointer-events-none">
                          <MessageSquare size={16} strokeWidth={1.75} />
                        </span>
                        <textarea
                          rows={4}
                          value={form.message}
                          onChange={(e) => { setForm(p => ({ ...p, message: e.target.value })); setErrors(p => ({ ...p, message: '' })); }}
                          placeholder="Tell us about your use case, team size, current challenges..."
                          className={`w-full pl-10 pr-4 py-3 rounded-lg border text-gray-900 dark:text-white text-sm outline-none transition-all resize-none bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500
                            ${errors.message
                              ? 'border-red-400 focus:border-red-400 focus:bg-red-50/40 dark:focus:bg-red-950/20'
                              : 'border-gray-200 dark:border-gray-700 focus:border-blue-400 focus:bg-blue-50/40 dark:focus:bg-blue-950/20'}`}
                        />
                      </div>
                      {errors.message && <p className="text-xs text-red-400 mt-1.5">{errors.message}</p>}
                    </div>

                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full h-12 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all text-sm"
                    >
                      Send message
                    </motion.button>

                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                      By submitting, you agree to our{' '}
                      <a href="#" className="underline hover:text-gray-600 dark:hover:text-gray-300">Privacy Policy</a>.
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
