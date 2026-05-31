# qwen2API 启动指南

## 快速开始

### 1. 一键启动

```bash
python start.py
```

启动脚本会自动完成以下操作：
- 创建 Python venv 虚拟环境
- 安装后端依赖
- 下载 Camoufox 浏览器内核
- 启动后端服务
- 启动前端开发服务器

### 2. 访问服务

启动完成后，可以访问：
- **前端 WebUI**: http://127.0.0.1:5174
- **后端 API**: http://127.0.0.1:7860

## 详细说明

### venv 虚拟环境

启动脚本会自动创建 `.venv` 目录作为 Python 虚拟环境，所有依赖都安装在这个环境中，不会影响系统 Python 环境。

**venv 目录结构**:
```
.venv/
├── Scripts/     # Windows
│   ├── python.exe
│   └── pip.exe
├── bin/         # Linux/Mac
│   ├── python
│   └── pip
└── Lib/         # 依赖库
```

### 启动步骤

启动脚本分为 5 个步骤：

1. **[STEP 0/5]** 创建 Python venv 虚拟环境
2. **[STEP 1/5]** 安装后端依赖
3. **[STEP 2/5]** 检查并下载 Camoufox 浏览器内核
4. **[STEP 3/5]** 启动前端开发服务器
5. **[STEP 4/5]** 启动后端服务

### 环境变量

可以通过环境变量配置服务：

```bash
# 设置后端端口（默认 7860）
export PORT=8080

# 设置工作进程数（默认 1）
export WORKERS=2

# 启动服务
python start.py
```

### 停止服务

按 `Ctrl+C` 停止所有服务。

## 故障排除

### 1. venv 创建失败

**问题**: 创建 venv 时出现权限错误

**解决方案**:
```bash
# 手动创建 venv
python -m venv .venv

# 激活 venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

# 安装依赖
pip install -r backend/requirements.txt
```

### 2. 依赖安装失败

**问题**: pip 安装依赖时出现网络错误

**解决方案**:
```bash
# 使用国内镜像源
pip install -r backend/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 3. Camoufox 下载失败

**问题**: 下载 Camoufox 浏览器内核时出现网络错误

**解决方案**:
```bash
# 手动下载 Camoufox
python -m camoufox fetch

# 或者跳过下载（仅影响匿名访问功能）
```

### 4. 端口被占用

**问题**: 启动时提示端口已被占用

**解决方案**:
```bash
# Windows
netstat -ano | findstr :7860
taskkill /F /PID <PID>

# Linux/Mac
lsof -ti:7860 | xargs kill -9
```

## 开发模式

### 仅启动后端

```bash
# 激活 venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

# 启动后端
uvicorn backend.main:app --host 0.0.0.0 --port 7860 --reload
```

### 仅启动前端

```bash
cd frontend
npm install
npm run dev
```

## 生产部署

### 1. 构建前端

```bash
cd frontend
npm run build
```

### 2. 启动后端

```bash
# 激活 venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

# 启动后端（生产模式）
uvicorn backend.main:app --host 0.0.0.0 --port 7860 --workers 4
```

## 更新日志

- **v1.0.0**: 初始版本
  - 自动创建 venv 虚拟环境
  - 自动安装依赖
  - 自动下载 Camoufox 浏览器内核
  - 一键启动前后端服务