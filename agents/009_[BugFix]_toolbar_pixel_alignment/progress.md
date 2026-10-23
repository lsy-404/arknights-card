# 操作记录
- 调整 web/rich-text.js：去除字号/颜色 mousedown 阻止，按保存的 Quill range 显式调用 formatText；同步字号、颜色控件和粗体/下划线/删除线 aria-pressed。
- 调整 web/rich-text-render.js：基于 Canvas fontBoundingBox 字体度量和 CSS line-height 计算每行 baseline，混合字号行采用最大 ascender/descender。
- 扩展 test/rich-text.browser.test.cjs：通过真实 Chromium 鼠标点击和键盘操作原生字号下拉框及色盘；截取 Quill DOM 与 Canvas 输出，逐行比较暗像素 bbox。
- 验证：根单元测试 6 项通过；富文本浏览器测试通过且 bbox 误差 0px；二维码浏览器测试通过；git diff --check 通过。
