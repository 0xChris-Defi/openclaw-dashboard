import { Home, MessageSquare, Server, Settings, Bot, Github, BookOpen, Plug, Menu, X, Webhook } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  external?: boolean;
}

const navItems: NavItem[] = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/chatbox', icon: MessageSquare, label: 'Chatbox' },
  { path: '/gateway', icon: Webhook, label: 'Gateway & Webhook' },
  { path: '/settings/channels', icon: Plug, label: 'Channels' },
  { path: '/settings/models', icon: Settings, label: 'Models' },
  { path: '/settings/telegram-access', icon: Bot, label: 'Access' },
  { 
    path: 'https://github.com/0xChris-Defi/openclaw-dashboard', 
    icon: Github, 
    label: 'GitHub',
    external: true 
  },
  { 
    path: 'https://docs.openclaw.ai', 
    icon: BookOpen, 
    label: 'Docs',
    external: true 
  },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [location] = useLocation();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 xl:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 bg-card border-r border-primary/30 transition-all duration-300 flex flex-col',
          // All screens: start below header
          'top-16 h-[calc(100vh-4rem)]',
          // Mobile/Tablet: higher z-index for drawer
          'z-50 xl:z-30',
          // Desktop: always visible, toggle between expanded/collapsed
          'xl:translate-x-0',
          isOpen ? 'w-60' : 'w-16',
          // Mobile: drawer style, hidden by default
          isOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'
        )}
      >
      {/* Toggle Button - Hidden on mobile */}
      <button
        onClick={onToggle}
        className="hidden xl:flex items-center justify-center h-12 border-b border-primary/30 hover:bg-primary/10 transition-colors"
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          if (item.external) {
            return (
              <a
                key={item.path}
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-mono transition-colors hover:bg-primary/10 relative',
                  isOpen ? 'justify-start' : 'justify-center'
                )}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isOpen && <span className="truncate">{item.label}</span>}
              </a>
            );
          }

          return (
            <Link key={item.path} href={item.path}>
              <a
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-mono transition-colors hover:bg-primary/10 relative',
                  isActive && 'bg-primary/20 text-primary',
                  isOpen ? 'justify-start' : 'justify-center'
                )}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isOpen && <span className="truncate">{item.label}</span>}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Footer - Version Info */}
      {isOpen && (
        <div className="border-t border-primary/30 p-4">
          <div className="text-xs font-mono text-muted-foreground">
            <div>OpenClaw Dashboard</div>
            <div className="text-primary">v2026.2</div>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
