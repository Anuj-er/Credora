#!/bin/bash
# Stop Credora servers without affecting other local apps.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTS=(3000 3001 3002 3003 3004 5173 8545)

echo "🛑 Stopping Credora services..."
for port in "${PORTS[@]}"; do
  for pid in $(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null); do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    case "$cwd" in
      "$PROJECT_ROOT"|"$PROJECT_ROOT"/*)
        kill "$pid" 2>/dev/null || true
        ;;
    esac
  done
done

echo "✅ Credora services stopped."
