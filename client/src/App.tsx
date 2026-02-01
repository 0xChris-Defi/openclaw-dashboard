import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ChannelSettings from "./pages/ChannelSettings";
import ModelSettings from "./pages/ModelSettings";
import TelegramAccessControl from "./pages/TelegramAccessControl";
import Chatbox from "./pages/Chatbox";
import GatewayManagement from "./pages/GatewayManagement";

function Router() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Not authenticated or not admin - show login
  if (!isAuthenticated || !isAdmin) {
    return <Login onLogin={() => {}} />;
  }

  return (
    <Layout>
      <Switch>
        <Route path={"/"}>
          <Home onLogout={logout} />
        </Route>
        <Route path={"/chatbox"} component={Chatbox} />
        <Route path={"/gateway"} component={GatewayManagement} />
        <Route path={"/settings/channels"} component={ChannelSettings} />
        <Route path={"/settings/models"} component={ModelSettings} />
        <Route path={"/settings/telegram-access"} component={TelegramAccessControl} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <SidebarProvider>
          <TooltipProvider>
            <Toaster 
              theme="dark"
              toastOptions={{
                style: {
                  background: 'oklch(0.12 0.015 260)',
                  border: '1px solid oklch(0.25 0.02 260)',
                  color: 'oklch(0.9 0.01 260)',
                },
              }}
            />
            <Router />
          </TooltipProvider>
        </SidebarProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
