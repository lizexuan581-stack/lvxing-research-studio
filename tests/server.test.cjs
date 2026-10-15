'use strict';
const assert=require('node:assert/strict');
const {createServer}=require('../server/index.cjs');
(async()=>{
  const port=18784,app=createServer({port});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));let count=0;
  try {
    const base='http://127.0.0.1:'+port;
    const check=async(name,url,options,status)=>{const res=await fetch(base+url,options);assert.equal(res.status,status,name);count++;console.log('PASS '+name);return res;};
    await check('健康检查不返回密钥','/api/health',{},200);
    await check('未配对不能运行','/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'},401);
    await check('恶意网页来源被拒绝','/api/health',{headers:{Origin:'https://evil.example'}},403);
    await check('公开页面不能偷取配对码','/api/session',{headers:{Origin:'https://lizexuan581-stack.github.io'}},403);
    await check('本机读取配对码','/api/session',{},200);
    await check('配置缺失不假运行','/api/runs',{method:'POST',headers:{'X-Lvxing-Token':app.token,'Content-Type':'application/json'},body:'{}'},409);
    await check('私有日志不被静态服务器发布','/private/agent-runs/',{},404);
    await check('源码不被静态服务器发布','/server/index.cjs',{},404);
    await check('公开站点允许预检','/api/runs',{method:'OPTIONS',headers:{Origin:'https://lizexuan581-stack.github.io'}},204);
    console.log(JSON.stringify({suite:'gateway-security',passed:count}));
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
