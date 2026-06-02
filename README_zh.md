# Gemini-web2api

通过浏览器自动化访问 Gemini Web，并对外暴露 Gemini API / OpenAI API 兼容接口。配合 [AIStudioToAPI](https://github.com/iBUHub/AIStudioToAPI) 的 auth 文件实现免登录。

## 项目简介

Gemini-web2api 使用 Playwright 浏览器自动化访问 Gemini Web 网页版（`https://gemini.google.com/app`），并对外提供兼容 Gemini API 和 OpenAI API 的 HTTP 接口。

通过复用 AIStudioToAPI 生成的 `auth-N.json` 文件（包含 Google 账号 cookies 的 Playwright `storageState`），实现免登录直接调用。

## 快速开始

### 环境要求

- Node.js 20+
- AIStudioToAPI 生成的有效 `auth-N.json` 文件

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/your-org/gemini-web2api.git
cd gemini-web2api

# 安装依赖
npm install

# 复制并编辑环境配置
cp .env.example .env

# 确保 auth 文件存在
mkdir -p auth
# 将 AIStudioToAPI 的 auth-0.json 放在此目录

# 启动服务
npm start
```

### Docker 部署（与 AIStudioToAPI 联动）

```bash
# 创建部署目录
mkdir deploy && cd deploy

# 复制 compose 文件
cp docker-compose.example.yml docker-compose.yml

# 创建必要目录
mkdir -p auth aistudio-data gemini-web2api-data

# 启动两个服务
docker compose up -d --build

# 访问地址：
# AIStudioToAPI:  http://localhost:7860
# Gemini-web2api: http://localhost:7870
```

## API 接口

### 健康检查（无需鉴权）

```bash
curl http://localhost:7870/health
```

响应示例：

```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-06-01T00:00:00.000Z",
  "authCount": 2,
  "rotationCount": 1,
  "browserStarted": true
}
```

### 模型列表（Gemini 格式）

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:7870/v1beta/models
```

### 生成内容（Gemini 格式）

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:7870/v1beta/models/gemini-3.1-flash-lite:generateContent \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          { "text": "用一句话介绍一下自己。" }
        ]
      }
    ],
    "systemInstruction": {
      "parts": [
        { "text": "你是一个简洁的助手。" }
      ]
    },
    "generationConfig": {
      "temperature": 0.7,
      "maxOutputTokens": 1024
    }
  }'
```

### 聊天补全（OpenAI 格式）

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:7870/v1/chat/completions \
  -d '{
    "model": "gemini-3.1-flash-lite",
    "messages": [
      { "role": "system", "content": "你是一个简洁的助手。" },
      { "role": "user", "content": "你好，介绍一下自己。" }
    ],
    "temperature": 0.7,
    "max_tokens": 1024,
    "stream": false
  }'
```

## 配置说明

完整配置项请参考 `.env.example`。

| 环境变量                  | 默认值                        | 说明                                                            |
| ------------------------- | ----------------------------- | --------------------------------------------------------------- |
| `PORT`                    | 7870                          | 服务端口                                                        |
| `HOST`                    | 0.0.0.0                       | 监听地址                                                        |
| `API_KEYS`                | 123456                        | API 密钥，多个用逗号分隔                                        |
| `AUTH_MODE`               | file                          | 认证模式，MVP 仅支持 `file`                                     |
| `AUTH_DIR`                | /app/configs/auth             | auth 文件目录                                                   |
| `ENABLE_AUTH_UPDATE`      | false                         | 是否允许写回 auth 文件                                          |
| `GEMINI_WEB_URL`          | https://gemini.google.com/app | Gemini Web 地址                                                 |
| `BROWSER_ENGINE`          | chromium                      | 浏览器运行时引擎（`chromium` 或 `firefox`）                     |
| `BROWSER_HEADLESS`        | true                          | 是否无头模式运行浏览器                                          |
| `BROWSER_EXECUTABLE_PATH` | （空）                        | 自定义浏览器路径                                                |
| `BROWSER_USER_AGENT`      | （空）                        | 可选浏览器 User-Agent 覆盖                                      |
| `BROWSER_VIEWPORT`        | （空）                        | 可选视口尺寸，例如 `1920x1080`                                  |
| `BROWSER_PROXY`           | （空）                        | 可选 Playwright 代理服务器                                      |
| `BROWSER_INIT_SCRIPT`     | （空）                        | 可选页面脚本前置注入脚本                                        |
| `AUTH_STATE_WAIT_MS`      | 10000                         | auth 调试读取页面状态前的等待时间                               |
| `AUTH_STATE_POLL_MS`      | 500                           | auth 状态检查轮询间隔                                           |
| `MAX_CONTEXTS`            | 1                             | 最大浏览器上下文数                                              |
| `MAX_RETRIES`             | 2                             | 最大重试次数                                                    |
| `RETRY_DELAY_MS`          | 1500                          | 重试间隔（毫秒）                                                |
| `REQUEST_TIMEOUT_MS`      | 120000                        | 请求超时（毫秒）                                                |
| `DEFAULT_MODEL`           | gemini-3.1-flash-lite         | 未传模型时使用的默认模型                                        |
| `MODELS`                  | 内置模型列表                  | 可用模型列表，格式：`id:web页面模型标签:显示名`，多个用逗号分隔 |
| `LOG_LEVEL`               | info                          | 日志级别（error/warn/info/debug）                               |

### 模型切换

默认暴露以下模型：

- `gemini-3.1-flash-lite`
- `gemini-3.5-flash`
- `gemini-3.1-pro-preview`

Gemini/OpenAI 请求中的模型名会被解析为内部模型 ID，并在 Gemini Web 页面尝试切换到对应模型。当前支持的思考等级为 `standard`（标准）和 `extended`（扩展），可通过 Gemini `generationConfig.thinkingLevel` / `thinking_level` 或 OpenAI `thinking_level` / `reasoning_effort` 传入。由于 Gemini Web DOM 可能变化，如果页面模型菜单或思考等级菜单无法识别，服务会记录 warn 日志并继续使用页面当前设置。

可用 `MODELS` 自定义列表，例如：

```bash
MODELS="gemini-3.1-flash-lite:3.1 Flash-Lite:Gemini 3.1 Flash-Lite,gemini-3.5-flash:3.5 Flash:Gemini 3.5 Flash,gemini-3.1-pro-preview:3.1 Pro:Gemini 3.1 Pro Preview"
DEFAULT_MODEL=gemini-3.1-flash-lite
```

## Web 管理面板

访问 `http://localhost:7870/ui` 打开管理面板（无需 API Key）。该面板面向本地或可信网络运维使用；不要将其直接暴露到公网，因为页面会显示账号运行状态、失败原因、调试文件路径等诊断信息。

功能包括：

- **仪表盘** — 系统运行时间、浏览器状态、账号统计
- **账号管理** — 查看所有 auth 文件状态（正常/过期/重复/轮换中）
- **在线测试** — 直接在页面上测试 generateContent 接口
- **实时日志** — 查看服务端日志（自动刷新）
- **配置查看** — 展示当前运行配置

## 架构设计

```
Route → Adapter → RequestHandler → BrowserPool → GeminiPageController
```

| 层                       | 职责                                     |
| ------------------------ | ---------------------------------------- |
| **Route**                | HTTP 请求入口，参数校验                  |
| **Adapter**              | API 格式转换（Gemini/OpenAI ↔ 内部格式） |
| **RequestHandler**       | 请求编排、重试、账号轮换、错误映射       |
| **BrowserPool**          | 浏览器生命周期、账号上下文管理           |
| **GeminiPageController** | Gemini Web 页面操作和 DOM 选择器         |

### 与 AIStudioToAPI 的关系

```
AIStudioToAPI 写入/维护 ./auth/auth-N.json
        ↓ (共享 volume)
Gemini-web2api 只读挂载 ./auth
        ↓
AuthSource 扫描 auth 文件
        ↓
BrowserPool 使用 storageState 创建浏览器上下文
        ↓
GeminiPageController 操作 Gemini Web 页面
```

- AIStudioToAPI 负责账号登录和 auth 文件维护
- Gemini-web2api 只读使用 auth 文件，不修改
- 两个服务通过 Docker Compose 共享 auth volume

## MVP 功能范围

### 已实现

- ✅ Gemini API 兼容接口（`/v1beta/models`、`generateContent`）
- ✅ OpenAI API 兼容接口（`/v1/chat/completions`）
- ✅ API Key 鉴权（Bearer token 和 query key）
- ✅ auth 文件扫描、去重、过期检测
- ✅ 浏览器自动化与页面控制
- ✅ 请求重试与账号轮换
- ✅ 错误映射（Gemini/OpenAI 格式）
- ✅ Docker 部署支持
- ✅ Web 管理面板（仪表盘、账号管理、在线测试、实时日志、配置/调试）
- ✅ 完整单元测试（37 个测试用例）

### 未实现（后续版本）

- ❌ Streaming SSE 流式响应
- ❌ Anthropic Claude API 兼容
- ❌ Tool/Function Calling
- ❌ 图片输入/输出
- ❌ TTS 语音合成
- ❌ Embeddings 向量接口
- ❌ Token 计数
- ❌ VNC 登录
- ❌ HTTP auth 同步

## 调试提示

Gemini Web 的 DOM 选择器是最容易变化的部分。如需调试：

1. 所有选择器集中在 `src/browser/selectors.js`
2. 所有页面操作集中在 `src/browser/GeminiPageController.js`
3. 使用 `BROWSER_HEADLESS=false` 启动可以看到浏览器界面
4. 使用 `LOG_LEVEL=debug` 查看详细日志

## 调试 auth 登录

可以使用本地 Playwright auth 调试器验证某个 auth 文件能否在当前浏览器运行时下打开 Gemini Web：

```bash
AUTH_DIR=./configs/auth LOG_LEVEL=debug npm run debug:auth -- --auth-index 0
```

复用 AIStudioToAPI/Camoufox 生成的 auth 文件时，可尝试这些对齐配置：

```bash
BROWSER_ENGINE=firefox
BROWSER_EXECUTABLE_PATH=/path/to/camoufox
BROWSER_VIEWPORT=1920x1080
```

调试器会输出安全的 auth 摘要和页面诊断，不会输出 cookie 值。

## 许可证

GPLv3
