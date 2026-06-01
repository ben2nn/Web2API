# Web2API Enterprise Gateway

一个功能强大的 Qwen API 网关，支持多种访问方式。

## 功能特性

### 1. API 代理

- OpenAI 兼容 API
- Anthropic/Claude 兼容 API
- Gemini 兼容 API
- 模型映射和路由

### 2. 账号管理

- 账号池管理
- 自动注册新账号
- 账号健康检查
- 自动刷新 token

### 3. 匿名访问

- 无需 API Key 即可访问
- 通过 cookies 获取匿名身份
- 自动获取匿名 token

### 4. 浏览器自动化

- 模拟真实用户操作
- 通过浏览器访问 Qwen 网页版
- 不需要登录 token
- 支持流式聊天

## 快速开始

### 1. 一键启动

```bash
python start.py
```

### 2. 访问服务

- **前端 WebUI**: http://127.0.0.1:5174
- **后端 API**: http://127.0.0.1:7860

## 配置选项

### 环境变量

```bash
# 服务配置
PORT=7860
WORKERS=1
ADMIN_KEY=admin

# 匿名访问
ENABLE_ANONYMOUS=true
ANONYMOUS_QUOTA=50000

# 浏览器自动化
USE_BROWSER_AUTOMATION=false
BROWSER_TIMEOUT=120
```

### 前端配置

1. 打开系统设置页面
2. 配置匿名访问开关
3. 配置浏览器自动化开关

## 使用方式

### 1. API 调用

```bash
# OpenAI 兼容
curl http://localhost:7860/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "qwen3.6-plus",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 2. 匿名访问

启用匿名访问后，无需 API Key：

```bash
curl http://localhost:7860/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.6-plus",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 3. 浏览器自动化

启用浏览器自动化后，当没有可用账号时自动使用：

```bash
# 设置环境变量
export USE_BROWSER_AUTOMATION=true

# 启动服务
python start.py
```

## 文档

- [启动指南](STARTUP.md)
- [匿名访问](ANONYMOUS_ACCESS.md)
- [浏览器自动化](BROWSER_AUTOMATION.md)
- [兼容性问题解决方案](COMPATIBILITY_FIX.md)

## 测试

```bash
# 激活 venv 环境
.venv\Scripts\activate

# 测试匿名访问
python test_anonymous.py

# 测试浏览器自动化
python test_browser_chat.py

# 测试完整流程
python test_anonymous_integration.py
```

## 故障排除

### 1. 匿名访问失败

- 检查网络连接
- 检查 Qwen 网站是否可访问
- 查看后端日志

### 2. 浏览器自动化失败

- 检查 Camoufox 是否安装
- 检查浏览器超时配置
- 查看后端日志

### 3. 账号注册失败

- 检查临时邮箱服务
- 手动添加账号
- 使用匿名访问

## 更新日志

### v2.0.0

- 添加匿名访问功能
- 添加浏览器自动化功能
- 添加 venv 虚拟环境支持
- 优化启动脚本

### v1.0.0

- 初始版本
- API 代理功能
- 账号池管理