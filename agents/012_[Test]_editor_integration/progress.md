# 操作记录
- `feature/rich-text` 已合并 `feature/reference-layout`，并取得完整 operator catalog。
- 新增 `test/profile-integration.browser.test.cjs`，使用真实 Chromium 执行 DOM 交互及 PNG 导出检查。首次运行发现静态测试服务器需显式返回 HTML MIME，已修正。
- `node --test test/*.test.js`：8 项通过；`node test/qr.browser.test.cjs`：通过。
- 综合浏览器测试已验证条码、语录/格言切换、选项 DOM/画布位置及二维码位置；当前仅两项预期布局修复断言失败：空阵营 code 回退文本、qrCount=1 仍绘制 QR2。
