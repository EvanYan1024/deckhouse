# Deckhouse

一个自托管的 Docker Compose 管理器,内置文件浏览器、容器终端和实时日志 ——
把你常用的 `docker compose up/down/logs/exec` 搬进一个温和的 Web UI。

适合场景:一台 VPS 上跑着十来个自托管服务(Nginx / Postgres / Grafana /
各种 arr…),不想每次 SSH 进去翻目录,又觉得 Portainer / Dockge 要么太
重要么太硬核。

---

## ✨ 特性

- **Stack 管理** — 部署、启动、停止、重启、更新(`pull` + `up`)、删除整个栈;也能单独控制某个 service
- **文件浏览器** — 在 Web 上浏览 / 编辑 / 上传 / 下载 / 搜索 stack 目录下的文件,CodeMirror 语法高亮
- **实时日志** — 用 Socket.IO 流式推送 `docker compose logs -f` 的输出
- **容器终端** — 通过 xterm.js + node-pty 打开运行中容器的交互式 shell
- **`docker run` → compose** — 粘贴一行 `docker run ...`,自动转成 compose YAML 模板
- **全局 .env** — 多个 stack 共用的环境变量写一次
- **多用户 + 管理员角色** — 管理员能加人、改全局设置;普通用户只能操作 stack
- **远程 Agent** — 一个 Deckhouse 实例管理多台主机上的栈(通过 Socket.IO 代理)
- **安全基线** — JWT(密码改动即失效)、bcrypt 密码、路径沙箱、服务名参数注入校验

## 🖼️ 截图

> 截图待补。

---

## 🚀 快速开始(推荐:Docker)

完整生产部署步骤见 [`DEPLOY.md`](./DEPLOY.md),包含 Caddy 反代 + HTTPS 配置、
安全检查清单、常见问题。

最小可跑版本:

```bash
git clone https://github.com/<you>/deckhouse.git
cd deckhouse

# 准备宿主机目录(stacks 路径在容器内外必须一致,见 deploy/compose.yaml)
sudo mkdir -p /opt/deckhouse/data /opt/deckhouse/stacks

# 构建并启动
cd deploy
sudo docker compose up -d --build
```

浏览器打开 `http://<服务器>:5001` → `/setup` 创建第一个管理员账号。

## 🛠️ 开发环境

需要 Node.js ≥ 22 和本机可用的 `docker` + `docker compose`。

```bash
git clone https://github.com/<you>/deckhouse.git
cd deckhouse

# 安装根目录 + frontend 两份依赖
npm install
cd frontend && npm install && cd ..

# 同时启动后端(tsx watch)和前端(Vite dev server)
npm run dev
```

默认端口:

- 后端 / Socket.IO / 生产静态资源:`5001`
- Vite 开发服务器:Vite 默认 `5173`(开发时前端在这里,生产构建后合并进 `5001`)

其他常用脚本:

```bash
npm run check-ts           # 后端 + common 类型检查
npm run build:frontend     # 构建前端静态资源到 frontend/dist
npm run start              # 生产模式启动后端(读取 frontend/dist)

# 前端独立命令
cd frontend
npm run lint
npm run build
```

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DECKHOUSE_PORT` | `5001` | 监听端口 |
| `DECKHOUSE_HOSTNAME` | `0.0.0.0` | 绑定地址。生产建议改 `127.0.0.1` 交给反代 |
| `DECKHOUSE_STACKS_DIR` | `./stacks` | stack 根目录。**容器部署时必须和宿主机挂载路径一致** |
| `DECKHOUSE_DATA_DIR` | `./data` | 用户数据(`users.json`、`jwt-secret.txt`、`agents.json`、`settings.json`) |
| `DECKHOUSE_ENABLE_CONSOLE` | 未设置 | 设为 `1` 启用宿主机 shell 入口(**仅 admin 可用,等同给 admin 宿主 root**,生产强烈建议关闭) |

## 🏗️ 架构一览

```
 Browser (React 19 + Socket.IO client)
   ↕  WebSocket
 Deckhouse server (Express 5 + Socket.IO, :5001)
   ├── Auth / 用户 / 全局设置      ← main-socket-handler
   ├── Agent proxy(路由本地 / 远程)← agent-proxy-socket-handler
   │     ├── Docker(deploy/start/stop/logs…)
   │     ├── File(list/read/write/upload/…)
   │     └── Terminal(容器 shell / 宿主 shell)
   │             ↕  child_process.spawn
   │          docker CLI / node-pty
   │             ↕
   │          Docker daemon + 文件系统
```

- 前后端通信**全部走 Socket.IO**,没有 REST
- 后端**不直连 Docker API**,而是 `child_process.spawn` 调用 `docker` CLI
- 路径安全由 `PathValidator` 统一校验(realpath + 白名单根目录)
- 详见 [`CLAUDE.md`](./CLAUDE.md)(项目开发指南)和 [`DESIGN.md`](./DESIGN.md)(设计规范)

## 🔒 安全说明

上线前请确认:

- [ ] HTTPS 由反代(Caddy / nginx / traefik)提供,Deckhouse 自身只开 `127.0.0.1`
- [ ] 没有开 `DECKHOUSE_ENABLE_CONSOLE`(除非你真的需要)
- [ ] 测试期的 admin 账号已删除,正式账号用强密码
- [ ] `data/` 目录有宿主备份策略 —— JWT 密钥、用户哈希都在里面

完整清单见 [`DEPLOY.md` 的安全检查清单](./DEPLOY.md#安全检查清单)。

## 🗺️ 项目状态

**Alpha** —— 可用,但还没有版本号,接口可能变动。生产部署前请通读
[`DEPLOY.md`](./DEPLOY.md)。

已规划但未实现的工作见 [`TODO.md`](./TODO.md)。

## 📄 License

MIT
