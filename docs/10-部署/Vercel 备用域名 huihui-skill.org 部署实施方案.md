Vercel 备用域名 huihui-skill.org 部署实施方案
状态： ✅ 已完成
日期： 2026-05-17 | 首次部署：2026-05-14
一、当前架构梳理
经调研，项目已具备双平台部署的完整代码结构：
plaintext
daodejing-kb/
├── api/                          ← Vercel Serverless Functions
│   ├── chat.js                   ← Vercel 聊天 API（ESM export handler）
│   ├── family_chat.js            ← Vercel 亲子对话 API（CJS require）
│   └── _shared/                  ← 共享模块（双平台共用）
│       ├── system-prompt.js      ← buildSystemPrompt（唯一规范来源）
│       └── feedback-email.js     ← 反馈邮件发送
│
├── functions/api/                ← Cloudflare Pages Functions
│   └── chat.js                   ← CF 聊天 API（onRequest pattern）
│
├── js/huihui-chat.js            ← 前端聊天组件（API_URL = '/api/chat' 相对路径）
├── css/huihui-chat.css          ← 聊天组件样式
├── server.js                    ← 本地开发服务器
├── .vercel/project.json         ← Vercel 项目关联（已存在）
│   ├── projectId: prj_DVEqiGI9EVVJ0alImyXDXP9L2Z3l
│   └── orgId: team_AvPcpWYRMheafrkVD05CQoti
│
├── 主域名  → hui-skill.org (Cloudflare Pages)
└── 备用域名 → huihui-skill.org (Vercel)
关键设计： 双平台共用 api/_shared/system-prompt.js，前端使用相对路径 /api/chat，自动适配当前域名。
二、部署流程（7 步）
阶段 A：准备
Step 1：确认版本一致性 — 提交本地修改
当前 git 有 8 个已修改文件（包括本轮 family.js/family.css/server.js 修改）。部署前需确保代码库干净。
bash
cd e:/daodejing-kb
git add -A
git commit -m "feat: 亲子时光学习模式 P2 + Vercel 备用部署配置同步"
Step 2：更新 Vercel CLI
当前 Vercel CLI 版本 v50.38.2，最新为 v53.2.0：
bash
npm i -g vercel@latest
阶段 B：部署
Step 3：关联 Vercel 项目
.vercel/project.json 已存在 prj_DVEqiGI9EVVJ0alImyXDXP9L2Z3l，但该文件在 .gitignore 中。需要确认当前环境已关联：
bash
cd e:/daodejing-kb
vercel link --confirm
# 输出应显示已关联到 daodejing-kb 项目
注意： 如果 .vercel/project.json 丢失（如从新机器操作），需运行 vercel link 手动选择同名项目。
Step 4：配置环境变量
Vercel 上的 DEEPSEEK_API_KEY 需确认是否仍有效：
bash
# 检查当前环境变量
vercel env ls

# 如不存在或需要更新，执行：
vercel env add DEEPSEEK_API_KEY production
# 粘贴 API Key: <your-deepseek-api-key>
注意： RESEND_API_KEY 等反馈邮件相关环境变量也需一并检查：
bash
vercel env ls  # 确认是否有 RESEND_API_KEY
如果缺失且需要反馈功能：
bash
vercel env add RESEND_API_KEY production
Step 5：执行生产部署
bash
vercel --prod --yes
Vercel 自动完成以下操作：
检测 api/chat.js 和 api/family_chat.js 为 Serverless Functions
打包 api/_shared/ 作为依赖
静态文件（HTML/CSS/JS）从根目录服务
生成唯一部署 URL：daodejing-kb-xxxxxxxxx.vercel.app
Step 6：验证 DNS 配置
huihui-skill.org 之前已绑定到 Vercel。需验证 DNS 记录是否仍然正确：
bash
# 检查 DNS 解析
nslookup huihui-skill.org
# 预期：返回 76.76.21.21（Vercel IP）

# 或
dig huihui-skill.org A
如需重新配置 DNS：
记录类型	名称	值	代理状态
A	@ (或 huihui-skill.org)	76.76.21.21	DNS only（灰色云朵）
⚠️ 关键： DNS 代理必须设为 "DNS only"，不能用 Cloudflare Proxy（橙色云朵）。否则会导致 HTTP 525 SSL Handshake Failed 错误。
SSL 证书验证：
bash
vercel domains inspect huihui-skill.org
# 应显示证书状态为 valid
阶段 C：验证
Step 7：执行完整测试清单
详见下面第五节。
三、环境变量配置
变量名	位置	值	状态
DEEPSEEK_API_KEY	Vercel Dashboard → Settings → Environment Variables → Production	sk-137...55b4	待确认
RESEND_API_KEY	同上	反馈邮件用	待确认
ADMIN_TOKEN	同上	元数据审核管理端认证	待确认
安全规则：
所有 Key 仅存储在 Vercel 环境变量中，前端代码不可见
.env 文件已在 .gitignore 中，不会提交到仓库
Vercel 环境变量通过 vercel env add 命令行或 Dashboard 管理
四、API 端点验证
Vercel Serverless Functions 自动检测 api/ 目录下的文件：
文件	路由	用途	运行时
api/chat.js	POST /api/chat	慧惠 AI 聊天	Node.js (ESM)
api/family_chat.js	POST /api/family_chat	亲子共读对话	Node.js (CJS)
server.js	仅本地开发	—	—
functions/api/chat.js	Cloudflare 专用	—	—
前端无需修改：js/huihui-chat.js 使用 var API_URL = '/api/chat'（相对路径），在 huihui-skill.org 上自动指向 Vercel 的 /api/chat。
五、部署验证测试清单
5.1 基础设施测试
#	测试项	命令/方法	预期结果
1	首页可访问	curl -I https://huihui-skill.org/	HTTP 200
2	JS 静态文件	curl -I https://huihui-skill.org/js/huihui-chat.js	HTTP 200
3	CSS 静态文件	curl -I https://huihui-skill.org/css/huihui-chat.css	HTTP 200
4	API 基础连通	curl -X POST https://huihui-skill.org/api/chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"道是什么？"}],"level":"L2"}'	HTTP 200 + JSON
5	CORS 预检	curl -X OPTIONS https://huihui-skill.org/api/chat -v	204 + Access-Control-Allow-Origin: *
6	API Key 机密性	浏览器查看页面源代码	无 sk- 前缀字符串
5.2 功能测试
#	测试项	预期结果
7	浮动聊天按钮	右下角 🌿 按钮可见，带脉冲动画
8	聊天面板开关	点击按钮/ESC/点击外部 → 面板正常开合
9	L1 回复风格	生活化比喻，无专业术语
10	L2 回复风格	概念解读，框架梳理
11	L3 回复风格	现实应用，多角度分析
12	L4 回复风格	学术视角，考据对比
13	匿名 ID 持久化	刷新页面 → huihui_uid localStorage 不变
14	超时处理	超时 → 友好错误提示
15	移动端响应	375px 宽度 → 面板全屏
5.3 亲子时光页面测试
#	测试项	预期结果
16	亲子时光页面加载	https://huihui-skill.org/family → 200
17	连续学习模式	年龄选择 → 慧惠对话正常
18	自由探索模式	模式切换 → 章节输入 → 对话正常
19	亲子对话 API	POST /api/family_chat → 返回慧惠对话
5.4 域名与 SSL 测试
#	测试项	预期结果
20	DNS 解析	huihui-skill.org → 76.76.21.21
21	SSL 证书	浏览器显示 🔒，无证书错误
22	HTTP → HTTPS	自动 308 重定向
六、风险控制 — 确保主域名 hui-skill.org 不受影响
6.1 架构隔离
隔离维度	说明
平台隔离	hui-skill.org → Cloudflare Pages；huihui-skill.org → Vercel（独立平台，互不影响）
代码隔离	API 文件分目录：functions/api/（CF）vs api/（Vercel），修改互不干涉
环境变量隔离	Cloudflare Pages 和 Vercel 各自独立配置 DEEPSEEK_API_KEY
DNS 隔离	hui-skill.org → CNAME CF Pages；huihui-skill.org → A Vercel IP，DNS 记录无交叉
Git 隔离	共用代码分支，但部署由各自平台的 webhook/CLI 独立触发
6.2 防护措施
plaintext
本次 Vercel 部署操作范围：
  ✅ 影响：api/chat.js, api/family_chat.js, api/_shared/, 静态文件
  ❌ 不影响：functions/api/chat.js（CF 专用）、Cloudflare Pages 配置、hui-skill.org DNS
Vercel 部署不会触发 Cloudflare Pages 重新部署（CF 由 GitHub webhook 触发，Vercel 由 CLI 手动触发）
即使 Vercel 部署失败，hui-skill.org 不受任何影响
回滚方案：如果 huihui-skill.org 出现问题，vercel rollback 可立即回退到上一个正常版本
七、版本一致性保障
7.1 代码同步策略
plaintext
本地修改 → git commit → git push
                            ├── Cloudflare Pages（webhook 自动部署到 hui-skill.org）
                            └── Vercel CLI 手动部署（vercel --prod --yes → huihui-skill.org）
规则：
每次本地修改完成后，先 git commit，再执行 vercel --prod --yes
同一个 commit 部署到两个平台，确保版本一致
Shared 模块（api/_shared/）是唯一规范来源，修改后自动同步
7.2 验证版本一致性
bash
# 本地版本
git log -1 --oneline

# Vercel 已部署版本
vercel inspect --production daodejing-kb.vercel.app | grep -E "sha|commit"

# 如发现不一致，重新部署即可
vercel --prod --yes
八、执行前提检查清单
在开始部署前，需要确认以下事项：
#	检查项	状态
1	Vercel CLI 已安装并登录（skyboyhjj）	✅ 已确认
2	.vercel/project.json 存在	✅ 已确认
3	api/chat.js 存在且使用 ESM handler 模式	✅ 已确认
4	api/_shared/system-prompt.js 存在	✅ 已确认
5	前端 API_URL = '/api/chat' 使用相对路径	✅ 已确认
6	.gitignore 排除 .env 和 .vercel	✅ 已确认
7	huihui-skill.org DNS 解析状态	⏳ 待检查
8	Vercel 项目环境变量配置状态	⏳ 待检查
9	本地 git 有未提交修改	⚠️ 8 个文件待提交
九、执行顺序总结
plaintext
Step 1: git commit（本地修改同步）
Step 2: npm i -g vercel@latest（CLI 更新）
Step 3: vercel link --confirm（确认项目关联）
Step 4: vercel env ls + 确认/配置环境变量
Step 5: vercel --prod --yes（部署）
Step 6: 验证 DNS + SSL
Step 7: 运行完整测试清单
⚠️ 预计耗时： 10-15 分钟（不含 DNS 传播等待）
以上方案是否确认？确认后我将按 Step 1-7 顺序执行。
已操作
1个待办
方案已完整呈现。要点总结：
代码已就绪：api/ 目录（Vercel）和 functions/api/（Cloudflare）已分离，共享模块位于 api/_shared/
项目已关联：.vercel/project.json 指向已有项目 prj_DVEqiGI9EVVJ0alImyXDXP9L2Z3l，账号 skyboyhjj 已登录
无风险：两个平台独立部署、独立 DNS、独立环境变量，互不影响
待确认项：DNS 解析状态、Vercel 环境变量配置、本地 git 修改需提交

---

**八、SkillUP 认知追踪部署确认（2026-05-17）**

SkillUP 全四阶段已部署至 Vercel 生产环境：

| 部署批次 | Commit | 内容 | 状态 |
|:---|:---|:---|:---|
| Phase 1-4 初版 | `83744b4` | 追踪器、许可管理、卡片 UI、动态反馈 | ✅ |
| 修复：卡片点击无反应 | `4a7b553` | 未授权卡片点击打开聊天面板 | ✅ |
| 修复：许可征求引导 | `cbe6012` | 预征求引导消息 | ✅ |
| 修复：立即征求 +"保存" | `9e66dd6` | `__skillupCardTrigger` 即时征求 + 肯定词列表更新 | ✅ |

**部署后验证**（`scripts/verify-deploy.mjs --domain huihui-skill.org`）：
- 核心页面 HTTP 200：16/16 通过
- API 端点（`/api/chat`）：HTTP 200
- 搜索数据 URL 格式：OK
- SkillUP 文件可访问性：`skillup-tracker.js` / `skillup-consent.js` / `skillup-ui.js` / `skillup-ui.css` 全部 HTTP 200

**部署命令速查**：
```bash
# 生产部署（需要 Vercel token）
npx vercel --prod --yes --token vcp_...

# 部署后验证
node scripts/verify-deploy.mjs --domain huihui-skill.org

# CI 全量检查
npm run ci
```