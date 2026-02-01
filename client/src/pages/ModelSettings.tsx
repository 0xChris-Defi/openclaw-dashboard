import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Cpu, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Check, 
  X, 
  Loader2,
  Settings,
  ArrowLeft,
  Zap,
  Star,
  Clock
} from "lucide-react";
import { Link } from "wouter";

// Model provider definitions
const modelProviders = [
  { value: "openai", label: "OpenAI", icon: "🤖", color: "bg-green-500" },
  { value: "anthropic", label: "Anthropic (Claude)", icon: "🧠", color: "bg-orange-500" },
  { value: "openrouter", label: "OpenRouter", icon: "🌐", color: "bg-blue-500" },
  { value: "google", label: "Google (Gemini)", icon: "🔮", color: "bg-purple-500" },
  { value: "minimax", label: "MiniMax", icon: "⚡", color: "bg-yellow-500" },
  { value: "deepseek", label: "DeepSeek", icon: "🔍", color: "bg-cyan-500" },
  { value: "moonshot", label: "Moonshot (Kimi)", icon: "🌙", color: "bg-indigo-500" },
  { value: "zhipu", label: "智谱AI (GLM)", icon: "🐉", color: "bg-red-500" },
  { value: "baichuan", label: "百川", icon: "🌊", color: "bg-teal-500" },
  { value: "qwen", label: "通义千问", icon: "☁️", color: "bg-sky-500" },
  { value: "custom", label: "Custom (OpenAI Compatible)", icon: "🔧", color: "bg-gray-500" },
] as const;

// Config field definitions per provider
const providerConfigFields: Record<string, Array<{
  key: string;
  label: string;
  type: "text" | "password" | "number";
  placeholder?: string;
  required?: boolean;
}>> = {
  openai: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "sk-...", required: true },
    { key: "baseUrl", label: "Base URL (Optional)", type: "text", placeholder: "https://api.openai.com/v1" },
    { key: "organization", label: "Organization ID (Optional)", type: "text", placeholder: "org-..." },
  ],
  anthropic: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "sk-ant-...", required: true },
    { key: "baseUrl", label: "Base URL (Optional)", type: "text", placeholder: "https://api.anthropic.com" },
  ],
  openrouter: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "sk-or-...", required: true },
  ],
  google: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "AIza...", required: true },
  ],
  minimax: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "Your API key", required: true },
    { key: "groupId", label: "Group ID", type: "text", placeholder: "Group ID", required: true },
  ],
  deepseek: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "sk-...", required: true },
  ],
  moonshot: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "sk-...", required: true },
  ],
  zhipu: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "Your API key", required: true },
  ],
  baichuan: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "Your API key", required: true },
  ],
  qwen: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "sk-...", required: true },
  ],
  custom: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "Your API key", required: true },
    { key: "baseUrl", label: "Base URL", type: "text", placeholder: "https://your-api.com/v1", required: true },
  ],
};

// Default models per provider
const defaultModels: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
  openrouter: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-2.0-flash-exp"],
  google: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
  minimax: ["abab6.5s-chat", "abab6.5-chat", "abab5.5-chat"],
  deepseek: ["deepseek-chat", "deepseek-coder"],
  moonshot: ["moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k"],
  zhipu: ["glm-4", "glm-4-flash", "glm-3-turbo"],
  baichuan: ["Baichuan4", "Baichuan3-Turbo", "Baichuan2-Turbo"],
  qwen: ["qwen-max", "qwen-plus", "qwen-turbo"],
  custom: [],
};

export default function ModelSettings() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [configName, setConfigName] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // Fetch model configs
  const { data: models, isLoading, refetch } = trpc.aiModels.list.useQuery();
  
  // Mutations
  const createMutation = trpc.aiModels.create.useMutation({
    onSuccess: () => {
      toast.success("Model provider created successfully");
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to create model provider: ${error.message}`);
    },
  });

  const updateMutation = trpc.aiModels.update.useMutation({
    onSuccess: () => {
      toast.success("Model provider updated successfully");
      setIsEditDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update model provider: ${error.message}`);
    },
  });

  const deleteMutation = trpc.aiModels.delete.useMutation({
    onSuccess: () => {
      toast.success("Model provider deleted successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete model provider: ${error.message}`);
    },
  });

  const testMutation = trpc.aiModels.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${result.message} (${result.latency}ms)`);
      } else {
        toast.error(result.message);
      }
      setTestingId(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Test failed: ${error.message}`);
      setTestingId(null);
    },
  });

  const testWithConfigMutation = trpc.aiModels.testWithConfig.useMutation();

  const setDefaultMutation = trpc.aiModels.setDefault.useMutation({
    onSuccess: () => {
      toast.success("Default model updated");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to set default: ${error.message}`);
    },
  });

  const syncMutation = trpc.aiModels.syncToGateway.useMutation({
    onSuccess: () => {
      toast.success("Model synced to Gateway successfully");
      setSyncingId(null);
    },
    onError: (error: any) => {
      toast.error(`Sync failed: ${error.message}`);
      setSyncingId(null);
    },
  });

  const resetForm = () => {
    setSelectedProvider("");
    setConfigName("");
    setConfigValues({});
    setSelectedModel("");
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!selectedProvider || !configName) {
      toast.error("Please fill in all required fields");
      return;
    }

    createMutation.mutate({
      provider: selectedProvider as any,
      name: configName,
      config: configValues,
      enabled: false,
      selectedModel: selectedModel || undefined,
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;

    updateMutation.mutate({
      id: editingId,
      name: configName,
      config: configValues,
      selectedModel: selectedModel || undefined,
    });
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    testMutation.mutate({ id });
  };

  const handleTestBeforeSave = async () => {
    if (!selectedProvider) return;
    
    try {
      const result = await testWithConfigMutation.mutateAsync({
        provider: selectedProvider as any,
        config: configValues,
      });
      
      if (result.success) {
        toast.success(`${result.message} (${result.latency}ms)`);
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

  const handleSetDefault = (id: number) => {
    setDefaultMutation.mutate({ id });
  };

  const openEditDialog = (model: any) => {
    setEditingId(model.id);
    setSelectedProvider(model.provider);
    setConfigName(model.name);
    setConfigValues(model.config || {});
    setSelectedModel(model.selectedModel || "");
    setIsEditDialogOpen(true);
  };

  const getProviderInfo = (provider: string) => {
    return modelProviders.find(p => p.value === provider) || { label: provider, icon: "🤖", color: "bg-gray-500" };
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

  const getAvailableModels = (provider: string, modelConfig: { models?: Array<{ id: string } | string> | null }) => {
    // If we have fetched models from the API, use those
    if (modelConfig?.models && modelConfig.models.length > 0) {
      return modelConfig.models.map((m: any) => m.id || m);
    }
    // Otherwise use defaults
    return defaultModels[provider] || [];
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
              <Cpu className="w-8 h-8" />
              MODEL SETTINGS
            </h1>
            <p className="text-muted-foreground mt-2">Configure AI model providers for your assistant</p>
          </div>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Provider
          </Button>
        </div>

        {/* Model List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : models && models.length > 0 ? (
          <div className="grid gap-4">
            {models.map((model) => {
              const info = getProviderInfo(model.provider);
              const availableModels = getAvailableModels(model.provider, model);
              return (
                <Card key={model.id} className={`bg-card/50 border-border/50 hover:border-primary/30 transition-colors ${model.isDefault ? 'ring-2 ring-primary/50' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg ${info.color} flex items-center justify-center text-2xl`}>
                          {info.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-mono font-semibold text-lg">{model.name}</h3>
                            {model.isDefault && (
                              <Badge className="bg-primary/20 text-primary border-primary/50">
                                <Star className="w-3 h-3 mr-1" /> Default
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{info.label}</p>
                          {model.selectedModel && (
                            <p className="text-xs text-primary font-mono mt-1">Model: {model.selectedModel}</p>
                          )}
                        </div>
                        {getStatusBadge(model.testStatus)}
                        {model.testLatency && (
                          <Badge variant="outline" className="text-muted-foreground">
                            <Clock className="w-3 h-3 mr-1" /> {model.testLatency}ms
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`enabled-${model.id}`} className="text-sm text-muted-foreground">
                            Enabled
                          </Label>
                          <Switch
                            id={`enabled-${model.id}`}
                            checked={model.enabled}
                            onCheckedChange={(checked) => handleToggleEnabled(model.id, checked)}
                          />
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTest(model.id)}
                          disabled={testingId === model.id}
                          className="text-muted-foreground hover:text-primary"
                        >
                          {testingId === model.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>

                        {!model.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(model.id)}
                            className="text-muted-foreground hover:text-yellow-400"
                            title="Set as Default"
                          >
                            <Star className="w-4 h-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSync(model.id)}
                          disabled={syncingId === model.id || !model.enabled}
                          className="text-muted-foreground hover:text-green-400"
                          title="Sync to Gateway"
                        >
                          {syncingId === model.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(model)}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate({ id: model.id })}
                          className="text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {model.testMessage && (
                      <p className="mt-3 text-sm text-muted-foreground font-mono">
                        Last test: {model.testMessage}
                      </p>
                    )}

                    {/* Available Models */}
                    {availableModels.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-2">Available Models:</p>
                        <div className="flex flex-wrap gap-2">
                          {availableModels.slice(0, 5).map((m: string) => (
                            <Badge 
                              key={m} 
                              variant="outline" 
                              className={`text-xs cursor-pointer hover:bg-primary/20 ${model.selectedModel === m ? 'bg-primary/20 text-primary' : ''}`}
                              onClick={() => {
                                updateMutation.mutate({ id: model.id, selectedModel: m });
                              }}
                            >
                              {m}
                            </Badge>
                          ))}
                          {availableModels.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{availableModels.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card/50 border-border/50 border-dashed">
            <CardContent className="p-12 text-center">
              <Cpu className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Model Providers Configured</h3>
              <p className="text-muted-foreground mb-4">Add an AI model provider to get started</p>
              <Button 
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Provider
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Provider Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary">Add Model Provider</DialogTitle>
            <DialogDescription>Configure a new AI model provider</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={selectedProvider} onValueChange={(v) => {
                setSelectedProvider(v);
                setSelectedModel("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {modelProviders.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      <span className="flex items-center gap-2">
                        <span>{provider.icon}</span>
                        <span>{provider.label}</span>
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
                placeholder="My OpenAI Account"
              />
            </div>

            {selectedProvider && providerConfigFields[selectedProvider]?.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </Label>
                <Input
                  type={field.type}
                  value={configValues[field.key] || ""}
                  onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                />
              </div>
            ))}

            {selectedProvider && defaultModels[selectedProvider]?.length > 0 && (
              <div className="space-y-2">
                <Label>Default Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {defaultModels[selectedProvider].map((model) => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTestBeforeSave}
              disabled={!selectedProvider || testWithConfigMutation.isPending}
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
              Create Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Provider Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary">Edit Model Provider</DialogTitle>
            <DialogDescription>Update provider configuration</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Configuration Name</Label>
              <Input
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="My OpenAI Account"
              />
            </div>

            {selectedProvider && providerConfigFields[selectedProvider]?.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </Label>
                <Input
                  type={field.type}
                  value={configValues[field.key] || ""}
                  onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                />
              </div>
            ))}

            {selectedProvider && defaultModels[selectedProvider]?.length > 0 && (
              <div className="space-y-2">
                <Label>Default Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {defaultModels[selectedProvider].map((model) => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
