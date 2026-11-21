import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const root = new URL('./site/', import.meta.url);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg'
};

// Serve only packaged website files. A request never becomes a filesystem path.
const files = new Map();
async function loadDirectory(directory, prefix) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) {
      await loadDirectory(new URL(entry.name + '/', directory), path + '/');
    } else if (entry.isFile() && types[extname(entry.name)]) {
      files.set(path, {
        type: types[extname(entry.name)],
        body: await readFile(new URL(entry.name, directory))
      });
    }
  }
}
await loadDirectory(root, '/');
files.set('/', files.get('/index.html'));

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '127.0.0.1';
createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const file = files.get(request.url.split('?')[0]);
  if (!file) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    'Content-Type': file.type,
    'Content-Length': file.body.length,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(request.method === 'HEAD' ? undefined : file.body);
}).listen(port, host, () => console.log('Health Huddle listening on %s:%d', host, port));
