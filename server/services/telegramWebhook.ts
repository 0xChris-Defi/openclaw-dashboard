import { Request, Response, Express } from 'express';
import { getTelegramBotToken } from '../db';
import * as db from '../db';
import { decryptConfig } from '../crypto';
import { invokeLLM } from '../_core/llm';

// Telegram Update types
interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  reply_to_message?: TelegramMessage;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyToMessageId?: number
): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        reply_to_message_id: replyToMessageId,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[TelegramWebhook] Failed to send message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[TelegramWebhook] Error sending message:', error);
    return false;
  }
}

/**
 * Get AI response using configured model
 */
async function getAIResponse(userMessage: string, userId: number): Promise<string> {
  try {
    // Get the default model config
    const modelConfigs = await db.getModelConfigs(1); // Use admin user ID
    const defaultModel = modelConfigs.find(m => m.isDefault) || modelConfigs[0];

    if (!defaultModel) {
      return "抱歉，AI 模型尚未配置。请在 Dashboard 中配置 AI 模型。";
    }

    // Decrypt the config to get API key
    const decryptedConfig = decryptConfig(defaultModel.config as Record<string, unknown>);
    const apiKey = decryptedConfig.apiKey as string;
    const baseUrl = decryptedConfig.baseUrl as string || 'https://api.openai.com/v1';
    const model = defaultModel.selectedModel || 'gpt-3.5-turbo';

    if (!apiKey) {
      return "抱歉，AI 模型 API Key 未配置。请在 Dashboard 中配置。";
    }

    // Use invokeLLM for the response
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant. Respond in the same language as the user message. Keep responses concise and helpful.' },
        { role: 'user', content: userMessage },
      ],
    });

    if (response.choices && response.choices.length > 0) {
      const content = response.choices[0].message?.content;
      if (typeof content === 'string') {
        return content;
      }
      return "抱歉，无法生成回复。";
    }

    return "抱歉，AI 服务暂时不可用。";
  } catch (error) {
    console.error('[TelegramWebhook] Error getting AI response:', error);
    return `抱歉，处理消息时出错：${error instanceof Error ? error.message : '未知错误'}`;
  }
}

/**
 * Check if user is allowed to use the bot
 */
async function isUserAllowed(telegramUserId: number): Promise<boolean> {
  try {
    // Get bot token to verify Telegram channel is configured
    const botToken = await getTelegramBotToken();
    if (!botToken) {
      console.warn('[TelegramWebhook] No Telegram channel configured');
      return false;
    }

    // For now, allow all users if bot is configured
    // TODO: Implement proper DM policy checking from channel config
    // The DM policy should be stored in the channel config's decrypted data
    
    // Check if user is in allowlist
    const isInAllowlist = await db.isInTelegramAllowlist(String(telegramUserId));
    if (isInAllowlist) {
      return true;
    }

    // Check if user is paired
    const pairedUsers = await db.getTelegramPairedUsers();
    const isPaired = pairedUsers.some(entry => entry.telegramUserId === String(telegramUserId));
    if (isPaired) {
      return true;
    }

    // Default: allow all users (open policy)
    // In production, you may want to change this to false and require explicit allowlist
    return true;
  } catch (error) {
    console.error('[TelegramWebhook] Error checking user access:', error);
    return false;
  }
}

/**
 * Handle incoming Telegram webhook update
 */
async function handleWebhookUpdate(update: TelegramUpdate): Promise<void> {
  console.log('[TelegramWebhook] Received update:', JSON.stringify(update, null, 2));

  const message = update.message || update.edited_message;
  if (!message || !message.text) {
    console.log('[TelegramWebhook] No text message in update, skipping');
    return;
  }

  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text;
  const messageId = message.message_id;

  if (!userId) {
    console.log('[TelegramWebhook] No user ID in message, skipping');
    return;
  }

  // Get bot token
  const botToken = await getTelegramBotToken();
  if (!botToken) {
    console.error('[TelegramWebhook] Bot token not configured');
    return;
  }

  // Check if user is allowed
  const allowed = await isUserAllowed(userId);
  if (!allowed) {
    console.log(`[TelegramWebhook] User ${userId} not allowed`);
    await sendTelegramMessage(
      botToken,
      chatId,
      "抱歉，您没有权限使用此 Bot。请联系管理员获取访问权限。",
      messageId
    );
    return;
  }

  // Handle special commands
  if (text.startsWith('/')) {
    const command = text.split(' ')[0].toLowerCase();
    
    switch (command) {
      case '/start':
        await sendTelegramMessage(
          botToken,
          chatId,
          "👋 欢迎使用 OpenClaw AI 助手！\n\n直接发送消息即可与 AI 对话。\n\n可用命令：\n/help - 显示帮助\n/status - 检查服务状态",
          messageId
        );
        return;

      case '/help':
        await sendTelegramMessage(
          botToken,
          chatId,
          "🤖 *OpenClaw AI 助手*\n\n直接发送消息即可与 AI 对话。\n\n可用命令：\n/start - 开始使用\n/help - 显示帮助\n/status - 检查服务状态",
          messageId
        );
        return;

      case '/status':
        await sendTelegramMessage(
          botToken,
          chatId,
          "✅ 服务运行正常\n\n🤖 AI 模型已配置\n📡 Webhook 已激活",
          messageId
        );
        return;

      default:
        // Unknown command, treat as regular message
        break;
    }
  }

  // Send typing indicator
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        action: 'typing',
      }),
    });
  } catch (e) {
    // Ignore typing indicator errors
  }

  // Get AI response
  const aiResponse = await getAIResponse(text, userId);

  // Send response
  await sendTelegramMessage(botToken, chatId, aiResponse, messageId);
}

/**
 * Register webhook routes on Express app
 */
export function registerWebhookRoutes(app: Express): void {
  // Telegram webhook endpoint
  app.post('/webhook', async (req: Request, res: Response) => {
    try {
      console.log('[TelegramWebhook] Received POST /webhook');
      
      const update = req.body as TelegramUpdate;
      
      // Respond immediately to Telegram (within 60 seconds requirement)
      res.status(200).json({ ok: true });

      // Process the update asynchronously
      handleWebhookUpdate(update).catch(error => {
        console.error('[TelegramWebhook] Error handling update:', error);
      });
    } catch (error) {
      console.error('[TelegramWebhook] Error processing webhook:', error);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // Health check endpoint for webhook
  app.get('/webhook', (req: Request, res: Response) => {
    res.status(200).json({ 
      ok: true, 
      message: 'OpenClaw Telegram Webhook is active',
      timestamp: new Date().toISOString(),
    });
  });

  console.log('[TelegramWebhook] Routes registered: POST /webhook, GET /webhook');
}
