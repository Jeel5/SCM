import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import {
  Truck, Package, BarChart3, Zap, Globe, ArrowRight,
  CheckCircle, Mail, TrendingUp, Clock, AlertTriangle,
  Warehouse, RefreshCw, DollarSign, Users, ChevronRight,
} from 'lucide-react';
import { PublicHeader } from './components/Header';
import { PublicFooter } from './components/Footer';

/* ─────────────────────────── Animation helpers ─────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};
const stagger = (delay = 0) => ({
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const } },
});

function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.section
      ref={ref}
      id={id}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      variants={fadeUp}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ─────────────────────────── Static data ────────────────────────────── */
const stats = [
  { value: '12,458', label: 'Orders tracked' },
  { value: '5', label: 'Carrier integrations' },
  { value: '94.7%', label: 'On-time delivery rate' },
  { value: '96.2%', label: 'SLA compliance' },
];

const features = [
  {
    icon: Globe,
    color: 'from-blue-500 to-indigo-600',
    title: 'End-to-End Visibility',
    desc: 'Real-time tracking across every carrier, mode, and geography. Know where every shipment is — before your customers ask.',
  },
  {
    icon: AlertTriangle,
    color: 'from-amber-500 to-orange-500',
    title: 'Proactive Exception Management',
    desc: 'AI-powered alerts catch disruptions before they become delivery failures. Resolve issues in hours, not days.',
  },
  {
    icon: BarChart3,
    color: 'from-purple-500 to-violet-600',
    title: 'Supply Chain Intelligence',
    desc: 'Deep analytics and benchmarking to measure carrier performance, SLA compliance, and operational KPIs.',
  },
  {
    icon: Truck,
    color: 'from-green-500 to-emerald-600',
    title: 'Carrier Network',
    desc: 'Integrated with 5 major carriers — Delhivery, BlueDart, DTDC, Ecom Express, and Shadowfax — with a pluggable connector model for more.',
  },
  {
    icon: Warehouse,
    color: 'from-cyan-500 to-blue-600',
    title: 'Warehouse Operations',
    desc: 'Optimize inventory placement, picking workflows, and warehouse utilization across your entire network.',
  },
  {
    icon: DollarSign,
    color: 'from-rose-500 to-pink-600',
    title: 'Finance & Cost Control',
    desc: 'Automated freight audit, invoice matching, and cost allocation across every shipment and carrier.',
  },
];

const howItWorks = [
  {
    step: '01',
    title: 'Connect your ecosystem',
    desc: 'Connect your carrier accounts, warehouses, and order sources using the built-in connector model or the open REST API.',
    icon: Globe,
  },
  {
    step: '02',
    title: 'Get complete visibility',
    desc: 'All shipment data flows into one unified platform. Track orders, predict delays, and monitor warehouse ops in real time.',
    icon: BarChart3,
  },
  {
    step: '03',
    title: 'Act before problems escalate',
    desc: 'AI surfaces exceptions and recommends next best actions. Automated workflows resolve issues without manual intervention.',
    icon: Zap,
  },
];

const plans = [
  {
    name: 'Starter',
    price: '₹499',
    period: '/month',
    desc: 'Perfect for growing e-commerce brands',
    highlight: false,
    features: [
      'Up to 1,000 orders / month',
      '3 warehouse locations',
      '10 carrier integrations',
      'Real-time tracking',
      'Exception alerts',
      'Standard analytics',
      'Email support',
    ],
  },
  {
    name: 'Growth',
    price: '₹1,499',
    period: '/month',
    desc: 'For scaling operations teams',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Up to 10,000 orders / month',
      'Unlimited warehouses',
      '50 carrier integrations',
      'Advanced analytics & BI',
      'SLA management',
      'Returns management',
      'Finance & freight audit',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For complex, global supply chains',
    highlight: false,
    features: [
      'Unlimited orders',
      'Unlimited warehouses',
      '500+ carrier integrations',
      'Custom reporting & dashboards',
      'Dedicated success manager',
      'SLA & contract management',
      'White-label options',
      'SSO & enterprise security',
      '24/7 premium support',
    ],
  },
];

/* ─────────────────────────── Dashboard Mockup ───────────────────────── */
function DashboardMockup() {
  return (
    <div className="relative bg-gray-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Window bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-gray-800/50">
        <span className="h-3 w-3 rounded-full bg-red-500/70" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
        <span className="h-3 w-3 rounded-full bg-green-500/70" />
        <span className="ml-4 text-xs text-gray-500 font-mono">twinchain/dashboard</span>
      </div>
      {/* App shell */}
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden sm:flex w-12 flex-col items-center py-4 gap-4 border-r border-white/5 bg-gray-900">
          {[Truck, Package, BarChart3, Warehouse, AlertTriangle, RefreshCw, DollarSign].map(
            (Icon, i) => (
              <div
                key={i}
                className={`h-8 w-8 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-blue-600' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <Icon className="h-4 w-4 text-white opacity-70" />
              </div>
            )
          )}
        </div>
        {/* Main content */}
        <div className="flex-1 p-4 space-y-3 bg-gray-950 min-h-80">
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Total Orders', value: '12,458', change: '+12.5%', color: 'text-blue-400' },
              { label: 'Active Shipments', value: '3,247', change: '+8.3%', color: 'text-green-400' },
              { label: 'Active Exceptions', value: '42', change: '-15.7%', color: 'text-amber-400' },
              { label: 'SLA Compliance', value: '96.2%', change: '-1.3%', color: 'text-purple-400' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white/5 border border-white/5 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 mb-1">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] text-green-400">{kpi.change}</p>
              </div>
            ))}
          </div>
          {/* Chart placeholder */}
          <div className="bg-white/5 border border-white/5 rounded-xl p-3 h-28 flex items-end gap-1.5 overflow-hidden">
            {[60, 80, 55, 90, 75, 95, 70, 85, 100, 88, 72, 94].map((h, i) => (
              <div key={i} className="flex-1 h-full flex flex-col justify-end">
                <div
                  style={{ height: `${h}%` }}
                  className="rounded-sm bg-gradient-to-t from-blue-600/80 to-indigo-400/50"
                />
              </div>
            ))}
          </div>
          {/* Table placeholder */}
          <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
            {[
              { id: 'ORD-9821', carrier: 'FedEx', status: 'Delivered', color: 'text-green-400' },
              { id: 'ORD-9820', carrier: 'UPS', status: 'In Transit', color: 'text-blue-400' },
              { id: 'ORD-9819', carrier: 'DHL', status: 'Exception', color: 'text-amber-400' },
            ].map((row) => (
              <div key={row.id} className="flex items-center justify-between px-3 py-2 border-b border-white/5 last:border-0">
                <span className="text-[11px] text-gray-400 font-mono">{row.id}</span>
                <span className="text-[11px] text-gray-500">{row.carrier}</span>
                <span className={`text-[11px] font-medium ${row.color}`}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Page Component ─────────────────────────── */
export function LandingPage() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;

    const id = location.hash.slice(1);
    const section = document.getElementById(id);
    if (!section) return;

    // Defer until layout/animations mount so scrolling targets the final position.
    window.requestAnimationFrame(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash]);

  return (
    <div className="bg-white dark:bg-gray-950 h-screen overflow-y-auto overflow-x-hidden scrollbar-none font-sans antialiased">
      <PublicHeader />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-linear-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-[#0a0f1e] dark:via-[#0a0f1e] dark:to-[#0a0f1e] pt-32 pb-20 lg:pt-40 lg:pb-28">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-175 h-175 rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute -top-20 right-0 w-125 h-125 rounded-full bg-indigo-600/10 blur-[100px]" />
          <div className="absolute bottom-0 left-1/3 w-100 h-100 rounded-full bg-purple-600/8 blur-[100px]" />
        </div>

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 xl:gap-28 items-center max-w-[1400px] mx-auto">
            {/* Left copy */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-200 bg-white/80 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 text-sm font-medium mb-8"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                </span>
                Trusted by 2,400+ companies globally
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-[1.1] tracking-tight mb-6"
              >
                Complete
                <span className="block bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Supply Chain
                </span>
                Visibility
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-10 max-w-lg"
              >
                TwinChain connects every carrier, warehouse, and order into one intelligent platform.
                Predict disruptions, resolve exceptions, and delight customers — at scale.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3 mb-12"
              >
                <Link
                  to="/get-demo"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  Request a Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-gray-300 text-gray-700 hover:text-gray-900 hover:border-gray-400 hover:bg-white dark:border-white/15 dark:text-gray-300 dark:hover:text-white dark:hover:border-white/30 dark:hover:bg-white/5 font-medium rounded-xl transition-all"
                >
                  <Mail className="h-4 w-4" />
                  Contact Us
                </Link>
              </motion.div>
            </div>

            {/* Right — Dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block relative"
            >
              <DashboardMockup />
              {/* Floating badges */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 }}
                className="absolute -left-6 top-1/3 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-3 flex items-center gap-3 border border-gray-100 dark:border-gray-700"
              >
                <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">On-Time Rate</p>
                  <p className="text-lg font-bold text-green-600">94.7%</p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.0 }}
                className="absolute -right-4 bottom-1/4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-3 flex items-center gap-3 border border-gray-100 dark:border-gray-700"
              >
                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">Avg Delivery Time</p>
                  <p className="text-lg font-bold text-blue-600">2.4 days</p>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-20 max-w-[1400px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/70 dark:bg-white/5 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10"
          >
            {stats.map(({ value, label }) => (
              <div key={label} className="bg-white/70 dark:bg-white/[0.03] px-6 py-6 text-center hover:bg-white dark:hover:bg-white/[0.06] transition-colors">
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{value}</p>
                <p className="text-sm text-gray-600 dark:text-gray-500">{label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      <Section id="features" className="py-24 lg:py-32 scroll-mt-24 lg:scroll-mt-28">
        <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Platform</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
              Everything your supply chain needs
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">
              One platform to connect, track, and optimize every node of your supply chain — from vendor to customer doorstep.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={stagger(i * 0.07)}
                className="group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
              >
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <ChevronRight className="h-4 w-4" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <Section id="how-it-works" className="py-24 lg:py-32 bg-gray-100 dark:bg-gray-950 scroll-mt-24 lg:scroll-mt-28">
        <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
              Up and running in days, not months
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Our implementation team gets you live fast, with zero disruption to existing operations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-px bg-gradient-to-r from-blue-600/0 via-blue-600/40 to-blue-600/0" />
            {howItWorks.map((step, i) => (
              <motion.div
                key={step.step}
                variants={stagger(i * 0.12)}
                className="relative text-center"
              >
                <div className="h-24 w-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex flex-col items-center justify-center shadow-xl shadow-blue-500/20 relative">
                  <step.icon className="h-8 w-8 text-white" />
                  <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white dark:bg-gray-950 border-2 border-blue-500 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{step.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── PRODUCT SCREENSHOT ────────────────────────────────────────── */}
      <Section className="py-24 lg:py-32 bg-gradient-to-b from-white to-blue-50/30 dark:from-gray-950 dark:to-gray-900">
        <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Real-time Intelligence</p>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
                See everything.<br />Act on what matters.
              </h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
                TwinChain's intelligent dashboard aggregates data from every system — carrier APIs, WMS, ERP, and e-commerce platforms — into one unified view.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  { icon: TrendingUp, text: 'Live carrier performance benchmarking across all lanes' },
                  { icon: AlertTriangle, text: 'AI-powered exception detection with root cause analysis' },
                  { icon: Clock, text: 'Predicted ETAs with confidence intervals' },
                  { icon: Users, text: 'Customer-facing tracking portal out of the box' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-gray-600 dark:text-gray-300 text-sm">{text}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 hover:bg-gray-800 text-white font-semibold rounded-xl transition-all hover:scale-105"
              >
                See it in action <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-3xl blur-2xl" />
              <DashboardMockup />
            </div>
          </div>
        </div>
      </Section>

      {/* ── PRICING ───────────────────────────────────────────────────── */}
      <Section id="pricing" className="py-24 lg:py-32 bg-white dark:bg-gray-950 scroll-mt-24 lg:scroll-mt-28">
        <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">
              Start for free. Scale as you grow. No hidden fees, ever.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto xl:max-w-6xl">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                variants={stagger(i * 0.1)}
                className={`relative rounded-2xl p-7 flex flex-col ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-blue-600 to-indigo-700 text-white shadow-2xl shadow-blue-500/30 scale-105'
                    : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full shadow">
                    {plan.badge}
                  </span>
                )}
                <div className="mb-6">
                  <h3 className={`text-lg font-bold mb-1 ${plan.highlight ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm mb-4 ${plan.highlight ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>{plan.desc}</p>
                  <div className="flex items-baseline gap-1">
                      <span className={`text-4xl font-extrabold ${plan.highlight ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className={`text-sm ${plan.highlight ? 'text-blue-200' : 'text-gray-500'}`}>{plan.period}</span>
                    )}
                  </div>
                </div>
                <ul className="space-y-3 flex-1 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle className={`h-4 w-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-blue-300' : 'text-green-500'}`} />
                      <span className={plan.highlight ? 'text-blue-100' : 'text-gray-600 dark:text-gray-300'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.price === 'Custom' ? '/contact' : '/get-demo'}
                  className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105 active:scale-95 ${
                    plan.highlight
                      ? 'bg-white text-blue-600 hover:bg-blue-50 shadow-lg'
                      : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg'
                  }`}
                >
                  {plan.price === 'Custom' ? 'Contact Sales' : 'Get a Demo'}
                </Link>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-8">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </Section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
      <Section className="py-24 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-[#0a0f1e] dark:to-[#0a0f1e] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/15 blur-[100px] rounded-full" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-5 leading-tight">
            Ready to see your supply chain clearly?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-10">
            Join 2,400+ companies that trust TwinChain to run their supply chains. Get started in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/get-demo"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-base font-bold rounded-xl shadow-2xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95"
            >
              Get a Demo
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 border border-gray-300 text-gray-700 hover:text-gray-900 hover:border-gray-400 hover:bg-white dark:border-white/15 dark:text-gray-300 dark:hover:text-white dark:hover:border-white/30 dark:hover:bg-white/5 text-base font-semibold rounded-xl transition-all"
            >
              Talk to Our Team
            </Link>
          </div>
        </div>
      </Section>

      <PublicFooter />
    </div>
  );
}
