# ms-email-test

Outlook Graph 邮件采集测试仓库。用 **1 个 Microsoft App + 10 个真实 Outlook.com** 验证：

```text
Outlook.com → Microsoft Graph → 下载原始 MIME / .eml →（可选）重新投递到 Fastmail
```

第一阶段不接 MySQL、不接 Lark。这是 testing harness。

三个要点：CSV 账本、怎么测、怎么注册 Microsoft 客户端。

## 本地运行

```bash
cp .env.example .env
yarn
yarn dev
```

本地 `yarn dev` 监听 `PORT`（默认 3000），再用 ngrok 把该端口暴露成 HTTPS。浏览器走 ngrok 地址，不要用 localhost 做 OAuth 回调。

先填好 `.env` 里的 `MS_CLIENT_ID` / `MS_CLIENT_SECRET` / `MS_REDIRECT_URI`。打开 ngrok 地址会先要 **页面密码**（默认 `123456`），再点「添加 Outlook」。Outlook 密码在微软登录页输入，不会写入 CSV。

## 1. 数据库（暂时用 CSV）

两张表，密码和 token 不进表。Token 在 `data/tokens/`，`.eml` 在 `storage/eml/`。

**`data/outlook_accounts.csv`**：一行一个邮箱。

- 登录成功 → `Running`，进入限流调度队列
- Worker **只处理 Running**（公平轮询，默认每分钟最多 20 个号）
- Disable 后停止；token 失效才要 Re-auth
- 同一邮箱只有一行

**`data/outlook_redirects.csv`**：哪个邮箱的哪封信处理过。

- 查重：`(account_id, graph_message_id)`
- `Seen`：发现了还没转
- `Success`：已经重定向过，以后不再转
- `Failed`：可 Retry
- `Skipped`：明确不转

## 2. 怎么注册 Microsoft 客户端

10 个 Outlook **共用一个** Azure 应用。

1. 打开 [Entra 管理中心](https://entra.microsoft.com) → **App registrations** → **New registration**。
2. Name：`Outlook Graph Mail PoC`。
3. 账号类型选 **Personal Microsoft accounts only**（不要选「仅本组织」）。
4. Redirect URI 选 **Web**，填 ngrok 的 HTTPS 回调（必须和 `.env` 里 `MS_REDIRECT_URI` 一字不差）：

```text
https://<your-ngrok-host>/auth/microsoft/callback
```

5. 记下 Application (client) ID → `MS_CLIENT_ID`。
6. **Certificates & secrets** → New client secret，复制 **Value**（不是 Secret ID）→ `MS_CLIENT_SECRET`。
7. **API permissions** → Microsoft Graph → Delegated：

```text
openid
profile
offline_access
User.Read
Mail.Read
```

不要加 `Mail.ReadWrite` / `Mail.Send`。

`.env`：

```text
MS_CLIENT_ID=...
MS_CLIENT_SECRET=...
MS_TENANT=consumers
MS_REDIRECT_URI=https://<your-ngrok-host>/auth/microsoft/callback
```

点「添加 Outlook」应跳到微软登录；同意 Mail.Read 后回到首页，账号表出现该邮箱且为 `Running`。

常见错误：redirect 多一个 `/`（AADSTS50011）；单租户导致 Outlook.com 登不进；复制了 Secret ID 而不是 Value。

## 3. 怎么测

1. 页面密码进入后，添加 Outlook：`outlook_accounts.csv` 有该邮箱、`Running`；`data/tokens/` 有 json。
2. 同一邮箱再登录：仍一行，token 更新。
3. 调度器自动轮询，不必 Sync Now。首页能看到本轮进度和配额。
4. `ENABLE_FORWARD=false` 时新信为 `Seen`；再轮询不新增同一 `graph_message_id`。
5. `ENABLE_FORWARD=true` 且配好 SMTP 后：该行变 `Success`，不会重复投。
6. 破坏 token 后该号 `ReauthRequired`，其它 Running 不受影响。
7. 每个号至少测：纯文本、HTML、附件、primary、alias。看 EML 的 `To:`。
8. 多号 Running 连跑 7~14 天，看是否频繁 re-auth / 429。

## 明确不做

MySQL、Lark、Outlook 自动注册/规则/转发配置、Graph webhook、Redis、多进程 worker、React。

## 转发开关

先只收信：`ENABLE_FORWARD=false`。

确认 Graph 稳定后再开，并填写 `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `FORWARD_TO`。不要假设重新投递 EML 等于 Outlook Redirect；SMTP 会加新传输头，SPF/DKIM 可能变。
