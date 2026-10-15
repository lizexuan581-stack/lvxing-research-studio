// API secrets never enter this module or browser storage. Pairing is session-memory only.
export function createAgentStudio(api) {
  const {project,actions,render,persist,record,toast,download,modal,esc,route}=api;
  let base=['localhost','127.0.0.1'].includes(location.hostname)?location.origin:'http://127.0.0.1:8780';
  let token='',health=null,job=null,timer=null,current=null,task='',consent=false,connecting=false;
  const label={ 'run.start':'建立输入快照','file.register':'登记资料指纹','model.request':'模型组织任务','model.response':'收到模型响应','tool.request':'调用研究工具','file.search':'检索受控资料','file.read':'读取原文页','calculation':'执行确定性计算','tool.result':'保存工具结果','report.validation':'核验报告引用','report.generated':'生成研究报告','run.finish':'任务结束','run.error':'任务中止'};
  const names={finance:'财务情景',scenarios:'三情景对照',historical_city:'城市历史复算',historical_national:'全国量价复算',carbon:'碳核算',behavior:'行为模型'};
  const metricNames={deltaRevenueWan:['收入增量','万元'],totalRevenueWan:['情景后收入','万元'],contributionWan:['经营贡献','万元'],cashAfterInputsWan:['扣除输入现金支出后差额','万元'],breakEvenPrice:['盈亏平衡单价','元/笔'],deltaRevenue:['历史收入变化','万元'],growth:['收入变动率','%'],gross1:['本期毛利','万元'],volumeEffect:['量效应','万元'],priceEffect:['价效应','万元'],residual:['桥接残差','万元'],reductionKg:['减排差额','kg CO₂e'],personKm:['替代里程','人公里'],advantage:['收益差','元/次'],finalShare:['末轮绿色出行比例',''],change:['比例变化','']};
  const fmt=v=>v===null?'缺少对应输入':typeof v==='number'?v.toLocaleString('zh-CN',{maximumFractionDigits:4}):String(v);
  function summaryCards(output) {
    return (output?.observations||[]).filter(o=>o.name==='calculate'&&!o.error).map(o=>{
      const result=o.result.result;
      const metrics=Array.isArray(result)?result.map(s=>`<li><span>${esc(s.name)}</span><b>${esc(s.result?fmt(s.result.deltaRevenueWan)+' 万元':s.error)}</b></li>`).join(''):
        Object.entries(metricNames).filter(([k])=>Object.hasOwn(result,k)).map(([k,[l,u]])=>`<li><span>${l}</span><b>${esc(fmt(result[k]))}<small> ${u}</small></b></li>`).join('');
      return `<article class="agent-metric"><div class="agent-kicker">TOOL · ${esc(o.id)}</div><h3>${esc(names[o.args.kind]||o.args.kind)}</h3><ul>${metrics}</ul><details><summary>输入参数与完整结果</summary><pre>${esc(JSON.stringify(o.result,null,2))}</pre></details></article>`;
    }).join('');
  }
  function resultHTML(output,manifest) {
    if(!output)return '';
    const r=output.report;
    if(!r||!Array.isArray(r.claims)||!Array.isArray(r.risks)||!Array.isArray(r.followups)||r.claims.some(c=>!Array.isArray(c.citations)||!Array.isArray(c.toolIds)))return '<p class="agent-error">导入的报告格式不完整，请从原运行包重新导出。</p>';
    return `<section class="agent-result"><div class="agent-result-head"><div><div class="agent-kicker">RESEARCH OUTPUT</div><h2>${esc(r.title)}</h2></div><span class="agent-status done">引用检查通过</span></div><p class="agent-summary">${esc(r.summary)}</p><div class="agent-metrics">${summaryCards(output)}</div><div class="agent-claims">${r.claims.map((c,i)=>`<article><span class="agent-index">0${i+1}</span><div><span class="tag">${esc(c.type)}</span><p>${esc(c.statement)}</p>${c.citations.map(x=>`<blockquote>${esc(x.quote)}<cite>${esc(x.docId)} · 第 ${esc(x.page)} 页</cite></blockquote>`).join('')}${c.toolIds.length?`<small>计算依据 ${esc(c.toolIds.join(' / '))}</small>`:''}</div></article>`).join('')}</div><div class="agent-notes"><section><h3>财务含义</h3><p>${esc(r.financialDiscussion)}</p></section><section><h3>跟踪与风险</h3><ul>${[...r.risks,...r.followups].map(s=>`<li>${esc(s)}</li>`).join('')}</ul></section></div><p class="agent-meta">${esc(manifest?.actualModel||'DeepSeek')} · ${esc(manifest?.modelCalls||0)} 次模型调用 · ${esc(manifest?.toolCalls||0)} 次工具调用 · ${esc(manifest?.eventCount||0)} 条记录<br>检查覆盖引用定位与程序复算，金融判断仍需研究者复核。</p></section>`;
  }
  function page() {
    const p=project(),history=p.agentRuns||[],latest=current||(history.length?history.at(-1):null),events=job?.events||latest?.events||[];
    return `<div class="page-header"><div><div class="eyebrow">EVIDENCE → TOOLS → RESEARCH</div><h1>投研智能体</h1><p class="subheading">从一个研究问题出发，让检索、核验、计算和报告形成完整研究记录。</p></div><button class="button outline" data-action="agent-connect">${connecting?'连接中…':health?.configured?'连接设置':'连接 DeepSeek'}</button></div>
    <div class="agent-hero"><div><span class="agent-kicker">CONTROLLED RESEARCH / 1.3</span><h2>让政策分析，<br>走到可复核的财务结论。</h2><p>模型负责组织资料与分析，金额由确定性工具计算。每一次读取、调用和输出，都与本次任务一起保存。</p><div class="agent-steps"><span>资料检索</span><i>→</i><span>事实核验</span><i>→</i><span>量化计算</span><i>→</i><span>研究报告</span></div></div><aside><span class="agent-orbit"></span><strong>${p.docs.length}<small>份受控资料</small></strong><strong>${p.facts.length}<small>个事实字段</small></strong><strong>SHA-256<small>快照与日志校验</small></strong></aside></div>
    <div class="agent-layout"><div><section class="panel agent-task"><div class="panel-header"><h2>研究任务</h2><span class="agent-status ${health?.configured?'done':''}">${health?.configured?'模型服务已连接':'尚未连接本机服务'}</span></div><label class="field"><span>希望研究什么问题？</span><textarea id="agentTask" rows="4" maxlength="1800">${esc(task||p.profile.question+' 请检索资料、读取原文、核验事实，并计算当前财务情景，输出政策传导分析。')}</textarea></label><div class="agent-presets"><button data-action="agent-preset" data-task="分析常州政策对永安行的影响，读取政策及财报，核验事实，用finance计算当前情景。">政策传导</button><button data-action="agent-preset" data-task="读取全国订单和单价原文，核验事实，调用historical_national分析历史量价影响。">历史量价</button><button data-action="agent-preset" data-task="检索并读取免费骑行资料，核验事实，调用scenarios比较收费增加、免费增加及收费减少情景。">免费与收费</button></div><label class="agent-consent"><input id="agentConsent" type="checkbox" ${consent?'checked':''}><span>本次允许向 DeepSeek 发送任务、资料片段和事实字段，原文件仍保留在本机。请仅使用公开或获授权资料。</span></label><div class="agent-buttons"><button class="button" data-action="agent-run" ${job?.status==='running'?'disabled':''}>${job?.status==='running'?'正在执行研究…':'开始研究 →'}</button>${job?.status==='running'?'<button class="button outline" data-action="agent-cancel">取消任务</button>':''}<button class="button outline" data-action="agent-example">查看已验证案例</button></div><p class="hint">公开网址保留完整工作台。运行新任务需启动技术包中的本机服务；查看已验证案例无需密钥，不会发起模型调用。</p></section>
    ${latest?.manifest?`<div class="agent-delivery"><div><b>${latest.replay?'已完成运行 · 案例回看':'本次运行成果'}</b><small>${esc(latest.manifest.id)}</small></div><button class="button outline small" data-action="agent-export">导出完整运行包</button>${latest.output?'<button class="button small" data-action="agent-report">导出报告</button>':''}</div>`:''}
    ${job?.error?`<div class="agent-error">${esc(job.error)}<p>失败过程已记录，不会作为成功结果展示。</p></div>`:''}${resultHTML(latest?.output,latest?.manifest)}</div>
    <aside class="panel agent-trace"><div class="panel-header"><div><h2>执行记录</h2><p>模型与工具各司其职</p></div><span class="agent-counter">${events.length}</span></div><div class="agent-timeline">${events.length?events.slice(-26).map(e=>`<article class="${e.type.includes('error')?'failed':''}"><i></i><div><b>${esc(label[e.type]||e.type)}</b><small>#${esc(e.seq)} ${esc(e.name||names[e.kind]||'')} ${esc(new Date(e.time).toLocaleTimeString('zh-CN'))}</small>${e.issues?.length?`<p>${esc(e.issues.join('；'))}</p>`:''}</div></article>`).join(''):'<div class="agent-empty">任务开始后，这里会展示实际执行步骤。<br>没有调用，不生成运行记录。</div>'}</div><p class="hint">界面展示最近记录，完整运行包保留全部记录，不截断历史。</p></aside></div>`;
  }
  function paint(){if(route()==='agent')render();}
  function capture(){task=document.querySelector('#agentTask')?.value||task;consent=document.querySelector('#agentConsent')?.checked||false;}
  async function request(url,options={}) {
    const res=await fetch(base+url,{...options,headers:{'Content-Type':'application/json','X-Lvxing-Token':token,...options.headers},signal:AbortSignal.timeout(20000)});
    const json=await res.json();if(!res.ok)throw Error(json.error||'服务请求失败');return json;
  }
  actions['agent-connect']=async()=>{
    capture();connecting=true;paint();
    try {
      health=await(await fetch(base+'/api/health',{signal:AbortSignal.timeout(4000)})).json();
      const local=location.origin===base;
      if(local)token=(await(await fetch(base+'/api/session')).json()).token;
      connecting=false;
      modal('连接本机模型服务',`<p>模型：${esc(health.model)}；${health.configured?'密钥已在本机服务配置':'请使用启动脚本输入密钥后重启服务'}。</p><p>服务只监听本机，不公开你的 API 密钥。${local?'需要在 GitHub Pages 使用时，将本机配对码粘贴到公开页面的连接框。':'请输入从本机页面复制的配对码。'}</p><label class="field"><span>配对码（仅当前页面会话使用）</span><input id="agentPair" type="password" autocomplete="off" value="${local?esc(token):''}"></label><div class="agent-buttons"><button class="button" data-action="agent-save-connection">确认连接</button>${local?'<button class="button outline" data-action="agent-copy-pair">复制配对码</button>':''}</div>`);paint();
    } catch {connecting=false;health=null;paint();modal('启动本机服务',`<p>先解压技术实现包，双击“启动投研智能体.cmd”，在终端输入 DeepSeek 密钥。</p><p>服务启动后打开本机页面连接。若浏览器询问本地网络权限，请仅对本工作台允许访问。</p><p><a href="http://127.0.0.1:8780/#agent" target="_blank" rel="noopener">打开本机投研工作台 ↗</a></p><p>公开案例回看不需要启动服务。</p>`);}
  };
  actions['agent-save-connection']=()=>{token=document.querySelector('#agentPair').value.trim();document.querySelector('#dialog').close();paint();toast('连接设置已保存于本次页面会话');};
  actions['agent-copy-pair']=async()=>{await navigator.clipboard.writeText(token);toast('配对码已复制；不包含API密钥');};
  actions['agent-preset']=el=>{task=el.dataset.task;document.querySelector('#agentTask').value=task;};
  actions['agent-run']=async()=>{
    capture();if(!token||!health?.configured){toast('请先连接模型服务',true);return;}
    if(!consent){toast('请确认本次模型调用的数据范围',true);return;}
    try {
      const p=project(),snapshot=JSON.parse(JSON.stringify(p));delete snapshot.agentRuns;snapshot.runs=[];snapshot.reports=[];
      const accepted=await request('/api/runs',{method:'POST',body:JSON.stringify({project:snapshot,task,allowCloud:true})});
      job={jobId:accepted.jobId,status:'running',events:[]};current=null;
      record('智能体任务提交',{task,provider:'DeepSeek',docs:p.docs.map(d=>d.id)},{jobId:job.jobId});paint();
      async function poll(){
        try {
          job=await request('/api/runs/'+accepted.jobId);
          if(job.status!=='running') {
            const bundle=await request('/api/runs/'+accepted.jobId+'/bundle');
            current={manifest:job.manifest,output:job.output,events:job.events,bundle,inputFingerprint:window.StudioResearch.signature(p)};
            p.agentRuns??=[];p.agentRuns.push(current);await persist();
            toast(job.status==='completed'?'研究完成，报告与运行记录已保存':job.error||'任务未完成',job.status!=='completed');
          }else timer=setTimeout(poll,1800);
          if(route()==='agent')capture();paint();
        }catch(e){job.status='connection-lost';job.error='连接中断：'+e.message+'。本机服务中的运行文件仍保留。';paint();}
      }
      timer=setTimeout(poll,800);
    }catch(e){toast(e.message,true);}
  };
  actions['agent-cancel']=async()=>{if(job?.jobId){await request('/api/runs/'+job.jobId+'/cancel',{method:'POST',body:'{}'});toast('已请求取消，正在保存执行记录');}};
  actions['agent-example']=async()=>{
    capture();if(job?.status==='running'){toast('请先完成当前任务');return;}
    try{const res=await fetch('./demo/verified-case.json',{cache:'no-store'});if(!res.ok)throw Error('已验证案例尚未发布');current={...await res.json(),replay:true};job=null;paint();toast('正在查看已完成的真实模型运行，不发起新调用');}catch(e){toast(e.message,true);}
  };
  const latest=()=>current||(project().agentRuns||[]).at(-1);
  actions['agent-export']=()=>{const v=latest();if(v?.bundle)download(v.manifest.id+'.agent-bundle.json',JSON.stringify(v.bundle,null,2));};
  actions['agent-report']=()=>{const v=latest();if(!v?.output)return;const body=resultHTML(v.output,v.manifest);download('绿行智研_智能体研究报告.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>绿行智研研究报告</title><style>body{max-width:1000px;margin:40px auto;padding:20px;font:16px/1.8 "Microsoft YaHei",sans-serif;color:#183b35}article,section{margin:15px 0}blockquote{border-left:3px solid #5e9d89;padding:12px;background:#f1f7f5}cite,small{display:block;color:#647c75}pre{white-space:pre-wrap;overflow-wrap:anywhere}li{margin:8px 0}</style><body>${body}</body></html>`,'text/html');};
  return {page};
}
