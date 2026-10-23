# 调研记录

- jsQR 适合纯浏览器本地解码，需 vendoring 运行时和保留许可证。
- 当前仓库尚无 web/ 或 test/ 目录，需先确认分支共享状态与 package/test 环境。
- jsQR npm 1.4.0 使用 Apache-2.0；运行时代码与 LICENSE 已本地 vendoring，页面加载相对 URL，不调用 CDN。
- 截图裁切以 QR 四角外扩 20% 边长作为静区，较最小 QR 的 4 模块需求留有余量；靠近图像边界时在边界内截取。
- 浏览器端行为测试使用本地 Playwright + qrcode 临时依赖生成聊天截图，分别确认中心 logo 能解码、白底无码失败提示、白边缘二维码以及手动移动裁剪框后仍可解码。
- 测试初始缺少 work/ 目录，npm pack 报 ENOENT；创建目录后下载成功。第一次浏览器测试在 page.evaluate 中误引用 Node 侧 QRCode，全局不可用；改为在 Node 侧生成 data URL 后传入页面，测试通过。
- 增加固定聊天截图 fixture 后，边缘二维码测试误将整张截图缩放进边缘画布导致失败；改为从截图中取出二维码区域构造边缘用例后全部通过。
