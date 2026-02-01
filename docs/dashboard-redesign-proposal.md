# Dashboard 布局重构方案

## 📋 当前布局分析

**现状：**
- 顶部：Logo + 标题 + 状态指示器 + Refresh/Logout 按钮
- 主体：4x2 网格布局的信息卡片（Gateway Status, System Info, AI Models, Telegram Channel, System Log, Gateway Token）
- 底部：Quick Actions 区域（6个按钮卡片）

**问题：**
1. Quick Actions 占用大量垂直空间
2. 导航不够直观，需要滚动才能看到所有功能
3. 不符合后台管理系统的标准布局模式
4. 移动端体验不佳

---

## 🎯 新布局设计方案

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]  OPENCLAW DASHBOARD          [Status] [Logout]  │ ← Header (固定顶部)
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  [Home]  │   Dashboard 主内容区                          │
│  [Chat]  │   - Gateway Status                           │
│  [Gate]  │   - AI Models                                │
│  [Chan]  │   - Telegram Channel                         │
│  [Model] │   - System Info                              │
│  [Tele]  │   - System Log                               │
│  [Doc]   │   - Gateway Token                            │
│  [Repo]  │                                              │
│          │                                              │
│  Sidebar │   Main Content Area                          │
│  (固定)   │   (可滚动)                                    │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### 左侧边栏设计

**宽度：**
- 展开状态：240px
- 收起状态：64px（仅显示图标）
- 移动端：全屏抽屉式

**导航项目：**

1. **🏠 Dashboard** - 主页（当前页面）
2. **💬 Chatbox** - AI 聊天
3. **⚙️ Gateway** - Gateway 管理
4. **🔌 Channels** - 渠道配置
5. **🤖 Models** - 模型配置
6. **🔐 Access** - Telegram 访问控制
7. **📚 Docs** - 文档
8. **💻 GitHub** - 代码仓库

**视觉设计：**
- 背景：`bg-card` (深色半透明)
- 边框：右侧 1px 红色霓虹边框
- 激活状态：红色背景 + 左侧红色竖条
- Hover 状态：红色半透明背景
- 图标：使用 lucide-react 图标
- 字体：`font-mono` 保持赛博朋克风格

### 顶部 Header 调整

**保留元素：**
- Logo + 标题（左侧）
- Gateway 状态指示器（ONLINE/OFFLINE）
- Logout 按钮（右侧）

**移除元素：**
- Refresh 按钮（改为自动刷新）

**新增元素：**
- 侧边栏折叠按钮（移动端）
- 用户头像/名称（可选）

### 主内容区调整

**布局优化：**
1. 移除 Quick Actions 区域
2. 将信息卡片改为 2 列网格（桌面）/ 1 列（移动）
3. 增加卡片间距，提升可读性
4. 添加面包屑导航（可选）

**卡片顺序调整：**
```
Row 1: Gateway Status | System Info
Row 2: AI Models (full width)
Row 3: Telegram Channel | Gateway Token
Row 4: System Log (full width)
```

---

## 🎨 视觉设计细节

### 侧边栏样式

```tsx
// 侧边栏容器
className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-60 bg-card border-r border-primary/30 flex flex-col"

// 导航项
className="flex items-center gap-3 px-4 py-3 text-sm font-mono transition-colors hover:bg-primary/10"

// 激活状态
className="bg-primary/20 border-l-4 border-primary text-primary"

// 图标
className="w-5 h-5"
```

### 响应式设计

**桌面 (≥1024px)：**
- 侧边栏固定展开
- 主内容区 margin-left: 240px
- 2 列网格布局

**平板 (768px - 1023px)：**
- 侧边栏可折叠
- 主内容区自适应
- 2 列网格布局

**移动 (< 768px)：**
- 侧边栏改为抽屉式（默认隐藏）
- 主内容区全宽
- 1 列网格布局
- 顶部添加汉堡菜单按钮

---

## 🔧 技术实现方案

### 组件结构

```
src/
├── components/
│   ├── DashboardLayout.tsx (已存在，可复用部分逻辑)
│   ├── Sidebar.tsx (新建)
│   ├── Header.tsx (新建)
│   └── MainContent.tsx (新建)
├── pages/
│   └── Home.tsx (重构)
```

### 核心代码结构

```tsx
// Sidebar.tsx
export function Sidebar({ isOpen, onToggle }) {
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/chatbox', icon: MessageSquare, label: 'Chatbox' },
    { path: '/gateway', icon: Server, label: 'Gateway' },
    // ...
  ];
  
  return (
    <aside className={cn(
      "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-card border-r border-primary/30",
      isOpen ? "w-60" : "w-16"
    )}>
      {navItems.map(item => (
        <NavItem key={item.path} {...item} isCollapsed={!isOpen} />
      ))}
    </aside>
  );
}

// Home.tsx (重构)
export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  return (
    <div className="min-h-screen bg-background">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <main className={cn(
        "pt-16 transition-all",
        sidebarOpen ? "ml-60" : "ml-16"
      )}>
        <div className="container py-6">
          {/* 现有的卡片内容 */}
        </div>
      </main>
    </div>
  );
}
```

### 状态管理

- 使用 `useState` 管理侧边栏展开/收起状态
- 使用 `localStorage` 持久化用户偏好
- 使用 `useLocation` 高亮当前页面

### 动画效果

- 侧边栏展开/收起：`transition-all duration-300`
- 导航项 Hover：`transition-colors`
- 移动端抽屉：使用 `framer-motion` 实现滑入/滑出

---

## 📊 优势对比

| 特性 | 当前布局 | 新布局 |
|------|---------|--------|
| 导航可见性 | 需要滚动 | 始终可见 |
| 空间利用率 | 低（Quick Actions 占用大） | 高（侧边栏固定） |
| 专业度 | 一般 | 专业后台系统 |
| 移动端体验 | 较差 | 优秀（抽屉式） |
| 扩展性 | 有限 | 易于添加新页面 |
| 用户学习成本 | 中等 | 低（标准模式） |

---

## ⏱️ 预计开发时间

**总计：3-4 小时**

- Phase 1: 创建 Sidebar 和 Header 组件（1h）
- Phase 2: 重构 Home.tsx 布局（1h）
- Phase 3: 响应式适配和动画（1h）
- Phase 4: 测试和优化（0.5-1h）

---

## 🎯 实施建议

1. **保留赛博朋克风格**：红色霓虹、等宽字体、终端美学
2. **复用现有组件**：DashboardLayout 的部分逻辑可以复用
3. **渐进式实现**：先实现桌面端，再适配移动端
4. **用户反馈**：实现后收集用户意见，迭代优化

---

**是否开始实施此方案？** 或者你有任何需要调整的地方？
