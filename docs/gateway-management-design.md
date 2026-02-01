# OpenClaw Gateway 管理功能设计方案

## 一、需求分析

### 核心功能
1. **Webhook 轮询重启**：定期检测 Telegram webhook 状态，自动重启失效的连接
2. **手动重启控制**：提供 UI 界面手动重启 Gateway 进程
3. **实时监控**：显示 Gateway 运行状态、资源使用、日志等

### 业务背景
- Telegram webhook 经常掉线（根据知识库）
- 需要稳定的生产环境 webhook URL
- 需要防止测试环境 URL 覆盖生产 URL

---

## 二、技术架构设计

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Dashboard                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 监控面板     │  │ 重启控制     │  │ 日志查看     │      │
│  │ - 进程状态   │  │ - 手动重启   │  │ - 实时日志   │      │
│  │ - 资源使用   │  │ - 定时任务   │  │ - 错误追踪   │      │
│  │ - Webhook    │  │ - Webhook    │  │ - 历史记录   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ tRPC API
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Gateway Manager Service                              │   │
│  │ - Process lifecycle management (start/stop/restart)  │   │
│  │ - Health check & monitoring                          │   │
│  │ - Log aggregation                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Webhook Poller Service (Cron Job)                    │   │
│  │ - Periodic webhook status check                      │   │
│  │ - Auto-restart on failure                            │   │
│  │ - Production URL protection                          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Metrics Collector                                    │   │
│  │ - CPU/Memory usage                                   │   │
│  │ - Request count & latency                            │   │
│  │ - Error rate tracking                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              OpenClaw Gateway Process                        │
│  - PID: 24099                                                │
│  - Port: 18789                                               │
│  - Telegram webhook                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、数据库设计

### 3.1 gateway_monitors 表
存储 Gateway 监控历史数据

```sql
CREATE TABLE gateway_monitors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  timestamp BIGINT NOT NULL,           -- 记录时间戳
  status ENUM('running', 'stopped', 'error') NOT NULL,
  pid INT,                              -- 进程 ID
  cpu_usage DECIMAL(5,2),               -- CPU 使用率 (%)
  memory_usage DECIMAL(10,2),           -- 内存使用 (MB)
  uptime BIGINT,                        -- 运行时长 (秒)
  request_count INT DEFAULT 0,          -- 请求数
  error_count INT DEFAULT 0,            -- 错误数
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_timestamp (timestamp)
);
```

### 3.2 gateway_restart_logs 表
记录重启操作历史

```sql
CREATE TABLE gateway_restart_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  trigger_type ENUM('manual', 'webhook_check', 'health_check', 'scheduled') NOT NULL,
  trigger_user_id VARCHAR(255),         -- 手动重启的用户 ID
  reason TEXT,                          -- 重启原因
  old_pid INT,                          -- 旧进程 ID
  new_pid INT,                          -- 新进程 ID
  success BOOLEAN NOT NULL,             -- 是否成功
  error_message TEXT,                   -- 错误信息
  duration_ms INT,                      -- 重启耗时 (毫秒)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at)
);
```

### 3.3 webhook_status_logs 表
记录 Telegram webhook 状态检查

```sql
CREATE TABLE webhook_status_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  check_timestamp BIGINT NOT NULL,
  webhook_url VARCHAR(500),
  is_active BOOLEAN NOT NULL,           -- webhook 是否激活
  pending_update_count INT DEFAULT 0,   -- 待处理更新数
  last_error_date BIGINT,               -- 最后错误时间
  last_error_message TEXT,              -- 最后错误信息
  response_time_ms INT,                 -- 响应时间
  action_taken ENUM('none', 'restart', 'alert') DEFAULT 'none',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_check_timestamp (check_timestamp)
);
```

### 3.4 gateway_settings 表
存储 Gateway 管理配置

```sql
CREATE TABLE gateway_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 初始配置
INSERT INTO gateway_settings (key, value, description) VALUES
  ('webhook_check_interval', '300', 'Webhook 检查间隔（秒）'),
  ('production_webhook_url', '', '生产环境 Webhook URL'),
  ('auto_restart_enabled', 'true', '是否启用自动重启'),
  ('max_restart_attempts', '3', '最大重启尝试次数'),
  ('health_check_timeout', '10', '健康检查超时时间（秒）');
```

---

## 四、API 设计

### 4.1 Gateway 管理 API

#### 4.1.1 获取 Gateway 状态
```typescript
gatewayManager.getStatus.useQuery()

返回：
{
  status: 'running' | 'stopped' | 'error',
  pid: number | null,
  port: number,
  uptime: number,  // 秒
  cpuUsage: number,  // %
  memoryUsage: number,  // MB
  lastRestart: number,  // 时间戳
  webhookStatus: {
    isActive: boolean,
    url: string,
    lastCheck: number,
    pendingUpdates: number
  }
}
```

#### 4.1.2 手动重启 Gateway
```typescript
gatewayManager.restart.useMutation({
  reason?: string
})

返回：
{
  success: boolean,
  oldPid: number,
  newPid: number,
  duration: number,  // 毫秒
  message: string
}
```

#### 4.1.3 停止 Gateway
```typescript
gatewayManager.stop.useMutation()
```

#### 4.1.4 启动 Gateway
```typescript
gatewayManager.start.useMutation()
```

#### 4.1.5 获取实时日志
```typescript
gatewayManager.getLogs.useQuery({
  lines?: number,  // 默认 100
  level?: 'all' | 'error' | 'warn' | 'info'
})

返回：
{
  logs: Array<{
    timestamp: number,
    level: string,
    message: string
  }>
}
```

#### 4.1.6 获取监控历史
```typescript
gatewayManager.getMonitorHistory.useQuery({
  startTime: number,
  endTime: number,
  interval?: '1m' | '5m' | '1h'  // 聚合间隔
})

返回：
{
  data: Array<{
    timestamp: number,
    cpuUsage: number,
    memoryUsage: number,
    requestCount: number,
    errorCount: number
  }>
}
```

### 4.2 Webhook 管理 API

#### 4.2.1 检查 Webhook 状态
```typescript
webhookManager.checkStatus.useMutation()

返回：
{
  isActive: boolean,
  url: string,
  pendingUpdates: number,
  lastError: {
    date: number,
    message: string
  } | null
}
```

#### 4.2.2 设置生产 Webhook URL
```typescript
webhookManager.setProductionUrl.useMutation({
  url: string
})
```

#### 4.2.3 获取 Webhook 历史
```typescript
webhookManager.getHistory.useQuery({
  limit?: number
})
```

#### 4.2.4 配置自动检查
```typescript
webhookManager.configureAutoCheck.useMutation({
  enabled: boolean,
  intervalSeconds: number,
  autoRestart: boolean
})
```

---

## 五、核心服务实现

### 5.1 Gateway Process Manager

```typescript
// server/services/gatewayProcessManager.ts

class GatewayProcessManager {
  private process: ChildProcess | null = null;
  private pid: number | null = null;
  
  async start(): Promise<{ success: boolean; pid: number }> {
    // 1. 检查是否已运行
    // 2. 启动新进程: pnpm openclaw gateway
    // 3. 等待进程启动完成（检查端口）
    // 4. 记录日志
  }
  
  async stop(): Promise<{ success: boolean }> {
    // 1. 发送 SIGTERM 信号
    // 2. 等待优雅关闭（10秒超时）
    // 3. 如果超时则 SIGKILL
    // 4. 记录日志
  }
  
  async restart(reason?: string): Promise<RestartResult> {
    // 1. 记录旧 PID
    // 2. 停止旧进程
    // 3. 启动新进程
    // 4. 验证新进程健康
    // 5. 记录重启日志到数据库
  }
  
  async getStatus(): Promise<GatewayStatus> {
    // 1. 检查进程是否存在
    // 2. 获取 CPU/内存使用情况
    // 3. 检查端口是否监听
    // 4. 返回状态信息
  }
  
  async healthCheck(): Promise<boolean> {
    // 1. 发送 HTTP 请求到 Gateway
    // 2. 检查响应状态
    // 3. 验证 Telegram webhook
  }
}
```

### 5.2 Webhook Poller Service

```typescript
// server/services/webhookPoller.ts

class WebhookPollerService {
  private intervalId: NodeJS.Timeout | null = null;
  
  start() {
    // 从数据库读取配置
    const interval = await getSetting('webhook_check_interval');
    
    this.intervalId = setInterval(async () => {
      await this.checkAndRestart();
    }, interval * 1000);
  }
  
  async checkAndRestart() {
    // 1. 调用 Telegram API 检查 webhook 状态
    const status = await this.checkWebhookStatus();
    
    // 2. 记录状态到数据库
    await db.insert(webhookStatusLogs).values({
      checkTimestamp: Date.now(),
      webhookUrl: status.url,
      isActive: status.isActive,
      pendingUpdateCount: status.pendingUpdates
    });
    
    // 3. 如果 webhook 失效且启用自动重启
    if (!status.isActive && await getSetting('auto_restart_enabled') === 'true') {
      const attempts = await this.getRecentRestartAttempts();
      const maxAttempts = await getSetting('max_restart_attempts');
      
      if (attempts < maxAttempts) {
        await gatewayManager.restart('webhook_check');
        await this.resetWebhook();
      } else {
        // 发送告警通知
        await notifyOwner({
          title: 'Gateway Webhook 持续失败',
          content: `已尝试重启 ${attempts} 次，仍然失败`
        });
      }
    }
  }
  
  async checkWebhookStatus(): Promise<WebhookStatus> {
    // 调用 Telegram getWebhookInfo API
    const botToken = await getGatewayConfig('channels.telegram.botToken');
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`
    );
    return response.json();
  }
  
  async resetWebhook() {
    // 1. 读取生产 webhook URL
    const productionUrl = await getSetting('production_webhook_url');
    
    // 2. 设置 webhook
    const botToken = await getGatewayConfig('channels.telegram.botToken');
    await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        body: JSON.stringify({ url: productionUrl })
      }
    );
  }
}
```

### 5.3 Metrics Collector

```typescript
// server/services/metricsCollector.ts

class MetricsCollector {
  private intervalId: NodeJS.Timeout | null = null;
  
  start() {
    // 每 30 秒收集一次指标
    this.intervalId = setInterval(async () => {
      await this.collect();
    }, 30000);
  }
  
  async collect() {
    const status = await gatewayManager.getStatus();
    
    await db.insert(gatewayMonitors).values({
      timestamp: Date.now(),
      status: status.status,
      pid: status.pid,
      cpuUsage: status.cpuUsage,
      memoryUsage: status.memoryUsage,
      uptime: status.uptime,
      requestCount: await this.getRequestCount(),
      errorCount: await this.getErrorCount()
    });
  }
  
  async getRequestCount(): Promise<number> {
    // 从 Gateway 日志中统计请求数
  }
  
  async getErrorCount(): Promise<number> {
    // 从 Gateway 日志中统计错误数
  }
}
```

---

## 六、前端 UI 设计

### 6.1 监控面板布局

```
┌─────────────────────────────────────────────────────────────┐
│ Gateway Management                                    [刷新] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ 状态        │ │ 运行时长    │ │ 内存使用    │            │
│ │ 🟢 RUNNING  │ │ 2h 34m      │ │ 281 MB      │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                               │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ CPU 使用    │ │ 请求数      │ │ 错误数      │            │
│ │ 6.9%        │ │ 1,234       │ │ 3           │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ Webhook Status                                                │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ URL: https://your-domain.com/webhook            │   │
│ │ Status: 🟢 Active                                      │   │
│ │ Last Check: 2 minutes ago                             │   │
│ │ Pending Updates: 0                                    │   │
│ │                                                        │   │
│ │ [检查状态] [重置 Webhook] [配置自动检查]             │   │
│ └───────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ Quick Actions                                                 │
│ [🔄 重启 Gateway] [⏸ 停止] [▶ 启动] [📋 查看日志]          │
├─────────────────────────────────────────────────────────────┤
│ Resource Usage (Last 1 Hour)                                 │
│ ┌───────────────────────────────────────────────────────┐   │
│ │     CPU %                                              │   │
│ │  10 ┤                                                  │   │
│ │   8 ┤     ╭─╮                                          │   │
│ │   6 ┤   ╭─╯ ╰─╮   ╭─╮                                 │   │
│ │   4 ┤ ╭─╯     ╰───╯ ╰─╮                               │   │
│ │   2 ┤─╯               ╰───                            │   │
│ │   0 └────────────────────────────────────────────────│   │
│ └───────────────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────────────┐   │
│ │   Memory (MB)                                          │   │
│ │ 300 ┤                                                  │   │
│ │ 280 ┤ ──────────────────────────────────              │   │
│ │ 260 ┤                                                  │   │
│ └───────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ Recent Restart Logs                                           │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 2026-01-31 20:06  Manual      Success  (1.2s)         │   │
│ │ 2026-01-31 18:30  Webhook     Success  (0.9s)         │   │
│ │ 2026-01-31 15:20  Health Check Failed  (timeout)      │   │
│ └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 日志查看器

```
┌─────────────────────────────────────────────────────────────┐
│ Gateway Logs                                [实时] [导出]    │
├─────────────────────────────────────────────────────────────┤
│ Filter: [All] [Error] [Warn] [Info]    Lines: [100▼]        │
├─────────────────────────────────────────────────────────────┤
│ [2026-01-31 20:06:00] [gateway] listening on ws://0.0.0.0:18789
│ [2026-01-31 20:06:04] [telegram] starting provider          │
│ [2026-01-31 20:06:05] [telegram] webhook active             │
│ ...                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 七、实施计划

### Phase 1: 数据库和基础 API（1-2 小时）
- [ ] 创建 4 个数据表
- [ ] 实现 GatewayProcessManager 核心功能
- [ ] 实现基础 tRPC API（status, restart, logs）

### Phase 2: Webhook 轮询服务（1 小时）
- [ ] 实现 WebhookPollerService
- [ ] 实现 Telegram webhook 状态检查
- [ ] 实现自动重启逻辑
- [ ] 实现生产 URL 保护机制

### Phase 3: 监控和指标收集（1 小时）
- [ ] 实现 MetricsCollector
- [ ] 实现历史数据查询 API
- [ ] 实现日志聚合功能

### Phase 4: 前端 UI（2-3 小时）
- [ ] 创建 GatewayManagement 页面
- [ ] 实现监控面板组件
- [ ] 实现图表可视化（CPU/内存）
- [ ] 实现日志查看器
- [ ] 实现重启控制面板

### Phase 5: 测试和优化（1 小时）
- [ ] 测试重启功能
- [ ] 测试 webhook 轮询
- [ ] 测试监控数据收集
- [ ] 性能优化

---

## 八、关键技术点

### 8.1 进程管理
- 使用 Node.js `child_process` 模块
- 优雅关闭：SIGTERM → 等待 → SIGKILL
- PID 文件管理防止重复启动

### 8.2 Webhook 保护
- 数据库存储生产 URL
- 启动时强制设置生产 URL
- 定期验证 URL 未被覆盖

### 8.3 监控数据聚合
- 原始数据：30 秒采集一次
- 展示数据：按时间间隔聚合（1m/5m/1h）
- 自动清理历史数据（保留 7 天）

### 8.4 错误处理
- 重启失败重试机制（最多 3 次）
- 失败告警通知（使用 notifyOwner）
- 详细错误日志记录

---

## 九、配置示例

### 9.1 环境变量
```bash
# Gateway 管理配置
GATEWAY_PROCESS_PATH=/home/ubuntu/openclaw
GATEWAY_LOG_PATH=/tmp/openclaw/openclaw.log
GATEWAY_PID_FILE=/tmp/openclaw/gateway.pid

# Webhook 配置
PRODUCTION_WEBHOOK_URL=https://your-domain.com/webhook
WEBHOOK_CHECK_INTERVAL=300  # 5 分钟
AUTO_RESTART_ENABLED=true
```

### 9.2 数据库配置
```typescript
// 在 gateway_settings 表中配置
{
  webhook_check_interval: '300',
  production_webhook_url: 'https://your-domain.com/webhook',
  auto_restart_enabled: 'true',
  max_restart_attempts: '3',
  health_check_timeout: '10'
}
```

---

## 十、安全考虑

1. **权限控制**：只有 admin 角色可以执行重启操作
2. **操作审计**：所有重启操作记录操作人和原因
3. **速率限制**：防止频繁重启（5 分钟内最多 3 次）
4. **配置保护**：生产 webhook URL 只能通过 admin 修改

---

## 十一、监控告警

### 告警规则
1. **连续重启失败**：3 次重启失败后发送告警
2. **Webhook 持续失效**：1 小时内 webhook 检查失败超过 5 次
3. **资源异常**：CPU > 80% 或内存 > 500MB 持续 5 分钟
4. **进程崩溃**：Gateway 进程意外退出

### 告警渠道
- Dashboard 内通知（使用 notifyOwner）
- 可选：Telegram 消息通知
- 可选：邮件通知

---

## 十二、后续扩展

1. **多实例管理**：支持管理多个 Gateway 实例
2. **配置热更新**：无需重启修改配置
3. **性能分析**：请求耗时分布、慢查询分析
4. **备份恢复**：配置文件自动备份
5. **插件管理**：动态启用/禁用插件

---

## 总结

本方案提供了一个完整的 OpenClaw Gateway 管理系统，包括：
- ✅ 自动化的 webhook 健康检查和重启
- ✅ 灵活的手动控制界面
- ✅ 全面的监控和日志系统
- ✅ 生产环境 URL 保护机制
- ✅ 详细的操作审计

预计总开发时间：**6-8 小时**
