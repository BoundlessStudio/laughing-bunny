import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { Sandbox } from '@hopx-ai/sdk';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const apiKey = process.env.HOPX_API_KEY;

if (!apiKey) {
  console.warn('HOPX_API_KEY is not set. API requests will fail until it is provided.');
}

app.use(express.json());
const frontendDir = path.join(process.cwd(), 'client-dist');
const legacyPublicDir = path.join(process.cwd(), 'public');

app.use(express.static(frontendDir));
app.use(express.static(legacyPublicDir));

const sandboxCache = new Map<string, Sandbox>();

const getSandbox = async (sandboxId: string): Promise<Sandbox> => {
  const cached = sandboxCache.get(sandboxId);
  if (cached) return cached;

  const sandbox = await Sandbox.connect(sandboxId, apiKey);
  sandboxCache.set(sandboxId, sandbox);
  return sandbox;
};

const toError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

app.get('/api/templates', async (_req, res) => {
  try {
    const templates = await Sandbox.listTemplates({ apiKey });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.get('/api/sandboxes', async (_req, res) => {
  try {
    const sandboxes = await Sandbox.list({ apiKey });
    const data = await Promise.all(
      sandboxes.map(async (sandbox) => {
        sandboxCache.set(sandbox.sandboxId, sandbox);
        const info = await sandbox.getInfo().catch(() => null);
        return {
          id: sandbox.sandboxId,
          info
        };
      })
    );

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.post('/api/sandboxes', async (req, res) => {
  try {
    const { template = 'code-interpreter', timeoutSeconds = 3600, envVars = {} } = req.body as {
      template?: string;
      timeoutSeconds?: number;
      envVars?: Record<string, string>;
    };

    const sandbox = await Sandbox.create({
      template,
      timeoutSeconds,
      envVars,
      apiKey
    });

    sandboxCache.set(sandbox.sandboxId, sandbox);

    res.status(201).json({ id: sandbox.sandboxId });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.post('/api/sandboxes/:id/start', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    await sandbox.resume();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.post('/api/sandboxes/:id/stop', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    await sandbox.pause();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.delete('/api/sandboxes/:id', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    await sandbox.kill();
    sandboxCache.delete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.get('/api/sandboxes/:id/files', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    const targetPath = String(req.query.path ?? '/');
    const files = await sandbox.files.list(targetPath);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.get('/api/sandboxes/:id/file-content', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    const filePath = String(req.query.path ?? '');

    if (!filePath) {
      res.status(400).json({ error: 'Missing path query parameter' });
      return;
    }

    const content = await sandbox.files.read(filePath);
    res.json({ path: filePath, content });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.post('/api/sandboxes/:id/terminal', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    const { command, timeout = 60 } = req.body as { command?: string; timeout?: number };

    if (!command) {
      res.status(400).json({ error: 'command is required' });
      return;
    }

    const result = await sandbox.commands.run(command, { timeout });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.get('/api/sandboxes/:id/env', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    const env = await sandbox.env.getAll();
    res.json(env);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.put('/api/sandboxes/:id/env', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    const { key, value } = req.body as { key?: string; value?: string };

    if (!key || value === undefined) {
      res.status(400).json({ error: 'key and value are required' });
      return;
    }

    const env = await sandbox.env.set(key, value);
    res.json(env);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.delete('/api/sandboxes/:id/env/:key', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    await sandbox.env.delete(req.params.key);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.get('/api/sandboxes/:id/vnc', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    const info = await sandbox.desktop.getVncInfo();
    const url = await sandbox.desktop.getVncUrl().catch(() => null);
    res.json({ info, url });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.post('/api/sandboxes/:id/vnc/start', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    const info = await sandbox.desktop.startVnc();
    const url = await sandbox.desktop.getVncUrl().catch(() => null);
    res.json({ info, url });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.post('/api/sandboxes/:id/vnc/stop', async (req, res) => {
  try {
    const sandbox = await getSandbox(req.params.id);
    await sandbox.desktop.stopVnc();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

app.get('/{*any}', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/terminal' });

wss.on('connection', async (clientSocket: WebSocket, req: http.IncomingMessage) => {
  const reqUrl = new URL(req.url ?? '', `http://${req.headers.host}`);
  const sandboxId = reqUrl.searchParams.get('sandboxId');

  if (!sandboxId) {
    clientSocket.send('Missing sandboxId query parameter.\r\n');
    clientSocket.close();
    return;
  }

  let upstreamSocket: WebSocket | undefined;

  try {
    const sandbox = await getSandbox(sandboxId);
    upstreamSocket = await sandbox.terminal.connect();

    upstreamSocket.on('message', (message: RawData) => {
      if (clientSocket.readyState === clientSocket.OPEN) {
        clientSocket.send(message.toString());
      }
    });

    upstreamSocket.on('close', () => {
      if (clientSocket.readyState === clientSocket.OPEN) {
        clientSocket.close();
      }
    });

    upstreamSocket.on('error', (error: Error) => {
      if (clientSocket.readyState === clientSocket.OPEN) {
        clientSocket.send(`\r\n[terminal proxy error] ${toError(error)}\r\n`);
      }
    });

    clientSocket.on('message', (message: RawData) => {
      const payload = message.toString();

      try {
        const event = JSON.parse(payload) as { type?: string; cols?: number; rows?: number };
        if (event.type === 'resize' && event.cols && event.rows) {
          if (upstreamSocket) {
            sandbox.terminal.resize(upstreamSocket, event.cols, event.rows);
          }
          return;
        }
      } catch {
        // Treat non-JSON messages as terminal input.
      }

      if (upstreamSocket && upstreamSocket.readyState === WebSocket.OPEN) {
        upstreamSocket.send(payload);
      }
    });

    clientSocket.on('close', () => {
      if (upstreamSocket && upstreamSocket.readyState === WebSocket.OPEN) {
        upstreamSocket.close();
      }
    });
  } catch (error) {
    clientSocket.send(`Unable to connect terminal: ${toError(error)}\r\n`);
    clientSocket.close();
  }
});

server.listen(port, () => {
  console.log(`Control panel running at http://localhost:${port}`);
});
