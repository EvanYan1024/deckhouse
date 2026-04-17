# Deckhouse — 待开发功能

与 Dockge 的功能差距分析，按优先级分组。

Dockge 本地路径：`/Users/yanyuan/Documents/Develop/Github/dockge`

---

## P0 — 高优先级

### 容器资源统计（CPU / 内存）

实时显示每个容器的 CPU 和内存使用情况。

- **后端**：添加 `dockerStats` 处理器 — `docker stats --format json --no-stream`，解析 CPUPerc / MemUsage
- **前端**：在 compose 页面或仪表盘中展示，每个服务显示徽章或进度条
- **轮询**：按需（用户打开统计面板时）或定期（可见时每 5-10 秒）
- **参考**：Dockge `dockge-server.ts` — `dockerStats` 事件，`Container.vue` — DockerStat 组件

---

## P1 — 中优先级

### 修改密码

允许已登录用户修改密码。

- **后端**：在 `MainSocketHandler` 中添加 `changePassword` 处理器 — 验证旧密码（bcrypt.compare），哈希新密码，持久化到 users.json
- **前端**：在 设置 > 安全 页面添加表单（旧密码、新密码、确认密码）
- **参考**：Dockge `main-socket-handler.ts` — `changePassword` 事件

### Docker 网络列表

提供 Docker 网络列表，用于 compose 编辑器自动补全。

- **后端**：添加 `getDockerNetworkList` 处理器 — `docker network ls --format {{.Name}}`
- **前端**：在 YAML 编辑器侧边栏或辅助面板中提供自动补全/下拉菜单
- **参考**：Dockge `dockge-server.ts` — `getDockerNetworkList` 事件

### Docker Run 转 Compose 转换器

将 `docker run` 命令转换为 compose YAML，方便迁移。

- **后端**：添加 `composerize` 处理器 — 使用 `composerize` npm 包
- **前端**：在创建 stack 页面或仪表盘添加输入框，粘贴 `docker run` 命令即可获取 compose YAML
- **参考**：Dockge `main-socket-handler.ts` — `composerize` 事件，`DashboardHome.vue` — 转换器 UI

### 全局环境变量

共享的 `.env` 变量，应用于所有 stack。

- **后端**：在 stacks 根目录读写 `global.env`，所有 compose 命令传入 `--env-file`
- **前端**：在 设置 > 环境变量 页面使用 CodeMirror 编辑器（与单 stack 的 .env 编辑器相同）
- **存储**：`{stacksDir}/global.env`
- **参考**：Dockge `main-socket-handler.ts` — `getSettings` / `setSettings` 的 globalEnvContent 字段

### 通用设置页面

配置服务器级别的设置，例如主域名。

- **后端**：添加 `getSettings` / `setSettings` 处理器，持久化到 `data/settings.json`
- **前端**：设置 > 通用 表单 — 主域名（用于编辑器中的 URL 生成）
- **参考**：Dockge `settings.ts` 模型，`General.vue` 组件

### 关于页面

显示版本信息，检查更新。

- **前端**：设置 > 关于 — 显示当前版本、GitHub 链接、可选的更新检查
- **参考**：Dockge `About.vue` 组件

---

## P2 — 低优先级

### 多用户管理

支持多个用户账户及不同角色。

- **后端**：用户增删改查处理器 — 添加/删除/列出用户，基于角色的访问控制（管理员 vs 只读用户）
- **存储**：从 users.json Map 迁移到正式数据库，或至少支持多记录 JSON
- **前端**：设置 > 用户 页面，包含用户列表和邀请流程
- **参考**：Dockge 使用 RedBean ORM 和 `user` 表

### 双因素认证（2FA / TOTP）

为登录添加基于 TOTP 的双因素认证。

- **后端**：生成 TOTP 密钥，验证令牌，按用户存储 `twofa_secret` 和 `twofa_status`
- **依赖**：`otpauth` 包用于 TOTP，`qrcode` 用于二维码生成
- **前端**：设置 > 安全 — 启用 2FA 对话框（含二维码），登录页面添加 TOTP 输入框
- **参考**：Dockge `TwoFADialog.vue`，`main-socket-handler.ts` — `twoFASetup`、`twoFAVerify`、`twoFADisable`

### Stack 搜索与筛选

按名称搜索 stack，按状态筛选。

- **前端**：在仪表盘和侧边栏添加搜索框 + 筛选按钮（运行中 / 已停止 / 全部）
- **无需后端改动** — 基于现有 stackList 数据在客户端筛选
- **参考**：Dockge `StackList.vue` — searchText + 状态筛选

### 多主机 Agent 支持

通过单一 UI 管理多台远程服务器上的 Docker stack。

- **后端**：
  - Agent 模型：存储 URL、凭证、显示名称
  - Agent 管理器：通过 Socket.IO 客户端连接远程 Deckhouse 实例
  - 代理：将事件转发到远程 agent（路由已在 `AgentProxySocketHandler` 中搭建）
- **前端**：侧边栏显示 agent 列表，按 agent 分组 stack，添加/移除 agent UI
- **架构**：事件路由已实现 — 本地调用走 `agentSocket.call()`，远程调用需要 Socket.IO 客户端连接远程实例
- **参考**：Dockge `agent-manager.ts`、`manage-agent-socket-handler.ts`、`Agent.ts` 模型

### 主机控制台

可选的系统级 bash shell，可从 UI 访问。

- **后端**：`mainTerminal` 处理器 — 使用 PTY 生成 bash 进程，通过 `DECKHOUSE_ENABLE_CONSOLE` 环境变量控制开关
- **前端**：独立的控制台页面，使用 xterm.js
- **安全**：默认禁用，需要显式启用
- **参考**：Dockge `terminal-socket-handler.ts` — `mainTerminal`、`checkMainTerminal`

---

## 已实现（Deckhouse 独有功能，超越 Dockge）

| 功能 | 描述 |
|------|------|
| **文件浏览器** | 在 stack 目录中浏览、编辑、上传、下载、创建、删除、重命名文件 |
| **内联文件编辑器** | CodeMirror 支持 10+ 种语言模式，Ctrl+S 保存，修改状态指示 |
| **文件搜索** | 在 stack 目录内递归搜索文件 |
| **路径沙箱** | 严格安全机制 — 所有文件访问均验证允许的根目录，支持符号链接解析 |
| **操作进度日志** | Deploy/Start/Stop 等操作实时流式输出 docker compose 日志 |
| **容器交互式终端** | 通过 node-pty 在运行中容器内打开 shell，支持 resize 同步 |
| **单服务控制** | 按服务显示状态、镜像、端口徽章，支持单独 Start/Stop/Restart |
