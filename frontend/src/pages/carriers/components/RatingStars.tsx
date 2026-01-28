import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-4 w-4',
            i < Math.floor(rating)
              ? 'text-yellow-400 fill-yellow-400'
              : i < rating
                ? 'text-yellow-400 fill-yellow-400 opacity-50'
                : 'text-gray-300'
          )}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-gray-700 dark:text-gray-300">{rating.toFixed(1)}</span>
    </div>
  );
}
