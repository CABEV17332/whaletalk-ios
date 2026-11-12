#!/bin/bash
# 极简 WKWebView 壳 → 未签名 .ipa
# 不需要 Xcode 工程、不需要 Capacitor，只需要装好 Xcode（提供 iOS SDK）。
#
#   bash build-minimal-ipa.sh https://chat.example.com
#
# 产物：~/WhaleTalk-unsigned.ipa（用 Sideloadly 自签安装）

set -euo pipefail

SERVER_URL="${1:-}"
if [ -z "$SERVER_URL" ]; then
  echo "用法: bash build-minimal-ipa.sh https://你的服务器地址" >&2
  exit 1
fi

APP_NAME="WhaleTalk"
BUNDLE_ID="com.whaletalk.app"
DISPLAY_NAME="鲸语"
WORK="$HOME/whaletalk-ipa-build"
APP="$WORK/Payload/$APP_NAME.app"

rm -rf "$WORK"
mkdir -p "$APP"

cat > "$WORK/AppDelegate.swift" <<'SWIFT'
import UIKit
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = WhaleViewController()
        window?.makeKeyAndVisible()
        return true
    }
}

final class WhaleViewController: UIViewController, WKNavigationDelegate {
    private var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true
        view.addSubview(webView)

        load()
    }

    private func load() {
        guard let url = URL(string: SERVER_URL_PLACEHOLDER) else { return }
        webView.load(URLRequest(url: url))
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let alert = UIAlertController(title: "连不上服务器",
                                      message: "\(error.localizedDescription)\n\n请检查网络和服务器地址。",
                                      preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "重试", style: .default) { _ in self.load() })
        present(alert, animated: true)
    }
}
SWIFT

# 注入服务器地址
python3 - "$WORK/AppDelegate.swift" "$SERVER_URL" <<'PY'
import sys
path, url = sys.argv[1], sys.argv[2]
src = open(path, encoding="utf-8").read().replace("SERVER_URL_PLACEHOLDER", url)
open(path, "w", encoding="utf-8").write(src)
PY

cat > "$APP/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key><string>zh_CN</string>
    <key>CFBundleDisplayName</key><string>$DISPLAY_NAME</string>
    <key>CFBundleExecutable</key><string>$APP_NAME</string>
    <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>$APP_NAME</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>1.0.0</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>LSRequiresIPhoneOS</key><true/>
    <key>MinimumOSVersion</key><string>12.0</string>
    <key>UILaunchScreen</key><dict/>
    <key>UIRequiredDeviceCapabilities</key><array><string>arm64</string></array>
    <key>UISupportedInterfaceOrientations</key>
    <array><string>UIInterfaceOrientationPortrait</string></array>
    <key>UIStatusBarStyle</key><string>UIStatusBarStyleDefault</string>
    <key>NSAppTransportSecurity</key>
    <dict><key>NSAllowsArbitraryLoads</key><true/></dict>
</dict>
</plist>
PLIST

SDK="$(xcrun --sdk iphoneos --show-sdk-path)"
echo "iOS SDK: $SDK"

xcrun --sdk iphoneos swiftc \
  -target arm64-apple-ios12.0 \
  -sdk "$SDK" \
  -O \
  -o "$APP/$APP_NAME" \
  "$WORK/AppDelegate.swift" \
  -framework UIKit -framework WebKit

cd "$WORK"
zip -qry "$HOME/WhaleTalk-unsigned.ipa" Payload

echo ""
echo "✅ 打包完成: $HOME/WhaleTalk-unsigned.ipa"
echo "   在 Windows 用 Sideloadly 导入这个 ipa，登录 Apple ID 签名安装。"
