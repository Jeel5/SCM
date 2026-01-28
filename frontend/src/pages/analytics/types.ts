export interface KPICardProps {
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down';
  icon: React.ElementType;
  color: string;
}

export interface OrderTrendData {
  date: string;
  orders: number;
  revenue: number;
}

export interface CarrierData {
  name: string;
  count: number;
}

export interface WarehouseData {
  name: string;
  utilization: number;
}

export interface DeliveryPerformanceData {
  name: string;
  value: number;
  [key: string]: string | number;
}
