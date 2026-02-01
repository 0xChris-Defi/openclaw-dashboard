import { Menu, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/_core/hooks/useAuth';

interface HeaderProps {
  onMenuClick: () => void;
  gatewayStatus?: 'online' | 'offline';
}

export function Header({ onMenuClick, gatewayStatus = 'online' }: HeaderProps) {
  const { logout } = useAuth();

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-card border-b border-primary/30 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left: Menu + Logo */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden hover:bg-primary/10"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-3">
            {/* ASCII Lobster Logo */}
            <pre className="text-primary font-mono text-[8px] leading-tight hidden sm:block">
{`🦞 OPENCLAW 🦞
╔═══════════╗
║  ◉    ◉  ║
║   ╲  ╱   ║
║  ═════   ║
╚═══════════╝`}
            </pre>

            {/* Title */}
            <div>
              <h1 className="text-lg font-mono font-bold text-primary">
                OPENCLAW DASHBOARD
              </h1>
              <p className="text-xs text-muted-foreground font-mono hidden sm:block">
                Personal AI Assistant Control Panel
              </p>
            </div>
          </div>
        </div>

        {/* Right: Status + Actions */}
        <div className="flex items-center gap-3">
          {/* Gateway Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                gatewayStatus === 'online'
                  ? 'bg-green-500 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-sm font-mono hidden sm:inline">
              {gatewayStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="hover:bg-primary/10 hidden sm:inline-flex"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="hover:bg-primary/10 gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
