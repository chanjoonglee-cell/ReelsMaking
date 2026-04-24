#!/usr/bin/env bash
# Double-click launcher for macOS Finder.
# First run: creates venv, installs deps, prompts for OPENAI_API_KEY.
# Subsequent runs: just starts the server and opens the browser.

set -u

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR" || { echo "failed to cd to $SCRIPT_DIR"; read -r; exit 1; }

echo "╔════════════════════════════════════════╗"
echo "║  정부사업 사업계획서 자동화 도구       ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "작업 폴더: $SCRIPT_DIR"
echo ""

# --- 1) Python 확인 ---------------------------------------------------------
PY=""
for candidate in python3.12 python3.11 python3.10 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    ver=$("$candidate" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || echo "")
    major=${ver%%.*}
    minor=${ver##*.}
    if [ -n "$ver" ] && [ "$major" -ge 3 ] && [ "$minor" -ge 10 ]; then
      PY="$candidate"
      break
    fi
  fi
done

if [ -z "$PY" ]; then
  echo "❌ Python 3.10 이상이 필요합니다."
  echo "   설치: https://www.python.org/downloads/  또는  brew install python@3.12"
  echo ""
  echo "Enter 키를 누르면 창이 닫힙니다."
  read -r
  exit 1
fi
echo "✓ Python: $($PY --version)"

# --- 2) venv --------------------------------------------------------------
if [ ! -d ".venv" ]; then
  echo "• 가상환경(.venv) 생성 중..."
  "$PY" -m venv .venv || { echo "❌ venv 생성 실패"; read -r; exit 1; }
fi
# shellcheck disable=SC1091
source .venv/bin/activate

# --- 3) 의존성 설치 --------------------------------------------------------
STAMP=".venv/.deps-installed"
REQ_MTIME=$(stat -f %m requirements.txt 2>/dev/null || stat -c %Y requirements.txt 2>/dev/null || echo 0)
NEED_INSTALL=1
if [ -f "$STAMP" ]; then
  STAMP_MTIME=$(cat "$STAMP" 2>/dev/null || echo 0)
  if [ "$STAMP_MTIME" = "$REQ_MTIME" ]; then
    NEED_INSTALL=0
  fi
fi

if [ "$NEED_INSTALL" = "1" ]; then
  echo "• 패키지 설치 중... (처음이면 1-2분 걸립니다)"
  python -m pip install --upgrade pip >/dev/null 2>&1
  if python -m pip install -r requirements.txt; then
    echo "$REQ_MTIME" > "$STAMP"
    echo "✓ 패키지 설치 완료"
  else
    echo "❌ 패키지 설치 실패"
    read -r
    exit 1
  fi
else
  echo "✓ 패키지 설치됨 (캐시)"
fi

# --- 4) .env 확인 / OPENAI_API_KEY 입력 -----------------------------------
if [ ! -f ".env" ] || ! grep -q "^OPENAI_API_KEY=sk-" .env 2>/dev/null; then
  echo ""
  echo "🔑 OpenAI API 키가 필요합니다."
  echo "   (https://platform.openai.com/api-keys 에서 발급)"
  echo ""
  printf "   키를 붙여넣고 Enter: "
  read -r USER_KEY
  if [ -z "$USER_KEY" ]; then
    echo "❌ 키가 비었습니다. 창을 다시 열어 주세요."
    read -r
    exit 1
  fi
  cat > .env <<EOF
OPENAI_API_KEY=$USER_KEY
PROPOSAL_MODEL=gpt-4.1
VISION_MODEL=gpt-4o
SESSIONS_DIR=./sessions
HOST=127.0.0.1
PORT=8000
EOF
  echo "✓ .env 저장됨"
fi

# --- 5) 외부 도구 안내 (선택사항) -----------------------------------------
if ! command -v pandoc >/dev/null 2>&1; then
  echo "ℹ️  (선택) pandoc 미설치 — DOCX 품질이 낮을 수 있음. 'brew install pandoc'"
fi
if ! command -v soffice >/dev/null 2>&1 && ! command -v libreoffice >/dev/null 2>&1; then
  echo "ℹ️  (선택) LibreOffice 미설치 — HWP 내보내기 불가. 'brew install --cask libreoffice'"
fi

# --- 6) 포트 점유 확인 ------------------------------------------------------
PORT=8000
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo ""
  echo "⚠️  포트 $PORT 가 이미 사용 중입니다."
  printf "   기존 프로세스를 종료할까요? [y/N]: "
  read -r ans
  if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
    lsof -nP -iTCP:$PORT -sTCP:LISTEN -t | xargs kill -9 2>/dev/null
    sleep 1
  else
    echo "중단합니다."
    read -r
    exit 1
  fi
fi

# --- 7) 서버 실행 ----------------------------------------------------------
echo ""
echo "🚀 서버를 시작합니다: http://127.0.0.1:$PORT"
echo "   (이 창을 닫으면 서버가 종료됩니다)"
echo ""
exec python app.py
