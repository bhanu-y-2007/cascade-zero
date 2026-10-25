"""
CASCADE ZERO — One-click startup launcher.
Run this file with Python to start both the backend and open a browser.

Usage:
    python launch.py

This script:
  1. Installs Python dependencies
  2. Installs Node.js dependencies (npm install)
  3. Starts the FastAPI backend on port 8000 in the background
  4. Starts the Vite frontend on port 5173 in the background
  5. Waits for both to be ready
  6. Opens http://localhost:5173 in your default browser
"""
import os
import subprocess
import sys
import time
import urllib.request
import webbrowser

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_PORT = 8000
FRONTEND_PORT = 5173
BACKEND_URL = f"http://localhost:{BACKEND_PORT}"
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"

print("=" * 60)
print("CASCADE ZERO — Startup Launcher")
print("=" * 60)
os.chdir(PROJECT_DIR)
print(f"Project directory: {PROJECT_DIR}\n")

# ── 1. Install Python deps ──────────────────────────────────────
print("[1] Installing Python dependencies...")
result = subprocess.run(
    [sys.executable, "-m", "pip", "install", "-r", "requirements.txt", "-q"],
    capture_output=True, text=True
)
if result.returncode != 0:
    print(f"    ❌ pip install failed:\n{result.stderr}")
    sys.exit(1)
print("    ✅ Python dependencies ready")

# ── 2. Install Node deps ────────────────────────────────────────
print("[2] Installing Node.js dependencies (npm install)...")
result = subprocess.run(
    ["npm", "install", "--silent"],
    capture_output=True, text=True, shell=True
)
if result.returncode != 0:
    print(f"    ⚠️  npm install returned code {result.returncode} — may already be installed")
else:
    print("    ✅ Node.js dependencies ready")

# ── 3. Start backend ────────────────────────────────────────────
print(f"\n[3] Starting backend on {BACKEND_URL} ...")
backend_proc = subprocess.Popen(
    [sys.executable, "server.py"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
)

# Wait up to 15s for the backend health endpoint
for attempt in range(30):
    time.sleep(0.5)
    try:
        with urllib.request.urlopen(f"{BACKEND_URL}/api/health", timeout=2) as resp:
            if resp.status == 200:
                print(f"    ✅ Backend is up at {BACKEND_URL}")
                print(f"    📖 API docs: {BACKEND_URL}/docs")
                break
    except Exception:
        pass
    if backend_proc.poll() is not None:
        out = backend_proc.stdout.read()
        print(f"    ❌ Backend process exited early:\n{out}")
        sys.exit(1)
else:
    print(f"    ❌ Backend did not respond within 15s. Check for port conflicts on :{BACKEND_PORT}")
    backend_proc.terminate()
    sys.exit(1)

# ── 4. Start frontend ───────────────────────────────────────────
print(f"\n[4] Starting frontend on {FRONTEND_URL} ...")
frontend_proc = subprocess.Popen(
    "npm run dev",
    shell=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
)

# Wait up to 20s for Vite dev server
for attempt in range(40):
    time.sleep(0.5)
    try:
        with urllib.request.urlopen(FRONTEND_URL, timeout=2) as resp:
            if resp.status == 200:
                print(f"    ✅ Frontend is up at {FRONTEND_URL}")
                break
    except Exception:
        pass
    if frontend_proc.poll() is not None:
        out = frontend_proc.stdout.read()
        print(f"    ❌ Frontend process exited early:\n{out}")
        backend_proc.terminate()
        sys.exit(1)
else:
    print(f"    ⚠️  Frontend may still be starting — check {FRONTEND_URL}")

# ── 5. Open browser ─────────────────────────────────────────────
print(f"\n[5] Opening browser: {FRONTEND_URL}")
webbrowser.open(FRONTEND_URL)

print("\n" + "=" * 60)
print("CASCADE ZERO is running!")
print(f"  Frontend:  {FRONTEND_URL}")
print(f"  Backend:   {BACKEND_URL}")
print(f"  API docs:  {BACKEND_URL}/docs")
print("=" * 60)
print("\nPress CTRL+C to stop both services.\n")

# ── 6. Keep running and stream backend logs ─────────────────────
try:
    while True:
        line = backend_proc.stdout.readline()
        if line:
            print(f"[backend] {line}", end="")
        if backend_proc.poll() is not None:
            print("\n[backend] Process ended.")
            break
        if frontend_proc.poll() is not None:
            print("\n[frontend] Process ended.")
            break
        if not line:
            time.sleep(0.1)
except KeyboardInterrupt:
    print("\n\nStopping services...")
    backend_proc.terminate()
    frontend_proc.terminate()
    print("Done.")
