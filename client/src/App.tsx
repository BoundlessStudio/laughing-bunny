import { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button } from './components/ui/button';

type SandboxItem = { id: string; info?: { status?: string; region?: string } | null };

const api = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || JSON.stringify(data));
  return data;
};

function App() {
  const [sandboxes, setSandboxes] = useState<SandboxItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [template, setTemplate] = useState('code-interpreter');
  const [timeoutSeconds, setTimeoutSeconds] = useState(3600);
  const [path, setPath] = useState('/');
  const [filePath, setFilePath] = useState('');
  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [vncUrl, setVncUrl] = useState('');
  const [noVncUrl, setNoVncUrl] = useState('');
  const [outputs, setOutputs] = useState<Record<string, string>>({});

  const termHostRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const termSocketRef = useRef<WebSocket | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);

  const selectedSandbox = useMemo(() => sandboxes.find((s) => s.id === selected), [sandboxes, selected]);

  const setOut = (key: string, data: unknown) => setOutputs((s) => ({ ...s, [key]: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }));

  const loadSandboxes = async () => {
    const items = await api('/api/sandboxes');
    setSandboxes(items);
    setSelected((prev) => prev && items.find((x: SandboxItem) => x.id === prev) ? prev : items[0]?.id ?? null);
  };

  useEffect(() => { loadSandboxes().catch((e) => setOut('sandboxes', e.message)); }, []);

  const needSelected = () => {
    if (!selected) throw new Error('Select a sandbox first');
    return selected;
  };

  const initXterm = () => {
    if (xtermRef.current || !termHostRef.current) return;

    const xterm = new Terminal({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      theme: {
        background: '#050a14',
        foreground: '#cae2ff'
      }
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(termHostRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitRef.current = fitAddon;

    xterm.onData((data) => {
      if (termSocketRef.current?.readyState === WebSocket.OPEN) {
        termSocketRef.current.send(data);
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      if (termSocketRef.current?.readyState === WebSocket.OPEN) {
        termSocketRef.current.send(JSON.stringify({ type: 'resize', cols: xterm.cols, rows: xterm.rows }));
      }
    };

    resizeHandlerRef.current = handleResize;
    window.addEventListener('resize', handleResize);
  };

  const disconnectTerminal = () => {
    termSocketRef.current?.close();
    termSocketRef.current = null;
  };

  const connectTerminal = () => {
    const sandboxId = needSelected();
    initXterm();
    disconnectTerminal();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/terminal?sandboxId=${encodeURIComponent(sandboxId)}`);
    termSocketRef.current = socket;

    socket.onopen = () => {
      xtermRef.current?.writeln('\r\n[terminal connected]\r');
      const cols = xtermRef.current?.cols ?? 80;
      const rows = xtermRef.current?.rows ?? 24;
      socket.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    socket.onmessage = (event) => {
      xtermRef.current?.write(String(event.data));
    };

    socket.onclose = () => {
      xtermRef.current?.writeln('\r\n[terminal disconnected]\r');
    };

    socket.onerror = () => {
      xtermRef.current?.writeln('\r\n[terminal connection error]\r');
    };

  };

  useEffect(() => {
    return () => {
      disconnectTerminal();
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current);
      }
      xtermRef.current?.dispose();
    };
  }, []);

  const buildNoVncUrl = (raw: string) => {
    const parsed = new URL(raw);
    const protocol = parsed.protocol === 'wss:' || parsed.protocol === 'https:' ? 'wss' : 'ws';
    const host = parsed.hostname;
    const port = parsed.port || (protocol === 'wss' ? '443' : '80');
    const path = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
    return `https://novnc.com/noVNC/vnc.html?autoconnect=true&resize=remote&encrypt=${protocol === 'wss'}&host=${encodeURIComponent(host)}&port=${port}&path=${encodeURIComponent(path)}${parsed.search ? `&${parsed.search.slice(1)}` : ''}`;
  };

  return (
    <div className="app">
      <aside className="panel sidebar">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Sandboxes</h2>
          <Button variant="ghost" onClick={() => loadSandboxes().catch((e) => setOut('sandboxes', e.message))}>Refresh</Button>
        </div>
        <div className="row">
          <input className="input" value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="template" />
          <input className="input" type="number" value={timeoutSeconds} onChange={(e) => setTimeoutSeconds(Number(e.target.value))} />
        </div>
        <Button onClick={async () => {
          const result = await api('/api/sandboxes', { method: 'POST', body: JSON.stringify({ template, timeoutSeconds }) });
          setSelected(result.id);
          await loadSandboxes();
        }}>Create</Button>
        <p className="small">shadcn-style components + AI SDK elements-inspired layout.</p>
        <div className="list">
          {sandboxes.map((sb) => (
            <Button key={sb.id} variant="ghost" className={`item ${selected === sb.id ? 'active' : ''}`} onClick={() => setSelected(sb.id)}>
              <div><strong>{sb.id.slice(0, 18)}...</strong></div>
              <div className="small">{sb.info?.status ?? 'unknown'}</div>
            </Button>
          ))}
        </div>
      </aside>

      <main className="panel main">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>{selected ?? 'Select a sandbox'}</h2>
            <div className="small">{selectedSandbox?.info?.status ?? 'No sandbox selected'}</div>
          </div>
          <div className="row">
            <Button onClick={async () => { await api(`/api/sandboxes/${needSelected()}/start`, { method: 'POST' }); await loadSandboxes(); }}>Start</Button>
            <Button variant="ghost" onClick={async () => { await api(`/api/sandboxes/${needSelected()}/stop`, { method: 'POST' }); await loadSandboxes(); }}>Stop</Button>
            <Button variant="destructive" onClick={async () => { await api(`/api/sandboxes/${needSelected()}`, { method: 'DELETE' }); await loadSandboxes(); }}>Delete</Button>
          </div>
        </div>

        <section className="grid">
          <article className="card">
            <h3>Filesystem</h3>
            <div className="row"><input className="input" value={path} onChange={(e) => setPath(e.target.value)} /><Button onClick={async () => setOut('files', await api(`/api/sandboxes/${needSelected()}/files?path=${encodeURIComponent(path)}`))}>List</Button></div>
            <pre>{outputs.files}</pre>
            <div className="row"><input className="input" value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="/path/to/file" /><Button onClick={async () => setOut('file', await api(`/api/sandboxes/${needSelected()}/file-content?path=${encodeURIComponent(filePath)}`))}>Read</Button></div>
            <pre>{outputs.file}</pre>
          </article>

          <article className="card">
            <h3>Terminal (xterm.js)</h3>
            <div className="row">
              <Button onClick={() => connectTerminal()}>Connect</Button>
              <Button variant="ghost" onClick={() => disconnectTerminal()}>Disconnect</Button>
            </div>
            <div ref={termHostRef} className="terminal" />
          </article>

          <article className="card">
            <h3>Environment Variables</h3>
            <div className="row"><Button onClick={async () => setOut('env', await api(`/api/sandboxes/${needSelected()}/env`))}>Load</Button></div>
            <pre>{outputs.env}</pre>
            <div className="row"><input className="input" value={envKey} onChange={(e) => setEnvKey(e.target.value)} placeholder="KEY" /><input className="input" value={envValue} onChange={(e) => setEnvValue(e.target.value)} placeholder="VALUE" /></div>
            <div className="row"><Button onClick={async () => setOut('env', await api(`/api/sandboxes/${needSelected()}/env`, { method: 'PUT', body: JSON.stringify({ key: envKey, value: envValue }) }))}>Set</Button><Button variant="destructive" onClick={async () => { await api(`/api/sandboxes/${needSelected()}/env/${encodeURIComponent(envKey)}`, { method: 'DELETE' }); setOut('env', 'Deleted'); }}>Delete</Button></div>
          </article>

          <article className="card">
            <h3>VNC (noVNC)</h3>
            <div className="row">
              <Button onClick={async () => { const r = await api(`/api/sandboxes/${needSelected()}/vnc`); setOut('vnc', r); setVncUrl(r.url || ''); }}>Status</Button>
              <Button onClick={async () => { const r = await api(`/api/sandboxes/${needSelected()}/vnc/start`, { method: 'POST' }); setOut('vnc', r); setVncUrl(r.url || ''); }}>Start</Button>
              <Button variant="ghost" onClick={async () => { await api(`/api/sandboxes/${needSelected()}/vnc/stop`, { method: 'POST' }); setOut('vnc', 'Stopped'); }}>Stop</Button>
            </div>
            <div className="row"><input className="input" value={vncUrl} onChange={(e) => setVncUrl(e.target.value)} placeholder="Paste VNC URL" /><Button onClick={() => setNoVncUrl(buildNoVncUrl(vncUrl))}>Open noVNC</Button></div>
            {noVncUrl ? <iframe title="noVNC" src={noVncUrl} className="vnc" /> : <div className="vnc" />}
            <pre>{outputs.vnc}</pre>
          </article>
        </section>
      </main>
    </div>
  );
}

export default App;
