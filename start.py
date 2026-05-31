#!/usr/bin/env python3
"""
qwen2API Enterprise Gateway 启动脚本

前端: Vite dev server  http://localhost:5174  (热更新)
后端: uvicorn          http://localhost:7860  (API 网关)
"""
import os
import sys
import subprocess
import time
import signal
from pathlib import Path

WORKSPACE_DIR = Path(__file__).parent.absolute()
BACKEND_DIR = WORKSPACE_DIR / "backend"
FRONTEND_DIR = WORKSPACE_DIR / "frontend"
LOGS_DIR = WORKSPACE_DIR / "logs"
DATA_DIR = WORKSPACE_DIR / "data"
VENV_DIR = WORKSPACE_DIR / ".venv"


def ensure_dirs():
    LOGS_DIR.mkdir(exist_ok=True)
    DATA_DIR.mkdir(exist_ok=True)


def check_python():
    if sys.version_info < (3, 10):
        print("[FAIL] 需要 Python 3.10+，当前版本:", sys.version)
        sys.exit(1)


def get_venv_python():
    """获取 venv 环境中的 Python 解释器路径"""
    if os.name == "nt":  # Windows
        return VENV_DIR / "Scripts" / "python.exe"
    else:  # Linux/Mac
        return VENV_DIR / "bin" / "python"


def get_venv_pip():
    """获取 venv 环境中的 pip 路径"""
    if os.name == "nt":  # Windows
        return VENV_DIR / "Scripts" / "pip.exe"
    else:  # Linux/Mac
        return VENV_DIR / "bin" / "pip"


def create_venv():
    """创建 Python venv 虚拟环境"""
    venv_python = get_venv_python()

    # 如果 venv 已存在，检查是否可用
    if VENV_DIR.exists() and venv_python.exists():
        print("[OK] venv 虚拟环境已存在")
        return True

    print("[STEP 0/5] 创建 Python venv 虚拟环境...")
    try:
        # 创建 venv
        subprocess.check_call(
            [sys.executable, "-m", "venv", str(VENV_DIR)],
            cwd=WORKSPACE_DIR,
        )
        print(f"[OK] venv 虚拟环境已创建: {VENV_DIR}")

        # 升级 pip
        print("  -> 升级 pip...")
        subprocess.check_call(
            [str(venv_python), "-m", "pip", "install", "--upgrade", "pip", "-q"],
            cwd=WORKSPACE_DIR,
        )
        print("[OK] pip 已升级")
        return True
    except Exception as e:
        print(f"[FAIL] 创建 venv 失败: {e}")
        return False


def install_backend_deps():
    print("[STEP 1/5] 安装后端依赖...")
    env = os.environ.copy()
    env["PYTHONPATH"] = str(WORKSPACE_DIR)

    venv_python = get_venv_python()
    if not venv_python.exists():
        print("[FAIL] venv 环境不存在，请先创建 venv")
        sys.exit(1)

    try:
        subprocess.check_call(
            [str(venv_python), "-m", "pip", "install", "-r", "requirements.txt", "-q"],
            cwd=BACKEND_DIR,
            env=env,
        )
        print("[OK] 后端依赖已就绪")
    except Exception as e:
        print(f"[WARN] 后端依赖安装异常: {e}")


def fetch_browser():
    print("[STEP 2/5] 检查注册功能所需的 Camoufox 浏览器内核...")
    env = os.environ.copy()
    env["PYTHONPATH"] = str(WORKSPACE_DIR)

    venv_python = get_venv_python()
    if not venv_python.exists():
        print("[FAIL] venv 环境不存在，请先创建 venv")
        sys.exit(1)

    try:
        result = subprocess.run(
            [str(venv_python), "-m", "camoufox", "path"],
            capture_output=True, text=True, timeout=10, env=env,
        )
        if result.returncode == 0 and result.stdout.strip():
            print("[OK] 浏览器内核已存在，跳过下载")
            return
    except Exception:
        pass
    print("  -> 正在下载 Camoufox 内核（仅注册/激活账号时会使用，请耐心等待）...")
    try:
        subprocess.check_call(
            [str(venv_python), "-m", "camoufox", "fetch"],
            cwd=WORKSPACE_DIR,
            env=env,
        )
        print("[OK] 浏览器内核下载完成")
    except Exception as e:
        print(f"[WARN] 浏览器内核下载异常: {e}")


def start_frontend() -> subprocess.Popen:
    print("[STEP 3/5] 启动前端开发服务器...")
    is_windows = os.name == "nt"

    if not (FRONTEND_DIR / "node_modules").exists():
        print("  -> 正在执行 npm install...")
        try:
            subprocess.check_call(
                "npm install" if is_windows else ["npm", "install"],
                cwd=FRONTEND_DIR,
                shell=is_windows,
            )
        except subprocess.CalledProcessError as e:
            print(f"[FAIL] npm install 失败: {e}")
            sys.exit(1)

    proc = subprocess.Popen(
        "npm run dev" if is_windows else ["npm", "run", "dev"],
        cwd=FRONTEND_DIR,
        shell=is_windows,
    )
    print(f"[OK] 前端已启动 (PID: {proc.pid})  ->  http://127.0.0.1:5174")
    return proc


def kill_port(port: int):
    """Kill any process occupying the given port."""
    try:
        if os.name == "nt":
            result = subprocess.run(
                ["netstat", "-ano", "-p", "TCP"],
                capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.splitlines():
                if f":{port} " in line and "LISTENING" in line:
                    pid = line.strip().split()[-1]
                    if pid.isdigit():
                        subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
                        print(f"  -> 已终止占用 {port} 端口的旧进程 (PID: {pid})")
                        time.sleep(1)
                        return
        else:
            result = subprocess.run(
                ["lsof", "-ti", f"tcp:{port}"],
                capture_output=True, text=True, timeout=5
            )
            pid = result.stdout.strip()
            if pid:
                subprocess.run(["kill", "-9", pid], capture_output=True)
                print(f"  -> 已终止占用 {port} 端口的旧进程 (PID: {pid})")
                time.sleep(1)
    except Exception:
        pass


def start_backend() -> subprocess.Popen:
    print("[STEP 4/5] 启动后端服务...")
    env = os.environ.copy()
    env["PYTHONPATH"] = str(WORKSPACE_DIR)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"

    venv_python = get_venv_python()
    if not venv_python.exists():
        print("[FAIL] venv 环境不存在，请先创建 venv")
        sys.exit(1)

    port = env.get("PORT", "7860")
    workers = env.get("WORKERS", "1")
    kill_port(int(port))

    proc = subprocess.Popen(
        [
            str(venv_python), "-m", "uvicorn",
            "backend.main:app",
            "--host", "0.0.0.0",
            "--port", port,
            "--workers", workers,
        ],
        cwd=WORKSPACE_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=0,
    )
    print(f"[OK] 后端进程已启动 (PID: {proc.pid})，正在等待服务完成初始化...")

    import threading
    ready_event = threading.Event()

    def read_output():
        for line in iter(proc.stdout.readline, b""):
            try:
                decoded = line.decode("utf-8", errors="replace")
            except Exception:
                decoded = str(line)
            print(decoded, end="")
            if "Application startup complete" in decoded or "服务已完全就绪" in decoded:
                ready_event.set()

    threading.Thread(target=read_output, daemon=True).start()

    started = ready_event.wait(timeout=300)
    if not started:
        print("[WARN] 后端初始化超时，服务可能未完全就绪")
    else:
        print("[OK] 服务已完全就绪")

    return proc


def main():
    ensure_dirs()
    check_python()

    # 创建 venv 虚拟环境
    if not create_venv():
        print("[FAIL] 无法创建 venv 环境，退出")
        sys.exit(1)

    install_backend_deps()
    fetch_browser()
    backend_proc = start_backend()
    frontend_proc = start_frontend()

    port = os.environ.get("PORT", "7860")
    browser_auto = os.environ.get("USE_BROWSER_AUTOMATION", "false")
    print()
    print("=" * 50)
    print("  qwen2API 已上线")
    print(f"  前端 WebUI:   http://127.0.0.1:5174")
    print(f"  后端 API:     http://127.0.0.1:{port}")
    print(f"  venv 环境:    {VENV_DIR}")
    print(f"  浏览器自动化: {'启用' if browser_auto.lower() == 'true' else '禁用'}")
    print("=" * 50)
    print("  按 Ctrl+C 停止所有服务")
    print()

    def signal_handler(sig, frame):
        print("\n正在关闭服务...")
        for p in (backend_proc, frontend_proc):
            try:
                p.terminate()
            except Exception:
                pass
        backend_proc.wait()
        print("服务已停止")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        while True:
            if backend_proc.poll() is not None:
                print(f"[FAIL] 后端进程异常退出 (退出码: {backend_proc.returncode})")
                break
            if frontend_proc.poll() is not None:
                print(f"[FAIL] 前端进程异常退出 (退出码: {frontend_proc.returncode})")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        for p in (backend_proc, frontend_proc):
            try:
                if p.poll() is None:
                    p.terminate()
            except Exception:
                pass


if __name__ == "__main__":
    main()
