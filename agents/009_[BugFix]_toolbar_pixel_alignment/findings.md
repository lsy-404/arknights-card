# 调查记录
- 浏览器原生下拉/色盘确实需保留 mousedown 默认行为；原选择区通过 Quill 保存的 range 和显式 formatText(index,length,...) 恢复。
- 字号 select 与颜色 input 的真实 mousedown 均未被取消；Chromium 实际点击并键盘打开字号菜单后，原选中文字格式更新成功。
- Canvas 使用 fontBoundingBoxAscent/Descent，并将每 run 的行高 leading 均分到 ascent/descent；行盒分别取各 run 最大 ascent/descent。实际 DOM 与 Canvas 中英混排、混合字号、多行文本像素 bbox 差值 0px。
