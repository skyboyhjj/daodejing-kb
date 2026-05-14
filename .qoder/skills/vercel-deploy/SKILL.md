---
name: vercel-deploy
description: Vercel 生产部署与运维 Skill。用于将 daodejing-kb 项目部署到 Vercel 平台（备用域名 huihui-skill.org），包含完整的前置检查、环境变量配置、Serverless Function 部署、DNS/SSL 验证、以及部署后全量测试清单。当用户需要部署到 Vercel、更新生产环境、排查部署问题、或执行部署后验证时使用本 Skill。
---

# Vercel 生产部署与运维

将 daodejing-kb 项目部署到 Vercel 平台，绑定自定义域名 `huihui-skill.org`，并执行完整的部署后验证。

## 1. 部署架构

### 1.1 双平台架构

项目同时部署在两个独立平台上，共用同一代码库：

```
                    GitHub: skyboyhjj/daodejing-kb
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
   ┌──────────────────────┐         ┌──────────────────────────┐
   │   Cloudflare Pages    │         │         Vercel            │
   │   hui-skill.org       │         │   huihui-skill.org       │
   │                       │         │                          │
   │  API: functions/api/  │         │  API: api/chat.js        │
   │       chat.js         │         │       api/family_chat.js │
   └──────────────────────┘         └──────────────────────────┘
```

**关键设计：**
- 前端 `API_URL = '/api/chat'`（相对路径），在两个平台上均自动指向各自的 Functions 端点，无需切换
- `api/_shared/system-prompt.js` 是 System Prompt 唯一规范来源，两个平台共用
- 环境变量各自独立配置（Cloudflare Pages 和 Vercel 分别设置 `DEEPSEEK_API_KEY`）
- 修改互不干扰：修改 CF 代码不影响 Vercel，反之亦然

### 1.2 Vercel 侧技术栈

| 层         | 技术                         | 说明                                 |
| ---------- | ---------------------------- | ------------------------------------ |
| 静态托管   | Vercel Static                | HTML/CSS/JS 从根目录服务             |
| API 后端   | Vercel Serverless Functions  | `api/chat.js` + `api/family_chat.js` |
| 共享模块   | `api/_shared/`               | system-prompt.js, feedback-email.js  |
| 运行时     | Node.js (ESM)                | Vercel 自动编译 ESM → CJS            |
| 密钥管理   | Vercel Environment Variables | `DEEPSEEK_API_KEY` 仅服务端可读      |
| 自定义域名 | `huihui-skill.org`           | DNS A 记录 → 76.76.21.21             |

### 1.3 安全设计

- **API Key 机密性**：`DEEPSEEK_API_KEY` 仅存储在 Vercel 环境变量中，`api/chat.js` 通过 `process.env.DEEPSEEK_API_KEY` 读取
- **CORS**：`Access-Control-Allow-Origin: *`，允许所有来源调用（当前阶段无鉴权）
- **超时保护**：前端 10s (`AbortController`)、后端 15s (`AbortSignal.timeout`)
- **前端无 Token**：JS 源代码中不包含任何 API Key 或敏感凭证
- **.env 不入库**：`.env` 已在 `.gitignore` 中排除

### 1.4 Vercel 项目信息

| 配置项      | 值                                 |
| ----------- | ---------------------------------- |
| 项目名称    | `daodejing-kb`                     |
| Project ID  | `prj_DVEqiGI9EVVJ0alImyXDXP9L2Z3l` |
| Org ID      | `team_AvPcpWYRMheafrkVD05CQoti`    |
| Vercel 账号 | `skyboyhjj`                        |
| 生产域名    | `https://huihui-skill.org`         |
| 默认域名    | `https://daodejing-kb.vercel.app`  |

---

## 2. 完整部署步骤

### 2.1 前置条件检查

在开始部署前，逐项确认：

| #   | 检查项              | 验证命令                    | 预期                      |
| --- | ------------------- | --------------------------- | ------------------------- |
| 1   | Node.js 已安装      | `node --version`            | ≥ 16.0.0                  |
| 2   | Vercel CLI 已安装   | `vercel --version`          | ≥ 50.0.0                  |
| 3   | Vercel 已登录       | `vercel whoami`             | `skyboyhjj`               |
| 4   | 项目已关联          | 检查 `.vercel/project.json` | projectId 正确            |
| 5   | 本地代码已提交      | `git status`                | working tree clean        |
| 6   | `.env` 包含有效 Key | `type .env`                 | `DEEPSEEK_API_KEY=sk-...` |
| 7   | DNS 管理权限        | Cloudflare Dashboard        | 可编辑 huihui-skill.org   |

### 2.2 Vercel CLI 安装与登录

```bash
# 安装（如未安装）
npm i -g vercel@latest

# 登录
vercel login
# 浏览器弹出 OAuth → 选择 GitHub 账号授权

# 验证
vercel whoami
# → skyboyhjj
```

> **已知问题**：如果 Vercel 账号 Display Name 包含非 ASCII 字符（如中文），`vercel login` 会报错 `TypeError: ... is not a legal HTTP header value`。此时必须使用 `--token` 方式认证（见 [6.6 故障排除](#66-vercel-cli-登录报错-unicode-用户名)）。

### 2.3 项目关联

确认 `.vercel/project.json` 存在且内容正确：

```json
{
  "projectId": "prj_DVEqiGI9EVVJ0alImyXDXP9L2Z3l",
  "orgId": "team_AvPcpWYRMheafrkVD05CQoti",
  "projectName": "daodejing-kb"
}
```

如文件丢失，重新关联：

```bash
vercel link
# 选择团队 → 选择 daodejing-kb 项目
```

### 2.4 环境变量配置

**必需变量：**

| 变量名             | 位置                                                             | 说明                            |
| ------------------ | ---------------------------------------------------------------- | ------------------------------- |
| `DEEPSEEK_API_KEY` | Vercel Dashboard → Settings → Environment Variables → Production | DeepSeek API 密钥（`sk-` 开头） |
| `ADMIN_TOKEN`      | 同上                                                             | 元数据审核管理端认证 Token      |
| `RESEND_API_KEY`   | 同上（可选）                                                     | 反馈邮件发送（Resend API）      |

**通过 CLI 配置：**

```bash
# 查看现有环境变量
vercel env ls

# 添加/更新（会提示输入值）
vercel env add DEEPSEEK_API_KEY production
vercel env add ADMIN_TOKEN production
vercel env add RESEND_API_KEY production
```

> **注意**：环境变量修改后必须重新部署才能生效。

### 2.5 执行部署

#### 方式 A：使用 Token 部署（推荐，适用于非交互环境）

```bash
# 从 https://vercel.com/account/tokens 获取 Token
vercel --prod --yes --token <TOKEN>
```

#### 方式 B：交互式部署

```bash
vercel --prod --yes
```

**部署过程自动完成：**
1. 检测 `api/chat.js`、`api/family_chat.js` 为 Serverless Functions
2. 打包 `api/_shared/` 作为共享依赖
3. 静态文件（HTML/CSS/JS）从根目录服务
4. 生成唯一部署 URL：`daodejing-kb-xxxxxxxxx.vercel.app`
5. 自动绑定自定义域名 `huihui-skill.org`

**部署耗时**：约 50-60 秒（上传 + 构建 + 发布）

### 2.6 部署后立即验证

```bash
# 验证首页
curl -s -o /dev/null -w "%{http_code}" https://huihui-skill.org/
# → 200

# 验证 API
curl -X POST https://huihui-skill.org/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}],"level":"L2"}'
# → 200 + JSON (包含 choices[0].message.content)
```

---

## 3. 配置要点

### 3.1 CORS 配置

`api/chat.js` 中设置：

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

- `OPTIONS` 预检返回 `204 No Content`
- 当前阶段无鉴权，Origin 设为 `*`

### 3.2 API_URL 配置

`js/huihui-chat.js` 中使用相对路径：

```javascript
var API_URL = '/api/chat';
```

无需指定完整 URL。在 Vercel 上前后端同域（`huihui-skill.org`），相对路径自动指向该域的 `/api/chat`。

### 3.3 System Prompt 配置

System Prompt 定义在 `api/_shared/system-prompt.js` 的 `buildSystemPrompt(level)` 函数中，包含：

- **慧惠角色定义**：温柔、聪慧的数字生命
- **定位**：亲子体验营 AI 助手
- **风格**：安静、轻盈、不做作
- **7 条回答原则**：简短有力、贴近生活、尊重原典、启发思考、轻盈温柔、善行无辙迹、为道日损
- **L1-L4 层级指导**：根据 `level` 参数动态追加层级相关指令

**修改 System Prompt 后**：只需重新部署（`vercel --prod`），无需修改任何 API 端点代码。本地开发服务器 `server.js` 引用了同一份 System Prompt，修改后本地也会同步。

### 3.4 超时设置

| 层级 | 超时值 | 位置                | 机制                             |
| ---- | ------ | ------------------- | -------------------------------- |
| 前端 | 10s    | `js/huihui-chat.js` | `AbortController` + `setTimeout` |
| 后端 | 15s    | `api/chat.js`       | `AbortSignal.timeout(15000)`     |

两处均对 `TimeoutError` / `AbortError` 做友好提示："DeepSeek API 响应超时，请稍后重试。"

### 3.5 匿名用户 ID 机制

`js/huihui-chat.js` 中：

```javascript
var userId = localStorage.getItem('huihui_uid');
if (!userId) {
    userId = 'guest_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    localStorage.setItem('huihui_uid', userId);
}
```

- 格式：`guest_` + base36 时间戳 + 5 位随机字符（如 `guest_lq7x2k3m9a1b`）
- 持久化到 `localStorage`，同设备刷新不丢失
- 随 API 请求发送 `user_id` 字段，为后续用户画像预留

---

## 4. 验证测试清单

### 4.1 基础设施测试

```bash
# 1. 首页可访问
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://huihui-skill.org/
# → HTTP 200

# 2. JS 静态文件
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://huihui-skill.org/js/huihui-chat.js
# → HTTP 200

# 3. CSS 静态文件
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://huihui-skill.org/css/huihui-chat.css
# → HTTP 200

# 4. API /api/chat POST
curl -X POST https://huihui-skill.org/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"道是什么？"}],"level":"L2"}'
# → HTTP 200 + JSON (choices[0].message.content 包含中文回答)

# 5. API /api/family_chat POST
curl -X POST https://huihui-skill.org/api/family_chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"第1章讲什么？"}],"chapter":1,"age_group":"7_9"}'
# → HTTP 200 + JSON (huihui_response 包含亲子对话)

# 6. CORS 预检
curl -X OPTIONS https://huihui-skill.org/api/chat -I
# → HTTP 204 + Access-Control-Allow-Origin: * + Access-Control-Allow-Methods: POST, OPTIONS

# 7. 亲子时光页面
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://huihui-skill.org/family
# → HTTP 200
```

### 4.2 L1-L4 分层功能测试

| 层级    | 测试问题                           | 预期风格                                           |
| ------- | ---------------------------------- | -------------------------------------------------- |
| L1 白话 | "无为是什么意思？"                 | 生活化比喻，无专业术语（如"像妈妈让孩子自己吃饭"） |
| L2 精读 | "道和德是什么关系？"               | 概念解读，原文引用，框架梳理                       |
| L3 应用 | "无为在管理上怎么用？"             | 现实案例，多角度分析（如管理学、心理学）           |
| L4 学术 | "王弼和河上公对道的注疏有何不同？" | 考据对比，版本差异，跨文化比较                     |

```bash
# L1 测试示例
curl -X POST https://huihui-skill.org/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"无为是什么意思？"}],"level":"L1"}'
# 预期：回答含比喻，无"道""德""玄"等专业术语堆砌
```

### 4.3 浏览器端交互测试

在浏览器中打开 `https://huihui-skill.org/`，逐项检查：

1. **浮动按钮**：右下角 🌿 按钮可见，初始 3 秒脉冲动画后消失
2. **面板打开**：点击按钮 → 聊天面板从右侧滑入
3. **面板关闭**：点击 ✕ / 按 ESC / 点击面板外 → 面板关闭
4. **层级按钮**：L1 白话 | L2 精读 | L3 应用 | L4 学术 → 4 个按钮可见
5. **层级切换**：点击按钮 → 高亮切换 → 刷新页面后层级保持
6. **消息发送**：输入文字 → 点击 ➤ 或回车 → 用户气泡出现 → AI 气泡出现（含打字动画）
7. **对话历史**：刷新页面 → 之前对话保留
8. **匿名 ID**：DevTools → Application → Local Storage → `huihui_uid` 存在且刷新不变
9. **欢迎语**：首次打开面板 → 显示"你好呀！我是慧惠。关于《道德经》，有什么想聊的？"

### 4.4 移动端响应测试

- 视口宽度 ≤ 480px：聊天面板全屏展开，无 padding 溢出
- iOS Safari：底部安全区适配正常（`safe-area-inset-bottom`）
- 输入框：不遮挡键盘，自动滚动到最新消息

### 4.5 API Key 安全性测试

```bash
# 检查首页源码是否泄露 API Key
curl -s https://huihui-skill.org/ | grep "sk-"
# → 无输出（即无泄露）

# 检查 JS 文件是否泄露
curl -s https://huihui-skill.org/js/huihui-chat.js | grep "sk-"
# → 无输出（即无泄露）
```

### 4.6 错误场景测试

| 测试场景          | 命令                       | 预期 HTTP                     |
| ----------------- | -------------------------- | ----------------------------- |
| GET /api/chat     | `curl -X GET ...`          | 405 Method not allowed        |
| OPTIONS /api/chat | `curl -X OPTIONS ...`      | 204 No Content                |
| 空 body           | `curl -X POST ... -d '{}'` | 200（空 messages 仍返回响应） |
| 无 API Key        | 部署时不配环境变量         | 500 + "环境变量未配置"        |

---

## 5. 域名和 SSL 配置

### 5.1 DNS 配置（Cloudflare）

在 Cloudflare DNS 管理面板中为 `huihui-skill.org` 配置：

| 记录类型 | 名称                         | 值            | Proxy 状态               |
| -------- | ---------------------------- | ------------- | ------------------------ |
| A        | `@`（或 `huihui-skill.org`） | `76.76.21.21` | **DNS only**（灰色云朵） |

> **关键**：Proxy 状态必须设为 "DNS only"（灰色云朵），不能开 Cloudflare Proxy（橙色云朵）。否则会导致 HTTP 525 SSL Handshake Failed。

如存在旧的 Worker 记录，必须删除：
- 删除 `huihui-skill.org` 的 Worker route
- 删除 `www.huihui-skill.org` 的 Worker route

### 5.2 SSL 证书

Vercel 自动为自定义域名签发 Let's Encrypt SSL 证书。

**验证证书状态：**

```bash
# DNS 解析
nslookup huihui-skill.org
# → 76.76.21.21

# SSL 证书
vercel domains inspect huihui-skill.org
# → 证书状态应为 valid

# 浏览器
# 访问 https://huihui-skill.org → 地址栏显示 🔒，无证书警告
```

### 5.3 DNS 生效等待

- DNS 修改后传播需 5-30 分钟
- SSL 证书签发需 2-5 分钟
- 如果访问失败，等待后重试

---

## 6. 故障排除

### 6.1 部署失败：构建错误

**症状**：`vercel --prod` 构建阶段报错

**排查：**
```bash
# 查看构建日志
vercel logs <deployment-url>

# 本地模拟构建
vercel build
```

**常见原因：**
- `api/_shared/system-prompt.js` 语法错误 → `node -c api/_shared/system-prompt.js` 检查
- `package.json` 中 `engines.node` 版本不兼容 → 确保 `>=16.0.0`

### 6.2 API 返回 500 + "环境变量未配置"

**症状**：`{"error":"DEEPSEEK_API_KEY 环境变量未配置。"}`

**原因**：Vercel 环境变量未设置或未在 Production 环境

**解决：**
```bash
vercel env ls
# 确认有 DEEPSEEK_API_KEY 且环境为 Production

# 如缺失：
vercel env add DEEPSEEK_API_KEY production
# 粘贴 API Key

# 环境变量修改后必须重新部署
vercel --prod --yes
```

### 6.3 HTTP 525 SSL Handshake Failed

**症状**：浏览器访问 `https://huihui-skill.org` 显示 525 错误

**原因**：Cloudflare DNS 中 Proxy 开启了（橙色云朵），或存在 Worker 记录拦截流量

**解决：**
1. Cloudflare DNS → 将 `huihui-skill.org` 的 A 记录 Proxy 改为 **DNS only**（灰色云朵）
2. 删除所有 `huihui-skill.org` 的 Worker route
3. SSL/TLS 加密模式设为 **Full** 或 **Full (Strict)**

### 6.4 自定义域名无法访问

**症状**：浏览器访问超时或 DNS 解析失败

**解决：**
```bash
# 检查 DNS
nslookup huihui-skill.org
# 应返回 76.76.21.21

# 检查 Vercel 域名绑定
vercel domains ls
# 应显示 huihui-skill.org
```

如 DNS 不解析：等待 5-30 分钟 DNS 传播。如超过 30 分钟仍不解析，检查 Cloudflare DNS 记录是否正确。

### 6.5 前端聊天按钮不显示

**症状**：页面加载但右下角没有 🌿 按钮

**排查：**
1. 浏览器 F12 → Network 面板 → 确认 `huihui-chat.js` 和 `huihui-chat.css` 返回 200
2. 检查 Console 是否有 JS 错误
3. 尝试 Ctrl+Shift+R 强制刷新（可能缓存了旧版本）

### 6.6 Vercel CLI 登录报错（Unicode 用户名）

**症状**：`TypeError: 奇迹每一天 @ vercel x.x.x ... is not a legal HTTP header value`

**原因**：Vercel 账号 Display Name 包含中文字符，CLI 将其放入 HTTP User-Agent header

**解决方案 A（推荐）— 使用 Token：**
1. 打开 https://vercel.com/account/tokens
2. 创建 Personal Access Token（Full Account 权限）
3. 部署时使用：`vercel --prod --yes --token <TOKEN>`
4. **注意**：Token 只需在部署命令中传入，不需要 `vercel login`

**解决方案 B — 修改 Display Name：**
1. Vercel Dashboard → Settings → General
2. 将 Display Name 从 "奇迹每一天" 改为 ASCII 字符（如 `skyboyhjj`）
3. `vercel login` 重新认证

### 6.7 Git push 后网络错误

**症状**：`Failed to connect to 127.0.0.1 port 10809`

**原因**：本地 Git 配置了 HTTP 代理且代理未运行

**解决：**
```bash
# 临时取消代理后推送
git config --local --unset http.proxy
git config --local --unset https.proxy
git push

# 推送后恢复代理
git config --local http.proxy "http://127.0.0.1:10809"
git config --local https.proxy "http://127.0.0.1:10809"
```

---

## 7. 后续更新维护流程

### 7.1 标准更新流程

```bash
# 1. 本地修改代码
# 2. 提交到 Git
git add . && git commit -m "描述你的改动"

# 3. 推送到 GitHub（Cloudflare Pages 会自动部署到 hui-skill.org）
git push

# 4. 部署到 Vercel（huihui-skill.org）
vercel --prod --yes --token <TOKEN>

# 5. 验证部署
curl -s -o /dev/null -w "%{http_code}" https://huihui-skill.org/
# → 200
```

### 7.2 仅更新环境变量

```bash
# 更新环境变量
vercel env add DEEPSEEK_API_KEY production
# 输入新的 API Key

# 重新部署使环境变量生效
vercel --prod --yes --token <TOKEN>
```

环境变量修改后**必须重新部署**，Vercel 不会自动重启已部署的 Functions。

### 7.3 回滚

```bash
# 查看部署历史
vercel list daodejing-kb

# 回滚到上一个生产部署
vercel rollback

# 或指定具体部署
vercel rollback <deployment-url>
```

回滚即时生效，无需重新构建。

### 7.4 版本一致性验证

```bash
# 本地版本
git log -1 --oneline

# Vercel 部署版本
vercel inspect --production daodejing-kb.vercel.app | grep -E "sha|commit"
```

如不一致，重新部署即可。

### 7.5 文件修改影响范围

| 修改的文件            | 影响平台                  | 需要重新部署             |
| --------------------- | ------------------------- | ------------------------ |
| `api/chat.js`         | Vercel                    | ✅ `vercel --prod`        |
| `api/family_chat.js`  | Vercel                    | ✅ `vercel --prod`        |
| `api/_shared/*.js`    | Vercel                    | ✅ `vercel --prod`        |
| `js/huihui-chat.js`   | Vercel + CF Pages         | ✅ 两者都需要             |
| `css/huihui-chat.css` | Vercel + CF Pages         | ✅ 两者都需要             |
| `*.html`              | Vercel + CF Pages         | ✅ 两者都需要             |
| `functions/api/*.js`  | Cloudflare Pages          | ✅ `git push`（自动触发） |
| `data/*.json`         | Vercel（打包进 Function） | ✅ `vercel --prod`        |
| `server.js`           | 仅本地开发                | ❌ 无需部署               |
| `scripts/*`           | 仅本地开发                | ❌ 无需部署               |

---

## 附录：快速命令参考

```bash
# 登录（交互式）
vercel login

# 登录（Token 方式）
vercel --token <TOKEN> --prod --yes

# 部署到生产环境
vercel --prod --yes

# 查看环境变量
vercel env ls

# 添加环境变量
vercel env add DEEPSEEK_API_KEY production

# 查看域名列表
vercel domains ls

# 检查域名证书
vercel domains inspect huihui-skill.org

# 查看部署历史
vercel list daodejing-kb

# 回滚
vercel rollback

# 查看部署详情
vercel inspect <deployment-url>

# 本地开发
node server.js
```
