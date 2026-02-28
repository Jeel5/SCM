import { useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, Store, Package, Handshake } from 'lucide-react';
import { Tabs } from '@/components/ui';
import { ChannelsTab } from './components/ChannelsTab';
import { SuppliersTab } from './components/SuppliersTab';

export function PartnersPage() {
  const [activeTab, setActiveTab] = useState('channels');

  const tabs = [
    { id: 'channels', label: 'Sales Channels' },
    { id: 'suppliers', label: 'Suppliers' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Handshake className="h-7 w-7 text-blue-600" />
            Channel Partners
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage sales channels, carriers, and suppliers
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Store className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sales Channels</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">Order sources</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Carriers</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                <a href="/carriers" className="text-blue-600 hover:underline">Manage carriers →</a>
              </p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Suppliers</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">Inbound vendors</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700 px-4">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
        <div className="p-4">
          {activeTab === 'channels' && <ChannelsTab />}
          {activeTab === 'suppliers' && <SuppliersTab />}
        </div>
      </div>
    </div>
  );
}
