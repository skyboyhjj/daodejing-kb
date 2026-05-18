
# Phase 4：生产运维、全链路监控与持续交付

> **依据文档**: `docs/metadata-implementation-plan.md`（Phase 1-3 完成）| `docs/metadata-lifecycle-design.md`（§1-§8 参考）  
> **当前系统版本**: Phase 1-3 全部完成 (2026-05-15) | **优先级**: P2 — 运维成熟度提升  
> **前置状态**: 81 章全量上线、混合架构（Cloudflare + Vercel）就绪、自动化测试通过

---

## 一、Phase 4 定位与总览

Phase 3 的标题是"架构分离与**运维完善**"，但 Phase 3 实际完成了架构分离部分（3.1 路径隔离、3.2 混合架构），运维完善部分仅做了自动化测试（3.3）。Phase 4 承接 Phase 3 未完成的"运维完善"部分，面向以下核心目标：

| 维度 | 当前状态 | Phase 4 目标 |
|------|----------|-------------|
| 监控 | 无主动监控 | 全链路健康检测 + 漂移告警 |
| CI/CD | GitHub Actions 语法检查 + 搜索测试 | 完整质量门禁（含 metadata 测试 + 部署后验证） |
| 缓存 | 24h TTL 惰性过期 | 主动预热 + 更新触发失效 |
| 安全 | 基本认证 + 脱敏 | 安全审计 + 头加固 + 日志脱敏 |
| 运营 | 审核控制台 | 运营仪表板 + 内容健康可视化 |
| 备份 | 无 | 自动备份 + 恢复流程 |

---

## 二、任务清单

### 任务 4.1：全链路健康监控端点

| 属性 | 内容 |
|------|------|
| **状态** | ⬜ 待实施 |
| **优先级** | P1 — 生产运维基础 |
| **描述** | 创建 `/api/health` 端点，聚合检测所有子系统的健康状态，为外部监控（如 UptimeRobot、Vercel Analytics）提供标准化入口 |
| **预估工作量** | 1-2 天 |

#### 4.1.1 实现细节

**新增文件**: `api/_shared/health-check.js` (~80 行)

```
检测项（5 项）：
┌─────────────────────────────────────────────────────┐
│ 1. 文件系统健康                                        │
│    - family_metadata_public.json 可读且 JSON 合法      │
│    - family_metadata.json 可读且 JSON 合法（管理端）     │
│    - chapters/ 目录存在且包含 ≥81 个 .html 文件         │
│                                                       │
│ 2. 元数据完整性                                        │
│    - chapters 字典包含 81 个 key                       │
│    - approved_count ≥ 0                               │
│    - content_hash 非空                                 │
│                                                       │
│ 3. 外部 API 连通性（可选）                               │
│    - DeepSeek API 可达（轻量 ping/模型列表请求）          │
│    - 超时 5s，失败不阻塞整体返回                          │
│                                                       │
│ 4. 后台任务系统状态                                     │
│    - task-manager 已初始化                             │
│    - 活跃任务数 ≤ 阈值                                  │
│                                                       │
│ 5. 部署环境信息（脱敏）                                   │
│    - Node.js 版本                                      │
│    - 平台标识（Vercel / local）                         │
│    - PORT / REVISER_PORT                               │
└─────────────────────────────────────────────────────┘
```

**响应格式**:
```json
{
  "status": "ok" | "degraded" | "unhealthy",
  "timestamp": "2026-05-15T12:00:00.000Z",
  "checks": {
    "filesystem": { "status": "ok", "detail": "81 chapters, public metadata valid" },
    "metadata_integrity": { "status": "ok", "detail": "approved=78, hash=1bcf082b" },
    "deepseek_api": { "status": "ok", "latency_ms": 340 },
    "task_system": { "status": "ok", "detail": "0 active tasks" }
  },
  "environment": {
    "node": "v20.11.0",
    "platform": "vercel"
  }
}
```

**路由注册**（`server.js`）:
```javascript
// /api/health → 全链路健康检查（无需认证）
if (pathname === '/api/health') {
    handleHealthCheck(req, res);
    return;
}
```

**Cloudflare 对应**（`functions/api/health.js`）:
- 轻量版：仅检查静态资源完整性 + DeepSeek 连通性
- 无 fs 模块，使用 fetch 自检

#### 4.1.2 集成点
- **Vercel**: `server.js` 注册路由
- **Cloudflare**: `functions/api/health.js` 新文件
- **外部监控**: 配置 UptimeRobot 每 5 分钟 ping `GET /api/health`

#### 4.1.3 验收标准
- [ ] `GET /api/health` 返回 200 且 `status: "ok"`（正常情况）
- [ ] 元数据文件缺失时返回 `status: "degraded"`（降级但不崩溃）
- [ ] Cloudflare 和 Vercel 两端均部署
- [ ] 响应时间 < 500ms（不含 DeepSeek 探测）

---

### 任务 4.2：CI/CD 流水线完善

| 属性 | 内容 |
|------|------|
| **状态** | ⬜ 待实施 |
| **优先级** | P1 — 阻断劣化部署 |
| **描述** | 完善 `.github/workflows/ci.yml`，纳入 metadata 构建校验和测试套件，增加 Vercel 部署后验证 |
| **预估工作量** | 2-3 天 |

#### 4.2.1 当前 CI 差距分析

```
当前 .github/workflows/ci.yml 包含：
  ✅ validate job:     validate.js + build-index.js --check
  ✅ syntax job:       node --check 全量 JS 文件
  ✅ test-search job:  test-search.js

缺失：
  ❌ build-public-metadata.js --check（构建校验）
  ❌ scripts/test-metadata.js（元数据测试）
  ❌ Vercel 部署后 health check
  ❌ PR 预览部署自动评论
```

#### 4.2.2 新增 Job 设计

**Job 4: Metadata Quality Gate**
```yaml
metadata-quality:
  name: Metadata Quality Gate
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - name: Check public metadata consistency
      run: node scripts/build-public-metadata.js --check
    - name: Run metadata regression tests
      run: node scripts/test-metadata.js
```

**Job 5: Deploy Health Check (Vercel 部署后)**
```yaml
deploy-verify:
  name: Post-Deploy Health Check
  needs: [deploy]  # 依赖 Vercel 部署 job
  runs-on: ubuntu-latest
  steps:
    - name: Wait for deployment
      run: sleep 30
    - name: Health check production
      run: |
        curl -f -s -o /dev/null -w "%{http_code}" \
          https://your-domain.vercel.app/api/health | grep 200
    - name: Version check
      run: |
        curl -s https://your-domain.vercel.app/api/metadata/version | \
          jq '.content_hash'
```

#### 4.2.3 验收标准
- [ ] PR 触发 CI → metadata quality gate 通过才允许合并
- [ ] `main` 分支 push → 全部 5 个 job 通过
- [ ] 部署后 health check 自动验证
- [ ] CI 失败时 GitHub 通知

---

### 任务 4.3：缓存体系优化

| 属性 | 内容 |
|------|------|
| **状态** | ⬜ 待实施 |
| **优先级** | P2 — 用户体验优化 |
| **描述** | 优化多层缓存策略：元数据更新触发缓存失效、亲子对话预热自动化、CDN 缓存规则调优 |
| **预估工作量** | 3-4 天 |

#### 4.3.1 当前缓存架构回顾

```
层级 1: metadata-store 内存缓存    → 5s TTL，写入时刷新
层级 2: family_chat 对话缓存      → 24h TTL，Map 惰性删除
层级 3: family_chat_cache.json   → 手动预热（Skill）
层级 4: Cloudflare CDN           → 默认规则，无显式控制
```

**核心问题**:
1. 元数据更新（`build-public-metadata.js` 重新生成）后，`family_chat` 24h 缓存仍返回旧数据
2. 缓存预热依赖手动触发 Skill，部署后首次对话需冷启动
3. CDN 可能缓存旧的 `family_metadata_public.json`

#### 4.3.2 改进设计

**A. 版本感知缓存键**（`api/family_chat.js`）

```javascript
// 当前：
var cacheKey = 'fc_' + chapter + '_' + ageGroup + '_' + historyHash;

// 改进：
var cacheKey = 'fc_' + chapter + '_' + ageGroup + '_' + historyHash + '_' + contentHash;
// contentHash 从 family_metadata_public.json._content_hash 读取
// 元数据更新 → hash 变化 → 自动 miss 旧缓存 → 生成新对话
```

实现位置: `api/family_chat.js:47` (cacheGet/cacheSet)  
影响: 零代码修改的消费者端，仅缓存键变化

**B. 构建后自动预热**（集成到 `build-public-metadata.js`）

```bash
# --warmup 模式：构建公开版后触发预热
node scripts/build-public-metadata.js --warmup

# 内部调用:
# 1. 构建 _public.json
# 2. 启动临时 server（随机端口）
# 3. 遍历 approved 章节 × 3 年龄段 → GET /api/family_chat
# 4. 保存到 family_chat_cache.json
# 5. 关闭临时 server
```

**C. CDN 缓存控制**（`server.js` 响应头）

```javascript
// 对 _public.json 设置短期缓存
if (pathname.includes('family_metadata_public.json')) {
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.setHeader('ETag', '"' + contentHash + '"');
}
```

#### 4.3.3 验收标准
- [ ] 运行 `build-public-metadata.js` 后，`family_chat` 缓存自动失效
- [ ] `--warmup` 模式成功预热 ≥80% approved 章节
- [ ] CDN 缓存规则不缓存过期的公开元数据超过 10 分钟
- [ ] 缓存命中率日志可观测（console.log 输出 `[cache] hit/miss`）

---

### 任务 4.4：安全合规深化

| 属性 | 内容 |
|------|------|
| **状态** | ⬜ 待实施 |
| **优先级** | P1 — 安全底线 |
| **描述** | 安全头加固、管理端日志脱敏、API 限流、敏感配置审计 |
| **预估工作量** | 2-3 天 |

#### 4.4.1 实施项

**A. HTTP 安全头加固**（`server.js` 统一注入）

```javascript
// 所有响应统一添加
var SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.deepseek.com"
};
```

实现位置: `server.js` 的 `sendJSON()` / `serveStatic()` 函数

**B. 管理端操作日志脱敏**

当前 `console.log('[task-handler] meta_revise OK: 第' + task.chapter + '章')` — 安全。  
但 `admin/family-review.js` 中的 fetch 请求可能暴露 `ADMIN_TOKEN` 于浏览器 DevTools。

改进:
- 管理端 API 调用统一使用 `Authorization` header（已实现 ✅）
- 确保 Token 不出现在 URL query string 中（审计现有代码）

**C. 简易速率限制**（`api/_shared/rate-limiter.js` 新文件）

```javascript
// 内存 Map: IP → { count, resetAt }
// 公开 API: 30 req/min per IP
// 管理 API: 60 req/min per IP（需认证）
// 超过限制 → 429 Too Many Requests
```

**D. 敏感配置审计**

```bash
# 检查清单：
✅ .env 不在 Git 中（.gitignore 已配置）
✅ family_metadata.json 不在 Git 中（.gitignore 已配置）
✅ ADMIN_TOKEN 通过环境变量注入（非硬编码）
⚠️ 需确认：Vercel 环境变量中无明文泄露
⚠️ 需确认：Cloudflare Pages 环境变量配置正确
```

#### 4.4.2 验收标准
- [ ] 所有 HTTP 响应包含 6 个安全头
- [ ] 速率限制在本地测试中触发（>30 req/min → 429）
- [ ] 管理 Token 不出现在浏览器 URL 或 console 中
- [ ] `git log -p` 确认敏感文件不在 Git 历史中

---

### 任务 4.5：内容运营仪表板

| 属性 | 内容 |
|------|------|
| **状态** | ⬜ 待实施 |
| **优先级** | P2 — 运营效率 |
| **描述** | 在审核控制台中增加运营视图：章节健康总览、审核效率统计、内容新鲜度热力图 |
| **预估工作量** | 3-5 天 |

#### 4.5.1 功能设计

**A. 章节健康总览**（`/admin` 仪表板首页）

```
┌──────────────────────────────────────────────────┐
│ 📊 元数据运营仪表板                   2026-05-15  │
├──────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 81 章节   │ │ 78 已审核 │ │ 0 锁定中  │          │
│  │ 100%     │ │ 96.3%    │ │ 0%       │          │
│  └──────────┘ └──────────┘ └──────────┘          │
│                                                    │
│  状态分布:  ████████████████████ approved (78)     │
│             ██ pending (1)                         │
│             ██ revision_needed (2)                 │
│                                                    │
│  内容新鲜度:                                        │
│  最近更新: 2026-05-15 (ch76, ch50)                 │
│  超过30天未审: 2 章                                │
│                                                    │
│  safety_notes 平均: 3.4 条/章                      │
│  interaction_points 平均: 2.4 个/章                │
│  禁用术语命中: 0                                    │
└──────────────────────────────────────────────────┘
```

**B. API 端点**

```
GET /admin/api/dashboard → {
    total, approved, pending, reviewing, revision_needed,
    avg_safety_notes, avg_interaction_points,
    last_updated_chapters: [{chapter, title, updated_at}],
    stale_chapters: [{chapter, title, days_since_review}],
    forbidden_term_hits: 0
}
```

**C. 实现方式**

- 新增 `handleDashboard()` 函数（`server.js`，~40 行）
- 在 `admin/family-review.js` 中增加仪表板渲染逻辑（~80 行）
- 复用现有 `metadata-store.js` 的聚合查询能力

#### 4.5.2 验收标准
- [ ] `GET /admin/api/dashboard` 返回完整统计数据
- [ ] 仪表板在审核控制台首页可见
- [ ] 状态分布数据与 `test-metadata.js` T5 输出一致
- [ ] 过期章节（>30 天未审核）正确标记

---

### 任务 4.6：备份与灾难恢复

| 属性 | 内容 |
|------|------|
| **状态** | ⬜ 待实施 |
| **优先级** | P2 — 数据安全 |
| **描述** | 建立自动备份机制，覆盖三个核心数据文件，编写恢复 SOP |
| **预估工作量** | 2-3 天 |

#### 4.6.1 备份策略

```
备份目标文件（3 个）:
┌──────────────────────────────────────────────┐
│ data/family_metadata.json          (~250 KB) │
│ data/family_metadata_staging.json  (~5 KB)   │
│ data/family_metadata_public.json   (~180 KB) │
└──────────────────────────────────────────────┘

备份方式:
  A. Git 自动备份（推荐）:
     - pre-commit hook 检测元数据文件变更
     - 自动在 commit 前将当前版本复制到 data/backups/
     - 文件名: family_metadata.{YYYY-MM-DD-HHmmss}.json
     
  B. 定时脚本备份:
     - scripts/backup-metadata.js
     - 复制到 data/backups/ 目录
     - 保留最近 30 个备份，自动轮转

保留策略:
  - data/backups/ 目录在 .gitignore 中（不提交到仓库）
  - 本地保留 30 天滚动备份
  - Vercel 环境通过 GitHub Releases 或外部存储
```

#### 4.6.2 恢复流程

```bash
# 1. 列出可用备份
ls data/backups/

# 2. 恢复到指定时间点
cp data/backups/family_metadata.2026-05-15-120000.json data/family_metadata.json

# 3. 重新构建公开版
node scripts/build-public-metadata.js

# 4. 验证
node scripts/test-metadata.js
```

#### 4.6.3 验收标准
- [ ] `node scripts/backup-metadata.js` 创建带时间戳的备份文件
- [ ] 备份文件包含完整的 chapters 数据（JSON 合法）
- [ ] 恢复后 `test-metadata.js` 全部通过
- [ ] 备份轮转逻辑：超过 30 个时自动删除最旧

---

## 三、任务依赖关系

```
Phase 4 (生产运维与持续交付)
│
├── 4.1 全链路健康监控            ← 无依赖，可立即开始
│     └── 被 4.2.2 依赖（部署后验证需要 health endpoint）
│
├── 4.2 CI/CD 流水线完善          ← 依赖 4.1（health check）、依赖 4.4（安全）
│
├── 4.3 缓存体系优化              ← 依赖 Phase 3 完成、可独立开始
│
├── 4.4 安全合规深化              ← 无依赖，可立即开始
│     └── 被 4.2 依赖（CI 需要安全校验）
│
├── 4.5 内容运营仪表板            ← 依赖 Phase 1-3 API 基础设施
│
└── 4.6 备份与灾难恢复            ← 无依赖，可立即开始
```

**并行组：**
- 组 A（可立即并行）: 4.1、4.4、4.6
- 组 B（依赖组 A）: 4.2、4.5
- 组 C（依赖 Phase 3 缓存架构）: 4.3

---

## 四、资源估计

| 任务 | 新增文件 | 修改文件 | 新增代码行 | 预估工作量 |
|------|---------|---------|-----------|-----------|
| 4.1 健康监控 | 2 (`api/_shared/health-check.js`, `functions/api/health.js`) | 1 (`server.js`) | ~150 | 1-2 天 |
| 4.2 CI/CD 完善 | 0 | 1 (`.github/workflows/ci.yml`) | ~60 | 2-3 天 |
| 4.3 缓存优化 | 0 | 3 (`api/family_chat.js`, `build-public-metadata.js`, `server.js`) | ~120 | 3-4 天 |
| 4.4 安全深化 | 1 (`api/_shared/rate-limiter.js`) | 1 (`server.js`) | ~100 | 2-3 天 |
| 4.5 运营仪表板 | 0 | 2 (`server.js`, `admin/family-review.js`) | ~180 | 3-5 天 |
| 4.6 备份恢复 | 1 (`scripts/backup-metadata.js`) | 0 | ~80 | 2-3 天 |
| **总计** | **4** | **8** | **~690** | **13-20 天** |

---

## 五、风险评估与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| DeepSeek API 连通性探测引入延迟 | 低 | 低 | health check 中 DeepSeek 探测设 5s 超时，失败不标记 unhealthy |
| 速率限制误伤合法用户 | 中 | 中 | 管理端 Token 认证绕过限流；公开 API 设置合理阈值（30/min） |
| CDN 缓存控制与 Cloudflare 默认行为冲突 | 中 | 中 | 使用 ETag + Cache-Control 组合；在 Cloudflare Dashboard 配置 Page Rules |
| 备份文件占用磁盘空间过大 | 低 | 低 | 轮转保留 30 个备份；单文件 ~250KB → 总占用 ~7.5MB |
| Vercel Serverless 冷启动影响 health check | 中 | 低 | health check 响应 <1s 即可；外部监控设置合理超时 |
| 仪表板聚合计算在 81 章规模下性能不足 | 低 | 低 | 当前数据量级小（81 章），无性能风险；如扩展可加缓存 |

---

## 六、验收标准总表

| 任务 | 核心验收指标 |
|------|-------------|
| 4.1 | `GET /api/health` 双平台可用，响应 <500ms，降级时不崩溃 |
| 4.2 | CI 包含 metadata 质量门禁，PR 合并前强制通过 |
| 4.3 | 元数据更新后缓存自动失效，预热命中率 ≥80% |
| 4.4 | 6 个安全头全部存在，速率限制可触发 429，Token 不泄露 |
| 4.5 | 仪表板数据与 `test-metadata.js` 输出一致 |
| 4.6 | 备份文件 JSON 合法，恢复后全测试通过，轮转逻辑正常 |

---

## 七、建议的立即启动项（无依赖）

按优先级排列，以下 3 个任务**零阻塞依赖**，可立即并行开始：

| 顺序 | 任务 | 预计耗时 | 理由 |
|------|------|---------|------|
| ① | 4.1 全链路健康监控 | 1-2 天 | 为监控和部署验证提供基础设施 |
| ② | 4.4 安全合规深化 | 2-3 天 | 安全底线，应尽早加固 |
| ③ | 4.6 备份与灾难恢复 | 2-3 天 | 保护已有数据资产，防患未然 |

---

以上 Phase 4 的全部 6 个任务与项目的 `metadata-implementation-plan.md`（Phase 1-3 完成状态）、`metadata-lifecycle-design.md`（§1-§8 设计规范）、以及当前 CI/CD 配置、缓存架构、安全机制的实际状态保持一致。是否需要我开始实施 Phase 4 的第一个任务？