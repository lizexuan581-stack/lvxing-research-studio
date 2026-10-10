// Development server only: intentionally binds to loopback, never all interfaces.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT || 8780);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg'};
http.createServer((req,res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{'Allow':'GET, HEAD'}); return res.end(); }
  let file;
  try {
    const requestPath = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    file = path.resolve(root, '.' + (requestPath.endsWith('/') ? requestPath+'index.html' : requestPath));
    const relative = path.relative(root,file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || relative.includes(':')) throw Error('Invalid path');
  } catch { res.writeHead(400); return res.end('Bad request'); }
  fs.stat(file,(err,stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Content-Length':stat.size,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    if (req.method === 'HEAD') return res.end();
    const stream=fs.createReadStream(file);
    stream.on('error',()=>res.destroy());
    stream.pipe(res);
  });
}).listen(port,'127.0.0.1',()=>console.log(`Lvxing Research Studio: http://127.0.0.1:${port}/`));
