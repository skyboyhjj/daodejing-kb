# 慧惠聊天组件 · 部署文档

> **版本**：v2.2
> **日期**：2026-05-08
> **当前主部署平台**：Cloudflare Pages（自定义域名 `hui-skill.org` / 默认域名 `daodejing-skill.pages.dev`）
> **备用/历史部署**：Vercel（`huihui-skill.org`）

---

## 部署历史与当前架构

本项目在部署过程中经历了三个阶段的演进：

| 阶段                 | 平台             | 方式                 | 结果     | 说明                                                                                                                    |
| -------------------- | ---------------- | -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| **第一阶段**         | Cloudflare       | Workers              | 存在问题 | 使用 Cloudflare Workers 方式部署 API 代理，遇到 Workers 配置和路由问题，未能正常工作                                    |
| **第二阶段**         | Vercel           | Serverless Functions | 可用     | 切换到 Vercel，`api/chat.js` 作为 Serverless Function 成功代理 DeepSeek API，绑定域名 `huihui-skill.org`                |
| **第三阶段（当前）** | Cloudflare Pages | Pages Functions      | 正常运行 | 新建 `daodejing-kb` Pages 项目，`functions/api/chat.js` 代理 DeepSeek API，`https://daodejing-skill.pages.dev` 一切正常 |

**关键教训**：Cloudflare Workers 与 Cloudflare Pages Functions 是两种不同的产品。Workers 需要独立的路由配置和部署流程，在本项目中遇到了兼容性问题。而 Cloudflare Pages Functions（`functions/` 目录）是 Pages 平台原生的 serverless 能力，与静态站点共享同一域名和部署流程，配置更简单、运行更稳定。

### 当前双平台部署

```
                    ┌─────────────────────────┐
                    │    GitHub: daodejing-kb  │
                    └───────────┬─────────────┘
                                │ git push
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
   ┌──────────────────────┐         ┌──────────────────────────┐
   │   Cloudflare Pages    │         │         Vercel            │
   │                       │         │                          │
   │ 静态: 根目录           │         │ 静态: 根目录              │
   │ API: functions/api/   │         │ API: api/chat.js         │
   │      chat.js          │         │                          │
   │                       │         │                          │
   │ 🌐 hui-skill.org      │         │ 🌐 huihui-skill.org      │
   │    daodejing-skill    │         │                          │
   │    .pages.dev         │         │                          │
   └──────────────────────┘         └──────────────────────────┘
```

两个平台各自独立运行，共用同一套代码。前端 `API_URL = '/api/chat'`（相对路径）在两个平台上均指向各自的 Functions 端点，无需切换。

Cloudflare Pages 部署已绑定自定义域名 `hui-skill.org`，中国用户可通过此域名直接访问。

---

## 自定义域名配置（hui-skill.org）

### 为什么需要自定义域名？

- `pages.dev` 是 Cloudflare 的共享域名，可能在某些网络环境下受限
- 自定义域名更短、更好记，提升用户信任感
- 便于中国用户访问（独立域名比共享域名解析更稳定）

### 配置步骤

#### 1. Cloudflare Pages 中添加域名

```
Cloudflare Dashboard → Workers & Pages → daodejing-kb → Custom Domains
→ Set up a custom domain → 输入 hui-skill.org → Continue
```

#### 2. DNS 验证

`hui-skill.org` 的 DNS 托管在 Cloudflare（与 Pages 同账户），添加域名后：

Cloudflare 自动完成全部操作——验证所有权 → 添加 DNS 记录 → 签发 SSL 证书，全程 **2-5 分钟**。

#### 3. SSL 证书

Cloudflare Pages 自动签发免费 Universal SSL 证书：
- 添加域名后 **2-5 分钟**生效
- Custom Domains 页面显示 `Active` 即已就绪
- 访问 `https://hui-skill.org` 应显示 🔒

#### 4. 验证

```bash
# 首页
curl -s -o /dev/null -w "%{http_code}" https://hui-skill.org/
# 预期: 200

# API 端点
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://hui-skill.org/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"道"}],"level":"L2"}'
# 预期: 200
```

### 中国用户访问优化

| 措施                         | 说明                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| Cloudflare Proxy（橙色云朵） | 静态资源自动缓存至全球边缘节点（香港/新加坡）                    |
| 静态资源 CDN 缓存            | CSS、JS、HTML 被 Cloudflare 自动缓存，回访加速                   |
| 保留 `pages.dev` 备用        | 主域名 DNS 出问题时用户仍可通过 `daodejing-skill.pages.dev` 访问 |
| 无需备案                     | `.org` 域名无法在国内备案，通过 Cloudflare 境外节点直接访问      |

### 注意事项

- **DNS 传播需等待** 5-30 分钟，如果访问失败请稍等
- **SSL 证书自动签发**，不要手动安装证书
- **www 子域名**：添加 CNAME `www` → `hui-skill.org` + Cloudflare Redirect Rule 301 重定向
- **无需修改任何代码**：`API_URL = '/api/chat'` 相对路径自动适配新域名
- **与 huihui-skill.org 区分**：`hui-skill.org` 指向 Cloudflare Pages，`huihui-skill.org` 指向 Vercel，两个域名独立运行

Cloudflare Pages 部署已绑定自定义域名 `hui-skill.org`，中国用户可通过此域名直接访问。

---

## 一、技术架构

### 1.1 整体架构图

```
┌────────────────────────────────────────────────────────────────────┐
│                     huihui-skill.org (Vercel 托管)                   │
│                                                                      │
│  ┌──────────────────────────────────┐    ┌──────────────────────────┐│
│  │  前端：静态网站 (HTML/CSS/JS)      │    │  后端：Serverless Function ││
│  │                                  │    │                          ││
│  │  js/huihui-chat.js              │    │  api/chat.js             ││
│  │  ├── IIFE 包裹，全局作用域隔离     │───▶│  ├── CORS 全放通 (*)       ││
│  │  ├── 注入浮动按钮 + 聊天面板 DOM   │    │  ├── POST 方法处理          ││
│  │  ├── 匿名用户 ID (guest_xxx)      │    │  ├── 读取 DEEPSEEK_API_KEY ││
│  │  ├── L1-L4 层级按钮               │    │  │   从 Vercel 环境变量      ││
│  │  ├── fetch /api/chat (相对路径)   │    │  ├── buildSystemPrompt()   ││
│  │  ├── AbortController 10s 超时     │    │  └── 15s 超时转发          ││
│  │  └── CustomEvent 跨组件同步       │    │                          ││
│  │                                  │    └──────────┬───────────────┘│
│  │  css/huihui-chat.css            │               │                │
│  │  ├── CSS 变量：水墨道风配色        │               │                │
│  │  ├── 浮动按钮 + 面板 + 气泡        │               │                │
│  │  └── 响应式：≤480px / ≤360px      │               │                │
│  └──────────────────────────────────┘               │                │
│                                                      │                │
└──────────────────────────────────────────────────────┼────────────────┘
                                                       │
                                                       │ HTTPS
                                                       ▼
                                            ┌──────────────────────┐
                                            │    DeepSeek API       │
                                            │  api.deepseek.com     │
                                            │  /v1/chat/completions │
                                            │  model: deepseek-chat │
                                            └──────────────────────┘
```

### 1.2 为什么选择 Vercel？

| 方面         | Cloudflare Pages Functions                    | Vercel Serverless Functions      |
| ------------ | --------------------------------------------- | -------------------------------- |
| API Key 安全 | ✅ 环境变量不暴露前端                          | ✅ 环境变量不暴露前端             |
| 部署可靠度   | ❌ 实际部署中 Functions 不被识别，多次调试无效 | ✅ `vercel deploy` 即部署生效     |
| Git 自动部署 | ❌ GitHub webhook 失效，push 后不触发          | ✅ `vercel --prod` 手动触发，可靠 |
| 自定义域名   | 需额外配置 DNS                                | `vercel alias` 一键绑定          |
| 免费额度     | 有                                            | 有（充足）                       |

### 1.3 安全设计

- **API Key 机密性**：`DEEPSEEK_API_KEY` 仅存储在 Vercel 项目环境变量中，`api/chat.js` 通过 `process.env.DEEPSEEK_API_KEY` 读取，前端代码不可见
- **CORS**：设置 `Access-Control-Allow-Origin: *`，允许同域前端调用
- **超时保护**：前端 10s (`AbortController`)、后端 15s (`AbortSignal.timeout`)，防止请求悬挂
- **前端无 Token**：前端 JS 中不包含任何 API Key 或敏感凭证

### 1.4 数据流

```
用户输入问题
  → huihui-chat.js: sendMessage()
    → 收集对话历史 getMessages()（最多 20 条，跳过欢迎语）
    → 获取当前层级 getSavedLevel()（localStorage）
    → fetch POST /api/chat
      → api/chat.js: handler(req, res)
        → 提取 messages + level
        → buildSystemPrompt(level) 构建 System Prompt
        → fetch DeepSeek API
        → 返回 JSON { choices: [...] }
      ← DeepSeek 响应
    ← 服务器返回
  → huihui-chat.js: 解析 choices[0].message.content
    → addMessage('ai', content) 渲染 AI 气泡
```

---

## 二、文件结构

### 2.1 核心文件清单

| 文件路径               | 行数 | 用途                                      | 关键设计                                                        |
| ---------------------- | ---- | ----------------------------------------- | --------------------------------------------------------------- |
| `api/chat.js`          | 110  | Vercel Serverless Function，DeepSeek 代理 | ES Module export，环境变量读 Key，L1-L4 分层 Prompt             |
| `js/huihui-chat.js`    | 378  | 聊天组件前端 JS 逻辑                      | IIFE 包装，DOM 注入，Anonymous ID，AbortController，CustomEvent |
| `css/huihui-chat.css`  | 488  | 聊天组件样式                              | CSS 变量（水墨道风），浮动按钮 + 面板 + 气泡 + 层级栏，响应式   |
| `server.js`            | 269  | 本地开发服务器                            | Node.js HTTP，静态文件 + /api/chat 代理，.env 自动加载          |
| `.vercel/project.json` | —    | Vercel 项目配置                           | projectId + orgId，Vercel CLI 自动生成                          |

### 2.2 辅助文件清单

| 文件路径                                         | 用途                                          |
| ------------------------------------------------ | --------------------------------------------- |
| `docs/设计方案-定义用户认知水平（L1-L4）.md`     | L1-L4 模型设计 + 知识库分层方案               |
| `docs/慧惠聊天组件_完整设计书.md`                | 产品定位、慧惠人格、功能范围、后续演进        |
| `docs/慧惠聊天组件_接入方案_GA.md`               | GA 版接入方案（原 Cloudflare 方案，仅供参考） |
| `docs/慧惠聊天组件_认知水平分层按钮_执行规格.md` | 层级按钮 UI 规格                              |
| `道家AI伦理应用设计.md`                         | 道家设计原则（善行无辙迹、为道日损等）        |
| `docs/慧惠产品体验定义书v011.md`                 | 慧惠产品整体体验定义                          |

### 2.3 已删除的文件

| 原文件                  | 删除原因                                                |
| ----------------------- | ------------------------------------------------------- |
| `functions/api/chat.js` | Cloudflare Pages Functions 版，切换到 Vercel 后不再需要 |
| `functions/api/ping.js` | Cloudflare Pages Functions 测试端点，不再需要           |

### 2.4 文件关系图

```
api/chat.js ─────────────────────────────────────────────┐
  后端：接收请求 → 读环境变量 → buildSystemPrompt → DeepSeek   │
  部署于 Vercel Serverless Functions                        │
                                                           │
js/huihui-chat.js ────────────────────────────────────────┤
  前端：注入 DOM → 事件绑定 → fetch /api/chat → 渲染气泡      │
  与 api/chat.js 通过 HTTP POST 通信                        │
                                                           │
css/huihui-chat.css                                       │
  样式：水墨道风配色 → 按钮/面板/气泡/层级栏/响应式            │
                                                           │
server.js ────────────────────────────────────────────────┘
  本地开发：替代 Vercel，相同 buildSystemPrompt 逻辑
  node server.js → localhost:8080
```

---

## 三、部署步骤

### 3.1 前置条件

- Node.js 环境
- Vercel CLI 已安装 (`npm i -g vercel`)
- Vercel 账号已注册（`skyboyhjj`）
- DeepSeek API Key 已获取
- 域名 `huihui-skill.org` 的 DNS 管理权限（Cloudflare）

### 3.2 第一次部署

#### Step 1: Vercel 登录

```bash
vercel login
```

浏览器弹出 OAuth 授权页面 → 选择 GitHub 账号登录 → 授权成功。

验证登录状态：

```bash
vercel whoami
# → skyboyhjj
```

#### Step 2: 关联 Vercel 项目

```bash
cd daodejing-kb
vercel link
```

选择团队 → 创建或选择已有项目。完成后生成 `.vercel/project.json`：

```json
{
  "projectId": "prj_DVEqiGI9EVVJ0alImyXDXP9L2Z3l",
  "orgId": "team_AvPcpWYRMheafrkVD05CQoti"
}
```

#### Step 3: 配置环境变量并部署

```bash
vercel --prod --yes \
  -e DEEPSEEK_API_KEY=sk-<your-api-key>
```

说明：
- `--prod`：直接部署到生产环境
- `--yes`：跳过确认提示
- `-e KEY=VALUE`：运行时注入环境变量

> **注意**：首次部署后，`-e` 传入的环境变量可能不会持久化。需执行 Step 4 确保环境变量持久存储。

#### Step 4: 持久化环境变量

```bash
vercel env add DEEPSEEK_API_KEY production
# 粘贴 API Key 并回车
```

验证环境变量已配置：

```bash
vercel env ls
# → DEEPSEEK_API_KEY  Production  plaintext
```

配置后需重新部署使环境变量生效：

```bash
vercel --prod --yes
```

#### Step 5: 绑定自定义域名

```bash
vercel alias add <deployment-url> huihui-skill.org
```

或通过 Vercel Dashboard → Settings → Domains → Add `huihui-skill.org`。

#### Step 6: 配置 DNS

在 Cloudflare DNS 管理面板中：

1. **添加 A 记录**：
   - Name: `huihui-skill.org`（或 `@`）
   - IPv4 address: `76.76.21.21`（Vercel 任意播 IP）
   - Proxy status: **DNS only**（灰色云朵，不要开代理）

2. **删除所有 Worker 记录**（如果存在）：
   - 删除 `huihui-skill.org` 的 Worker route
   - 删除 `www.huihui-skill.org` 的 Worker route
   - Worker 记录会拦截流量，导致 HTTP 525 错误

3. **SSL/TLS 设置**：
   - 加密模式设为 **Full** 或 **Full (Strict)**

DNS 生效后，Vercel 会自动为 `huihui-skill.org` 签发 SSL 证书。

### 3.3 后续更新部署

```bash
# 本地修改代码后
git add . && git commit -m "描述你的改动"

# 部署到 Vercel
vercel --prod --yes

# 推送到 GitHub（备份）
git push
```

---

## 四、配置要点

### 4.1 环境变量

| 变量名             | 位置                                      | 说明                            |
| ------------------ | ----------------------------------------- | ------------------------------- |
| `DEEPSEEK_API_KEY` | Vercel Environment Variables (Production) | DeepSeek API 密钥，仅服务端可读 |
| `DEEPSEEK_API_KEY` | 本地 `.env` 文件                          | 本地开发用，server.js 自动加载  |

**安全规则**：
- `.env` 文件已加入 `.gitignore`，绝不提交到仓库
- API Key 格式：`sk-` 开头的 35 位字符串
- 在 Vercel 中设置为 **Production** 环境变量

### 4.2 CORS 配置

[api/chat.js](api/chat.js:7-9) 中设置：

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

- `OPTIONS` 预检请求返回 `204 No Content`
- 当前阶段无鉴权需求，Origin 设为 `*`

### 4.3 API_URL 配置

[js/huihui-chat.js](js/huihui-chat.js:10) 中：

```javascript
var API_URL = '/api/chat';
```

使用**相对路径**，因为在 Vercel 上前后端同域（`huihui-skill.org`）。无需指定完整 URL。

### 4.4 System Prompt 配置

System Prompt 在 [api/chat.js](api/chat.js:66-109) 的 `buildSystemPrompt(level)` 函数中定义，包含：

- **慧惠角色定义**：温柔、聪慧的数字生命
- **定位**：亲子体验营 AI 助手，面向家长和孩子
- **风格**：安静、轻盈、不做作
- **7 条回答原则**：简短有力、贴近生活、尊重原典、启发思考、轻盈温柔、善行无辙迹、为道日损
- **知识边界**：专注《道德经》81 章，不提供医疗/法律/投资建议
- **L1-L4 层级指导**：根据 `level` 参数动态追加层级相关指令

本地开发服务器 [server.js](server.js:39-82) 中有完全一致的 System Prompt 副本。

### 4.5 超时设置

| 层级 | 超时值 | 位置                                           | 说明                             |
| ---- | ------ | ---------------------------------------------- | -------------------------------- |
| 前端 | 10s    | [js/huihui-chat.js](js/huihui-chat.js:195-196) | `AbortController` + `setTimeout` |
| 后端 | 15s    | [api/chat.js](api/chat.js:44)                  | `AbortSignal.timeout(15000)`     |

两处均对 `AbortError` / `TimeoutError` 做了友好的错误提示。

### 4.6 匿名用户 ID

[js/huihui-chat.js](js/huihui-chat.js:14-18) 中：

```javascript
var userId = localStorage.getItem('huihui_uid');
if (!userId) {
    userId = 'guest_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    localStorage.setItem('huihui_uid', userId);
}
```

- 格式：`guest_` + base36 时间戳 + 5 位随机字符
- 持久化到 `localStorage`，同设备不丢失
- 随 API 请求发送 `user_id` 字段，为后续用户画像预留

### 4.7 对话历史

[js/huihui-chat.js](js/huihui-chat.js:335-354) 中 `getMessages()` 函数：

- 跳过第一条欢迎语（`WELCOME_TEXT`）
- 最多取最近 20 条气泡（10 轮问答）
- 每条消息包含 `{ role: "user"|"assistant", content: "..." }`

---

## 五、验证测试

### 5.1 首页可访问性测试

```bash
# HTTP 状态码应为 200
curl -s -o /dev/null -w "%{http_code}" https://huihui-skill.org/
# 预期输出: 200
```

### 5.2 API 端点测试

```bash
# 基础连通性测试
curl -X POST https://huihui-skill.org/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"什么是道？"}],"level":"L2"}'
```

**预期结果**：
- HTTP 状态码：200
- `Content-Type: application/json`
- 响应体包含 `choices[0].message.content` 字段
- 内容为慧惠风格的中文回答，涉及道德经相关概念

### 5.3 CORS 预检测试

```bash
curl -X OPTIONS https://huihui-skill.org/api/chat -v
```

**预期结果**：
- HTTP 状态码：204
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`

### 5.4 L1-L4 分层测试

依次测试四个认知层级：

```bash
# L1 初学者 — 应返回生活化比喻，避免术语
curl -X POST https://huihui-skill.org/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"道是什么？"}],"level":"L1"}'

# L3 实践者 — 应结合现实应用和深度分析
curl -X POST https://huihui-skill.org/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"道和无为有什么关系？"}],"level":"L3"}'
```

### 5.5 错误场景测试

```bash
# 空消息体
curl -X POST https://huihui-skill.org/api/chat \
  -H "Content-Type: application/json" \
  -d '{}'

# 非 POST 方法
curl -X GET https://huihui-skill.org/api/chat

# OPTIONS 预检
curl -X OPTIONS https://huihui-skill.org/api/chat
```

**预期结果**：
- GET /api/chat → 405 Method not allowed
- OPTIONS /api/chat → 204 No Content

### 5.6 本地开发测试

```bash
# 启动本地服务器
node server.js

# 测试本地 API
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"无为是什么意思？"}],"level":"L2"}'
```

### 5.7 浏览器端测试

1. 打开 `https://huihui-skill.org/`
2. 确认右下角出现 🌿 浮动按钮（初加载时带脉冲动画，3 秒后消失）
3. 点击按钮打开聊天面板
4. 界面元素检查：
   - 面板头部：🌿 慧惠 · 道德经 AI 助教
   - L1-L4 层级按钮栏：白话 | 精读 | 应用 | 学术
   - 欢迎语："你好呀！我是慧惠。关于《道德经》，有什么想聊的？"
   - 输入文本框 + 发送按钮
5. 发送一条测试消息，验证 AI 回复正常
6. 不同层级切换后，回复风格应有明显差异
7. 移动端测试：面板应全屏展开

### 5.8 测试清单

| 测试项         | 验证方式                             | 预期                           |
| -------------- | ------------------------------------ | ------------------------------ |
| 首页可访问     | `curl -I https://huihui-skill.org/`  | HTTP 200                       |
| API 端点可访问 | `curl -X POST ... /api/chat`         | HTTP 200 + JSON                |
| CORS 预检      | `curl -X OPTIONS ... /api/chat`      | HTTP 204                       |
| API Key 不暴露 | 查看页面源码 / Network 面板          | 无 `sk-` 前缀字符串            |
| L1 回复风格    | 浏览器发送消息                       | 生活化比喻，无术语             |
| L2 回复风格    | 浏览器发送消息                       | 概念解读，框架梳理             |
| L3 回复风格    | 浏览器发送消息                       | 现实应用，多角度分析           |
| L4 回复风格    | 浏览器发送消息                       | 学术视角，考据对比             |
| 浮动按钮可见   | 页面加载后                           | 右下角 🌿 按钮                  |
| 面板开关       | 点击按钮 / ✕ 按钮 / ESC / 点击面板外 | 面板正确开合                   |
| 消息发送       | 输入文字，点击发送或回车             | 气泡出现，AI 回复              |
| 层级按钮同步   | 聊天面板选层级 → 页面层级同步        | CustomEvent 双向同步           |
| 匿名 ID 持久化 | 刷新页面                             | `huihui_uid` localStorage 不变 |
| 超时处理       | 网络断开时发送消息                   | "请求超时" 错误提示            |
| 移动端响应     | 浏览器 DevTools 切换到 375px         | 面板全屏，安全区适配           |
| DNS 解析       | `dig huihui-skill.org`               | 返回 76.76.21.21               |
| SSL 证书       | 浏览器访问 https                     | 绿锁，无证书错误               |

---

## 六、用户认知水平分级（L1-L4）

### 6.1 分级模型

源自 [docs/设计方案-定义用户认知水平（L1-L4）.md](docs/设计方案-定义用户认知水平（L1-L4）.md:23-29)，定义四个认知深度层级：

| 等级   | 标签 | 用户画像                                           | 核心需求                               | AI 回答策略                                                     |
| ------ | ---- | -------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| **L1** | 白话 | 对道德经了解甚少，可能只是好奇或想初步接触         | 直观易懂的初步印象，避免畏难情绪       | 生活化比喻 & 核心结论。忽略次要概念，用现代生活中的例子解释     |
| **L2** | 精读 | 有一定了解，希望系统性学习核心概念和章句           | 理解基本概念、原文大意和核心思想       | 概念解读 & 框架梳理。讲解关键术语（道、德、无为），理清章节逻辑 |
| **L3** | 应用 | 熟悉文本，希望将哲学应用于实际生活、工作或个人修养 | 获得实践指导、案例分析和深度解读       | 现实应用 & 深度分析。结合管理学、心理学、个人成长等多角度阐释   |
| **L4** | 学术 | 学者、深度爱好者，追求学术性、批判性的视角         | 了解不同流派解读、版本差异、跨文化比较 | 学术视角 & 发散探讨。考据信息、对比译本、探讨哲学悖论           |

### 6.2 代码实现

在 [api/chat.js](api/chat.js:100-105) 的 `buildSystemPrompt(level)` 中：

```javascript
var LEVEL_GUIDANCE = {
    'L1': '当前用户是初学者。请用生活化比喻和核心结论来解释，忽略次要概念，避免使用专业术语。',
    'L2': '当前用户是学习者。请进行概念解读和框架梳理，讲解关键术语（如道、德、无为），理清章节逻辑。',
    'L3': '当前用户是实践者。请结合现实应用与深度分析，从管理学、心理学、个人成长等角度进行多角度阐释。',
    'L4': '当前用户是研究者。请提供学术视角与发散探讨，提供考据信息、对比不同译本、探讨哲学悖论。'
};
```

- 默认层级：L2（精读）
- `guidance` 字符串追加到 System Prompt 末尾，引导 DeepSeek 模型调整回答风格

### 6.3 前端 UI：层级按钮

在 [js/huihui-chat.js](js/huihui-chat.js:38-43) 中注入聊天面板的层级按钮栏：

```html
<div class="huihui-level-bar">
    <button class="huihui-level-btn" data-level="L1">白话</button>
    <button class="huihui-level-btn" data-level="L2">精读</button>
    <button class="huihui-level-btn" data-level="L3">应用</button>
    <button class="huihui-level-btn" data-level="L4">学术</button>
</div>
```

层级状态通过 `localStorage` 持久化：

| Key                          | 用途             |
| ---------------------------- | ---------------- |
| `huihui_taoism_level`        | 聊天面板当前层级 |
| `daodejing-level-preference` | 章节页面层级偏好 |

### 6.4 跨组件同步

[js/huihui-chat.js](js/huihui-chat.js:100-128) 中通过 `CustomEvent` 实现聊天面板与章节页面层级的双向同步：

```javascript
// 派发事件（通知章节页面）
window.dispatchEvent(new CustomEvent('huihui-level-changed', {
    detail: { level: currentLevel }
}));

// 监听事件（响应章节页面层级变更）
window.addEventListener('huihui-level-changed', function (e) {
    var newLevel = e.detail && e.detail.level;
    if (newLevel && newLevel !== 'ALL') {
        setSavedLevel(newLevel);
        highlightChatLevelBtn(newLevel);
    }
});
```

### 6.5 分层示例

以用户询问"什么是无为？"为例，不同层级的回答风格：

| 层级        | 回答风格示例                                                                                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1 白话** | "无为不是什么都不做。就像妈妈让孩子自己吃饭，不替他吃，但会在旁边看着。这就是'做该做的，不瞎折腾'。"                                                                                                 |
| **L2 精读** | "'无为'是老子的核心概念。它并非消极怠惰，而是'不妄为'——顺应事物本性，不以私欲干涉。第37章说'道常无为而无不为'，道从不有意作为，却成就一切。"                                                         |
| **L3 应用** | "在管理中，'无为'体现为建立机制而非微观控制。比如设定清晰目标和规则后，信任团队自主执行。谷歌的20%自由时间就是现代版'无为而治'——给予空间，而非放任。"                                                |
| **L4 学术** | "河上公将'无为'注为'不造设'，王弼注为'顺自然也'。郭店楚简中有'亡为'的写法，强化了'无意为之'的含义。与希腊斯多葛学派'顺其自然'相比，老子的'无为'更强调对事物内在规律（道）的遵循而非理性的自我约束。" |

---

## 附录 A：快速参考

### A.1 常用命令

```bash
# 部署到 Vercel 生产环境
vercel --prod --yes

# 查看部署状态
vercel inspect <deployment-url>

# 查看环境变量
vercel env ls

# 查看域名
vercel domains ls

# 本地开发
node server.js
```

### A.2 当前部署信息

| 项目                   | 值                                                             |
| ---------------------- | -------------------------------------------------------------- |
| **主域名（CF Pages）** | `https://hui-skill.org`                                        |
| CF Pages 默认域名      | `https://daodejing-skill.pages.dev`                            |
| Vercel 自定义域名      | `https://huihui-skill.org`                                     |
| Vercel 默认域名        | `https://daodejing-kb.vercel.app`                              |
| Vercel Project ID      | `prj_DVEqiGI9EVVJ0alImyXDXP9L2Z3l`                             |
| Vercel Org ID          | `team_AvPcpWYRMheafrkVD05CQoti`                                |
| Vercel 账号            | `skyboyhjj`                                                    |
| CF Pages DNS           | CNAME `hui-skill.org` → `daodejing-skill.pages.dev`（Proxied） |
| Vercel DNS             | A → 76.76.21.21（DNS only，Cloudflare）                        |
| 环境变量               | `DEEPSEEK_API_KEY`（CF Pages + Vercel 分别配置）               |

### A.3 故障排查

| 问题                            | 原因                                   | 解决                                                                   |
| ------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| 浏览器 "Failed to fetch"        | 前端 JS 缓存了旧版本                   | Ctrl+Shift+R 强制刷新                                                  |
| API 返回 500 + "环境变量未配置" | `DEEPSEEK_API_KEY` 未配置              | CF Pages Dashboard → Settings → Environment Variables → 添加后重新部署 |
| HTTP 525 (SSL Handshake Failed) | Worker 记录拦截流量（Vercel 历史问题） | 删除 DNS 中所有 Worker 记录                                            |
| 自定义域名 SSL 证书未生效       | 刚添加域名，证书签发中                 | 等待 2-5 分钟，刷新 Custom Domains 页面                                |
| 自定义域名无法访问              | DNS 传播未完成                         | 等待 5-30 分钟，或检查 CNAME 记录是否正确                              |
| 首页无聊天按钮                  | `huihui-chat.js` 加载失败              | 检查浏览器 Network 面板，确认 JS/CSS 文件 200                          |
| Vercel CLI 登录失败             | OAuth token 过期                       | `vercel logout` → `vercel login` 重新认证                              |
| Git push 不触发 CF Pages 部署   | GitHub webhook 失效                    | CF Pages Dashboard → 重新连接 GitHub 仓库                              |

---

## 附录 B：设计原则参考

慧惠聊天组件的设计依据以下四项道家原则（详见 [道家AI伦理应用设计.md](道家AI伦理应用设计.md)）：

| 原则           | 出处      | 产品体现                                         |
| -------------- | --------- | ------------------------------------------------ |
| **善行无辙迹** | 第27章    | 帮助不留痕迹，不刷存在感，回答简洁不罗列步骤     |
| **为道日损**   | 第48章    | 敢于帮用户做减法，复杂问题引导到最简单的起点     |
| **不愤不启**   | 第7章引申 | 不主动说教，用户简单问则简单答，深度问则深度回应 |
| **绝巧弃利**   | 第19章    | 不炫技、不卖弄知识量，不用晦涩术语               |
