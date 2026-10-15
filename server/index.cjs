'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {runAgent,VERSION}=require('./agent.cjs');
const {createDeepSeek,DEFAULT_MODEL}=require('./provider.cjs');
const ROOT=path.resolve(__dirname,'..'),PUBLIC=path.join(ROOT,'dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg'};
async function body(req) {
  const chunks=[];let length=0;
  for await(const chunk of req) {length+=chunk.length;if(length>9*1024*1024)throw Error('请求超过9MB');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function createServer({apiKey,model=DEFAULT_MODEL,port=8780,runRoot=path.join(ROOT,'private','agent-runs'),provider,revision='working-tree'}={}) {
  const token=crypto.randomBytes(24).toString('hex'),jobs=new Map();let active=null;
  const engine=provider||(apiKey?createDeepSeek({apiKey,model}):null);
  const localOrigins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
  const origins=new Set([...localOrigins,'https://lizexuan581-stack.github.io']);
  function equal(a,b){if(typeof a!=='string'||a.length!==b.length)return false;return crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
  const server=http.createServer(async(req,res)=>{
    const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
    const origin=req.headers.origin;
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    if(!new Set([`127.0.0.1:${port}`,`localhost:${port}`]).has(req.headers.host))return send(403,{error:'无效主机'});
    if(origin&&!origins.has(origin))return send(403,{error:'来源不在允许名单'});
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Lvxing-Token');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Private-Network','true');}
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
    let url;
    try{url=new URL(req.url,'http://127.0.0.1');}catch{return send(400,{error:'请求地址错误'});}
    try {
      if(url.pathname==='/api/health'&&req.method==='GET')return send(200,{version:VERSION,configured:!!engine,provider:'DeepSeek',model:engine?.model||model,localOnly:true,active:!!active});
      if(url.pathname==='/api/session'&&req.method==='GET') {
        if(origin&&!localOrigins.has(origin))return send(403,{error:'请在本机页面获取配对码'});
        return send(200,{token});
      }
      if(url.pathname.startsWith('/api/')) {
        if(!equal(req.headers['x-lvxing-token'],token))return send(401,{error:'请连接本机服务并输入配对码'});
        if(url.pathname==='/api/runs'&&req.method==='POST') {
          if(!engine)return send(409,{error:'本机服务未配置模型密钥，请重新启动并输入密钥'});
          if(active)return send(409,{error:'已有任务执行中，请完成或取消后重试'});
          const data=await body(req);
          if(data.allowCloud!==true)return send(400,{error:'需确认将任务、引用片段和事实字段发送至DeepSeek'});
          // Validate before accepting a job; failed validation never makes a paid model call.
          require('./agent.cjs').validateProject(data.project);
          if(typeof data.task!=='string'||data.task.length<2||data.task.length>1800)return send(400,{error:'任务长度须为2至1800字'});
          const jobId=crypto.randomUUID(),controller=new AbortController();
          const job={jobId,status:'running',events:[],controller};jobs.set(jobId,job);active=jobId;
          runAgent({project:data.project,task:data.task,provider:engine,runRoot,sourceRevision:revision,signal:controller.signal,onEvent:e=>job.events.push(e)})
            .then(result=>{job.result=result;job.status=result.manifest.status;})
            .catch(e=>{job.status='failed';job.error=e.message;}).finally(()=>{active=null;});
          return send(202,{jobId});
        }
        const match=url.pathname.match(/^\/api\/runs\/([\w-]+)(?:\/(bundle|cancel))?$/);
        if(match) {
          const job=jobs.get(match[1]);if(!job)return send(404,{error:'任务不存在于当前服务会话'});
          if(match[2]==='cancel'&&req.method==='POST'){job.controller.abort();return send(200,{cancelRequested:true});}
          if(match[2]==='bundle'&&req.method==='GET') {
            if(!job.result)return send(409,{error:'任务尚未结束'});
            const files={};for(const name of ['input.json','manifest.json','run.jsonl','report.json','report.md']) {
              const f=path.join(job.result.directory,name);if(fs.existsSync(f))files[name]=fs.readFileSync(f,'utf8');
            }
            return send(200,{format:'lvxing-agent-bundle',version:1,id:job.result.id,files});
          }
          if(req.method==='GET'&&!match[2]) {
            const output=job.result&&fs.existsSync(path.join(job.result.directory,'report.json'))?JSON.parse(fs.readFileSync(path.join(job.result.directory,'report.json'),'utf8')):null;
            return send(200,{jobId:job.jobId,status:job.status,error:job.error||job.result?.manifest.error,
              events:job.events.map(e=>({seq:e.seq,time:e.time,type:e.type,hash:e.hash,name:e.data.name,kind:e.data.kind,call:e.data.call,issues:e.data.issues,message:e.data.message})),manifest:job.result?.manifest,output});
          }
        }
        return send(404,{error:'接口不存在'});
      }
      if(!['GET','HEAD'].includes(req.method))return send(405,{error:'方法不支持'});
      const requestPath=decodeURIComponent(url.pathname),file=path.resolve(PUBLIC,'.'+(requestPath.endsWith('/')?requestPath+'index.html':requestPath)),relative=path.relative(PUBLIC,file);
      if(relative.startsWith('..')||path.isAbsolute(relative)||relative.includes(':'))return send(400,{error:'无效路径'});
      if(!fs.existsSync(file)||!fs.statSync(file).isFile())return send(404,{error:'文件不存在'});
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':fs.statSync(file).size});
      if(req.method==='HEAD')return res.end();
      const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
    } catch(e) {if(!res.headersSent)send(400,{error:e.message});else res.destroy();}
  });
  return {server,token,close:()=>{for(const j of jobs.values())if(j.status==='running')j.controller.abort();return new Promise(resolve=>server.close(resolve));}};
}
async function hiddenInput() {
  process.stdout.write('DeepSeek API Key (hidden; memory only): ');
  if(!process.stdin.isTTY)throw Error('请使用交互终端输入，或在本机配置DEEPSEEK_API_KEY环境变量');
  process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
  return new Promise((resolve,reject)=>{
    let value='';
    function finish(){process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',read);process.stdout.write('\n');}
    function read(chunk){for(const ch of chunk){if(ch==='\r'||ch==='\n'){finish();resolve(value.trim());return;}if(ch==='\u0003'){finish();reject(Error('已取消'));return;}if(ch==='\u007f'||ch==='\b')value=value.slice(0,-1);else if(ch.charCodeAt(0)>=32)value+=ch;}}
    process.stdin.on('data',read);
  });
}
if(require.main===module)(async()=>{
  const apiKey=process.env.DEEPSEEK_API_KEY||(process.argv.includes('--ask-key')?await hiddenInput():'');
  const port=Number(process.env.PORT||8780);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT不合法');
  let revision='working-tree';try{revision=require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
  const app=createServer({apiKey,model:process.env.DEEPSEEK_MODEL||DEFAULT_MODEL,port,revision});
  app.server.listen(port,'127.0.0.1',()=>{
    console.log(`Lvxing ${VERSION}: http://127.0.0.1:${port}/#agent`);
    console.log('Model: '+(apiKey?'DeepSeek configured':'not configured'));
    console.log('公开页面连接本机时，在本机页面点击“连接服务”查看配对码。密钥不会发送到GitHub。');
  });
  process.on('SIGINT',()=>app.close().then(()=>process.exit(0)));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={createServer,hiddenInput};
