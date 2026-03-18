import { Link } from 'react-router-dom';
import {
  Truck,
} from 'lucide-react';
import {
  YouTubeIcon,
  LinkedInIcon,
  XIcon,
  FacebookIcon,
  InstagramIcon,
} from './SocialIcons';

const footerLinks = {
  Platform: [
    { label: 'Real-time Tracking', href: '#' },
    { label: 'Order Management', href: '#' },
    { label: 'Carrier Network', href: '#' },
    { label: 'Analytics & BI', href: '#' },
    { label: 'Exception Alerts', href: '#' },
    { label: 'Warehouse Ops', href: '#' },
  ],
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Get a Demo', href: '/get-demo' },
    { label: 'Contact', href: '/contact' },
  ],
};

const socialLinks = [
  {
    label: 'YouTube',
    href: 'https://youtube.com',
    icon: YouTubeIcon,
    hoverClass: 'hover:text-red-600 dark:hover:text-red-500 hover:border-red-300 dark:hover:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30',
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com',
    icon: LinkedInIcon,
    hoverClass: 'hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/30',
  },
  {
    label: 'X',
    href: 'https://x.com',
    icon: XIcon,
    hoverClass: 'hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/80',
  },
  {
    label: 'Facebook',
    href: 'https://facebook.com',
    icon: FacebookIcon,
    hoverClass: 'hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/30',
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com',
    icon: InstagramIcon,
    hoverClass: 'hover:text-pink-600 dark:hover:text-pink-400 hover:border-pink-300 dark:hover:border-pink-900/60 hover:bg-pink-50 dark:hover:bg-pink-950/30',
  },
];

export function PublicFooter() {
  return (
    <footer className="bg-gray-100 dark:bg-gray-950 text-gray-500 dark:text-gray-400">
      {/* Main Links */}
      <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-5">
              <div className="h-9 w-9 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">TwinChain</span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-500 max-w-xs">
              The all-in-one supply chain visibility and management platform — tracking orders, shipments, warehouses, carriers, and exceptions in one place.
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              {socialLinks.map(({ label, href, icon: Icon, hoverClass }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={`h-9 w-9 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-900/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center hover:-translate-y-0.5 ${hoverClass}`}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 tracking-wide">{section}</h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-200 dark:border-white/5">
        <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 2xl:px-32 py-6">
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
            &copy; {new Date().getFullYear()} TwinChain. Built as a full-stack supply chain management project.
          </p>
        </div>
      </div>
    </footer>
  );
}

