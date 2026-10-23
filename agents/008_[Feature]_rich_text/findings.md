# 调研与结论
- Quill 2.0.3 npm 分发物注明 BSD-3-Clause；vendored 浏览器 bundle 及 core CSS 与 LICENSE 文件位于 web/vendor。
- Quill formats 白名单限定粗体、下划线、删除线、字号、文字颜色；字号用 style attributor 注册 24-200 设计像素取值。
- 工具栏控件按 mousedown 阻止编辑器失焦，并对活动编辑器存储的 selection 进行格式更新。
- 浏览器验证使用真实 Chromium HTML clipboard paste；HTML 脚本、事件属性、图片及链接未进入可编辑文档，仅允许文本和白名单格式。
- Canvas 采用测宽后逐 run 绘制，并对传入边界裁剪；运行结果含高度与溢出指标。
