// Executor — Painel do BOPE
// Conversa com o Helper (node 626.js) em http://127.0.0.1:7962.

const HELPER = 'http://127.0.0.1:7962';

const api = async (path, opts = {}) => {
  const r = await fetch(HELPER + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { ok: r.ok, raw: txt }; }
};

const log = (() => {
  const el = document.getElementById('log');
  return (msg, cls = '') => {
    const row = document.createElement('div');
    if (cls) row.className = cls;
    row.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    el.appendChild(row);
    el.scrollTop = el.scrollHeight;
  };
})();

// Scripts em sessionStorage (some ao fechar aba)
const SCRIPTS_KEY = 'bope.exec.scripts';
function loadScripts() { try { return JSON.parse(sessionStorage.getItem(SCRIPTS_KEY) || '{}'); } catch { return {}; } }
function saveScripts(s) { sessionStorage.setItem(SCRIPTS_KEY, JSON.stringify(s)); }
let scripts = loadScripts();
let currentName = null;

function renderList() {
  const list = document.getElementById('scripts-list');
  list.innerHTML = '';
  const names = Object.keys(scripts).sort();
  if (!names.length) {
    const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'Nenhum script salvo.';
    list.appendChild(e); return;
  }
  for (const name of names) {
    const row = document.createElement('div');
    row.className = 'item' + (name === currentName ? ' active' : '');
    const n = document.createElement('span'); n.className = 'name'; n.textContent = name;
    const x = document.createElement('span'); x.className = 'x'; x.textContent = '×'; x.title = 'Remover';
    x.addEventListener('click', e => {
      e.stopPropagation();
      delete scripts[name]; saveScripts(scripts);
      if (currentName === name) { currentName = null; if (editor) editor.setValue(''); }
      renderList();
    });
    row.appendChild(n); row.appendChild(x);
    row.addEventListener('click', () => {
      currentName = name; editor.setValue(scripts[name] || '');
      document.getElementById('script-name').value = name; renderList();
    });
    list.appendChild(row);
  }
}
renderList();

// Monaco
let editor;
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
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: '-- cole seu script aqui\nprint(identifyexecutor())\n',
    language: 'luau',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    tabSize: 4,
  });
  editor.addAction({
    id: 'exec',
    label: 'Executar',
    keybindings: [monaco.KeyCode.F5],
    run: runScript,
  });
});

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

document.getElementById('btn-run').addEventListener('click', runScript);

document.getElementById('btn-save').addEventListener('click', () => {
  const name = document.getElementById('script-name').value.trim() || 'sem-nome.lua';
  scripts[name] = editor.getValue();
  saveScripts(scripts);
  currentName = name; renderList();
  log('salvo "' + name + '"', 'ok');
});

document.getElementById('btn-inject').addEventListener('click', async () => {
  log('injetando…');
  try {
    const r = await api('/inject', { method: 'POST' });
    if (r.ok) { log(r.message || 'injetado', 'ok'); refreshStatus(); }
    else log('falha: ' + (r.message || 'desconhecido'), 'err');
  } catch (e) { log('erro: ' + e.message + ' (helper offline?)', 'err'); }
});

// Status heartbeat — chama o /exec/state do Helper
async function refreshStatus() {
  const pill = document.getElementById('loader-pill');
  const txt = document.getElementById('loader-status');
  const banner = document.getElementById('offline-banner');
  try {
    const s = await api('/exec/state');
    banner.classList.remove('show');
    if (s.injected) { pill.classList.remove('err'); pill.classList.add('on'); txt.textContent = `injetado · PID ${s.pid}`; }
    else { pill.classList.remove('on','err'); txt.textContent = 'helper online'; }
  } catch {
    pill.classList.remove('on'); pill.classList.add('err');
    txt.textContent = 'helper offline';
    banner.classList.add('show');
  }
}
refreshStatus();
setInterval(refreshStatus, 2500);
