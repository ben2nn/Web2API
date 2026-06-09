# qwen2API 中文说明

这是 [README.md](./README.md) 的中文主文档镜像。当前主线为 `v2.0` Go 后端 + React WebUI；`v1.0` Python/FastAPI 仅作为历史版本说明。

核心内容请直接阅读 [README.md](./README.md)，其中包含：

- 项目能力与接口列表
- Mermaid 架构图
- Docker Hub 拉取部署
- 本地 Docker 编译部署
- GitHub Actions 自动打包 Docker
- `.env`、`data`、`logs` 路径说明
- 环境变量注入 API Key、账号和 keepalive 的说明

重要路径：

- Docker 容器内数据目录：`/app/data`
- Docker 默认宿主机数据目录：当前目录 `./data`
- 本地非 Docker 运行默认数据目录：当前项目下 `data`

不要在 `.env.example`、README 或提交记录中写入真实 `ADMIN_KEY`、Qwen token、Cookie、密码或下游 API Key。
