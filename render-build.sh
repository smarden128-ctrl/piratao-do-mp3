#!/usr/bin/env bash
set -e

echo "=== Verificando dependências do sistema ==="
ffmpeg -version | head -1 || echo "Aviso: ffmpeg não encontrado"
python3 --version

echo "=== Instalando ferramentas Python ==="
pip3 install yt-dlp spotdl

echo "=== Verificando instalações ==="
python3 -m yt_dlp --version || true
python3 -m spotdl --version || true

echo "=== Instalando pnpm ==="
npm config set prefix "$HOME/.npm-global"
mkdir -p "$HOME/.npm-global/bin"
npm install -g pnpm
export PATH="$HOME/.npm-global/bin:$PATH"

echo "=== Instalando dependências Node.js ==="
pnpm install

echo "=== Construindo o frontend ==="
BASE_PATH=/ PORT=3000 pnpm --filter @workspace/mp3-downloader run build

echo "=== Construindo o servidor API ==="
pnpm --filter @workspace/api-server run build

echo "=== Build concluído com sucesso! ==="
