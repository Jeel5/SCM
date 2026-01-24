import { motion } from 'framer-motion';
import {
  HelpCircle,
  Mail,
  Phone,
  MessageSquare,
  Book,
  FileText,
  Video,
  Search,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components/ui';

export function HelpSupportPage() {
  const quickLinks = [
    {
      title: 'Getting Started',
      icon: Book,
      description: 'Learn the basics of using LogiTower',
      link: '#',
    },
    {
      title: 'Documentation',
      icon: FileText,
      description: 'Complete API and feature documentation',
      link: '#',
    },
    {
      title: 'Video Tutorials',
      icon: Video,
      description: 'Watch step-by-step video guides',
      link: '#',
    },
    {
      title: 'Community Forum',
      icon: MessageSquare,
      description: 'Connect with other users',
      link: '#',
    },
  ];

  const faqs = [
    {
      question: 'How do I track my shipments?',
      answer:
        'Go to the Shipments page from the sidebar. You can search by tracking number, order ID, or filter by status to find specific shipments.',
    },
    {
      question: 'How do I create a new order?',
      answer:
        'Navigate to the Orders page and click "Create Order". Fill in customer details, add items, select a warehouse, and submit.',
    },
    {
      question: 'How do I manage SLA policies?',
      answer:
        'Access SLA Management from the sidebar. You can create new policies, view violations, and monitor compliance metrics.',
    },
    {
      question: 'How do I process returns?',
      answer:
        'Go to the Returns page, click "Create Return", select the order, specify items and reason, then follow the return workflow.',
    },
    {
      question: 'How do I generate reports?',
      answer:
        'Visit the Analytics page to view comprehensive reports. Use the Export button on any page to download data as CSV.',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-4">
          <HelpCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Help & Support</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Find answers to your questions or get in touch with our support team
        </p>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-2xl mx-auto"
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search for help articles, guides, and FAQs..."
            className="pl-12 h-14 text-base"
          />
        </div>
      </motion.div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickLinks.map((link, index) => {
          const Icon = link.icon;
          return (
            <motion.a
              key={link.title}
              href={link.link}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className="group"
            >
              <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                      <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{link.title}</h3>
                        <ExternalLink className="h-4 w-4 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{link.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.a>
          );
        })}
      </div>

      {/* Contact Options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Contact Support</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 mb-3">
                <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Email Support</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Get help via email within 24 hours
              </p>
              <a
                href="mailto:support@logitower.com"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                support@logitower.com
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 mb-3">
                <Phone className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Phone Support</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Talk to us Mon-Fri, 9am-6pm EST
              </p>
              <a
                href="tel:+1-555-0100"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                +1 (555) 010-0100
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 mb-3">
                <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Live Chat</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Chat with our support team instantly
              </p>
              <Button variant="primary" size="sm">
                Start Chat
              </Button>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* FAQs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Frequently Asked Questions
        </h2>
        <Card>
          <CardContent className="divide-y divide-gray-100 dark:divide-gray-700">
            {faqs.map((faq, index) => (
              <div key={index} className="py-6 first:pt-6 last:pb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{faq.question}</h3>
                <p className="text-gray-600 dark:text-gray-400">{faq.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Additional Help */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Still need help?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Our support team is ready to assist you with any questions or issues
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="primary">Contact Support</Button>
              <Button variant="outline">Browse Documentation</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default HelpSupportPage;
