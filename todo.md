# Project TODO

- [x] Basic cyberpunk terminal style dashboard
- [x] Gateway status monitoring
- [x] AI Models management with custom model support
- [x] Telegram bot integration display
- [x] System log display
- [x] Basic login page (hardcoded credentials)
- [x] Upgrade to full-stack architecture with database
- [x] Integrate OAuth login
- [x] Integrate Rainbow wallet login
- [x] Implement admin role management in database
- [x] Remove hardcoded login, use secure authentication
- [ ] Admin user management UI (optional)
- [x] Fix mobile header layout alignment issue
- [x] Implement AI Models click interaction and model switching
- [x] Create backend API for model management
- [x] Persist model selection to OpenClaw config
- [x] Fix Dashboard model display to correctly read OpenClaw config
- [x] Create database schema for channel_configs and model_configs
- [x] Implement encryption utilities for sensitive data
- [x] Create tRPC API for channel management
- [x] Create tRPC API for AI model management
- [x] Implement test connection for each channel type
- [x] Implement test connection for each AI provider
- [x] Create channel configuration UI page
- [x] Create AI model configuration UI page
- [x] Implement sync to OpenClaw Gateway
- [x] Design Telegram access control configuration in Dashboard
- [x] Create API for Telegram DM policy management
- [x] Create API for pairing code generation and management
- [x] Create API for allowlist user management
- [x] Build Telegram access control UI page
- [x] Implement sync to OpenClaw Gateway for access control

- [x] Design Chatbox and Skill Marketplace integration plan
- [x] Implement Chatbox chat feature with AI models
  - [x] Database schema for chat sessions and messages
  - [x] tRPC API routes (listSessions, createSession, deleteSession, updateSessionTitle, getMessages, sendMessage)
  - [x] Frontend Chatbox UI with session management
  - [x] OpenClaw Gateway integration with HTTP Chat Completions endpoint
  - [x] Markdown rendering for AI responses
  - [x] Cyberpunk-themed UI styling
  - [x] Session title editing
  - [ ] Add confirmation dialog for session deletion
  - [ ] Implement streaming responses
- [ ] Research skillsmp.com API and integration options
- [ ] Implement Skill Marketplace UI
- [ ] Add skill installation and management

- [x] Implement Gateway Management System
  - [x] Database schema (4 tables: gateway_monitors, gateway_restart_logs, webhook_status_logs, gateway_settings)
  - [x] Backend services (GatewayProcessManager, WebhookPollerService, MetricsCollector)
  - [x] tRPC API routes for gateway management (getStatus, restart, stop, start, getLogs, getMonitorHistory, getRestartLogs)
  - [x] Webhook management API (checkStatus, getHistory, configureAutoCheck, setProductionUrl, getSettings)
  - [x] Frontend monitoring dashboard UI with real-time status
  - [x] Webhook auto-restart mechanism (checks every 5 minutes)
  - [x] Metrics collector (collects every 30 seconds)
  - [x] Manual restart/stop/start controls
  - [x] Restart logs display
  - [x] Webhook status monitoring
  - [x] Configuration settings display
  - [x] Production webhook URL configuration form in UI
  - [ ] Real-time log viewer with filtering
  - [ ] Resource usage charts (CPU/Memory over time)
  - [ ] Alert notifications for critical events

- [x] Redesign Dashboard layout with left sidebar navigation
  - [x] Design sidebar navigation structure
  - [x] Replace Quick Actions cards with sidebar menu
  - [x] Create global Layout component with Sidebar
  - [x] Add active state highlighting for current page
  - [x] Apply sidebar to all pages (Dashboard, Chatbox, Gateway, etc.)
  - [x] Persist sidebar state to localStorage
  - [x] Implement collapsible sidebar toggle button (汉堡菜单)
  - [x] Optimize mobile responsive design (抽屉式侧边栏)
  - [x] Implement breadcrumb navigation (面包屑导航)

- [x] Fix mobile sidebar layout issues
  - [x] Remove duplicate menu buttons (hide sidebar toggle on mobile)
  - [x] Fix sidebar z-index to prevent overlapping header (z-50 on mobile, z-30 on desktop)
  - [x] Ensure proper spacing and positioning on mobile devices (full height drawer)

- [x] Fix missing navigation pages
  - [x] Fix Channels page route (/settings/channels)
  - [x] Fix Models page route (/settings/models)
  - [x] Fix Access page route (/settings/telegram-access)
  - [x] Update Sidebar paths to match App.tsx routes

- [x] Fix tablet responsive layout bug
  - [x] Adjust breakpoints: use drawer-style sidebar on tablet (< 1280px)
  - [x] Change from lg: (1024px) to xl: (1280px) breakpoint
  - [x] Ensure sidebar doesn't overlap main content on tablet devices
  - [x] Test on iPad and other tablet viewports

- [x] Fix sidebar overlapping header on mobile/tablet
  - [x] Change sidebar to start below header (top-16) on all screen sizes
  - [x] Adjust sidebar height to account for header space
  - [x] Test on mobile and tablet viewports

- [x] Fix sidebar being blocked by header content on mobile/tablet
  - [x] Sidebar menu items (Dashboard, Chatbox) hidden behind header area
  - [x] Adjust z-index so sidebar appears above header content (Header z-40, Sidebar z-50)
  - [x] Test on mobile viewport

- [x] Chatbox Upgrade - Phase 2
  - [x] Remove auto-create new chat when opening Chatbox (shows welcome screen instead)
  - [x] Complete 'using model' display at bottom of chat (model selector with provider colors)
  - [x] Make CHAT SESSIONS panel collapsible/resizable (collapse button + drag to resize)
  - [x] Implement streaming responses with thinking process display (sendMessageStream API + thinking collapsible)

- [x] Chatbox UX Fixes
  - [x] Show user message immediately (optimistic update) before AI response
  - [x] Fix SESSIONS panel scrolling with page - sticky header implemented

- [x] Fix SESSIONS panel - make New Chat button also sticky with header (full-width button in sticky header)

- [x] SESSIONS Panel Improvements
  - [x] Make entire SESSIONS panel collapsible/hideable
  - [x] Desktop: toggle button to hide/show panel, show expand icon when hidden
  - [x] Mobile: drawer-style panel, default hidden, floating button to open
  - [x] Fix session card list - panel fixed position, list scrolls internally
  - [x] Persist panel visibility state to localStorage

- [x] Fix SESSIONS panel scrolling with chat content
  - [x] SESSIONS panel should be completely fixed (position: fixed)
  - [x] Panel should not scroll when chat area scrolls
  - [x] Session cards always visible for quick switching regardless of chat scroll position

- [x] Fix SESSIONS panel position not adjusting with Sidebar state
  - [x] Created SidebarContext to share sidebar state across components
  - [x] Dynamically calculate SESSIONS panel left position based on sidebar state
  - [x] Sidebar expanded: left = 240px (w-60)
  - [x] Sidebar collapsed: left = 64px (w-16)
  - [x] SESSIONS panel now correctly follows Sidebar state

## Bug Fixes (2026-02-02)
- [x] 移动端 SESSIONS 面板遮挡聊天内容 - 改为纯抽屉模式（隐藏时不显示图标条）
- [x] 聊天输入框固定在底部（不随页面滚动）

## Deployment Fix (2026-02-02)
- [x] Fix deployment failure - Gateway services (GatewayProcessManager, WebhookPoller, MetricsCollector) should only run in development environment

## Webhook URL Feature (2026-02-02)
- [x] 添加“立即应用”按钮 - 手动触发 Telegram webhook 设置
- [x] 后端 API: gateway.applyWebhook 端点
- [x] 前端 UI: 在生产 Webhook URL 配置旁添加应用按钮

## Gateway & Webhook 统一管理 (2026-02-02)
- [x] 修改菜单名称为 "Gateway & Webhook"
- [x] 添加连接模式数据库字段 (telegram_connection_mode: 'gateway' | 'webhook')
- [x] 添加连接模式切换 API
- [x] 重构 Gateway 页面 UI，添加模式选择器
- [x] 实现模式切换逻辑（切换时自动处理冲突）
- [x] 添加 Webhook 服务状态监控
- [ ] 添加 Webhook 消息统计（今日处理数、错误率）
- [ ] 添加 Webhook 健康检查和自动恢复

## Admin Login (2026-02-02)
- [x] 添加管理员账号密码登录 API (admin/admin)
- [x] 更新登录页面 UI 添加账号密码表单

## Webhook Bot Token Bug Fix (2026-02-02)
- [x] 修复 Webhook 无法读取 Channel Settings 中配置的 Bot Token
- [x] 统一 Bot Token 数据源（从数据库 channel_configs 表读取）
- [x] 添加 getTelegramBotToken() 函数到 db.ts
- [x] 修改 webhookPoller.ts 使用数据库而不是本地文件
- [x] 添加 Bot Token 解密逻辑

## Telegram Webhook 消息处理 Bug (2026-02-02)
- [x] 诊断 /webhook 端点为什么没有正确处理 Telegram 消息
- [x] 检查服务器日志分析问题
- [x] 修复 Webhook 消息处理逻辑
- [x] 创建 telegramWebhook.ts 处理器
- [x] 注册 POST /webhook 和 GET /webhook 路由
- [x] 实现 AI 回复功能（使用 invokeLLM）
- [x] 实现用户权限检查（allowlist/paired）
- [x] 实现基本命令处理（/start, /help, /status）
