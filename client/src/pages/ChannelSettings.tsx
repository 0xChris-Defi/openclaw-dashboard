import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Check, 
  X, 
  Loader2,
  Settings,
  ArrowLeft,
  Zap,
  Send
} from "lucide-react";
import { Link } from "wouter";

// Channel type definitions
const channelTypes = [
  { value: "telegram", label: "Telegram", icon: "🤖", color: "bg-blue-500" },
  { value: "discord", label: "Discord", icon: "🎮", color: "bg-indigo-500" },
  { value: "slack", label: "Slack", icon: "💼", color: "bg-purple-500" },
  { value: "whatsapp", label: "WhatsApp", icon: "📱", color: "bg-green-500" },
  { value: "feishu", label: "飞书", icon: "🐦", color: "bg-blue-400" },
  { value: "lark", label: "Lark", icon: "🦅", color: "bg-cyan-500" },
  { value: "imessage", label: "iMessage", icon: "💬", color: "bg-gray-500" },
  { value: "wechat", label: "企业微信", icon: "💚", color: "bg-green-600" },
  { value: "custom", label: "Custom Webhook", icon: "🔗", color: "bg-orange-500" },
] as const;

// Config field definitions per channel type
const channelConfigFields: Record<string, Array<{
  key: string;
  label: string;
  type: "text" | "password" | "select";
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}>> = {
  telegram: [
    { key: "botToken", label: "Bot Token", type: "password", placeholder: "123456:ABC-DEF...", required: true },
    { key: "dmPolicy", label: "DM Policy", type: "select", options: [
      { value: "open", label: "Open (Anyone can DM)" },
      { value: "paired", label: "Paired (Require pairing)" },
      { value: "closed", label: "Closed (No DMs)" },
    ]},
  ],
  discord: [
    { key: "botToken", label: "Bot Token", type: "password", placeholder: "Your Discord bot token", required: true },
    { key: "applicationId", label: "Application ID", type: "text", placeholder: "Application ID" },
  ],
  slack: [
    { key: "botToken", label: "Bot Token (xoxb-...)", type: "password", placeholder: "xoxb-...", required: true },
    { key: "appToken", label: "App Token (xapp-...)", type: "password", placeholder: "xapp-..." },
    { key: "signingSecret", label: "Signing Secret", type: "password", placeholder: "Signing secret" },
  ],
  whatsapp: [
    { key: "accessToken", label: "Access Token", type: "password", placeholder: "Your access token", required: true },
    { key: "phoneNumberId", label: "Phone Number ID", type: "text", placeholder: "Phone number ID", required: true },
    { key: "webhookVerifyToken", label: "Webhook Verify Token", type: "text", placeholder: "Verify token" },
  ],
  feishu: [
    { key: "appId", label: "App ID", type: "text", placeholder: "cli_xxx", required: true },
    { key: "appSecret", label: "App Secret", type: "password", placeholder: "App secret", required: true },
    { key: "encryptKey", label: "Encrypt Key", type: "password", placeholder: "Encrypt key (optional)" },
    { key: "verificationToken", label: "Verification Token", type: "password", placeholder: "Verification token" },
  ],
  lark: [
    { key: "appId", label: "App ID", type: "text", placeholder: "cli_xxx", required: true },
    { key: "appSecret", label: "App Secret", type: "password", placeholder: "App secret", required: true },
    { key: "encryptKey", label: "Encrypt Key", type: "password", placeholder: "Encrypt key (optional)" },
    { key: "verificationToken", label: "Verification Token", type: "password", placeholder: "Verification token" },
  ],
  imessage: [
    { key: "serverUrl", label: "Server URL", type: "text", placeholder: "http://localhost:1234", required: true },
    { key: "password", label: "Password", type: "password", placeholder: "Server password (optional)" },
  ],
  wechat: [
    { key: "corpId", label: "Corp ID", type: "text", placeholder: "ww...", required: true },
    { key: "corpSecret", label: "Corp Secret", type: "password", placeholder: "Corp secret", required: true },
    { key: "agentId", label: "Agent ID", type: "text", placeholder: "Agent ID" },
  ],
  custom: [
    { key: "webhookUrl", label: "Webhook URL", type: "text", placeholder: "https://...", required: true },
    { key: "authHeader", label: "Auth Header", type: "text", placeholder: "Authorization header name" },
    { key: "authValue", label: "Auth Value", type: "password", placeholder: "Authorization value" },
  ],
};

export default function ChannelSettings() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [configName, setConfigName] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // Fetch channel configs
  const { data: channels, isLoading, refetch } = trpc.channels.list.useQuery();
  
  // Mutations
  const createMutation = trpc.channels.create.useMutation({
    onSuccess: () => {
      toast.success("Channel created successfully");
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to create channel: ${error.message}`);
    },
  });

  const updateMutation = trpc.channels.update.useMutation({
    onSuccess: () => {
      toast.success("Channel updated successfully");
      setIsEditDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update channel: ${error.message}`);
    },
  });

  const deleteMutation = trpc.channels.delete.useMutation({
    onSuccess: () => {
      toast.success("Channel deleted successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete channel: ${error.message}`);
    },
  });

  const testMutation = trpc.channels.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      setTestingId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Test failed: ${error.message}`);
      setTestingId(null);
    },
  });

  const testWithConfigMutation = trpc.channels.testWithConfig.useMutation();

  const syncMutation = trpc.channels.syncToGateway.useMutation({
    onSuccess: () => {
      toast.success("Channel synced to Gateway successfully");
      setSyncingId(null);
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
      setSyncingId(null);
    },
  });

  const resetForm = () => {
    setSelectedType("");
    setConfigName("");
    setConfigValues({});
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!selectedType || !configName) {
      toast.error("Please fill in all required fields");
      return;
    }

    createMutation.mutate({
      channelType: selectedType as any,
      name: configName,
      config: configValues,
      enabled: false,
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;

    updateMutation.mutate({
      id: editingId,
      name: configName,
      config: configValues,
    });
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    testMutation.mutate({ id });
  };

  const handleTestBeforeSave = async () => {
    if (!selectedType) return;
    
    try {
      const result = await testWithConfigMutation.mutateAsync({
        channelType: selectedType as any,
        config: configValues,
      });
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(`Test failed: ${error.message}`);
    }
  };

  const handleSync = (id: number) => {
    setSyncingId(id);
    syncMutation.mutate({ id });
  };

  const handleToggleEnabled = (id: number, enabled: boolean) => {
    updateMutation.mutate({ id, enabled });
  };

  const openEditDialog = (channel: any) => {
    setEditingId(channel.id);
    setSelectedType(channel.channelType);
    setConfigName(channel.name);
    setConfigValues(channel.config || {});
    setIsEditDialogOpen(true);
  };

  const getChannelInfo = (type: string) => {
    return channelTypes.find(c => c.value === type) || { label: type, icon: "📡", color: "bg-gray-500" };
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50"><Check className="w-3 h-3 mr-1" /> Connected</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/50"><X className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Not Tested</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-mono font-bold text-primary flex items-center gap-3">
              <MessageSquare className="w-8 h-8" />
              CHANNEL SETTINGS
            </h1>
            <p className="text-muted-foreground mt-2">Configure messaging channels for your AI assistant</p>
          </div>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Channel
          </Button>
        </div>

        {/* Channel List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : channels && channels.length > 0 ? (
          <div className="grid gap-4">
            {channels.map((channel) => {
              const info = getChannelInfo(channel.channelType);
              return (
                <Card key={channel.id} className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg ${info.color} flex items-center justify-center text-2xl`}>
                          {info.icon}
                        </div>
                        <div>
                          <h3 className="font-mono font-semibold text-lg">{channel.name}</h3>
                          <p className="text-sm text-muted-foreground">{info.label}</p>
                        </div>
                        {getStatusBadge(channel.testStatus)}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`enabled-${channel.id}`} className="text-sm text-muted-foreground">
                            Enabled
                          </Label>
                          <Switch
                            id={`enabled-${channel.id}`}
                            checked={channel.enabled}
                            onCheckedChange={(checked) => handleToggleEnabled(channel.id, checked)}
                          />
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTest(channel.id)}
                          disabled={testingId === channel.id}
                          className="text-muted-foreground hover:text-primary"
                        >
                          {testingId === channel.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSync(channel.id)}
                          disabled={syncingId === channel.id || !channel.enabled}
                          className="text-muted-foreground hover:text-green-400"
                          title="Sync to Gateway"
                        >
                          {syncingId === channel.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(channel)}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate({ id: channel.id })}
                          className="text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {channel.testMessage && (
                      <p className="mt-3 text-sm text-muted-foreground font-mono">
                        Last test: {channel.testMessage}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card/50 border-border/50 border-dashed">
            <CardContent className="p-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Channels Configured</h3>
              <p className="text-muted-foreground mb-4">Add a messaging channel to get started</p>
              <Button 
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Channel
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Channel Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary">Add New Channel</DialogTitle>
            <DialogDescription>Configure a new messaging channel for your AI assistant</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Channel Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select channel type" />
                </SelectTrigger>
                <SelectContent>
                  {channelTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Configuration Name</Label>
              <Input
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="My Telegram Bot"
              />
            </div>

            {selectedType && channelConfigFields[selectedType]?.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </Label>
                {field.type === "select" ? (
                  <Select 
                    value={configValues[field.key] || ""} 
                    onValueChange={(v) => setConfigValues({ ...configValues, [field.key]: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.type}
                    value={configValues[field.key] || ""}
                    onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTestBeforeSave}
              disabled={!selectedType || testWithConfigMutation.isPending}
            >
              {testWithConfigMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-primary/20 hover:bg-primary/30 text-primary"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Channel Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary">Edit Channel</DialogTitle>
            <DialogDescription>Update channel configuration</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Configuration Name</Label>
              <Input
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="My Telegram Bot"
              />
            </div>

            {selectedType && channelConfigFields[selectedType]?.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </Label>
                {field.type === "select" ? (
                  <Select 
                    value={configValues[field.key] || ""} 
                    onValueChange={(v) => setConfigValues({ ...configValues, [field.key]: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.type}
                    value={configValues[field.key] || ""}
                    onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTestBeforeSave}
              disabled={testWithConfigMutation.isPending}
            >
              {testWithConfigMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="bg-primary/20 hover:bg-primary/30 text-primary"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
