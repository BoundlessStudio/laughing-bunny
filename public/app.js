const $ = (id) => document.getElementById(id);

const state = {
  sandboxes: [],
  selectedSandboxId: null
};

const asJson = async (res) => {
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || JSON.stringify(payload));
  return payload;
};

const callApi = async (url, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  return asJson(await fetch(url, { ...options, headers }));
};

const render = (id, data) => {
  $(id).textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
};

const selectedId = () => {
  if (!state.selectedSandboxId) throw new Error('Select a sandbox first');
  return state.selectedSandboxId;
};

const statusBadge = (status) => status || 'unknown';

const renderSelectedHeader = () => {
  const title = $('selected-title');
  const subtitle = $('selected-subtitle');
  const actions = $('selected-actions');
  actions.innerHTML = '';

  if (!state.selectedSandboxId) {
    title.textContent = 'Select a sandbox';
    subtitle.textContent = 'Pick a sandbox on the left to manage files, terminal, env vars, and VNC.';
    return;
  }

  const selected = state.sandboxes.find((sb) => sb.id === state.selectedSandboxId);
  title.textContent = selected?.id || state.selectedSandboxId;
  subtitle.textContent = `Status: ${statusBadge(selected?.info?.status)}${selected?.info?.region ? ` · Region: ${selected.info.region}` : ''}`;

  const makeBtn = (label, handler, css = '') => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = css;
    btn.onclick = handler;
    actions.appendChild(btn);
  };

  makeBtn('Start', async () => {
    await callApi(`/api/sandboxes/${selectedId()}/start`, { method: 'POST' });
    await refreshSandboxes();
  });
  makeBtn('Stop', async () => {
    await callApi(`/api/sandboxes/${selectedId()}/stop`, { method: 'POST' });
    await refreshSandboxes();
  }, 'ghost');
  makeBtn('Delete', async () => {
    await callApi(`/api/sandboxes/${selectedId()}`, { method: 'DELETE' });
    state.selectedSandboxId = null;
    await refreshSandboxes();
  }, 'danger');
};

const refreshSandboxes = async () => {
  state.sandboxes = await callApi('/api/sandboxes');
  const list = $('sandbox-list');
  list.innerHTML = '';

  if (state.sandboxes.length > 0 && !state.selectedSandboxId) {
    state.selectedSandboxId = state.sandboxes[0].id;
  }

  if (state.selectedSandboxId && !state.sandboxes.some((x) => x.id === state.selectedSandboxId)) {
    state.selectedSandboxId = state.sandboxes[0]?.id ?? null;
  }

  for (const item of state.sandboxes) {
    const node = document.createElement('button');
    node.className = `sandbox-item ${item.id === state.selectedSandboxId ? 'active' : ''}`;
    node.innerHTML = `<div><strong>${item.id.slice(0, 18)}...</strong></div><div class="sandbox-meta">${statusBadge(item.info?.status)}</div>`;
    node.onclick = () => {
      state.selectedSandboxId = item.id;
      refreshSandboxes().catch((err) => alert(err.message));
    };
    list.appendChild(node);
  }

  renderSelectedHeader();
};

$('create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const result = await callApi('/api/sandboxes', {
    method: 'POST',
    body: JSON.stringify({
      template: form.get('template'),
      timeoutSeconds: Number(form.get('timeoutSeconds')),
    }),
  });
  state.selectedSandboxId = result.id;
  await refreshSandboxes();
});

$('refresh-sandboxes').onclick = () => refreshSandboxes().catch((err) => alert(err.message));

$('list-files').onclick = async () => {
  const sandboxId = selectedId();
  const path = encodeURIComponent($('file-path').value.trim() || '/');
  render('file-list-output', await callApi(`/api/sandboxes/${sandboxId}/files?path=${path}`));
};

$('read-file').onclick = async () => {
  const sandboxId = selectedId();
  const filePath = encodeURIComponent($('file-content-path').value.trim());
  render('file-content-output', await callApi(`/api/sandboxes/${sandboxId}/file-content?path=${filePath}`));
};

$('run-command').onclick = async () => {
  const sandboxId = selectedId();
  const command = $('terminal-command').value;
  render('terminal-output', await callApi(`/api/sandboxes/${sandboxId}/terminal`, {
    method: 'POST',
    body: JSON.stringify({ command })
  }));
};

$('load-env').onclick = async () => {
  render('env-output', await callApi(`/api/sandboxes/${selectedId()}/env`));
};

$('set-env').onclick = async () => {
  const key = $('env-key').value.trim();
  const value = $('env-value').value;
  render('env-output', await callApi(`/api/sandboxes/${selectedId()}/env`, {
    method: 'PUT',
    body: JSON.stringify({ key, value }),
  }));
};

$('delete-env').onclick = async () => {
  const key = encodeURIComponent($('env-key').value.trim());
  await callApi(`/api/sandboxes/${selectedId()}/env/${key}`, { method: 'DELETE' });
  render('env-output', 'Deleted');
};

$('vnc-status').onclick = async () => {
  render('vnc-output', await callApi(`/api/sandboxes/${selectedId()}/vnc`));
};

$('vnc-start').onclick = async () => {
  render('vnc-output', await callApi(`/api/sandboxes/${selectedId()}/vnc/start`, { method: 'POST' }));
};

$('vnc-stop').onclick = async () => {
  render('vnc-output', await callApi(`/api/sandboxes/${selectedId()}/vnc/stop`, { method: 'POST' }));
};

refreshSandboxes().catch((err) => {
  render('sandbox-list', `Unable to load sandboxes: ${err.message}`);
});
