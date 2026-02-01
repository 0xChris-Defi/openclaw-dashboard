/**
 * Channel connection testers for various messaging platforms
 */

interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Test Telegram Bot connection
 */
export async function testTelegramConnection(config: Record<string, unknown>): Promise<TestResult> {
  const botToken = config.botToken as string;
  if (!botToken) {
    return { success: false, message: 'Bot Token is required' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();

    if (data.ok) {
      return {
        success: true,
        message: `Connected to @${data.result.username}`,
        details: {
          botId: data.result.id,
          username: data.result.username,
          firstName: data.result.first_name,
        },
      };
    } else {
      return { success: false, message: data.description || 'Invalid Bot Token' };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test Discord Bot connection
 */
export async function testDiscordConnection(config: Record<string, unknown>): Promise<TestResult> {
  const botToken = config.botToken as string;
  if (!botToken) {
    return { success: false, message: 'Bot Token is required' };
  }

  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `Connected to ${data.username}#${data.discriminator}`,
        details: {
          botId: data.id,
          username: data.username,
          discriminator: data.discriminator,
        },
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.message || 'Invalid Bot Token' };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test Slack App connection
 */
export async function testSlackConnection(config: Record<string, unknown>): Promise<TestResult> {
  const botToken = config.botToken as string;
  if (!botToken) {
    return { success: false, message: 'Bot Token is required' };
  }

  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await response.json();

    if (data.ok) {
      return {
        success: true,
        message: `Connected to ${data.team} as ${data.user}`,
        details: {
          teamId: data.team_id,
          team: data.team,
          userId: data.user_id,
          user: data.user,
        },
      };
    } else {
      return { success: false, message: data.error || 'Invalid Bot Token' };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test WhatsApp Business API connection
 */
export async function testWhatsAppConnection(config: Record<string, unknown>): Promise<TestResult> {
  const accessToken = config.accessToken as string;
  const phoneNumberId = config.phoneNumberId as string;

  if (!accessToken || !phoneNumberId) {
    return { success: false, message: 'Access Token and Phone Number ID are required' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `Connected to ${data.display_phone_number || phoneNumberId}`,
        details: {
          phoneNumberId: data.id,
          displayPhoneNumber: data.display_phone_number,
          verifiedName: data.verified_name,
        },
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'Invalid credentials' };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test Feishu/Lark connection
 */
export async function testFeishuConnection(config: Record<string, unknown>): Promise<TestResult> {
  const appId = config.appId as string;
  const appSecret = config.appSecret as string;

  if (!appId || !appSecret) {
    return { success: false, message: 'App ID and App Secret are required' };
  }

  try {
    // Get tenant access token
    const response = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret,
        }),
      }
    );

    const data = await response.json();

    if (data.code === 0) {
      return {
        success: true,
        message: 'Successfully authenticated with Feishu',
        details: {
          expire: data.expire,
        },
      };
    } else {
      return { success: false, message: data.msg || 'Invalid credentials' };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test Lark (International) connection
 */
export async function testLarkConnection(config: Record<string, unknown>): Promise<TestResult> {
  const appId = config.appId as string;
  const appSecret = config.appSecret as string;

  if (!appId || !appSecret) {
    return { success: false, message: 'App ID and App Secret are required' };
  }

  try {
    // Get tenant access token (Lark uses different domain)
    const response = await fetch(
      'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret,
        }),
      }
    );

    const data = await response.json();

    if (data.code === 0) {
      return {
        success: true,
        message: 'Successfully authenticated with Lark',
        details: {
          expire: data.expire,
        },
      };
    } else {
      return { success: false, message: data.msg || 'Invalid credentials' };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test iMessage connection (via BlueBubbles/AirMessage server)
 */
export async function testIMessageConnection(config: Record<string, unknown>): Promise<TestResult> {
  const serverUrl = config.serverUrl as string;
  const password = config.password as string;

  if (!serverUrl) {
    return { success: false, message: 'Server URL is required' };
  }

  try {
    const response = await fetch(`${serverUrl}/api/v1/server/info`, {
      headers: password ? {
        'Authorization': `Bearer ${password}`,
      } : {},
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Connected to iMessage server',
        details: {
          serverVersion: data.data?.server_version,
          osVersion: data.data?.os_version,
        },
      };
    } else {
      return { success: false, message: 'Failed to connect to iMessage server' };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test WeChat (Enterprise WeChat) connection
 */
export async function testWeChatConnection(config: Record<string, unknown>): Promise<TestResult> {
  const corpId = config.corpId as string;
  const corpSecret = config.corpSecret as string;

  if (!corpId || !corpSecret) {
    return { success: false, message: 'Corp ID and Corp Secret are required' };
  }

  try {
    const response = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`
    );

    const data = await response.json();

    if (data.errcode === 0) {
      return {
        success: true,
        message: 'Successfully authenticated with WeChat Work',
        details: {
          expiresIn: data.expires_in,
        },
      };
    } else {
      return { success: false, message: data.errmsg || 'Invalid credentials' };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test custom webhook connection
 */
export async function testCustomWebhookConnection(config: Record<string, unknown>): Promise<TestResult> {
  const webhookUrl = config.webhookUrl as string;

  if (!webhookUrl) {
    return { success: false, message: 'Webhook URL is required' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'test',
        message: 'OpenClaw connection test',
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Webhook endpoint is reachable',
        details: {
          status: response.status,
        },
      };
    } else {
      return { 
        success: false, 
        message: `Webhook returned status ${response.status}` 
      };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test channel connection based on channel type
 */
export async function testChannelConnection(
  channelType: string,
  config: Record<string, unknown>
): Promise<TestResult> {
  switch (channelType) {
    case 'telegram':
      return testTelegramConnection(config);
    case 'discord':
      return testDiscordConnection(config);
    case 'slack':
      return testSlackConnection(config);
    case 'whatsapp':
      return testWhatsAppConnection(config);
    case 'feishu':
      return testFeishuConnection(config);
    case 'lark':
      return testLarkConnection(config);
    case 'imessage':
      return testIMessageConnection(config);
    case 'wechat':
      return testWeChatConnection(config);
    case 'custom':
      return testCustomWebhookConnection(config);
    default:
      return { success: false, message: `Unknown channel type: ${channelType}` };
  }
}
