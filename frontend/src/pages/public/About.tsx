import { Link } from 'react-router-dom';
import { CheckCircle, ClipboardList, ShieldCheck, Sliders, Truck, Users } from 'lucide-react';
import { PublicHeader } from './components/Header';
import { PublicFooter } from './components/Footer';

const scopeItems = [
  {
    title: 'Order visibility',
    desc: 'Track orders from creation through delivery with consistent status definitions.',
    icon: ClipboardList,
  },
  {
    title: 'Shipment tracking',
    desc: 'Normalize carrier events and surface delays, exceptions, and ETA changes.',
    icon: Truck,
  },
  {
    title: 'Operational workflows',
    desc: 'Route exceptions to the right teams with clear ownership and resolution paths.',
    icon: Sliders,
  },
  {
    title: 'Access control',
    desc: 'Role-based access for operations, warehouse, finance, and support teams.',
    icon: ShieldCheck,
  },
];

const principles = [
  'Single source of truth for order and shipment data',
  'Clear audit trails for operational decisions',
  'Consistent, measurable SLAs and performance tracking',
  'Integration-first approach for existing systems',
];

const audiences = [
  'E-commerce operations teams',
  'Retail and CPG logistics teams',
  'Manufacturers and suppliers',
  'Third-party logistics providers',
  'Carrier partners and last-mile teams',
];

export function AboutPage() {
  return (
    <div className="h-screen overflow-y-auto overflow-x-hidden scrollbar-none bg-white dark:bg-gray-950">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden pt-28 lg:pt-32 pb-16 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-b from-blue-50/60 to-white dark:from-gray-950 dark:to-gray-950">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-900/20" />
          <div className="absolute bottom-0 left-10 h-52 w-52 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-900/20" />
        </div>
        <div className="relative w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">About</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            TwinChain
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
            TwinChain is a supply chain visibility and operations platform that unifies orders, shipments,
            warehouses, and exceptions in one place. It is designed to help teams make reliable decisions
            with accurate, real-time data.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="px-6 py-3 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white font-semibold rounded-xl transition-all"
            >
              Login
            </Link>
            <a
              href="#scope"
              className="px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium rounded-xl transition-all"
            >
              What we provide
            </a>
          </div>
        </div>
      </section>

      {/* Scope */}
      <section id="scope" className="py-16">
        <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">What the platform covers</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {scopeItems.map((item) => (
              <div key={item.title} className="border border-gray-100 dark:border-gray-800 rounded-2xl p-6 bg-white/80 dark:bg-gray-900/70 backdrop-blur-sm hover:shadow-md transition-all">
                <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">How we build the product</h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                TwinChain is built around operational clarity. The focus is on accurate data, consistent
                workflows, and measurable outcomes rather than marketing claims.
              </p>
              <ul className="space-y-3">
                {principles.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-gray-100 dark:border-gray-800 rounded-2xl p-6 bg-white dark:bg-gray-800 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Who it is for</h3>
              <ul className="space-y-3">
                {audiences.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16">
        <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32">
          <div className="border border-gray-100 dark:border-gray-800 rounded-2xl p-8 sm:p-10 bg-white dark:bg-gray-900 shadow-sm">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">Contact</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              For product information, demos, or implementation questions, reach out to our team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="mailto:hello@twinchain.com"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all text-center"
              >
                hello@twinchain.com
              </a>
              <Link
                to="/login"
                className="px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium rounded-xl transition-all text-center"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
