import { Search, X } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/cn';
import { IconButton } from './icon-button';
import { Input } from './form';

export type SearchFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  clearLabel?: string;
  onClear?: () => void;
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, clearLabel = 'Clear search', onClear, value, ...props }, ref) => (
    <div className={cn('relative w-full', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
        size={18}
      />
      <Input ref={ref} value={value} className="pl-11 pr-14" type="search" {...props} />
      {onClear ? (
        <IconButton
          aria-label={clearLabel}
          variant="ghost"
          size="sm"
          className="absolute right-1.5 top-1/2 min-h-9 min-w-9 -translate-y-1/2"
          onClick={onClear}
        >
          <X aria-hidden="true" size={16} />
        </IconButton>
      ) : null}
    </div>
  ),
);

SearchField.displayName = 'SearchField';
