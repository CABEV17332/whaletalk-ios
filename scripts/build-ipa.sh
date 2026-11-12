#!/usr/bin/env bash
# 在 Mac 上一条命令打出未签名 .ipa（之后用 Sideloadly / AltStore 自签安装）
#
#   ./scripts/build-ipa.sh https://chat.example.com
#
set -euo pipefail
cd "$(dirname "$0")/.."

URL="${1:-${WHALETALK_SERVER_URL:-}}"
if [ -z "$URL" ]; then
  echo "用法: ./scripts/build-ipa.sh https://你的服务器地址" >&2
  exit 1
fi

need() { command -v "$1" >/dev/null 2>&1 || { echo "缺少命令: $1" >&2; exit 1; }; }
need node
need xcodebuild
need zip

node scripts/ios-config.mjs --url "$URL"
npx cap copy ios

cd ios/App
rm -rf build Payload "WhaleTalk-unsigned.ipa"
xcodebuild \
  -project App.xcodeproj \
  -scheme App \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build

APP="build/Build/Products/Release-iphoneos/App.app"
[ -d "$APP" ] || { echo "构建产物不存在: $APP" >&2; exit 1; }

mkdir -p Payload
cp -R "$APP" Payload/
zip -qry "WhaleTalk-unsigned.ipa" Payload
rm -rf Payload

echo ""
echo "✅ 打包完成: $(pwd)/WhaleTalk-unsigned.ipa"
echo "下一步：在 Windows 用 Sideloadly 导入这个 ipa，登录自己的 Apple ID 签名安装。"
