#!/usr/bin/env python3
"""
CASCADE ZERO — self-contained verification script.

Run this from the project directory to:
  1. Verify Python version and packages
  2. Verify the server imports cleanly
  3. Run all backend unit tests with detailed output
  4. Print a startup command reference

Usage:
    python verify.py
"""

import importlib
import sys
import unittest

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


# ──────────────────────────────────────────────────────────────────────────────
# 1. Python version check
# ──────────────────────────────────────────────────────────────────────────────
print("=" * 70)
print("CASCADE ZERO — Backend Verification Script")
print("=" * 70)

major, minor = sys.version_info[:2]
print(f"\n[1] Python version: {sys.version}")
if major < 3 or (major == 3 and minor < 11):
    print("    ❌  Python 3.11+ is required.")
    sys.exit(1)
else:
    print("    ✅  Python version OK")


# ──────────────────────────────────────────────────────────────────────────────
# 2. Required package checks
# ──────────────────────────────────────────────────────────────────────────────
print("\n[2] Checking required packages...")
REQUIRED = {
    "fastapi": "0.115",
    "uvicorn": "0.34",
    "httpx": "0.28",
    "pydantic": "2.10",
    "dotenv": None,  # python-dotenv exposes 'dotenv'
}
all_ok = True
for package, min_ver in REQUIRED.items():
    try:
        mod = importlib.import_module(package)
        ver = getattr(mod, "__version__", "unknown")
        print(f"    ✅  {package} {ver}")
    except ImportError:
        print(f"    ❌  {package} NOT FOUND — run: pip install -r requirements.txt")
        all_ok = False

if not all_ok:
    print("\nInstall missing packages then rerun this script.")
    sys.exit(1)


# ──────────────────────────────────────────────────────────────────────────────
# 3. Server import check
# ──────────────────────────────────────────────────────────────────────────────
print("\n[3] Importing server module...")
try:
    import server  # noqa: F401
    print("    ✅  server.py imported successfully")
except Exception as exc:
    print(f"    ❌  server.py failed to import: {exc}")
    sys.exit(1)


# ──────────────────────────────────────────────────────────────────────────────
# 4. Run all backend tests
# ──────────────────────────────────────────────────────────────────────────────
print("\n[4] Running backend tests...\n")
print("-" * 70)

loader = unittest.TestLoader()
suite = loader.discover(start_dir="tests", pattern="test_*.py")

runner = unittest.TextTestRunner(verbosity=2, stream=sys.stdout, buffer=True)
result = runner.run(suite)

print("-" * 70)
print(f"\n[4] Results:")
print(f"    Tests run:   {result.testsRun}")
print(f"    Failures:    {len(result.failures)}")
print(f"    Errors:      {len(result.errors)}")
print(f"    Skipped:     {len(result.skipped)}")

if result.failures or result.errors:
    print("\n    ❌  Some tests FAILED — see output above for details.")
    failed = True
else:
    print("\n    ✅  All tests PASSED")
    failed = False


# ──────────────────────────────────────────────────────────────────────────────
# 5. Print startup reference
# ──────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("Startup Commands")
print("=" * 70)
print("""
  TERMINAL 1 — Backend:
    python server.py
    # → starts at http://localhost:8000
    # → API docs at http://localhost:8000/docs
    # → health check: http://localhost:8000/api/health

  TERMINAL 2 — Frontend (after npm install in project dir):
    npm run dev
    # → opens at http://localhost:5173
    # → Vite proxies /api/* to http://127.0.0.1:8000
""")

sys.exit(1 if failed else 0)
