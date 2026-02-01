import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Power, 
  Play, 
  Pause,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Wifi,
  AlertCircle,
  CheckCircle2,
  Save,
  Rocket,
  Server,
  Webhook,
  Radio,
  Settings2,
  ArrowRightLeft
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

type ConnectionMode = 'gateway' | 'webhook';

export default function GatewayManagement() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('webhook');

  // Queries
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = trpc.gatewayManager.getStatus.useQuery(
    undefined,
    {
      refetchInterval: autoRefresh ? 5000 : false,
    }
  );

  const { data: connectionModeData, refetch: refetchConnectionMode } = trpc.gatewayManager.getConnectionMode.useQuery();
  const { data: restartLogs } = trpc.gatewayManager.getRestartLogs.useQuery({ limit: 10 });
  const { data: webhookLogs, refetch: refetchWebhookLogs } = trpc.webhookManager.getHistory.useQuery({ limit: 10 });
  const { data: settings, refetch: refetchSettings } = trpc.webhookManager.getSettings.useQuery();

  // Mutations
  const setConnectionModeMutation = trpc.gatewayManager.setConnectionMode.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        refetchConnectionMode();
        refetchStatus();
        refetchWebhookLogs();
      }
    },
    onError: (error) => {
      toast.error(`切换模式失败: ${error.message}`);
    },
  });

  const restartMutation = trpc.gatewayManager.restart.useMutation({
    onSuccess: () => {
      toast.success('Gateway 重启成功');
      refetchStatus();
    },
    onError: (error) => {
      toast.error(`重启失败: ${error.message}`);
    },
  });

  const stopMutation = trpc.gatewayManager.stop.useMutation({
    onSuccess: () => {
      toast.success('Gateway 已停止');
      refetchStatus();
    },
    onError: (error) => {
      toast.error(`停止失败: ${error.message}`);
    },
  });

  const startMutation = trpc.gatewayManager.start.useMutation({
    onSuccess: () => {
      toast.success('Gateway 已启动');
      refetchStatus();
    },
    onError: (error) => {
      toast.error(`启动失败: ${error.message}`);
    },
  });

  const checkWebhookMutation = trpc.webhookManager.checkStatus.useMutation({
    onSuccess: (data) => {
      if (data.isActive) {
        toast.success('Webhook 状态正常');
      } else {
        toast.warning('Webhook 未激活');
      }
      refetchWebhookLogs();
    },
    onError: (error) => {
      toast.error(`检查失败: ${error.message}`);
    },
  });

  const setProductionUrlMutation = trpc.webhookManager.setProductionUrl.useMutation({
    onSuccess: () => {
      toast.success('生产 Webhook URL 已保存');
      setIsEditingUrl(false);
      refetchSettings();
    },
    onError: (error) => {
      toast.error(`保存失败: ${error.message}`);
    },
  });

  const applyWebhookMutation = trpc.webhookManager.applyWebhook.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Webhook 已应用到: ${data.url}`);
        checkWebhookMutation.mutate();
      } else {
        toast.error(`应用失败: ${data.message}`);
      }
    },
    onError: (error) => {
      toast.error(`应用失败: ${error.message}`);
    },
  });

  // Load current connection mode
  useEffect(() => {
    if (connectionModeData?.mode) {
      setConnectionMode(connectionModeData.mode);
    }
  }, [connectionModeData]);

  // Load current production URL from settings
  useEffect(() => {
    if (settings?.settings) {
      const prodUrlSetting = settings.settings.find(s => s.key === 'production_webhook_url');
      if (prodUrlSetting) {
        setWebhookUrl(prodUrlSetting.value);
      }
    }
  }, [settings]);

  const handleModeChange = (newMode: ConnectionMode) => {
    if (newMode === connectionMode) return;
    
    // Confirm before switching
    const modeLabels = {
      gateway: 'Gateway 模式（本地轮询）',
      webhook: 'Webhook 模式（服务器推送）'
    };
    
    if (confirm(`确定要切换到 ${modeLabels[newMode]} 吗？\n\n切换后会自动处理冲突：\n- 切换到 Webhook：停止 Gateway 并设置 Webhook\n- 切换到 Gateway：删除 Webhook 并启动 Gateway`)) {
      setConnectionModeMutation.mutate({ mode: newMode });
    }
  };

  const handleRestart = () => {
    restartMutation.mutate({ reason: '手动重启' });
  };

  const handleStop = () => {
    stopMutation.mutate();
  };

  const handleStart = () => {
    startMutation.mutate();
  };

  const handleCheckWebhook = () => {
    checkWebhookMutation.mutate();
  };

  const handleSaveWebhookUrl = () => {
    if (!webhookUrl.trim()) {
      toast.error('请输入有效的 Webhook URL');
      return;
    }
    if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
      toast.error('Webhook URL 必须以 http:// 或 https:// 开头');
      return;
    }
    setProductionUrlMutation.mutate({ url: webhookUrl });
  };

  const handleApplyWebhook = () => {
    applyWebhookMutation.mutate();
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const formatTimestamp = (timestamp: number | string) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'stopped':
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const latestWebhookLog = webhookLogs?.logs?.[0];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-red">Gateway & Webhook</h1>
          <p className="text-muted-foreground mt-1">管理 Telegram 连接模式和监控服务状态</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'border-primary text-primary' : ''}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            自动刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchStatus();
              refetchWebhookLogs();
            }}
            disabled={statusLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${statusLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* Connection Mode Selector */}
      <Card className="border-primary/30 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Telegram 连接模式
          </CardTitle>
          <CardDescription>
            选择 Telegram Bot 的消息接收方式。Gateway 和 Webhook 模式互斥，不能同时使用。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gateway Mode Card */}
            <div
              className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                connectionMode === 'gateway'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              } ${setConnectionModeMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => handleModeChange('gateway')}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${connectionMode === 'gateway' ? 'bg-primary/20' : 'bg-muted'}`}>
                  <Server className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Gateway 模式</h3>
                    <Badge variant="outline" className="text-xs">本地轮询</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    使用本地 OpenClaw Gateway 进程通过 getUpdates API 轮询消息
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    <li>✓ 适合开发环境</li>
                    <li>✓ 无需公网地址</li>
                    <li>✗ 延迟较高（1-5秒）</li>
                    <li>✗ 需要保持进程运行</li>
                  </ul>
                </div>
              </div>
              {connectionMode === 'gateway' && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-primary">当前模式</Badge>
                </div>
              )}
            </div>

            {/* Webhook Mode Card */}
            <div
              className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                connectionMode === 'webhook'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-border hover:border-green-500/50'
              } ${setConnectionModeMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => handleModeChange('webhook')}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${connectionMode === 'webhook' ? 'bg-green-500/20' : 'bg-muted'}`}>
                  <Webhook className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Webhook 模式</h3>
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">推荐生产</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Telegram 主动推送消息到你的服务器 /webhook 端点
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    <li>✓ 实时推送（毫秒级）</li>
                    <li>✓ 按需处理，资源高效</li>
                    <li>✓ 适合生产环境</li>
                    <li>✗ 需要公网 HTTPS 地址</li>
                  </ul>
                </div>
              </div>
              {connectionMode === 'webhook' && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-green-500">当前模式</Badge>
                </div>
              )}
            </div>
          </div>

          {setConnectionModeMutation.isPending && (
            <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              正在切换模式...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mode-specific content */}
      <Tabs value={connectionMode} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gateway" className="gap-2">
            <Server className="w-4 h-4" />
            Gateway 状态
          </TabsTrigger>
          <TabsTrigger value="webhook" className="gap-2">
            <Webhook className="w-4 h-4" />
            Webhook 状态
          </TabsTrigger>
        </TabsList>

        {/* Gateway Tab */}
        <TabsContent value="gateway" className="space-y-4">
          {connectionMode !== 'gateway' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Gateway 模式未激活</AlertTitle>
              <AlertDescription>
                当前使用 Webhook 模式。如需使用 Gateway，请在上方切换连接模式。
              </AlertDescription>
            </Alert>
          )}

          {/* Gateway Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  状态
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  {status && getStatusIcon(status.status)}
                  <div>
                    <div className="text-2xl font-bold">
                      {status?.status.toUpperCase() || 'UNKNOWN'}
                    </div>
                    {status?.pid && (
                      <div className="text-xs text-muted-foreground">PID: {status.pid}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  运行时长
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {status?.uptime ? formatUptime(status.uptime) : '0h 0m 0s'}
                </div>
                {status?.lastRestart && (
                  <div className="text-xs text-muted-foreground mt-1">
                    上次重启: {formatTimestamp(status.lastRestart)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  CPU 使用
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {status?.cpuUsage?.toFixed(1) || '0.0'}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  处理器负载
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  内存使用
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {status?.memoryUsage?.toFixed(0) || '0'} MB
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  RAM 占用
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gateway Quick Actions */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>Gateway 操作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleRestart}
                  disabled={restartMutation.isPending || connectionMode !== 'gateway'}
                  className="gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${restartMutation.isPending ? 'animate-spin' : ''}`} />
                  重启 Gateway
                </Button>
                <Button
                  variant="outline"
                  onClick={handleStop}
                  disabled={stopMutation.isPending || status?.status === 'stopped' || connectionMode !== 'gateway'}
                  className="gap-2"
                >
                  <Pause className="w-4 h-4" />
                  停止
                </Button>
                <Button
                  variant="outline"
                  onClick={handleStart}
                  disabled={startMutation.isPending || status?.status === 'running' || connectionMode !== 'gateway'}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  启动
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Restart Logs */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>最近重启记录</CardTitle>
            </CardHeader>
            <CardContent>
              {restartLogs && restartLogs.logs.length > 0 ? (
                <div className="space-y-2">
                  {restartLogs.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-background/50 rounded-lg hover:bg-background/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {log.success ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                        <div>
                          <div className="font-medium">
                            {log.triggerType === 'manual' ? '手动重启' : 
                             log.triggerType === 'webhook_check' ? 'Webhook 检查' :
                             log.triggerType === 'health_check' ? '健康检查' : '定时任务'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {log.reason || '无原因'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {log.success ? '成功' : '失败'} ({log.durationMs}ms)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(new Date(log.createdAt).getTime())}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  暂无重启记录
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhook Tab */}
        <TabsContent value="webhook" className="space-y-4">
          {connectionMode !== 'webhook' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Webhook 模式未激活</AlertTitle>
              <AlertDescription>
                当前使用 Gateway 模式。如需使用 Webhook，请在上方切换连接模式。
              </AlertDescription>
            </Alert>
          )}

          {/* Webhook Status */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="w-5 h-5" />
                  Webhook 状态
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckWebhook}
                  disabled={checkWebhookMutation.isPending}
                >
                  {checkWebhookMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    '检查状态'
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {latestWebhookLog ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {latestWebhookLog.isActive ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      )}
                      <div>
                        <div className="font-medium">
                          {latestWebhookLog.isActive ? 'Webhook 激活' : 'Webhook 未激活'}
                        </div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {latestWebhookLog.webhookUrl || '未配置 URL'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        待处理: {latestWebhookLog.pendingUpdateCount || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(latestWebhookLog.checkTimestamp)}
                      </div>
                    </div>
                  </div>
                  {latestWebhookLog.lastErrorMessage && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <div className="text-sm text-red-400">
                        最后错误: {latestWebhookLog.lastErrorMessage}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  暂无 Webhook 状态数据，点击"检查状态"获取最新信息
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook URL Configuration */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                生产 Webhook URL 配置
              </CardTitle>
              <CardDescription>
                配置生产环境的 Webhook URL，Telegram 会将消息推送到此地址
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhook-url"
                      type="url"
                      placeholder="https://your-domain.com/webhook"
                      value={webhookUrl}
                      onChange={(e) => {
                        setWebhookUrl(e.target.value);
                        setIsEditingUrl(true);
                      }}
                      className="font-mono text-sm"
                    />
                    <Button
                      onClick={handleSaveWebhookUrl}
                      disabled={setProductionUrlMutation.isPending || !webhookUrl.trim()}
                      className="gap-2 shrink-0"
                    >
                      <Save className={`w-4 h-4 ${setProductionUrlMutation.isPending ? 'animate-pulse' : ''}`} />
                      保存
                    </Button>
                    <Button
                      onClick={handleApplyWebhook}
                      disabled={applyWebhookMutation.isPending || !webhookUrl.trim() || connectionMode !== 'webhook'}
                      variant="default"
                      className="gap-2 shrink-0 bg-green-600 hover:bg-green-700"
                    >
                      <Rocket className={`w-4 h-4 ${applyWebhookMutation.isPending ? 'animate-pulse' : ''}`} />
                      立即应用
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    提示：保存后点击"立即应用"将 Telegram Webhook 设置为此 URL
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Webhook History */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>Webhook 检查历史</CardTitle>
            </CardHeader>
            <CardContent>
              {webhookLogs && webhookLogs.logs.length > 0 ? (
                <div className="space-y-2">
                  {webhookLogs.logs.slice(0, 10).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-background/50 rounded-lg hover:bg-background/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {log.isActive ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                        <div>
                          <div className="font-medium text-sm">
                            {log.isActive ? '激活' : '未激活'}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                            {log.webhookUrl || '无 URL'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          待处理: {log.pendingUpdateCount || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(log.checkTimestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  暂无检查记录
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings */}
      {settings && settings.settings.length > 0 && (
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>配置信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settings.settings.map((setting) => (
                <div key={setting.id} className="p-3 bg-background/50 rounded-lg">
                  <div className="font-medium text-sm">{setting.key}</div>
                  <div className="text-muted-foreground text-xs mt-1">
                    {setting.description}
                  </div>
                  <div className="mt-2 font-mono text-sm text-primary truncate">
                    {setting.value}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
