import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute, extname, join } from 'node:path';
const root = fileURLToPath(new URL('../web/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.md': 'text/plain; charset=utf-8' };
const port = Number(process.env.PORT) || 4196;
createServer(async (request, response) => {
  try {
    const name = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    const rel = relative(root, name);
    if (rel.startsWith('..') || isAbsolute(rel)) { response.writeHead(403); response.end(); return; }
    const file = (await stat(name)).isDirectory() ? join(name, 'index.html') : name;
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/`));
