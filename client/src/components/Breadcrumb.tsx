import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn('flex items-center gap-2 text-sm font-mono', className)}>
      {/* Home Icon */}
      <Link href="/">
        <a className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
          <Home className="w-4 h-4" />
        </a>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            {item.path && !isLast ? (
              <Link href={item.path}>
                <a className="text-muted-foreground hover:text-primary transition-colors">
                  {item.label}
                </a>
              </Link>
            ) : (
              <span className={cn(
                isLast ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
