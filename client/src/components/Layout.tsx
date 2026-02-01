import { useMemo } from 'react';
import { Menu } from 'lucide-react';
import { useLocation } from 'wouter';
import { Sidebar } from './Sidebar';
import { Breadcrumb } from './Breadcrumb';
import { useSidebar } from '@/contexts/SidebarContext';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { sidebarOpen, toggleSidebar } = useSidebar();

  // Generate breadcrumb items based on current path
  const breadcrumbItems = useMemo(() => {
    const pathMap: Record<string, { label: string; parent?: string }> = {
      '/': { label: 'Dashboard' },
      '/chatbox': { label: 'Chatbox' },
      '/gateway': { label: 'Gateway & Webhook' },
      '/settings/channels': { label: 'Channel Settings', parent: 'Settings' },
      '/settings/models': { label: 'Model Settings', parent: 'Settings' },
      '/settings/telegram-access': { label: 'Telegram Access Control', parent: 'Settings' },
    };

    const current = pathMap[location];
    if (!current) return [];

    const items = [];
    if (current.parent) {
      items.push({ label: current.parent });
    }
    items.push({ label: current.label });
    return items;
  }, [location]);

  return (
    <div className="min-h-screen bg-background">
      {/* Scanlines overlay */}
      <div className="scanlines" />
      
      {/* Mobile Menu Button - Fixed at top left */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-[60] xl:hidden p-2 bg-card border border-primary/30 rounded hover:bg-primary/10 transition-colors"
        title="Toggle menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      
      {/* Main Content */}
      <main className={`transition-all duration-300 pt-16 ${
        sidebarOpen ? 'xl:ml-60' : 'xl:ml-16'
      }`}>
        {/* Breadcrumb */}
        {breadcrumbItems.length > 0 && (
          <div className="border-b border-border bg-card/30 backdrop-blur-sm">
            <div className="container py-3">
              <Breadcrumb items={breadcrumbItems} />
            </div>
          </div>
        )}
        
        {children}
      </main>
    </div>
  );
}
