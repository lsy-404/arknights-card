# Findings

## Read-only audit of the primary worktree

- `web/index.html`: `LOCAL PROFILE EDITOR` is a feature/implementation tagline rather than a user task label; remove it. The canvas accessible label `博士扩列档案实时预览` can be shortened to `档案预览` so it describes the artifact without announcing its update cadence.
- `web/app.js`: `正在本地检查二维码…` advertises execution location; `正在识别二维码…` communicates the task status. The catch path interpolates raw `error.message` in `自动检查未完成：${error.message} 可继续手动裁切。`; replace it with a stable user-facing message such as `二维码未能自动识别，请手动调整裁切框。` while retaining the crop path.
- `web/rich-text.js`: `无法加载本地富文本编辑器` exposes how the editor is packaged; use a task-facing message such as `编辑器暂不可用，请刷新后重试。`
- `web/render.js`: image validation/read errors tell users what to correct and should remain. No implementation tagline was found there.
- `web/qr.css`: no visible copy.

## QR module change

- Decoder script load/initialization failures previously carried English implementation details into the visible status. They now report `二维码识别暂不可用`.
- Unexpected QR/crop exceptions now use actionable generic messages rather than raw exception details. User-actionable file validation errors, no-QR guidance, and manual crop instructions remain.
