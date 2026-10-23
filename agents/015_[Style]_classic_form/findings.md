# 调研与决策
- 以 `922960e` 的左表单右预览结构为视觉基准，保留当前档案字段和 root 即将接入的 app API IDs。
- 右侧 `#sheet` 只包含 `#profile-canvas`。表单使用语义化 fieldset 和普通 range 输入容器；Canvas 独立负责预览及导出。
- 富文本工具栏固定在表单可见区域，Quill run字号继续存储设计像素；仅将输入编辑显示缩至舒适字号，避免改变导出数据。
- 每个编辑器按默认设计字号分别缩放：昵称 0.13、格言 0.8、语录和其他字段约 0.667；整体缩放 DOM，不改 getRuns 的字号值。
- 字体使用 `var(--font-family, Arimo, "Noto Sans SC", sans-serif)`，由主集成提供字体资源；署名项默认启用且可关闭。
