import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Users,
  Eye,
} from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Badge,
  Dropdown,
  Modal,
} from '@/components/ui';
import { formatDate, formatNumber, formatCurrency } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  admins: number;
  users: number;
  orders: number;
  revenue: number;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
}

export function CompaniesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [companies] = useState<Company[]>([
    {
      id: '1',
      name: 'TwinChain Demo',
      code: 'DEMO001',
      email: 'contact@twinchain-demo.in',
      phone: '+91-22-1234-5678',
      address: 'Mumbai, Maharashtra, India',
      admins: 1,
      users: 7,
      orders: 2547,
      revenue: 1250000,
      status: 'active',
      createdAt: '2025-01-15T10:00:00Z',
    },
    {
      id: '2',
      name: 'Acme Corporation',
      code: 'ACME001',
      email: 'info@acme.in',
      phone: '+91-11-9876-5432',
      address: 'Delhi, India',
      admins: 2,
      users: 15,
      orders: 3890,
      revenue: 1890000,
      status: 'active',
      createdAt: '2025-02-01T14:30:00Z',
    },
    {
      id: '3',
      name: 'Global Logistics Inc',
      code: 'GLI001',
      email: 'support@globallogistics.in',
      phone: '+91-80-5555-1234',
      address: 'Bangalore, Karnataka, India',
      admins: 1,
      users: 12,
      orders: 1234,
      revenue: 780000,
      status: 'active',
      createdAt: '2025-01-20T09:15:00Z',
    },
  ]);

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Company Management
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Manage all registered companies and their settings
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          Add Company
        </Button>
      </motion.div>

      {/* Search and Filters */}
      <Card>
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search companies by name, code, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Companies List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Company
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Users
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Orders
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCompanies.map((company) => (
                <tr
                  key={company.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                        {company.code.substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {company.name}
                        </div>
                        <code className="text-xs text-gray-500 dark:text-gray-400">
                          {company.code}
                        </code>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm">
                      <div className="text-gray-900 dark:text-white">
                        {company.email}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {company.phone}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm">
                      <div className="text-gray-900 dark:text-white font-medium">
                        {company.users}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {company.admins} {company.admins === 1 ? 'admin' : 'admins'}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-900 dark:text-white">
                    {formatNumber(company.orders)}
                  </td>
                  <td className="py-4 px-6 text-gray-900 dark:text-white font-medium">
                    {formatCurrency(company.revenue)}
                  </td>
                  <td className="py-4 px-6">
                    <Badge
                      variant={
                        company.status === 'active'
                          ? 'success'
                          : company.status === 'inactive'
                          ? 'warning'
                          : 'error'
                      }
                    >
                      {company.status}
                    </Badge>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(new Date(company.createdAt), 'MMM dd, yyyy')}
                  </td>
                  <td className="py-4 px-6">
                    <Dropdown
                      trigger={
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      }
                      items={[
                        {
                          label: 'View Details',
                          value: 'view',
                          icon: <Eye className="h-4 w-4" />,
                        },
                        {
                          label: 'Manage Users',
                          value: 'users',
                          icon: <Users className="h-4 w-4" />,
                        },
                        {
                          label: 'Edit',
                          value: 'edit',
                          icon: <Edit className="h-4 w-4" />,
                        },
                        {
                          label: 'Delete',
                          value: 'delete',
                          icon: <Trash2 className="h-4 w-4" />,
                          danger: true,
                        },
                      ]}
                      onSelect={(value) => {
                        console.log('Action:', value, 'Company:', company.id);
                        // TODO: Implement actions
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCompanies.length === 0 && (
            <div className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No companies found matching your search.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Create Company Modal */}
      <CreateCompanyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}

interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function CreateCompanyModal({ isOpen, onClose }: CreateCompanyModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  const handleSubmit = () => {
    // TODO: Implement create company API call
    console.log('Creating company:', formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Company" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Company Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter company name"
            required
          />
          <Input
            label="Company Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="e.g., ACME001"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="contact@company.in"
            required
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+91-XX-XXXX-XXXX"
            required
          />
        </div>

        <Input
          label="Address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Street address"
          required
        />

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="City"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="Mumbai"
            required
          />
          <Input
            label="State"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            placeholder="Maharashtra"
            required
          />
          <Input
            label="PIN Code"
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
            placeholder="400001"
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Create Company
          </Button>
        </div>
      </div>
    </Modal>
  );
}
