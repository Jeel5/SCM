// Page State
export interface HelpPageState {
  activeTab: HelpTab;
  searchQuery: string;
}

// Tab Types
export type HelpTab = 'faq' | 'guides' | 'contact' | 'api-docs';

export interface HelpTabConfig {
  id: HelpTab;
  label: string;
  icon: React.ElementType;
}

// FAQ
export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
  helpful: number;
  views: number;
  lastUpdated: string;
}

export type FAQCategory = 
  | 'orders'
  | 'shipments'
  | 'returns'
  | 'billing'
  | 'integrations'
  | 'account'
  | 'technical';

export interface FAQCategoryGroup {
  category: FAQCategory;
  label: string;
  icon: React.ElementType;
  items: FAQItem[];
}

// Guides
export interface Guide {
  id: string;
  title: string;
  description: string;
  category: GuideCategory;
  estimatedTime: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  steps: GuideStep[];
  relatedGuides: string[];
  lastUpdated: string;
}

export type GuideCategory = 
  | 'getting-started'
  | 'integrations'
  | 'automation'
  | 'reporting'
  | 'troubleshooting';

export interface GuideStep {
  title: string;
  content: string;
  code?: string;
  image?: string;
}

// Contact Support
export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  message: string;
  attachments?: File[];
}

export type SupportCategory = 
  | 'technical'
  | 'billing'
  | 'feature-request'
  | 'bug-report'
  | 'general';

export type SupportPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: SupportPriority;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';

export interface TicketMessage {
  id: string;
  from: string;
  role: 'user' | 'support';
  message: string;
  timestamp: string;
  attachments?: string[];
}

// API Documentation (if embedded)
export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  parameters?: APIParameter[];
  requestBody?: APIRequestBody;
  responses: APIResponse[];
  examples: APIExample[];
}

export interface APIParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

export interface APIRequestBody {
  type: string;
  properties: Record<string, APIProperty>;
  required: string[];
}

export interface APIProperty {
  type: string;
  description: string;
  example?: unknown;
}

export interface APIResponse {
  status: number;
  description: string;
  schema?: object;
}

export interface APIExample {
  title: string;
  request: string;
  response: string;
}
