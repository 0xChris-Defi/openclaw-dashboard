/**
 * AI Model provider connection testers
 */

interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
  models?: Array<{
    id: string;
    name: string;
    contextLength?: number;
  }>;
}

/**
 * Test OpenAI connection
 */
export async function testOpenAIConnection(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.apiKey as string;
  const baseUrl = (config.baseUrl as string) || 'https://api.openai.com/v1';

  if (!apiKey) {
    return { success: false, message: 'API Key is required' };
  }

  const startTime = Date.now();

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const models = data.data
        ?.filter((m: any) => m.id.includes('gpt'))
        ?.map((m: any) => ({
          id: m.id,
          name: m.id,
        }))
        ?.slice(0, 20);

      return {
        success: true,
        message: `Connected! Found ${data.data?.length || 0} models`,
        latency,
        models,
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'Invalid API Key', latency };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test Anthropic connection
 */
export async function testAnthropicConnection(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.apiKey as string;
  const baseUrl = (config.baseUrl as string) || 'https://api.anthropic.com';

  if (!apiKey) {
    return { success: false, message: 'API Key is required' };
  }

  const startTime = Date.now();

  try {
    // Anthropic doesn't have a models endpoint, so we send a minimal request
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    const latency = Date.now() - startTime;

    if (response.ok || response.status === 400) {
      // 400 might be rate limit but key is valid
      const models = [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextLength: 200000 },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextLength: 200000 },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextLength: 200000 },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', contextLength: 200000 },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', contextLength: 200000 },
      ];

      return {
        success: true,
        message: 'API Key is valid',
        latency,
        models,
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'Invalid API Key', latency };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test OpenRouter connection
 */
export async function testOpenRouterConnection(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.apiKey as string;

  if (!apiKey) {
    return { success: false, message: 'API Key is required' };
  }

  const startTime = Date.now();

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const models = data.data
        ?.slice(0, 50)
        ?.map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          contextLength: m.context_length,
        }));

      return {
        success: true,
        message: `Connected! Found ${data.data?.length || 0} models`,
        latency,
        models,
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'Invalid API Key', latency };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test Google Gemini connection
 */
export async function testGeminiConnection(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.apiKey as string;

  if (!apiKey) {
    return { success: false, message: 'API Key is required' };
  }

  const startTime = Date.now();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const models = data.models
        ?.filter((m: any) => m.name.includes('gemini'))
        ?.map((m: any) => ({
          id: m.name.replace('models/', ''),
          name: m.displayName || m.name,
          contextLength: m.inputTokenLimit,
        }))
        ?.slice(0, 20);

      return {
        success: true,
        message: `Connected! Found ${models?.length || 0} Gemini models`,
        latency,
        models,
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'Invalid API Key', latency };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test MiniMax connection
 */
export async function testMiniMaxConnection(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.apiKey as string;
  const groupId = config.groupId as string;

  if (!apiKey || !groupId) {
    return { success: false, message: 'API Key and Group ID are required' };
  }

  const startTime = Date.now();

  try {
    const response = await fetch(
      `https://api.minimax.chat/v1/text/chatcompletion_v2?GroupId=${groupId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'abab6.5s-chat',
          messages: [{ sender_type: 'USER', text: 'Hi' }],
          max_tokens: 1,
        }),
      }
    );

    const latency = Date.now() - startTime;

    if (response.ok) {
      const models = [
        { id: 'abab6.5s-chat', name: 'ABAB 6.5s Chat', contextLength: 245760 },
        { id: 'abab6.5g-chat', name: 'ABAB 6.5g Chat', contextLength: 8192 },
        { id: 'abab6.5t-chat', name: 'ABAB 6.5t Chat', contextLength: 8192 },
        { id: 'abab5.5s-chat', name: 'ABAB 5.5s Chat', contextLength: 16384 },
      ];

      return {
        success: true,
        message: 'API Key is valid',
        latency,
        models,
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.base_resp?.status_msg || 'Invalid credentials', latency };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test DeepSeek connection
 */
export async function testDeepSeekConnection(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.apiKey as string;
  const baseUrl = (config.baseUrl as string) || 'https://api.deepseek.com';

  if (!apiKey) {
    return { success: false, message: 'API Key is required' };
  }

  const startTime = Date.now();

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const models = data.data?.map((m: any) => ({
        id: m.id,
        name: m.id,
      })) || [
        { id: 'deepseek-chat', name: 'DeepSeek Chat', contextLength: 64000 },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', contextLength: 64000 },
      ];

      return {
        success: true,
        message: `Connected! Found ${models.length} models`,
        latency,
        models,
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'Invalid API Key', latency };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test Moonshot (Kimi) connection
 */
export async function testMoonshotConnection(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.apiKey as string;

  if (!apiKey) {
    return { success: false, message: 'API Key is required' };
  }

  const startTime = Date.now();

  try {
    const response = await fetch('https://api.moonshot.cn/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const models = data.data?.map((m: any) => ({
        id: m.id,
        name: m.id,
      })) || [
        { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K', contextLength: 8000 },
        { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K', contextLength: 32000 },
        { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', contextLength: 128000 },
      ];

      return {
        success: true,
        message: `Connected! Found ${models.length} models`,
        latency,
        models,
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'Invalid API Key', latency };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test Zhipu AI connection
 */
export async function testZhipuConnection(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.apiKey as string;

  if (!apiKey) {
    return { success: false, message: 'API Key is required' };
  }

  const startTime = Date.now();

  try {
    // Zhipu uses JWT-style API key
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
    });

    const latency = Date.now() - startTime;

    if (response.ok || response.status === 400) {
      const models = [
        { id: 'glm-4-plus', name: 'GLM-4 Plus', contextLength: 128000 },
        { id: 'glm-4-0520', name: 'GLM-4', contextLength: 128000 },
        { id: 'glm-4-air', name: 'GLM-4 Air', contextLength: 128000 },
        { id: 'glm-4-airx', name: 'GLM-4 AirX', contextLength: 8000 },
        { id: 'glm-4-flash', name: 'GLM-4 Flash', contextLength: 128000 },
        { id: 'glm-4v-plus', name: 'GLM-4V Plus (Vision)', contextLength: 8000 },
      ];

      return {
        success: true,
        message: 'API Key is valid',
        latency,
        models,
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'Invalid API Key', latency };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test Baichuan connection
 */
export async function testBaichuanConnection(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.apiKey as string;

  if (!apiKey) {
    return { success: false, message: 'API Key is required' };
  }

  const startTime = Date.now();

  try {
    const response = await fetch('https://api.baichuan-ai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Baichuan4',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
    });

    const latency = Date.now() - startTime;

    if (response.ok || response.status === 400) {
      const models = [
        { id: 'Baichuan4', name: 'Baichuan 4', contextLength: 32000 },
        { id: 'Baichuan3-Turbo', name: 'Baichuan 3 Turbo', contextLength: 32000 },
        { id: 'Baichuan3-Turbo-128k', name: 'Baichuan 3 Turbo 128K', contextLength: 128000 },
        { id: 'Baichuan2-Turbo', name: 'Baichuan 2 Turbo', contextLength: 32000 },
      ];

      return {
        success: true,
        message: 'API Key is valid',
        latency,
        models,
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'Invalid API Key', latency };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test Qwen (Tongyi Qianwen) connection
 */
export async function testQwenConnection(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.apiKey as string;

  if (!apiKey) {
    return { success: false, message: 'API Key is required' };
  }

  const startTime = Date.now();

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
    });

    const latency = Date.now() - startTime;

    if (response.ok || response.status === 400) {
      const models = [
        { id: 'qwen-max', name: 'Qwen Max', contextLength: 32000 },
        { id: 'qwen-max-longcontext', name: 'Qwen Max Long', contextLength: 30000 },
        { id: 'qwen-plus', name: 'Qwen Plus', contextLength: 131072 },
        { id: 'qwen-turbo', name: 'Qwen Turbo', contextLength: 131072 },
        { id: 'qwen-vl-max', name: 'Qwen VL Max (Vision)', contextLength: 32000 },
      ];

      return {
        success: true,
        message: 'API Key is valid',
        latency,
        models,
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.error?.message || 'Invalid API Key', latency };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test custom OpenAI-compatible API connection
 */
export async function testCustomAPIConnection(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.apiKey as string;
  const baseUrl = config.baseUrl as string;

  if (!baseUrl) {
    return { success: false, message: 'Base URL is required' };
  }

  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/models`, { headers });

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const models = data.data?.map((m: any) => ({
        id: m.id,
        name: m.id,
      }))?.slice(0, 30);

      return {
        success: true,
        message: `Connected! Found ${data.data?.length || 0} models`,
        latency,
        models,
      };
    } else {
      return { success: false, message: `Server returned status ${response.status}`, latency };
    }
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * Test model provider connection based on provider type
 */
export async function testModelConnection(
  provider: string,
  config: Record<string, unknown>
): Promise<TestResult> {
  switch (provider) {
    case 'openai':
      return testOpenAIConnection(config);
    case 'anthropic':
      return testAnthropicConnection(config);
    case 'openrouter':
      return testOpenRouterConnection(config);
    case 'google':
      return testGeminiConnection(config);
    case 'minimax':
      return testMiniMaxConnection(config);
    case 'deepseek':
      return testDeepSeekConnection(config);
    case 'moonshot':
      return testMoonshotConnection(config);
    case 'zhipu':
      return testZhipuConnection(config);
    case 'baichuan':
      return testBaichuanConnection(config);
    case 'qwen':
      return testQwenConnection(config);
    case 'custom':
      return testCustomAPIConnection(config);
    default:
      return { success: false, message: `Unknown provider: ${provider}` };
  }
}
