import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Edit2,
  Check,
  X,
  Terminal,
  Bot,
  Brain,
  ChevronDown,
  ChevronUp,
  Loader2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";

// Model options for the switcher
const defaultModels = [
  { id: "auto", name: "Auto (Gateway)", provider: "openclaw" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
  { id: "deepseek-chat", name: "DeepSeek V3", provider: "deepseek" },
];

// Provider colors
const providerColors: Record<string, string> = {
  openclaw: "text-primary",
  anthropic: "text-orange-400",
  openai: "text-green-400",
  deepseek: "text-blue-400",
  google: "text-yellow-400",
};

export default function Chatbox() {
  // Get sidebar state from context
  const { sidebarOpen } = useSidebar();
  
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [selectedModel, setSelectedModel] = useState("auto");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Sessions panel state - visibility (hidden/shown) - DESKTOP ONLY
  const [sessionsPanelVisible, setSessionsPanelVisible] = useState(() => {
    const saved = localStorage.getItem('chatbox-sessions-visible');
    if (saved !== null) return saved === 'true';
    return true; // Default visible on desktop
  });
  
  // Mobile drawer state (separate from visibility)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  
  // Panel width for resizing
  const [sessionsPanelWidth, setSessionsPanelWidth] = useState(() => {
    const saved = localStorage.getItem('chatbox-sessions-width');
    return saved ? parseInt(saved) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [thinkingContent, setThinkingContent] = useState("");
  const [showThinking, setShowThinking] = useState(true);
  
  // Optimistic user message - show immediately before AI response
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  
  // Check if mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Queries
  const { data: sessions = [], refetch: refetchSessions } = trpc.chat.listSessions.useQuery();
  const { data: messages = [], refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { sessionId: selectedSessionId! },
    { enabled: !!selectedSessionId }
  );

  // Mutations
  const createSession = trpc.chat.createSession.useMutation({
    onSuccess: (newSession) => {
      refetchSessions();
      setSelectedSessionId(newSession.id);
      toast.success("New chat session created");
      // Close mobile drawer after creating session
      if (isMobile) setMobileDrawerOpen(false);
    },
  });

  const deleteSession = trpc.chat.deleteSession.useMutation({
    onSuccess: () => {
      refetchSessions();
      setSelectedSessionId(null);
      toast.success("Chat session deleted");
    },
  });

  const updateSessionTitle = trpc.chat.updateSessionTitle.useMutation({
    onSuccess: () => {
      refetchSessions();
      setEditingSessionId(null);
      toast.success("Session title updated");
    },
  });

  // Auto-scroll to bottom when new messages arrive or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Select first session when sessions load (but don't auto-create)
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  // Save sessions panel state to localStorage
  useEffect(() => {
    localStorage.setItem('chatbox-sessions-visible', String(sessionsPanelVisible));
  }, [sessionsPanelVisible]);

  useEffect(() => {
    localStorage.setItem('chatbox-sessions-width', String(sessionsPanelWidth));
  }, [sessionsPanelWidth]);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      // Calculate new width based on sidebar position
      const sidebarWidth = sidebarOpen ? 240 : 64;
      const newWidth = Math.min(Math.max(e.clientX - sidebarWidth, 200), 500);
      setSessionsPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarOpen]);

  // Use the streaming mutation
  const sendMessageStream = trpc.chat.sendMessageStream.useMutation({
    onSuccess: (data) => {
      refetchMessages();
      setIsStreaming(false);
      setStreamingContent("");
      setPendingUserMessage(null);
      if (data.thinkingContent) {
        setThinkingContent(data.thinkingContent);
      }
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error.message}`);
      setIsStreaming(false);
      setStreamingContent("");
      setThinkingContent("");
      setPendingUserMessage(null);
    },
  });

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedSessionId) return;
    
    const content = messageInput.trim();
    setMessageInput("");
    
    // Show user message immediately (optimistic update)
    setPendingUserMessage(content);
    setIsStreaming(true);
    setStreamingContent("");
    setThinkingContent("");
    
    // Use streaming API for better UX
    sendMessageStream.mutate({
      sessionId: selectedSessionId,
      content,
      modelId: selectedModel === 'auto' ? undefined : selectedModel,
    });
  };

  const handleCreateNewSession = () => {
    createSession.mutate({ title: `Chat ${sessions.length + 1}` });
  };

  const handleDeleteSession = (sessionId: number) => {
    if (confirm("Are you sure you want to delete this chat session?")) {
      deleteSession.mutate({ sessionId });
    }
  };

  const handleStartEditTitle = (sessionId: number, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle || `Chat ${sessionId}`);
  };

  const handleSaveTitle = (sessionId: number) => {
    if (editingTitle.trim()) {
      updateSessionTitle.mutate({
        sessionId,
        title: editingTitle.trim(),
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };
  
  const handleSelectSession = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    // Close mobile drawer after selecting session
    if (isMobile) setMobileDrawerOpen(false);
  };

  const currentModel = defaultModels.find(m => m.id === selectedModel) || defaultModels[0];

  // Calculate dynamic left position for fixed elements
  const getLeftPosition = () => {
    if (isMobile) return 0;
    const sidebarWidth = sidebarOpen ? 240 : 64;
    if (sessionsPanelVisible) {
      return sidebarWidth + sessionsPanelWidth;
    }
    return sidebarWidth + 48; // 48px for collapsed panel icons
  };

  // Sessions Panel Content - reused for both desktop and mobile
  const SessionsPanelContent = () => (
    <div className="flex flex-col h-full">
      {/* Fixed Header with New Chat Button */}
      <div className="flex-shrink-0 bg-black/90 backdrop-blur-sm border-b border-primary/30">
        {/* Title Row */}
        <div className="p-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-mono font-bold text-primary neon-text-red">
              SESSIONS
            </h2>
          </div>
          {/* Close button for mobile */}
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileDrawerOpen(false)}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        {/* New Chat Button - Always Visible */}
        <div className="px-4 pb-3">
          <Button
            onClick={handleCreateNewSession}
            disabled={createSession.isPending}
            className="w-full bg-primary/20 hover:bg-primary/30 border border-primary/50 font-mono"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>
      </div>
      
      {/* Fixed Sessions List - scrolls internally */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-mono">No sessions yet</p>
              </div>
            ) : (
              <AnimatePresence>
                {sessions.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="mb-2"
                  >
                    <div
                      className={cn(
                        "p-3 rounded border cursor-pointer transition-all",
                        selectedSessionId === session.id
                          ? "border-primary bg-primary/20 neon-border-red"
                          : "border-primary/30 hover:border-primary/50 hover:bg-primary/10"
                      )}
                      onClick={() => handleSelectSession(session.id)}
                    >
                      {editingSessionId === session.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveTitle(session.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveTitle(session.id)}
                            className="h-7 w-7 p-0"
                          >
                            <Check className="w-4 h-4 text-green-400" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            className="h-7 w-7 p-0"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />
                              <span className="font-mono text-sm truncate">
                                {session.title || `Chat ${session.id}`}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(session.updatedAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEditTitle(session.id, session.title || '')}
                              className="h-7 w-7 p-0 hover:bg-primary/20"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteSession(session.id)}
                              className="h-7 w-7 p-0 hover:bg-red-500/20"
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  // Input area height for padding calculation
  const inputAreaHeight = 120; // Approximate height of input area

  return (
    <div className="h-[calc(100vh-80px)] relative">
      {/* Mobile: Floating Button to Open Sessions Drawer - Only show when drawer is closed */}
      {isMobile && !mobileDrawerOpen && (
        <Button
          onClick={() => setMobileDrawerOpen(true)}
          className="fixed bottom-36 left-4 z-40 h-12 w-12 rounded-full bg-primary/80 hover:bg-primary border border-primary/50 shadow-lg"
          title="Open Sessions"
        >
          <PanelLeft className="w-5 h-5" />
        </Button>
      )}
      
      {/* Mobile: Sessions Drawer Overlay - Pure overlay mode, doesn't affect chat area */}
      {isMobile && mobileDrawerOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}
      
      {/* Mobile: Sessions Drawer - Pure drawer mode, slides over content */}
      {isMobile && (
        <div
          className={cn(
            "fixed left-0 top-0 bottom-0 z-50 w-[85vw] max-w-[320px] bg-black/95 border-r border-primary/30 transition-transform duration-300 ease-in-out",
            mobileDrawerOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
          )}
        >
          <SessionsPanelContent />
        </div>
      )}
      
      {/* Desktop: Sessions Sidebar - Fixed Position */}
      {!isMobile && (
        <>
          {/* Show expand button when panel is hidden */}
          {!sessionsPanelVisible && (
            <div 
              className="fixed top-16 bottom-0 w-12 border-r border-primary/30 bg-black/40 backdrop-blur-sm flex flex-col items-center py-4 z-30"
              style={{ left: sidebarOpen ? 240 : 64 }}
            >
              <Button
                onClick={() => setSessionsPanelVisible(true)}
                className="w-8 h-8 p-0 bg-primary/20 hover:bg-primary/30 border border-primary/50"
                title="Show Sessions"
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
              <Separator className="w-6 my-3" />
              <Button
                size="sm"
                onClick={handleCreateNewSession}
                disabled={createSession.isPending}
                className="w-8 h-8 p-0 bg-primary/20 hover:bg-primary/30 border border-primary/50"
                title="New Chat"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Separator className="w-6 my-3" />
              {/* Mini session icons */}
              <ScrollArea className="flex-1 w-full">
                <div className="flex flex-col items-center gap-1 px-1">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      className={cn(
                        "w-8 h-8 rounded flex items-center justify-center transition-colors",
                        selectedSessionId === session.id
                          ? "bg-primary/30 text-primary"
                          : "hover:bg-primary/10 text-muted-foreground"
                      )}
                      title={session.title || `Chat ${session.id}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          
          {/* Full Sessions Panel - Fixed Position */}
          {sessionsPanelVisible && (
            <div 
              className="fixed top-16 bottom-0 border-r border-primary/30 bg-black/40 backdrop-blur-sm z-30"
              style={{ left: sidebarOpen ? 240 : 64, width: sessionsPanelWidth }}
            >
              {/* Hide Panel Button */}
              <button
                onClick={() => setSessionsPanelVisible(false)}
                className="absolute -right-3 top-4 z-10 w-6 h-6 rounded-full bg-card border border-primary/50 flex items-center justify-center hover:bg-primary/20 transition-colors"
                title="Hide Sessions"
              >
                <PanelLeftClose className="w-4 h-4 text-primary" />
              </button>
              
              <SessionsPanelContent />
              
              {/* Resize Handle */}
              <div
                ref={resizeRef}
                onMouseDown={handleMouseDown}
                className={cn(
                  "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors",
                  isResizing && "bg-primary/50"
                )}
              />
            </div>
          )}
        </>
      )}

      {/* Chat Area - Full width on mobile, offset on desktop */}
      <div 
        className="flex flex-col h-full"
        style={{ 
          marginLeft: !isMobile ? (sessionsPanelVisible ? sessionsPanelWidth : 48) : 0 
        }}
      >
        {selectedSessionId ? (
          <>
            {/* Messages Area - Add padding at bottom for fixed input */}
            <ScrollArea className="flex-1 p-6" style={{ paddingBottom: inputAreaHeight + 24 }}>
              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`mb-6 ${message.role === 'user' ? 'flex justify-end' : ''}`}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] p-4 rounded-lg border",
                        message.role === 'user'
                          ? "bg-primary/20 border-primary/50 neon-border-red"
                          : "bg-muted/50 border-muted-foreground/30"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-primary">
                          {message.role === 'user' ? 'YOU' : 'AI'}
                        </span>
                        <Separator orientation="vertical" className="h-3" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                        {message.modelId && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <span className="text-xs text-muted-foreground">
                              {message.modelId}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <Streamdown>{message.content}</Streamdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Pending User Message - Show immediately */}
              {pendingUserMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 flex justify-end"
                >
                  <div className="max-w-[80%] p-4 rounded-lg border bg-primary/20 border-primary/50 neon-border-red">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-primary">YOU</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="text-xs text-muted-foreground">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <Streamdown>{pendingUserMessage}</Streamdown>
                    </div>
                  </div>
                </motion.div>
              )}
              
              {/* Streaming Response Display */}
              {(isStreaming || sendMessageStream.isPending) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  {/* Thinking Process (if available) */}
                  {thinkingContent && (
                    <Collapsible open={showThinking} onOpenChange={setShowThinking} className="mb-4">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                          <Brain className="w-4 h-4 text-purple-400" />
                          <span className="font-mono">Thinking...</span>
                          {showThinking ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 p-3 rounded bg-purple-500/10 border border-purple-500/30 text-sm text-muted-foreground italic">
                          <Streamdown>{thinkingContent}</Streamdown>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* AI Response */}
                  <div className="max-w-[80%] p-4 rounded-lg border bg-muted/50 border-muted-foreground/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-primary">AI</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="text-xs text-muted-foreground">{currentModel.name}</span>
                    </div>
                    {streamingContent ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <Streamdown>{streamingContent}</Streamdown>
                        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-primary">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-mono">AI is thinking...</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Fixed Input Area at Bottom */}
            <div 
              className="fixed bottom-0 right-0 p-4 border-t border-primary/30 bg-black/90 backdrop-blur-sm z-30"
              style={{ 
                left: isMobile ? 0 : (sidebarOpen ? 240 : 64) + (sessionsPanelVisible ? sessionsPanelWidth : 48)
              }}
            >
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message... (Enter to send)"
                  className="flex-1 font-mono border-primary/30 focus:border-primary"
                  disabled={sendMessageStream.isPending || isStreaming}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageStream.isPending || isStreaming}
                  className="bg-primary/20 hover:bg-primary/30 border border-primary/50"
                >
                  {sendMessageStream.isPending || isStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              {/* Model Selector */}
              <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Bot className={cn("w-4 h-4", providerColors[currentModel.provider])} />
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="w-[200px] h-8 text-xs font-mono border-primary/30 bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {defaultModels.map((model) => (
                        <SelectItem key={model.id} value={model.id} className="text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <span className={providerColors[model.provider]}>●</span>
                            <span>{model.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                    ({currentModel.provider})
                  </span>
                </div>
                
                {/* Token count placeholder */}
                <div className="text-xs text-muted-foreground font-mono">
                  {messages.length > 0 && (
                    <span>Messages: {messages.length}</span>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          // Welcome Screen - No auto-create
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Terminal className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-2xl font-mono font-bold text-primary mb-2 neon-text-red">
                OPENCLAW CHAT
              </h2>
              <p className="text-muted-foreground font-mono mb-6">
                {sessions.length === 0 
                  ? "Start a new conversation with your AI assistant"
                  : "Select a chat session from the sidebar or create a new one"
                }
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={handleCreateNewSession}
                  disabled={createSession.isPending}
                  className="bg-primary/20 hover:bg-primary/30 border border-primary/50 font-mono"
                >
                  {createSession.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  New Chat Session
                </Button>
                {isMobile && sessions.length > 0 && (
                  <Button
                    onClick={() => setMobileDrawerOpen(true)}
                    variant="outline"
                    className="font-mono border-primary/50"
                  >
                    <PanelLeft className="w-4 h-4 mr-2" />
                    View Sessions
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
