# 🦞 OpenClaw Dashboard

Personal AI Assistant Control Panel with a cyberpunk terminal aesthetic.

![Dashboard Preview](https://img.shields.io/badge/version-v2026.2-red?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square)

## ✨ Features

- **🤖 AI Chatbox** - Chat with multiple AI models, session management, streaming responses
- **📡 Gateway Management** - Monitor and control your AI gateway service
- **💬 Multi-Channel Support** - Telegram, Discord, Slack, WhatsApp, and more
- **🔧 Model Configuration** - Configure multiple AI providers (OpenAI, Anthropic, DeepSeek, etc.)
- **🔐 Access Control** - Telegram DM policy, pairing codes, allowlist management
- **📊 Real-time Metrics** - Monitor gateway status, uptime, and performance

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Express 4, tRPC 11 |
| Database | MySQL/TiDB with Drizzle ORM |
| Auth | OAuth 2.0, Wallet Connect |
| Language | TypeScript 5.9 |

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- pnpm 9+
- MySQL 8+ or TiDB

### Installation

```bash
# Clone the repository
git clone https://github.com/0xChris-Defi/openclaw-dashboard.git
cd openclaw-dashboard

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and API keys

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/openclaw

# Authentication
JWT_SECRET=your-jwt-secret

# AI Provider (optional - for built-in AI features)
OPENAI_API_KEY=sk-xxx
```

## 📁 Project Structure

```
openclaw-dashboard/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   │   └── lib/           # Utilities and hooks
├── server/                 # Backend Express server
│   ├── routers.ts         # tRPC API routes
│   ├── db.ts              # Database queries
│   └── services/          # Background services
├── drizzle/               # Database schema and migrations
└── shared/                # Shared types and constants
```

## 🎨 Design System

OpenClaw uses a cyberpunk terminal aesthetic with:

- **Dark theme** - Deep black background (#0a0a0a)
- **Neon accents** - Red primary color with glow effects
- **Monospace typography** - Terminal-style fonts
- **Animated indicators** - Pulse effects for status displays

## 📱 Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard - Gateway status, models, system info |
| `/chatbox` | AI Chat - Session management, model selector |
| `/gateway` | Gateway - Process control, logs, webhook status |
| `/settings/channels` | Channel configurations |
| `/settings/models` | AI provider configurations |
| `/settings/telegram-access` | Telegram access control |

## 🔌 API

All APIs use tRPC for type-safe communication:

```typescript
// Example: Get chat sessions
const { data } = trpc.chat.listSessions.useQuery();

// Example: Send message
const mutation = trpc.chat.sendMessage.useMutation();
await mutation.mutateAsync({ sessionId: 1, content: "Hello!" });
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [tRPC](https://trpc.io/) - End-to-end typesafe APIs
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/0xChris-Defi">0xChris-Defi</a>
</p>
