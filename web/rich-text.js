const SIZE_VALUES = [24, 28, 32, 40, 48, 64, 96, 120, 160, 200];
let quillPromise;
let activeEditor = null;
let toolbarControls = null;

function updateToolbar(editor = activeEditor) {
  if (!toolbarControls || !editor) return;
  const range = editor.savedRange ?? editor.quill.getSelection();
  const format = editor.quill.getFormat(range ?? undefined);
  toolbarControls.bold.setAttribute('aria-pressed', String(Boolean(format.bold)));
  toolbarControls.underline.setAttribute('aria-pressed', String(Boolean(format.underline)));
  toolbarControls.strike.setAttribute('aria-pressed', String(Boolean(format.strike)));

  const size = format.size || `${editor.defaultSize}px`;
  toolbarControls.sizeSelect.value = [...toolbarControls.sizeSelect.options].some((option) => option.value === size)
    ? size
    : '';
  toolbarControls.colorInput.value = format.color || '#171918';
}

function applyAtSavedRange(editor, range, name, value) {
  editor.quill.focus();
  editor.quill.setSelection(range, 'silent');
  if (range.length > 0) {
    editor.quill.formatText(range.index, range.length, name, value, 'user');
  } else {
    editor.quill.format(name, value, 'user');
  }
  editor.savedRange = range;
  updateToolbar(editor);
}

function loadQuill() {
  if (window.Quill) return Promise.resolve(window.Quill);
  if (!quillPromise) {
    quillPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./vendor/quill.js', import.meta.url);
      script.onload = () => resolve(window.Quill);
      script.onerror = () => reject(new Error('无法加载本地富文本编辑器'));
      document.head.append(script);
    });
  }
  return quillPromise;
}

function normalizedRuns(quill) {
  const operations = quill.getContents().ops ?? [];
  const runs = [];
  let remaining = operations.map((op) => ({ ...op }));
  const last = remaining.at(-1);
  if (last && typeof last.insert === 'string' && last.insert.endsWith('\n')) {
    last.insert = last.insert.slice(0, -1);
    if (!last.insert) remaining = remaining.slice(0, -1);
  }

  for (const op of remaining) {
    if (typeof op.insert !== 'string') continue;
    const attributes = op.attributes ?? {};
    const format = {};
    if (attributes.bold) format.bold = true;
    if (attributes.underline) format.underline = true;
    if (attributes.strike) format.strike = true;
    if (attributes.size) format.size = Number.parseFloat(attributes.size);
    if (attributes.color) format.color = attributes.color;
    const previous = runs.at(-1);
    if (previous && Object.keys(format).every((key) => previous[key] === format[key]) &&
      Object.keys(previous).every((key) => key === 'text' || format[key] === previous[key])) {
      previous.text += op.insert;
    } else {
      runs.push({ text: op.insert, ...format });
    }
  }
  return runs;
}

export function setupRichTextToolbar(container) {
  if (container.dataset.richTextToolbar === 'true') return container;
  container.dataset.richTextToolbar = 'true';
  container.classList.add('rich-text-toolbar');
  const buttons = {};

  const makeButton = (label, key, action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.textContent = label;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      const editor = activeEditor;
      if (!editor) return;
      const range = editor.savedRange ?? editor.quill.getSelection();
      if (!range) return;
      editor.quill.setSelection(range, 'silent');
      action(editor.quill, range);
      editor.savedRange = editor.quill.getSelection() ?? range;
      editor.quill.focus();
      updateToolbar(editor);
    });
    container.append(button);
    buttons[key] = button;
  };

  makeButton('粗体', 'bold', (quill) => quill.format('bold', !quill.getFormat().bold, 'user'));
  makeButton('下划线', 'underline', (quill) => quill.format('underline', !quill.getFormat().underline, 'user'));
  makeButton('删除线', 'strike', (quill) => quill.format('strike', !quill.getFormat().strike, 'user'));
  makeButton('清除格式', 'clear', (quill) => quill.removeFormat(quill.getSelection(), 'user'));

  const sizeLabel = document.createElement('label');
  sizeLabel.textContent = '字号';
  const sizeSelect = document.createElement('select');
  sizeSelect.setAttribute('aria-label', '字号');
  for (const size of SIZE_VALUES) {
    const option = document.createElement('option');
    option.value = `${size}px`;
    option.textContent = `${size}`;
    sizeSelect.append(option);
  }
  sizeSelect.addEventListener('change', () => {
    const editor = activeEditor;
    if (!editor) return;
    const range = editor.savedRange ?? editor.quill.getSelection();
    if (!range) return;
    applyAtSavedRange(editor, range, 'size', sizeSelect.value);
  });
  sizeLabel.append(sizeSelect);
  container.append(sizeLabel);

  const colorLabel = document.createElement('label');
  colorLabel.textContent = '文字颜色';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.setAttribute('aria-label', '文字颜色');
  colorInput.value = '#171918';
  colorInput.addEventListener('input', () => {
    const editor = activeEditor;
    if (!editor) return;
    const range = editor.savedRange ?? editor.quill.getSelection();
    if (!range) return;
    applyAtSavedRange(editor, range, 'color', colorInput.value);
  });
  colorInput.addEventListener('change', () => updateToolbar());
  colorLabel.append(colorInput);
  container.append(colorLabel);
  toolbarControls = { ...buttons, sizeSelect, colorInput };
  updateToolbar();
  return container;
}

export async function createRichText(container, {
  onChange = () => {}, initialText = '', placeholder = '', defaultSize = 28, maxLength = 2000,
} = {}) {
  const Quill = await loadQuill();
  const size = Quill.import('attributors/style/size');
  size.whitelist = SIZE_VALUES.map((value) => `${value}px`);
  Quill.register(size, true);
  container.classList.add('rich-text-container');
  const editorNode = document.createElement('div');
  editorNode.className = 'rich-text-editor';
  editorNode.style.setProperty('--rich-text-default-size', `${defaultSize}px`);
  container.replaceChildren(editorNode);

  const quill = new Quill(editorNode, {
    theme: null,
    placeholder,
    formats: ['bold', 'underline', 'strike', 'size', 'color'],
    modules: { toolbar: false, history: { delay: 500, maxStack: 100, userOnly: true } },
  });
  const editor = { container, quill, savedRange: null, defaultSize };
  quill.root.setAttribute('aria-label', placeholder || '文本编辑');
  quill.root.setAttribute('spellcheck', 'false');
  quill.root.addEventListener('focus', () => { activeEditor = editor; updateToolbar(editor); });
  quill.root.addEventListener('mousedown', () => { activeEditor = editor; updateToolbar(editor); });
  quill.on('selection-change', (range) => {
    if (range) {
      editor.savedRange = range;
      activeEditor = editor;
      updateToolbar(editor);
    }
  });
  quill.on('text-change', (_delta, _old, source) => {
    if (source === 'silent') return;
    const text = quill.getText().slice(0, -1);
    if (text.length > maxLength) {
      quill.deleteText(maxLength, text.length - maxLength, 'silent');
      quill.setSelection(maxLength, 0, 'silent');
    }
    onChange(normalizedRuns(quill), quill.getText().slice(0, -1));
    updateToolbar(editor);
  });

  quill.setText(String(initialText).slice(0, maxLength), 'silent');
  return {
    getText: () => quill.getText().slice(0, -1),
    getRuns: () => normalizedRuns(quill),
    setText(text) {
      quill.setText(String(text).slice(0, maxLength), 'silent');
      editor.savedRange = null;
    },
  };
}
