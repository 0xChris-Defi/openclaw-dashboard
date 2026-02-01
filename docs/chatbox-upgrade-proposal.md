# Chatbox 升级方案

## 概述

基于用户反馈，对 Chatbox 进行四项重要升级，提升用户体验和功能完整性。

---

## 升级项目

### 1. 移除自动创建新会话

**当前行为：** 每次打开 Chatbox 页面时，如果没有会话，会自动创建一个 "New Chat"。

**问题：** 用户不需要这个功能，会产生很多空白会话。

**升级方案：**
- 移除 `useEffect` 中的自动创建逻辑
- 当没有会话时，显示欢迎界面，引导用户手动创建
- 欢迎界面包含：大图标 + 说明文字 + "创建新会话" 按钮

**代码改动：**
```tsx
// 删除这段自动创建逻辑
useEffect(() => {
  if (sessions.length === 0 && !createSession.isPending) {
    createSession.mutate({ title: "New Chat" });  // 删除
  } else if (sessions.length > 0 && !selectedSessionId) {
    setSelectedSessionId(sessions[0].id);  // 保留
  }
}, [sessions]);
```

---

### 2. 完善 "Using Model" 显示

**当前行为：** 底部显示 `Using model: default`，信息不够详细。

**升级方案：**
- 显示当前使用的模型名称（如 "Claude 3.5 Sonnet"）
- 显示模型提供商图标/标签
- 添加模型切换下拉菜单，允许用户在聊天时切换模型
- 显示格式：`🤖 Claude 3.5 Sonnet (Anthropic) ▼`

**UI 设计：**
```
┌─────────────────────────────────────────────────────┐
│ [输入框...]                              [发送按钮] │
├─────────────────────────────────────────────────────┤
│ 🤖 Claude 3.5 Sonnet (Anthropic) ▼  │  Tokens: 1.2k │
└─────────────────────────────────────────────────────┘
```

**功能特性：**
- 点击模型名称弹出下拉菜单，可切换模型
- 显示当前会话消耗的 token 数量（如果有）
- 模型切换后，后续消息使用新模型

---

### 3. CHAT SESSIONS 面板可折叠/可调整宽度

**当前行为：** 左侧会话列表固定宽度 320px，无法隐藏或调整。

**升级方案 A - 折叠按钮（推荐）：**
- 在面板顶部添加折叠/展开按钮
- 折叠后只显示一个小图标栏（宽度约 48px）
- 展开后恢复完整宽度
- 状态保存到 localStorage

**UI 设计：**
```
展开状态：                    折叠状态：
┌──────────────────┐         ┌────┐
│ CHAT SESSIONS [<]│         │ [>]│
├──────────────────┤         ├────┤
│ 📝 Chat 1        │         │ 📝 │
│ 📝 Chat 2        │         │ 📝 │
│ 📝 Chat 3        │         │ 📝 │
└──────────────────┘         └────┘
```

**升级方案 B - 可拖拽调整宽度：**
- 在面板右边缘添加拖拽条
- 用户可以拖动调整宽度（最小 200px，最大 400px）
- 双击拖拽条恢复默认宽度
- 宽度保存到 localStorage

**推荐：方案 A + B 结合**
- 支持折叠/展开
- 展开状态下支持拖拽调整宽度

---

### 4. 流式响应 + 思考过程显示

**当前行为：** 等待 AI 完整响应后一次性显示，只显示 "AI is thinking..."。

**升级方案：**

**4.1 流式响应（Streaming）**
- 后端改用 SSE (Server-Sent Events) 或 WebSocket
- 前端逐字/逐句显示 AI 响应
- 显示打字机效果

**4.2 思考过程显示（Thinking Process）**
- 支持显示 AI 的思考过程（如果模型支持）
- 思考过程用折叠区块显示
- 样式：灰色背景 + 斜体 + "🧠 Thinking..." 标签

**UI 设计：**
```
┌─────────────────────────────────────────────────────┐
│ 🧠 Thinking...                              [展开 ▼]│
│ ┌─────────────────────────────────────────────────┐ │
│ │ 用户问的是关于 React 的问题...                  │ │
│ │ 我需要考虑以下几点：                           │ │
│ │ 1. React 的基本概念                            │ │
│ │ 2. 相关的最佳实践                              │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ 好的，让我来解释一下 React...                      │
│ █ (光标闪烁，正在输出)                             │
└─────────────────────────────────────────────────────┘
```

**技术实现：**

**后端改动：**
```typescript
// 新增流式响应端点
sendMessageStream: protectedProcedure
  .input(z.object({
    sessionId: z.number(),
    content: z.string(),
  }))
  .subscription(async function* ({ ctx, input }) {
    // 1. 保存用户消息
    // 2. 调用 AI API (stream: true)
    // 3. 逐块 yield 响应
    for await (const chunk of aiStream) {
      yield {
        type: 'content',
        content: chunk.content,
        thinking: chunk.thinking,  // 如果有思考过程
      };
    }
    // 4. 保存完整响应到数据库
  }),
```

**前端改动：**
```typescript
// 使用 subscription 接收流式数据
const [streamingContent, setStreamingContent] = useState('');
const [thinkingContent, setThinkingContent] = useState('');

trpc.chat.sendMessageStream.useSubscription(
  { sessionId, content },
  {
    onData: (data) => {
      if (data.type === 'thinking') {
        setThinkingContent(prev => prev + data.content);
      } else {
        setStreamingContent(prev => prev + data.content);
      }
    },
    onComplete: () => {
      // 刷新消息列表
      refetchMessages();
    },
  }
);
```

---

## 实施优先级

| 优先级 | 功能 | 复杂度 | 预计时间 |
|--------|------|--------|----------|
| 🔴 高 | 1. 移除自动创建会话 | 低 | 10 分钟 |
| 🟠 中 | 2. 完善 Using Model 显示 | 中 | 30 分钟 |
| 🟠 中 | 3. 会话面板折叠/调整 | 中 | 45 分钟 |
| 🔴 高 | 4. 流式响应 + 思考过程 | 高 | 2-3 小时 |

---

## 建议实施顺序

1. **第一阶段（快速修复）：**
   - 移除自动创建会话
   - 完善 Using Model 显示

2. **第二阶段（UI 增强）：**
   - 会话面板折叠功能
   - 可选：拖拽调整宽度

3. **第三阶段（核心升级）：**
   - 流式响应实现
   - 思考过程显示

---

## 需要确认的问题

1. **流式响应**：是否需要支持所有模型的流式响应，还是只支持 OpenClaw Gateway？
2. **思考过程**：目前哪些模型支持返回思考过程？（Claude 3.5 支持，GPT-4 不支持）
3. **会话面板**：偏好折叠按钮还是拖拽调整宽度，或两者都要？

请确认以上方案，我将开始实施。
