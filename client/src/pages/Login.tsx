import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit';
import { motion } from "framer-motion";
import { AlertCircle, Loader2, Shield, Terminal, Wallet, Zap, User, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccount, useDisconnect } from 'wagmi';

interface LoginProps {
  onLogin: (success: boolean) => void;
}

// ASCII Art Lobster Logo - larger version for login
const LobsterLogoLarge = () => (
  <pre className="text-primary font-mono text-sm leading-tight neon-text-red select-none whitespace-pre">
{`
    ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗██╗      █████╗ ██╗    ██╗
   ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║     ██╔══██╗██║    ██║
   ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║     ███████║██║ █╗ ██║
   ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║     ██╔══██║██║███╗██║
   ╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗███████╗██║  ██║╚███╔███╔╝
    ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ 
`}
  </pre>
);

// Animated background particles
const BackgroundParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-primary/30 rounded-full"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
            opacity: 0,
          }}
          animate={{
            y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800)],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};

// Glitch text effect
const GlitchText = ({ children }: { children: string }) => {
  return (
    <span className="relative inline-block">
      <span className="relative z-10">{children}</span>
      <span 
        className="absolute top-0 left-0 text-accent opacity-70 animate-pulse"
        style={{ clipPath: "inset(0 0 50% 0)", transform: "translate(-2px, 0)" }}
      >
        {children}
      </span>
      <span 
        className="absolute top-0 left-0 text-primary opacity-70 animate-pulse"
        style={{ clipPath: "inset(50% 0 0 0)", transform: "translate(2px, 0)" }}
      >
        {children}
      </span>
    </span>
  );
};

export default function Login({ onLogin }: LoginProps) {
  const { isAuthenticated, loading: authLoading, refresh } = useAuth();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const adminLoginMutation = trpc.auth.adminLogin.useMutation({
    onSuccess: (data) => {
      toast.success("Admin authentication successful. Welcome, Operator.");
      refresh();
      onLogin(true);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const walletLoginMutation = trpc.auth.walletLogin.useMutation({
    onSuccess: (data) => {
      toast.success("Authentication successful. Welcome, Operator.");
      refresh();
      onLogin(true);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
      setIsLoggingIn(false);
      setHasAttemptedLogin(false);
      // Don't disconnect immediately to allow user to see the error
    },
  });

  // Handle wallet connection - only trigger login once per connection
  useEffect(() => {
    if (isConnected && address && !hasAttemptedLogin && !walletLoginMutation.isPending && !isLoggingIn) {
      setIsLoggingIn(true);
      setHasAttemptedLogin(true);
      setError(null);
      
      walletLoginMutation.mutate({
        walletAddress: address,
      });
    }
  }, [isConnected, address, hasAttemptedLogin, walletLoginMutation.isPending, isLoggingIn]);

  // Reset state when disconnected
  useEffect(() => {
    if (!isConnected) {
      setIsLoggingIn(false);
      setHasAttemptedLogin(false);
    }
  }, [isConnected]);

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated) {
      onLogin(true);
    }
  }, [isAuthenticated, onLogin]);

  const handleOAuthLogin = () => {
    window.location.href = getLoginUrl();
  };

  const handleWalletLogin = () => {
    setError(null);
    setHasAttemptedLogin(false);
    if (openConnectModal) {
      openConnectModal();
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setError(null);
    setHasAttemptedLogin(false);
    setIsLoggingIn(false);
  };

  const handleAdminLogin = () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      toast.error("Please enter username and password");
      return;
    }
    setError(null);
    adminLoginMutation.mutate({
      username: adminUsername,
      password: adminPassword,
    });
  };

  const isProcessing = authLoading || isLoggingIn || walletLoginMutation.isPending || adminLoginMutation.isPending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Scanlines overlay */}
      <div className="scanlines" />
      
      {/* Background particles */}
      <BackgroundParticles />
      
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(oklch(0.65 0.25 15 / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.65 0.25 15 / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px"
        }}
      />

      {/* Main login container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        {/* Logo section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mb-8"
        >
          <div className="overflow-x-auto">
            <LobsterLogoLarge />
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <span className="text-xs font-mono text-muted-foreground px-2">
              SECURE ACCESS TERMINAL
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          </div>
        </motion.div>

        {/* Login card */}
        <Card className="terminal-card border-primary/30 overflow-hidden">
          {/* Card header with terminal style */}
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 text-center">
                <span className="font-mono text-xs text-muted-foreground">
                  openclaw@gateway:~$ authenticate
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {/* System message */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mb-6 p-3 bg-muted/30 rounded-md border border-border/50"
            >
              <div className="flex items-start gap-2">
                <Terminal className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div className="font-mono text-xs text-muted-foreground space-y-1">
                  <p className="text-accent">[SYSTEM] Authentication required</p>
                  <p>Select a login method to access OpenClaw Dashboard.</p>
                  <p className="text-yellow-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Admin access only. Contact owner for permissions.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-md"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div className="font-mono text-xs">
                    <p className="text-red-400">[ERROR] Authentication failed</p>
                    <p className="text-red-300 mt-1">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Login buttons */}
            <div className="space-y-4">
              {/* OAuth Login */}
              <Button
                onClick={handleOAuthLogin}
                disabled={isProcessing}
                className="w-full h-12 bg-primary hover:bg-primary/80 text-primary-foreground font-mono relative overflow-hidden group"
              >
                {isProcessing ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AUTHENTICATING...</span>
                  </motion.div>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <GlitchText>LOGIN WITH OAUTH</GlitchText>
                  </span>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-xs text-muted-foreground font-mono">OR</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {/* Admin Password Login */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="admin-username" className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Username
                  </Label>
                  <Input
                    id="admin-username"
                    type="text"
                    placeholder="admin"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="bg-muted/30 border-border/50 font-mono text-sm h-10"
                    disabled={adminLoginMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password" className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Password
                  </Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                    className="bg-muted/30 border-border/50 font-mono text-sm h-10"
                    disabled={adminLoginMutation.isPending}
                  />
                </div>
                <Button
                  onClick={handleAdminLogin}
                  disabled={isProcessing}
                  variant="outline"
                  className="w-full h-10 border-green-500/50 hover:border-green-500 hover:bg-green-500/10 text-green-400 font-mono text-sm"
                >
                  {adminLoginMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4 mr-2" />
                  )}
                  ADMIN LOGIN
                </Button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-xs text-muted-foreground font-mono">OR</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {/* Wallet Login */}
              {isConnected ? (
                <div className="space-y-3">
                  <div className="p-3 bg-muted/30 rounded-md border border-accent/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-accent" />
                        <span className="font-mono text-sm text-foreground">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </span>
                      </div>
                      {walletLoginMutation.isPending && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleDisconnect}
                    variant="outline"
                    className="w-full h-10 border-border/50 hover:border-red-500/50 hover:text-red-400 font-mono text-sm"
                    disabled={walletLoginMutation.isPending}
                  >
                    DISCONNECT WALLET
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleWalletLogin}
                  disabled={isProcessing}
                  variant="outline"
                  className="w-full h-12 border-accent/50 hover:border-accent hover:bg-accent/10 text-accent font-mono"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wallet className="w-4 h-4 mr-2" />
                  )}
                  CONNECT WALLET
                </Button>
              )}
            </div>

            {/* Footer info */}
            <div className="mt-6 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span>v2.0.0</span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 pulse-glow" />
                  GATEWAY ONLINE
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-center"
        >
          <p className="text-xs font-mono text-muted-foreground">
            🦞 OpenClaw Personal AI Assistant
          </p>
          <p className="text-xs font-mono text-muted-foreground/50 mt-1">
            Secure • Private • Powerful
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
