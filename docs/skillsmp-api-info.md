# SkillsMP API 信息

## 概述
- 网站: https://skillsmp.com
- Skills 总数: 121,142+
- 支持: Claude Code, OpenAI Codex CLI, ChatGPT

## API 端点

### 1. 关键词搜索
```
GET /api/v1/skills/search
```
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| q | string | ✓ | 搜索关键词 |
| page | number | - | 页码 (默认: 1) |
| limit | number | - | 每页数量 (默认: 20, 最大: 100) |
| sortBy | string | - | 排序: stars \| recent |

### 2. AI 语义搜索
```
GET /api/v1/skills/ai-search
```
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| q | string | ✓ | AI 搜索查询 |

## 认证
需要 API Key，通过 Header 传递：
```
Authorization: Bearer sk_live_your_api_key
```

## 示例
```bash
# 关键词搜索
curl -X GET "https://skillsmp.com/api/v1/skills/search?q=SEO" \
  -H "Authorization: Bearer sk_live_your_api_key"

# AI 语义搜索
curl -X GET "https://skillsmp.com/api/v1/skills/ai-search?q=How+to+create+a+web+scraper" \
  -H "Authorization: Bearer sk_live_your_api_key"
```

## 分类
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

## Skill 安装位置
- Claude Code: ~/.claude/skills/ (个人) 或 .claude/skills/ (项目)
- OpenAI Codex CLI: ~/.codex/skills/
- OpenClaw: ~/.openclaw/workspace/skills/
