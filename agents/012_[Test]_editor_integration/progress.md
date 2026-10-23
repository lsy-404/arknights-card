# 操作记录
- `feature/rich-text` 已合并 `feature/reference-layout`，并取得完整 operator catalog。
- 新增 `test/profile-integration.browser.test.cjs`，使用真实 Chromium 执行 DOM 交互及 PNG 导出检查。首次运行发现静态测试服务器需显式返回 HTML MIME，已修正。
- `node --test test/*.test.js`：8 项通过；`node test/qr.browser.test.cjs`：通过。
- 综合浏览器测试已验证条码、语录/格言切换、选项 DOM/画布位置及二维码位置；当前仅两项预期布局修复断言失败：空阵营 code 回退文本、qrCount=1 仍绘制 QR2。
- 富文本溢出修复和扩展 browser tests 已提交。当前 9 项 Node 测试与 `test/rich-text.browser.test.cjs` 通过，后者确认 200px字号超出64px框时DOM与Canvas均保留可见字形。
- 合入 `feature/reference-layout` 的布局修复后，综合浏览器测试全部通过：434卡目录可完整加载；克莱门莎可用中文、连续拼音、首字母、英文检索并导出头像；所有25阵营默认文案完整且可容纳；QR画布框拖放、空code与qrCount导出行为正确；昵称条码、选项DOM/导出位置、QR与头像几何均通过。
- 最终验证：`node --test test/*.test.js` 11项通过；`node test/profile-integration.browser.test.cjs` 通过；`node test/rich-text.browser.test.cjs` 通过，DOM/Canvas像素文本bbox误差0px；`node test/qr.browser.test.cjs` 通过。
