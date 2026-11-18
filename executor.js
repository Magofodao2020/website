// Executor — Painel do BOPE
// Conversa com o Helper (node 626.js) em http://127.0.0.1:7962.
// Funciona sozinho em /executor e embutido na aba "Executor" do painel (iframe).

const HELPER = 'http://127.0.0.1:7962';
const DEFAULT_CODE = '-- cole seu script aqui\nprint(identifyexecutor())\n';

const $ = id => document.getElementById(id);
const icon = name => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'i');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-' + name);
  svg.appendChild(use);
  return svg;
};

const api = async (path, opts = {}) => {
  const r = await fetch(HELPER + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { ok: r.ok, raw: txt }; }
};

const log = (() => {
  const el = $('log');
  return (msg, cls = '') => {
    const empty = el.querySelector('.empty');
    if (empty) empty.remove();
    const row = document.createElement('div');
    if (cls) row.className = cls;
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = new Date().toLocaleTimeString();
    row.appendChild(t);
    row.appendChild(document.createTextNode(msg));
    el.appendChild(row);
    el.scrollTop = el.scrollHeight;
  };
})();

$('btn-clear-log').addEventListener('click', () => {
  $('log').innerHTML = '<div class="empty">Nada por aqui ainda.</div>';
});

// Storage protegido (modo privado / site data bloqueado não pode quebrar a página).
// localStorage: os scripts continuam salvos depois de fechar e abrir o site.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const SCRIPTS_KEY = 'bope.exec.scripts';
// Rascunho do editor: sobrevive a trocar de aba no painel e a fechar o site
const DRAFT_KEY = 'bope.exec.draft';

// Migração: versões antigas guardavam no sessionStorage. Junta o que houver lá
// (sem sobrescrever o que já está no localStorage) e limpa a cópia antiga.
try {
  const oldScripts = JSON.parse(sessionStorage.getItem(SCRIPTS_KEY) || 'null');
  if (oldScripts && typeof oldScripts === 'object') {
    let cur = {};
    try { cur = JSON.parse(store.get(SCRIPTS_KEY) || '{}') || {}; } catch {}
    store.set(SCRIPTS_KEY, JSON.stringify({ ...oldScripts, ...cur }));
    sessionStorage.removeItem(SCRIPTS_KEY);
  }
  const oldDraft = sessionStorage.getItem(DRAFT_KEY);
  if (oldDraft && !store.get(DRAFT_KEY)) store.set(DRAFT_KEY, oldDraft);
  sessionStorage.removeItem(DRAFT_KEY);
} catch {}

function loadScripts() { try { return JSON.parse(store.get(SCRIPTS_KEY) || '{}'); } catch { return {}; } }
function saveScripts(s) { store.set(SCRIPTS_KEY, JSON.stringify(s)); }
function loadDraft() { try { return JSON.parse(store.get(DRAFT_KEY) || 'null'); } catch { return null; } }
function saveDraft() {
  if (!editor) return;
  store.set(DRAFT_KEY, JSON.stringify({ code: editor.getValue(), name: $('script-name').value, current: currentName }));
}

let scripts = loadScripts();
let currentName = null;
let editor;

const draft = loadDraft();
if (draft) {
  $('script-name').value = draft.name || '';
  if (draft.current && scripts[draft.current] != null) currentName = draft.current;
}

function renderList() {
  const list = $('scripts-list');
  list.innerHTML = '';
  const names = Object.keys(scripts).sort();
  $('scripts-count').textContent = names.length;
  if (!names.length) {
    const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'Nenhum script salvo.';
    list.appendChild(e); return;
  }
  for (const name of names) {
    const row = document.createElement('div');
    row.className = 'item' + (name === currentName ? ' active' : '');
    row.tabIndex = 0;
    const n = document.createElement('span'); n.className = 'name'; n.textContent = name; n.title = name;
    const x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.title = 'Remover'; x.setAttribute('aria-label', 'Remover ' + name);
    x.appendChild(icon('x'));
    x.addEventListener('click', e => {
      e.stopPropagation();
      delete scripts[name]; saveScripts(scripts);
      if (currentName === name) { currentName = null; if (editor) editor.setValue(''); }
      renderList(); saveDraft();
      log('removido "' + name + '"');
    });
    row.appendChild(icon('file')); row.appendChild(n); row.appendChild(x);
    const open = () => {
      if (!editor) return;
      currentName = name; editor.setValue(scripts[name] || '');
      $('script-name').value = name; renderList(); saveDraft();
    };
    row.addEventListener('click', open);
    row.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    list.appendChild(row);
  }
}
renderList();

function saveCurrent() {
  if (!editor) return;
  const name = $('script-name').value.trim() || 'sem-nome.lua';
  scripts[name] = editor.getValue();
  saveScripts(scripts);
  currentName = name; $('script-name').value = name;
  renderList(); saveDraft();
  log('salvo "' + name + '"', 'ok');
}

// Monaco (se o CDN não carregar, o resto da página continua funcionando)
if (typeof require !== 'function') {
  const l = $('editor-loading');
  if (l) l.textContent = 'não foi possível carregar o editor (sem internet ou CDN bloqueado)';
  log('erro ao carregar o editor (CDN do Monaco inacessível)', 'err');
} else {
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
require(['vs/editor/editor.main'], () => {
  monaco.languages.register({ id: 'luau' });
  monaco.languages.setMonarchTokensProvider('luau', {
    keywords: ['and','break','do','else','elseif','end','false','for','function','if','in','local','nil','not','or','repeat','return','then','true','until','while','continue','type'],
    tokenizer: {
      root: [
        [/--\[\[/, 'comment', '@blockcomment'],
        [/--.*$/, 'comment'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],
        [/\d+\.?\d*/, 'number'],
        [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
      ],
      blockcomment: [[/]]/, 'comment', '@pop'], [/./, 'comment']],
    },
  });
  // Tema com as cores do painel
  monaco.editor.defineTheme('bope', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'f4f4f5' },
      { token: 'keyword', foreground: 'ff5a5f', fontStyle: 'bold' },
      { token: 'string', foreground: 'e5c400' },
      { token: 'number', foreground: '60a5fa' },
      { token: 'comment', foreground: '6b6b75', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'e4e4e7' },
    ],
    colors: {
      'editor.background': '#0d0d10',
      'editor.foreground': '#f4f4f5',
      'editorLineNumber.foreground': '#3f3f47',
      'editorLineNumber.activeForeground': '#e5c400',
      'editor.lineHighlightBackground': '#141418',
      'editor.lineHighlightBorder': '#00000000',
      'editorCursor.foreground': '#e5c400',
      'editor.selectionBackground': '#e5141b40',
      'editor.inactiveSelectionBackground': '#e5141b22',
      'editorIndentGuide.background1': '#1e1e23',
      'editorWidget.background': '#131316',
      'editorWidget.border': '#26262c',
      'scrollbarSlider.background': '#21212699',
      'scrollbarSlider.hoverBackground': '#34343b',
      'scrollbarSlider.activeBackground': '#3f3f47',
    },
  });
  let initial = DEFAULT_CODE;
  if (draft && typeof draft.code === 'string') initial = draft.code;
  else if (currentName) initial = scripts[currentName];
  editor = monaco.editor.create($('editor'), {
    value: initial,
    language: 'luau',
    theme: 'bope',
    automaticLayout: true,
    minimap: { enabled: false },
    fontFamily: '"Martian Mono", ui-monospace, "Cascadia Mono", Consolas, monospace',
    fontSize: 12.5,
    lineHeight: 21,
    tabSize: 4,
    padding: { top: 12, bottom: 12 },
    scrollBeyondLastLine: false,
    renderLineHighlight: 'all',
    smoothScrolling: true,
    cursorBlinking: 'smooth',
  });
  $('editor-loading').remove();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => monaco.editor.remeasureFonts());
  editor.addAction({
    id: 'exec',
    label: 'Executar',
    keybindings: [monaco.KeyCode.F5],
    run: runScript,
  });
  editor.addAction({
    id: 'save',
    label: 'Salvar script',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    run: saveCurrent,
  });
  let t;
  editor.onDidChangeModelContent(() => { clearTimeout(t); t = setTimeout(saveDraft, 300); });
}, err => {
  const l = $('editor-loading');
  if (l) l.textContent = 'não foi possível carregar o editor (sem internet ou CDN bloqueado)';
  log('erro ao carregar o editor: ' + (err && err.message ? err.message : err), 'err');
});
}

async function runScript() {
  if (!editor) return;
  const body = editor.getValue();
  if (!body.trim()) { log('script vazio', 'err'); return; }
  try {
    const j = await api('/script', { method: 'POST', body: JSON.stringify({ body }) });
    if (j.ok) log('enviado (' + body.length + ' bytes)', 'ok');
    else log('falhou: ' + (j.message || 'erro desconhecido'), 'err');
  } catch (e) { log('erro: ' + e.message + ' (helper offline?)', 'err'); }
}

$('btn-run').addEventListener('click', runScript);
$('btn-save').addEventListener('click', saveCurrent);
$('script-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveCurrent(); });
$('script-name').addEventListener('input', saveDraft);

$('btn-new').addEventListener('click', () => {
  if (!editor) return;
  currentName = null;
  editor.setValue('');
  $('script-name').value = '';
  renderList(); saveDraft();
  editor.focus();
});

// F5 fora do editor também executa (e não recarrega a página/iframe)
window.addEventListener('keydown', e => {
  if (e.key === 'F5' && !(editor && editor.hasTextFocus())) { e.preventDefault(); runScript(); }
});

$('btn-inject').addEventListener('click', async () => {
  log('injetando…');
  try {
    const r = await api('/inject', { method: 'POST' });
    if (r.ok) { log(r.message || 'injetado', 'ok'); refreshStatus(); }
    else log('falha: ' + (r.message || 'desconhecido'), 'err');
  } catch (e) { log('erro: ' + e.message + ' (helper offline?)', 'err'); }
});

// Status heartbeat — chama o /exec/state do Helper
async function refreshStatus() {
  const pill = $('loader-pill');
  const txt = $('loader-status');
  const banner = $('offline-banner');
  try {
    const s = await api('/exec/state');
    banner.classList.remove('show');
    pill.classList.remove('err');
    if (s.injected) { pill.classList.remove('idle'); pill.classList.add('on'); txt.textContent = `injetado · PID ${s.pid}`; }
    else { pill.classList.remove('on'); pill.classList.add('idle'); txt.textContent = 'helper online · não injetado'; }
  } catch {
    pill.classList.remove('on', 'idle'); pill.classList.add('err');
    txt.textContent = 'helper offline';
    banner.classList.add('show');
  }
}
refreshStatus();
setInterval(refreshStatus, 2500);
