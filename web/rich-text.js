const SIZE_VALUES = [24, 28, 32, 40, 48, 64, 96, 120, 160, 200];
let quillPromise;
const IMAGE_MAX_EDGE = 256;

function updateToolbar(editor) {
  const controls = editor.toolbar;
  if (!controls) return;
  const range = editor.savedRange ?? editor.quill.getSelection();
  const format = editor.quill.getFormat(range ?? undefined);
  controls.bold.setAttribute('aria-pressed', String(Boolean(format.bold)));
  controls.underline.setAttribute('aria-pressed', String(Boolean(format.underline)));
  controls.strike.setAttribute('aria-pressed', String(Boolean(format.strike)));

  const mixedSize = Array.isArray(format.size);
  const size = format.size || '';
  const defaultOption = controls.sizeSelect.options[0];
  defaultOption.textContent = `默认 · ${editor.defaultSize}`;
  controls.sizeSelect.value = mixedSize
    ? '__mixed'
    : [...controls.sizeSelect.options].some((option) => option.value === size && size)
      ? size
      : '';
  controls.colorInput.value = format.color || '#171918';
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

function scaledImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, IMAGE_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片无法读取，请选择有效的图片文件。'));
    };
    image.src = url;
  });
}

function loadQuill() {
  if (window.Quill) return Promise.resolve(window.Quill);
  if (!quillPromise) {
    quillPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./vendor/quill.js', import.meta.url);
      script.onload = () => resolve(window.Quill);
      script.onerror = () => reject(new Error('编辑器暂不可用，请刷新后重试。'));
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
    const attributes = op.attributes ?? {};
    const format = {};
    if (attributes.bold) format.bold = true;
    if (attributes.underline) format.underline = true;
    if (attributes.strike) format.strike = true;
    if (attributes.size) format.size = Number.parseFloat(attributes.size);
    if (attributes.color) format.color = attributes.color;
    if (typeof op.insert !== 'string') {
      if (typeof op.insert?.image === 'string') runs.push({ image: op.insert.image, ...format });
      continue;
    }
    const previous = runs.at(-1);
    if (previous && !previous.image && Object.keys(format).every((key) => previous[key] === format[key]) &&
      Object.keys(previous).every((key) => key === 'text' || format[key] === previous[key])) {
      previous.text += op.insert;
    } else {
      runs.push({ text: op.insert, ...format });
    }
  }
  return runs;
}

function buildToolbar(container, editor) {
  container.classList.add('rich-text-toolbar');
  const controls = {};

  const makeButton = (label, key, action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.textContent = label;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      const range = editor.savedRange ?? editor.quill.getSelection();
      if (!range) return;
      editor.quill.setSelection(range, 'silent');
      action(editor.quill, range);
      editor.savedRange = editor.quill.getSelection() ?? range;
      editor.quill.focus();
      updateToolbar(editor);
    });
    container.append(button);
    controls[key] = button;
  };

  makeButton('粗体', 'bold', (quill) => quill.format('bold', !quill.getFormat().bold, 'user'));
  makeButton('下划线', 'underline', (quill) => quill.format('underline', !quill.getFormat().underline, 'user'));
  makeButton('删除线', 'strike', (quill) => quill.format('strike', !quill.getFormat().strike, 'user'));
  makeButton('清除格式', 'clear', (quill) => quill.removeFormat(quill.getSelection(), 'user'));

  const sizeLabel = document.createElement('label');
  sizeLabel.textContent = '字号';
  const sizeSelect = document.createElement('select');
  sizeSelect.setAttribute('aria-label', '字号');
  const defaultSizeOption = document.createElement('option');
  defaultSizeOption.value = '';
  defaultSizeOption.textContent = '默认';
  sizeSelect.append(defaultSizeOption);
  const mixedSizeOption = document.createElement('option');
  mixedSizeOption.value = '__mixed';
  mixedSizeOption.textContent = '混合';
  mixedSizeOption.disabled = true;
  sizeSelect.append(mixedSizeOption);
  for (const size of SIZE_VALUES) {
    const option = document.createElement('option');
    option.value = `${size}px`;
    option.textContent = `${size}`;
    sizeSelect.append(option);
  }
  sizeSelect.addEventListener('change', () => {
    const range = editor.savedRange ?? editor.quill.getSelection();
    if (!range) return;
    applyAtSavedRange(editor, range, 'size', sizeSelect.value || false);
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
    const range = editor.savedRange ?? editor.quill.getSelection();
    if (!range) return;
    applyAtSavedRange(editor, range, 'color', colorInput.value);
  });
  colorInput.addEventListener('change', () => updateToolbar(editor));
  colorLabel.append(colorInput);
  container.append(colorLabel);

  const imageInput = document.createElement('input');
  imageInput.type = 'file';
  imageInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
  imageInput.hidden = true;
  imageInput.setAttribute('aria-label', '插入图片文件');
  imageInput.addEventListener('change', async () => {
    const file = imageInput.files?.[0];
    imageInput.value = '';
    if (!file) return;
    try {
      const source = await scaledImageDataUrl(file);
      const range = editor.savedRange ?? editor.quill.getSelection() ?? { index: editor.quill.getLength() - 1, length: 0 };
      editor.quill.insertEmbed(range.index, 'image', source, 'user');
      editor.quill.setSelection(range.index + 1, 0, 'silent');
      editor.savedRange = editor.quill.getSelection();
      editor.quill.focus();
    } catch { }
  });
  makeButton('插入图片', 'image', () => imageInput.click());
  container.append(imageInput);

  return { ...controls, sizeSelect, colorInput };
}

export async function createRichText(container, {
  onChange = () => {}, initialText = '', placeholder = '', defaultSize = 28, maxLength = 2000, toolbar = null,
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
    formats: ['bold', 'underline', 'strike', 'size', 'color', 'image'],
    modules: { toolbar: false, history: { delay: 500, maxStack: 100, userOnly: true } },
  });
  const editor = { container, quill, savedRange: null, defaultSize, toolbar: null };
  if (toolbar) editor.toolbar = buildToolbar(toolbar, editor);
  quill.root.setAttribute('aria-label', placeholder || '文本编辑');
  quill.root.setAttribute('spellcheck', 'false');
  quill.root.addEventListener('focus', () => updateToolbar(editor));
  quill.root.addEventListener('mousedown', () => updateToolbar(editor));
  quill.on('selection-change', (range) => {
    if (range) {
      editor.savedRange = range;
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
  updateToolbar(editor);
  return {
    getText: () => quill.getText().slice(0, -1),
    getRuns: () => normalizedRuns(quill),
    setDefaultSize(value) {
      editor.defaultSize = Number(value);
      editorNode.style.setProperty('--rich-text-default-size', `${editor.defaultSize}px`);
      updateToolbar(editor);
    },
    setText(text) {
      quill.setText(String(text).slice(0, maxLength), 'silent');
      editor.savedRange = null;
    },
  };
}
