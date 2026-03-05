#!/usr/bin/env bash
# Usage: ./deploy.sh user@homeserver [/remote/path]
# Example: ./deploy.sh pi@192.168.0.10 ~/apps/gamepad
set -euo pipefail

REMOTE="${1:?Usage: $0 user@host [remote_path]}"
REMOTE_PATH="${2:-~/gamepad}"
IMAGE="gamepad:latest"
TAR="/tmp/gamepad.tar"

echo "==> Building Docker image for linux/amd64..."
docker build --platform linux/amd64 -t "$IMAGE" .

echo "==> Saving image to $TAR..."
docker save "$IMAGE" -o "$TAR"

echo "==> Uploading image to $REMOTE:$REMOTE_PATH ..."
ssh "$REMOTE" "mkdir -p $REMOTE_PATH"
scp "$TAR" "$REMOTE:$REMOTE_PATH/gamepad.tar"
scp docker-compose.yml "$REMOTE:$REMOTE_PATH/docker-compose.yml"

echo "==> Loading image on remote..."
ssh "$REMOTE" "docker load -i $REMOTE_PATH/gamepad.tar && rm $REMOTE_PATH/gamepad.tar"

echo "==> Starting up new image..."
ssh "$REMOTE" "cd $REMOTE_PATH && docker compose up -d"

echo ""
echo "==> Done. Next steps on the homeserver:"
echo ""
echo "  1. Create $REMOTE_PATH/.env  (copy from .env.example, fill in SECRET_KEY_BASE)"
echo "     Generate a key:  mix phx.gen.secret"
echo ""
echo "  2. Start the container:"
echo "     cd $REMOTE_PATH && docker compose up -d"
echo ""
echo "  3. Configure cloudflared (see below)."
