# Chatbox 聊天功能 & Skill Marketplace 集成方案

## 一、Chatbox 聊天功能

### 1.1 功能概述
在 Dashboard 中集成 AI 聊天界面，允许用户直接与配置的大模型进行对话。

### 1.2 核心功能

| 功能 | 描述 |
|------|------|
| **多模型支持** | 使用 Dashboard 中配置的任意 AI 模型 |
| **模型切换** | 对话中可随时切换不同模型 |
| **对话历史** | 保存对话记录，支持查看历史会话 |
| **流式输出** | 实时显示 AI 回复，支持 Markdown 渲染 |
| **Skill 集成** | 在对话中可调用已安装的 Skills |
| **代码高亮** | 支持代码块语法高亮 |
| **导出功能** | 导出对话为 Markdown/JSON |

### 1.3 数据库设计

**chat_sessions 表**
- id: 主键
- userId: 用户 ID
- title: 会话标题
- modelId: 使用的模型
- createdAt, updatedAt: 时间戳

**chat_messages 表**
- id: 主键
- sessionId: 会话 ID
- role: user/assistant/system
- content: 消息内容
- modelId: 模型 ID
- tokenCount: Token 数量
- createdAt: 时间戳

### 1.4 API 设计

| 端点 | 描述 |
|------|------|
| chat.sessions.list | 获取用户的所有会话 |
| chat.sessions.create | 创建新会话 |
| chat.sessions.delete | 删除会话 |
| chat.messages.list | 获取会话的所有消息 |
| chat.messages.send | 发送消息并获取 AI 回复 |

---

## 二、Skill Marketplace 集成

### 2.1 功能概述
集成 SkillsMP.com 的 Agent Skills 市场 (121,000+ Skills)。

### 2.2 核心功能

| 功能 | 描述 |
|------|------|
| **浏览 Skills** | 按分类浏览 Skills |
| **AI 搜索** | 使用 AI 语义搜索 |
| **关键词搜索** | 传统关键词搜索 |
| **Skill 详情** | 查看详细信息、Star 数 |
| **一键安装** | 安装到 OpenClaw |
| **已安装管理** | 启用/禁用/卸载 Skills |
| **同步 Gateway** | 同步到 OpenClaw Gateway |

### 2.3 SkillsMP API

**关键词搜索**
```
GET /api/v1/skills/search?q=xxx&page=1&limit=20
```

**AI 语义搜索**
```
GET /api/v1/skills/ai-search?q=xxx
```

**认证**: Bearer Token (SKILLSMP_API_KEY)

### 2.4 数据库设计

**installed_skills 表**
- id: 主键
- skillId: SkillsMP ID
- name: 名称
- description: 描述
- author: 作者
- repoUrl: GitHub 仓库
- stars: Star 数
- category: 分类
- enabled: 是否启用
- skillContent: SKILL.md 内容
- installedAt, updatedAt: 时间戳

### 2.5 API 设计

| 端点 | 描述 |
|------|------|
| skills.search | 关键词搜索 |
| skills.aiSearch | AI 语义搜索 |
| skills.getCategories | 获取分类 |
| skills.install | 安装 Skill |
| skills.uninstall | 卸载 Skill |
| skills.toggle | 启用/禁用 |
| skills.listInstalled | 已安装列表 |
| skills.syncToGateway | 同步到 Gateway |

### 2.6 分类列表

- Tools (39,932)
- Development (34,522)
- Data & AI (23,006)
- Business (22,237)
- DevOps (18,910)
- Testing & Security (14,317)
- Content & Media (10,679)
- Documentation (10,054)
- Research (5,279)
- Databases (2,529)
- Lifestyle (2,053)
- Blockchain (1,556)

---

## 三、实现计划

### Phase 1: Chatbox
1. 创建数据库表
2. 实现后端 API
3. 集成 LLM 调用
4. 创建 UI 组件
5. 实现流式输出

### Phase 2: Skill Marketplace
1. 配置 SkillsMP API Key
2. 创建数据库表
3. 实现 API 调用
4. 创建 Marketplace UI
5. 实现安装/管理功能
6. 同步到 Gateway

---

## 四、环境变量

```env
SKILLSMP_API_KEY=sk_live_xxx
```

---

## 五、UI 入口

| 入口 | 图标 | 描述 |
|------|------|------|
| AI Chat | 💬 | Chatbox 聊天界面 |
| Skill Store | 🛒 | Skill Marketplace |
