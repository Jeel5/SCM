import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  iconBg: string;
  link?: string;
  onLearnMore?: () => void;
  learnMoreLabel?: string;
}

export function MetricCard({
  title,
  value,
  change,
  icon,
  iconBg,
  link,
  onLearnMore,
  learnMoreLabel = 'Learn More',
}: MetricCardProps) {
  const isPositive = change >= 0;
  const hasFooterAction = Boolean(link || onLearnMore);

  const handleLearnMoreClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onLearnMore?.();
  };

  const Content = (
    <Card hover={Boolean(link)} className="relative overflow-hidden h-full">
      {/* Decorative gradient */}
      <div className={cn('absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20', iconBg)} />
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-gray-900 dark:text-white"
          >
            {value}
          </motion.p>
          <div className="flex items-center gap-1 mt-2">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span
              className={cn(
                'text-sm font-medium',
                isPositive ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {isPositive ? '+' : ''}{change.toFixed(1)}%
            </span>
            <span className="text-sm text-gray-400 dark:text-gray-500">vs last period</span>
          </div>
        </div>
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', iconBg)}>
          {icon}
        </div>
      </div>
      
      {hasFooterAction && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          {link ? (
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              View Details <ArrowRight className="h-4 w-4" />
            </span>
          ) : (
            <button
              type="button"
              onClick={handleLearnMoreClick}
              className="text-sm text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-1 hover:gap-2 transition-all"
            >
              {learnMoreLabel} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </Card>
  );

  if (link) {
    return <Link to={link} className="group">{Content}</Link>;
  }
  return Content;
}
