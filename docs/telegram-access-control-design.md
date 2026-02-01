# Telegram 访问控制配置方案

## 功能概述

在 Dashboard 的 Channel Settings 页面中添加 Telegram 访问控制配置功能，允许管理员通过可视化界面管理 Bot 的访问权限。

---

## 访问控制模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **Open（开放）** | 任何人都可以与 Bot 对话 | 公开服务、测试环境 |
| **Pairing（配对）** | 需要配对码才能使用 | 私人助手、付费服务 |
| **Allowlist（白名单）** | 只有白名单中的用户可以使用 | 团队内部、指定用户 |
| **Disabled（禁用）** | 完全禁用 DM 功能 | 仅群组使用 |

---

## 功能模块

### 1. DM 策略配置
- 下拉选择访问模式（Open/Pairing/Allowlist/Disabled）
- 实时同步到 OpenClaw Gateway
- 显示当前生效的策略

### 2. 配对码管理（Pairing 模式）
- **生成配对码**：一键生成新的配对码，支持设置有效期
- **配对码列表**：显示所有已生成的配对码及状态
- **已配对用户**：显示通过配对码验证的用户列表
- **撤销配对**：移除已配对用户的访问权限

### 3. 白名单管理（Allowlist 模式）
- **添加用户**：通过 Telegram User ID 或用户名添加
- **用户列表**：显示白名单中的所有用户
- **批量导入**：支持从 CSV/JSON 批量导入用户
- **移除用户**：从白名单中移除指定用户

### 4. 群组策略配置
- 群组访问策略（allowlist/open/disabled）
- 群组白名单管理
- 群组管理员权限设置

---

## 数据库设计

### telegram_paired_users 表
```sql
CREATE TABLE telegram_paired_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  telegram_user_id VARCHAR(64) NOT NULL UNIQUE,
  telegram_username VARCHAR(64),
  telegram_name VARCHAR(128),
  paired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paired_by INT REFERENCES users(id),
  status ENUM('active', 'revoked') DEFAULT 'active',
  notes TEXT
);
```

### telegram_pairing_codes 表
```sql
CREATE TABLE telegram_pairing_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  used_at TIMESTAMP,
  used_by_telegram_id VARCHAR(64),
  created_by INT REFERENCES users(id),
  status ENUM('pending', 'used', 'expired', 'revoked') DEFAULT 'pending'
);
```

### telegram_allowlist 表
```sql
CREATE TABLE telegram_allowlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  telegram_user_id VARCHAR(64) NOT NULL UNIQUE,
  telegram_username VARCHAR(64),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  added_by INT REFERENCES users(id),
  notes TEXT
);
```

---

## API 设计

### Telegram 策略 API
```typescript
// 获取当前 Telegram 配置
GET /api/trpc/telegram.getConfig

// 更新 DM 策略
POST /api/trpc/telegram.setDmPolicy
  { policy: 'open' | 'pairing' | 'allowlist' | 'disabled' }

// 更新群组策略
POST /api/trpc/telegram.setGroupPolicy
  { policy: 'open' | 'allowlist' | 'disabled' }
```

### 配对码 API
```typescript
// 生成配对码
POST /api/trpc/telegram.generatePairingCode
  { expiresIn?: number } // 有效期（秒），默认 24 小时

// 获取配对码列表
GET /api/trpc/telegram.listPairingCodes

// 撤销配对码
POST /api/trpc/telegram.revokePairingCode
  { codeId: number }

// 获取已配对用户
GET /api/trpc/telegram.listPairedUsers

// 撤销用户配对
POST /api/trpc/telegram.revokePairedUser
  { telegramUserId: string }
```

### 白名单 API
```typescript
// 添加用户到白名单
POST /api/trpc/telegram.addToAllowlist
  { telegramUserId: string, username?: string, notes?: string }

// 获取白名单
GET /api/trpc/telegram.getAllowlist

// 从白名单移除
POST /api/trpc/telegram.removeFromAllowlist
  { telegramUserId: string }

// 批量导入白名单
POST /api/trpc/telegram.importAllowlist
  { users: Array<{ telegramUserId: string, username?: string }> }
```

---

## UI 设计

### Channel Settings 页面扩展

在现有的 Channel Settings 页面中，为 Telegram 渠道添加专门的访问控制面板：

```
┌─────────────────────────────────────────────────────────────┐
│ 📱 TELEGRAM ACCESS CONTROL                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DM Policy:  [▼ Pairing Mode    ]  [Sync to Gateway]       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔑 PAIRING CODES                    [+ Generate]    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Code          Status    Expires      Actions        │   │
│  │ ABC123        Pending   2h left      [Copy] [❌]    │   │
│  │ XYZ789        Used      -            [View User]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👥 PAIRED USERS                                     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ @username1    ID: 123456    Paired: 2h ago  [❌]    │   │
│  │ @username2    ID: 789012    Paired: 1d ago  [❌]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 实现步骤

1. **数据库 Schema 更新**
   - 添加 telegram_paired_users、telegram_pairing_codes、telegram_allowlist 表

2. **后端 API 实现**
   - 创建 telegram router 处理所有 Telegram 相关 API
   - 实现配对码生成和验证逻辑
   - 实现与 OpenClaw Gateway 的同步

3. **前端界面实现**
   - 在 ChannelSettings.tsx 中添加 Telegram 访问控制面板
   - 实现配对码管理 UI
   - 实现白名单管理 UI

4. **测试**
   - 单元测试覆盖所有 API
   - 端到端测试验证完整流程

---

## 安全考虑

1. **配对码安全**
   - 使用加密随机数生成配对码
   - 配对码默认 24 小时过期
   - 一次性使用，使用后立即失效

2. **权限控制**
   - 只有管理员可以管理访问控制
   - 所有操作记录审计日志

3. **同步安全**
   - 配置变更实时同步到 Gateway
   - 支持回滚到之前的配置
