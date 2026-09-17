# dsh-deepseek-balance

在 DeepSeek Harness Web 界面的**左下角设置按钮上方**，实时显示你的 DeepSeek API 余额。

- 每 **5 秒**自动刷新一次（页面不可见时暂停，恢复可见立即续查）
- 点击控件任意位置，或点击右侧 **↻ 刷新按钮**，立即手动查询
- 侧栏收起成窄条时，自动变成圆形 ¥ 徽标（悬停 title 查看详情）
- **不改动任何源代码**：以 DSH profile 插件（bundle）方式安装
- API Key 只存在于宿主进程（credentials seam），**永不下发到浏览器**

## 效果

```
┌────────────────────────────┐
│  ...会话列表...             │
│                            │
│  (¥) DeepSeek ¥ 12.34  ↻  │  ← 本插件（设置按钮上方）
│  ⚙ 设置                    │
└────────────────────────────┘
```

## 安装

```bash
# 本地目录 / Git 仓库均可
dsh plugin --profile web add dsh-deepseek-balance
# 或从 GitHub 安装
dsh plugin --profile web add https://github.com/<你的账号>/dsh-deepseek-balance.git
```

安装后**重启** `dsh web`（插件集在启动时解析）。

### API Key

插件默认读取 credential ref **`DEEPSEEK_API_KEY`**——也就是设置 → 模型里
`deepseek-official` 用的同一个 Key（存在 `$DSH_HOME/.credentials.yaml`）。
无需额外配置；也可在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- insert:
    - id: dsh-balance
      name: dsh-deepseek-balance
      config:
        baseUrl: https://api.deepseek.com        # 可选，DeepSeek API 根地址
        credentialRef: DEEPSEEK_API_KEY          # 可选，credential ref 名称
```

## 工作原理

| 层 | 文件 | 说明 |
| --- | --- | --- |
| 宿主端 | `lib/index.js` | cordis 插件：监听 `webServer` 后注册 `POST /dsh-balance/get` 路由（仅环回地址可访问），解析 API Key 后请求 `GET {baseUrl}/user/balance`，规整成 JSON 返回 |
| 浏览器端 | `lib/client.js` | 经 `dsh.client` 声明自动加载的客户端插件：把 `BalanceWidget` 注册进 `sidebar.footer.action` 插槽，5 秒轮询 + 手动刷新 |
| 配置层 | `cordis.patch.yml` | bundle patch，把插件挂进 profile 配置树 |

浏览器端通过 Connection RPC 调用同源路由 `POST /dsh-balance/get` 取数；该路由由宿主端用
`webServer.register()` 直接挂载（与 dsh-pilot、dsh-email 等插件同一挂法），只服务环回地址，
不经 `connection.rpc.handle()`——当前 dsh 版本下后者会因 `owner.webServer` 解析失败而永远注册不上。

## 开发

```bash
npm install        # 或 pnpm install（只需 esbuild）
npm run build      # 构建 lib/client.js（lib/index.js 是手写的零依赖 ESM，无需构建）
```

## 许可

MIT
