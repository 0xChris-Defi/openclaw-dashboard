import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft,
  Shield,
  Key,
  Users,
  UserPlus,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Clock,
  UserX,
  Upload,
  Loader2,
  Lock,
  Unlock,
  Ban,
  Link2
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

// Policy descriptions
const policyDescriptions = {
  open: "任何人都可以与 Bot 对话",
  pairing: "需要配对码才能使用，适合私人助手",
  allowlist: "只有白名单中的用户可以使用",
  disabled: "完全禁用 DM 功能",
};

const policyIcons = {
  open: Unlock,
  pairing: Key,
  allowlist: Users,
  disabled: Ban,
};

const policyColors = {
  open: "text-green-400",
  pairing: "text-yellow-400",
  allowlist: "text-blue-400",
  disabled: "text-red-400",
};

export default function TelegramAccessControl() {
  const [activeTab, setActiveTab] = useState("policy");
  const [copied, setCopied] = useState<string | null>(null);
  const [showAddPairedUser, setShowAddPairedUser] = useState(false);
  const [showAddAllowlistUser, setShowAddAllowlistUser] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState(24);
  
  // Form states
  const [newPairedUser, setNewPairedUser] = useState({
    telegramUserId: "",
    telegramUsername: "",
    telegramName: "",
    notes: "",
  });
  const [newAllowlistUser, setNewAllowlistUser] = useState({
    telegramUserId: "",
    telegramUsername: "",
    notes: "",
  });
  const [batchImportText, setBatchImportText] = useState("");

  // Queries
  const { data: telegramConfig, refetch: refetchConfig } = trpc.telegram.getConfig.useQuery();
  const { data: pairingCodes, refetch: refetchCodes } = trpc.telegram.listPairingCodes.useQuery();
  const { data: pairedUsers, refetch: refetchPairedUsers } = trpc.telegram.listPairedUsers.useQuery();
  const { data: allowlistUsers, refetch: refetchAllowlist } = trpc.telegram.listAllowlist.useQuery();

  // Mutations
  const setDmPolicy = trpc.telegram.setDmPolicy.useMutation({
    onSuccess: () => {
      toast.success("DM 策略已更新");
      refetchConfig();
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const generatePairingCode = trpc.telegram.generatePairingCode.useMutation({
    onSuccess: (data) => {
      toast.success(`配对码已生成: ${data?.code}`);
      refetchCodes();
    },
    onError: (error) => {
      toast.error(`生成失败: ${error.message}`);
    },
  });

  const revokePairingCode = trpc.telegram.revokePairingCode.useMutation({
    onSuccess: () => {
      toast.success("配对码已撤销");
      refetchCodes();
    },
  });

  const addPairedUser = trpc.telegram.addPairedUser.useMutation({
    onSuccess: () => {
      toast.success("用户已添加");
      setShowAddPairedUser(false);
      setNewPairedUser({ telegramUserId: "", telegramUsername: "", telegramName: "", notes: "" });
      refetchPairedUsers();
    },
    onError: (error) => {
      toast.error(`添加失败: ${error.message}`);
    },
  });

  const revokePairedUser = trpc.telegram.revokePairedUser.useMutation({
    onSuccess: () => {
      toast.success("用户已撤销");
      refetchPairedUsers();
    },
  });

  const deletePairedUser = trpc.telegram.deletePairedUser.useMutation({
    onSuccess: () => {
      toast.success("用户已删除");
      refetchPairedUsers();
    },
  });

  const addToAllowlist = trpc.telegram.addToAllowlist.useMutation({
    onSuccess: () => {
      toast.success("用户已添加到白名单");
      setShowAddAllowlistUser(false);
      setNewAllowlistUser({ telegramUserId: "", telegramUsername: "", notes: "" });
      refetchAllowlist();
    },
    onError: (error) => {
      toast.error(`添加失败: ${error.message}`);
    },
  });

  const removeFromAllowlist = trpc.telegram.removeFromAllowlist.useMutation({
    onSuccess: () => {
      toast.success("用户已从白名单移除");
      refetchAllowlist();
    },
  });

  const batchImportAllowlist = trpc.telegram.batchImportAllowlist.useMutation({
    onSuccess: (data) => {
      toast.success(`成功导入 ${data.addedCount} 个用户`);
      setShowBatchImport(false);
      setBatchImportText("");
      refetchAllowlist();
    },
    onError: (error) => {
      toast.error(`导入失败: ${error.message}`);
    },
  });

  const syncToGateway = trpc.telegram.syncToGateway.useMutation({
    onSuccess: () => {
      toast.success("已同步到 Gateway");
      refetchConfig();
    },
    onError: (error) => {
      toast.error(`同步失败: ${error.message}`);
    },
  });

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("已复制到剪贴板");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleBatchImport = () => {
    try {
      const lines = batchImportText.trim().split("\n").filter(l => l.trim());
      const users = lines.map(line => {
        const parts = line.split(",").map(p => p.trim());
        return {
          telegramUserId: parts[0],
          telegramUsername: parts[1] || undefined,
          notes: parts[2] || undefined,
        };
      }).filter(u => u.telegramUserId);

      if (users.length === 0) {
        toast.error("没有有效的用户数据");
        return;
      }

      batchImportAllowlist.mutate({ users });
    } catch (error) {
      toast.error("解析数据失败，请检查格式");
    }
  };

  const currentPolicy = telegramConfig?.dmPolicy || "open";
  const PolicyIcon = policyIcons[currentPolicy as keyof typeof policyIcons] || Shield;

  return (
    <div className="min-h-screen bg-background text-foreground cyber-grid">
      {/* Scanline effect */}
      <div className="scanline" />
      
      {/* Header */}
      <header className="border-b border-primary/30 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2 hover:bg-primary/20">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">返回</span>
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-primary" />
                <div>
                  <h1 className="text-xl font-mono font-bold neon-text-red">
                    TELEGRAM ACCESS CONTROL
                  </h1>
                  <p className="text-xs text-muted-foreground font-mono">
                    {telegramConfig?.botUsername || '@your_bot'}
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncToGateway.mutate()}
              disabled={syncToGateway.isPending}
              className="gap-2 border-primary/50 hover:bg-primary/20"
            >
              {syncToGateway.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              同步到 Gateway
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Current Status Card */}
        <Card className="cyber-card border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-primary flex items-center gap-2">
              <PolicyIcon className={`w-5 h-5 ${policyColors[currentPolicy as keyof typeof policyColors]}`} />
              当前访问策略
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`${policyColors[currentPolicy as keyof typeof policyColors]} border-current`}>
                    {currentPolicy.toUpperCase()}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    {policyDescriptions[currentPolicy as keyof typeof policyDescriptions]}
                  </span>
                </div>
                {currentPolicy === "pairing" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    已配对用户: {pairedUsers?.filter(u => u.status === 'active').length || 0} 人
                  </p>
                )}
                {currentPolicy === "allowlist" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    白名单用户: {allowlistUsers?.length || 0} 人
                  </p>
                )}
              </div>
              <Select
                value={currentPolicy}
                onValueChange={(value) => setDmPolicy.mutate({ policy: value as any })}
                disabled={setDmPolicy.isPending}
              >
                <SelectTrigger className="w-[200px] border-primary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">
                    <div className="flex items-center gap-2">
                      <Unlock className="w-4 h-4 text-green-400" />
                      Open (开放)
                    </div>
                  </SelectItem>
                  <SelectItem value="pairing">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-yellow-400" />
                      Pairing (配对)
                    </div>
                  </SelectItem>
                  <SelectItem value="allowlist">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      Allowlist (白名单)
                    </div>
                  </SelectItem>
                  <SelectItem value="disabled">
                    <div className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-400" />
                      Disabled (禁用)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different management sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-background/50 border border-primary/30">
            <TabsTrigger value="policy" className="data-[state=active]:bg-primary/20">
              <Shield className="w-4 h-4 mr-2" />
              策略设置
            </TabsTrigger>
            <TabsTrigger value="pairing" className="data-[state=active]:bg-primary/20">
              <Key className="w-4 h-4 mr-2" />
              配对码
            </TabsTrigger>
            <TabsTrigger value="paired" className="data-[state=active]:bg-primary/20">
              <Link2 className="w-4 h-4 mr-2" />
              已配对用户
            </TabsTrigger>
            <TabsTrigger value="allowlist" className="data-[state=active]:bg-primary/20">
              <Users className="w-4 h-4 mr-2" />
              白名单
            </TabsTrigger>
          </TabsList>

          {/* Policy Settings Tab */}
          <TabsContent value="policy" className="space-y-4">
            <Card className="cyber-card border-primary/30">
              <CardHeader>
                <CardTitle className="font-mono text-primary">访问策略说明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(policyDescriptions).map(([key, desc]) => {
                  const Icon = policyIcons[key as keyof typeof policyIcons];
                  const color = policyColors[key as keyof typeof policyColors];
                  return (
                    <div 
                      key={key} 
                      className={`p-4 rounded-lg border ${currentPolicy === key ? 'border-primary bg-primary/10' : 'border-border/50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${color}`} />
                        <div>
                          <h4 className={`font-mono font-bold ${color}`}>
                            {key.toUpperCase()}
                          </h4>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                        {currentPolicy === key && (
                          <Badge className="ml-auto bg-primary/20 text-primary">当前</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pairing Codes Tab */}
          <TabsContent value="pairing" className="space-y-4">
            <Card className="cyber-card border-primary/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-mono text-primary">配对码管理</CardTitle>
                <div className="flex items-center gap-2">
                  <Select
                    value={expiresInHours.toString()}
                    onValueChange={(v) => setExpiresInHours(parseInt(v))}
                  >
                    <SelectTrigger className="w-[120px] border-primary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 小时</SelectItem>
                      <SelectItem value="6">6 小时</SelectItem>
                      <SelectItem value="24">24 小时</SelectItem>
                      <SelectItem value="72">3 天</SelectItem>
                      <SelectItem value="168">7 天</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => generatePairingCode.mutate({ expiresInHours })}
                    disabled={generatePairingCode.isPending}
                    className="gap-2 bg-primary/20 hover:bg-primary/30 text-primary"
                  >
                    {generatePairingCode.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Key className="w-4 h-4" />
                    )}
                    生成配对码
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-primary/30">
                      <TableHead className="font-mono">配对码</TableHead>
                      <TableHead className="font-mono">状态</TableHead>
                      <TableHead className="font-mono">创建时间</TableHead>
                      <TableHead className="font-mono">过期时间</TableHead>
                      <TableHead className="font-mono">使用者</TableHead>
                      <TableHead className="font-mono text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pairingCodes?.map((code) => (
                      <TableRow key={code.id} className="border-primary/20">
                        <TableCell className="font-mono font-bold text-primary">
                          <div className="flex items-center gap-2">
                            {code.code}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(code.code, `code-${code.id}`)}
                              className="h-6 w-6 p-0"
                            >
                              {copied === `code-${code.id}` ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              code.status === 'pending' ? 'text-yellow-400 border-yellow-400' :
                              code.status === 'used' ? 'text-green-400 border-green-400' :
                              code.status === 'expired' ? 'text-muted-foreground border-muted-foreground' :
                              'text-red-400 border-red-400'
                            }
                          >
                            {code.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(code.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(code.expiresAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {code.usedByTelegramId || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {code.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => revokePairingCode.mutate({ codeId: code.id })}
                              className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!pairingCodes || pairingCodes.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          暂无配对码，点击上方按钮生成
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Paired Users Tab */}
          <TabsContent value="paired" className="space-y-4">
            <Card className="cyber-card border-primary/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-mono text-primary">已配对用户</CardTitle>
                <Dialog open={showAddPairedUser} onOpenChange={setShowAddPairedUser}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 bg-primary/20 hover:bg-primary/30 text-primary">
                      <UserPlus className="w-4 h-4" />
                      手动添加
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="cyber-card border-primary/30">
                    <DialogHeader>
                      <DialogTitle className="font-mono text-primary">添加配对用户</DialogTitle>
                      <DialogDescription>
                        手动添加一个 Telegram 用户到配对列表
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="telegramUserId">Telegram User ID *</Label>
                        <Input
                          id="telegramUserId"
                          value={newPairedUser.telegramUserId}
                          onChange={(e) => setNewPairedUser({ ...newPairedUser, telegramUserId: e.target.value })}
                          placeholder="例如: 123456789"
                          className="border-primary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telegramUsername">用户名 (可选)</Label>
                        <Input
                          id="telegramUsername"
                          value={newPairedUser.telegramUsername}
                          onChange={(e) => setNewPairedUser({ ...newPairedUser, telegramUsername: e.target.value })}
                          placeholder="例如: username (不含@)"
                          className="border-primary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telegramName">显示名称 (可选)</Label>
                        <Input
                          id="telegramName"
                          value={newPairedUser.telegramName}
                          onChange={(e) => setNewPairedUser({ ...newPairedUser, telegramName: e.target.value })}
                          placeholder="例如: John Doe"
                          className="border-primary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">备注 (可选)</Label>
                        <Input
                          id="notes"
                          value={newPairedUser.notes}
                          onChange={(e) => setNewPairedUser({ ...newPairedUser, notes: e.target.value })}
                          placeholder="添加备注..."
                          className="border-primary/50"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddPairedUser(false)}
                      >
                        取消
                      </Button>
                      <Button
                        onClick={() => addPairedUser.mutate(newPairedUser)}
                        disabled={!newPairedUser.telegramUserId || addPairedUser.isPending}
                        className="bg-primary/20 hover:bg-primary/30 text-primary"
                      >
                        {addPairedUser.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        添加
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-primary/30">
                      <TableHead className="font-mono">User ID</TableHead>
                      <TableHead className="font-mono">用户名</TableHead>
                      <TableHead className="font-mono">显示名称</TableHead>
                      <TableHead className="font-mono">状态</TableHead>
                      <TableHead className="font-mono">配对时间</TableHead>
                      <TableHead className="font-mono text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pairedUsers?.map((user) => (
                      <TableRow key={user.id} className="border-primary/20">
                        <TableCell className="font-mono">{user.telegramUserId}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.telegramUsername ? `@${user.telegramUsername}` : '-'}
                        </TableCell>
                        <TableCell>{user.telegramName || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={user.status === 'active' ? 'text-green-400 border-green-400' : 'text-red-400 border-red-400'}
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(user.pairedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {user.status === 'active' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => revokePairedUser.mutate({ telegramUserId: user.telegramUserId })}
                                className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10"
                                title="撤销访问"
                              >
                                <UserX className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deletePairedUser.mutate({ telegramUserId: user.telegramUserId })}
                              className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                              title="永久删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!pairedUsers || pairedUsers.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          暂无配对用户
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Allowlist Tab */}
          <TabsContent value="allowlist" className="space-y-4">
            <Card className="cyber-card border-primary/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-mono text-primary">白名单管理</CardTitle>
                <div className="flex gap-2">
                  <Dialog open={showBatchImport} onOpenChange={setShowBatchImport}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2 border-primary/50">
                        <Upload className="w-4 h-4" />
                        批量导入
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="cyber-card border-primary/30">
                      <DialogHeader>
                        <DialogTitle className="font-mono text-primary">批量导入用户</DialogTitle>
                        <DialogDescription>
                          每行一个用户，格式: UserID,用户名(可选),备注(可选)
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <Textarea
                          value={batchImportText}
                          onChange={(e) => setBatchImportText(e.target.value)}
                          placeholder={`123456789,username,备注\n987654321,another_user\n111222333`}
                          className="min-h-[200px] font-mono text-sm border-primary/50"
                        />
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowBatchImport(false)}
                        >
                          取消
                        </Button>
                        <Button
                          onClick={handleBatchImport}
                          disabled={!batchImportText.trim() || batchImportAllowlist.isPending}
                          className="bg-primary/20 hover:bg-primary/30 text-primary"
                        >
                          {batchImportAllowlist.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          导入
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={showAddAllowlistUser} onOpenChange={setShowAddAllowlistUser}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-primary/20 hover:bg-primary/30 text-primary">
                        <UserPlus className="w-4 h-4" />
                        添加用户
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="cyber-card border-primary/30">
                      <DialogHeader>
                        <DialogTitle className="font-mono text-primary">添加白名单用户</DialogTitle>
                        <DialogDescription>
                          添加一个 Telegram 用户到白名单
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="allowlistUserId">Telegram User ID *</Label>
                          <Input
                            id="allowlistUserId"
                            value={newAllowlistUser.telegramUserId}
                            onChange={(e) => setNewAllowlistUser({ ...newAllowlistUser, telegramUserId: e.target.value })}
                            placeholder="例如: 123456789"
                            className="border-primary/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="allowlistUsername">用户名 (可选)</Label>
                          <Input
                            id="allowlistUsername"
                            value={newAllowlistUser.telegramUsername}
                            onChange={(e) => setNewAllowlistUser({ ...newAllowlistUser, telegramUsername: e.target.value })}
                            placeholder="例如: username (不含@)"
                            className="border-primary/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="allowlistNotes">备注 (可选)</Label>
                          <Input
                            id="allowlistNotes"
                            value={newAllowlistUser.notes}
                            onChange={(e) => setNewAllowlistUser({ ...newAllowlistUser, notes: e.target.value })}
                            placeholder="添加备注..."
                            className="border-primary/50"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowAddAllowlistUser(false)}
                        >
                          取消
                        </Button>
                        <Button
                          onClick={() => addToAllowlist.mutate(newAllowlistUser)}
                          disabled={!newAllowlistUser.telegramUserId || addToAllowlist.isPending}
                          className="bg-primary/20 hover:bg-primary/30 text-primary"
                        >
                          {addToAllowlist.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          添加
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-primary/30">
                      <TableHead className="font-mono">User ID</TableHead>
                      <TableHead className="font-mono">用户名</TableHead>
                      <TableHead className="font-mono">备注</TableHead>
                      <TableHead className="font-mono">添加时间</TableHead>
                      <TableHead className="font-mono text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allowlistUsers?.map((user) => (
                      <TableRow key={user.id} className="border-primary/20">
                        <TableCell className="font-mono">{user.telegramUserId}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.telegramUsername ? `@${user.telegramUsername}` : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.notes || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(user.addedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromAllowlist.mutate({ telegramUserId: user.telegramUserId })}
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!allowlistUsers || allowlistUsers.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          白名单为空
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
