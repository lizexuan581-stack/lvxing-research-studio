'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../dist/core.js');
const R = require('../dist/research.js');
const P = require('./prompts.cjs');
const {canonical, digest, createAudit, verifyEvents} = require('./audit.cjs');
const VERSION = '1.3.0';
const schema = properties => ({type:'object', properties, required:Object.keys(properties), additionalProperties:false});
const text = {type:'string'};
const tools = [
  {name:'search_sources',description:'仅在受控工作区检索资料原文，空格分隔关键词，返回来源与页码。',parameters:schema({query:text})},
  {name:'read_page',description:'读取指定资料ID的一个原文页；报告引用必须来自已读页。',parameters:schema({docId:text,page:{type:'integer'}})},
  {name:'check_facts',description:'检查事实字段的来源、期间、单位、人工复核状态和分类，不代替金融专家判断。',parameters:schema({})},
  {name:'calculate',description:'调用确定性工具，以当前保存参数计算；历史工具限内置案例有来源的同口径字段。',parameters:schema({kind:{type:'string',enum:['finance','scenarios','historical_city','historical_national','carbon','behavior']}})}
].map(f=>({type:'function',function:f}));
function validateProject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('研究输入格式错误');
  if (Buffer.byteLength(JSON.stringify(input)) > 8*1024*1024) throw Error('研究输入超过8MB');
  const p = structuredClone(input);
  if (!Array.isArray(p.docs) || !p.docs.length || p.docs.length > 60) throw Error('请提供1至60份工作区资料');
  if (!Array.isArray(p.facts) || p.facts.length > 1000) throw Error('事实表格式错误');
  const ids = new Set(); let total = 0;
  for (const d of p.docs) {
    if (!/^[\w-]{1,100}$/.test(d.id) || ids.has(d.id) || typeof d.title !== 'string' || !Array.isArray(d.pages) || d.pages.length > 300) throw Error('资料ID或页数不合法');
    ids.add(d.id); const pages = new Set();
    for (const pg of d.pages) {
      if (!Number.isInteger(pg.page) || pg.page < 1 || pages.has(pg.page) || typeof pg.text !== 'string' || pg.text.length > 30000) throw Error('原文页格式错误或单页过长，请拆分资料');
      pages.add(pg.page); total += pg.text.length;
    }
  }
  if (total > 2000000) throw Error('全文超过200万字符');
  for (const k of ['profile','policy','financeInputs','behaviorInputs']) if (!p[k] || typeof p[k] !== 'object') throw Error('缺少工作区字段：' + k);
  if (typeof p.profile.question !== 'string') throw Error('研究问题格式错误');
  p.reports=[]; p.runs=[]; delete p.agentRuns;
  R.validate(p); return p;
}
function factCheck(p) {
  const items = p.facts.map(f=>{
    const d=p.docs.find(d=>d.id===f.sourceId), issues=[];
    if (!d) issues.push('来源缺失');
    if (!f.reviewed) issues.push('待人工复核');
    if (!f.period) issues.push('期间缺失');
    if (!f.unit) issues.push('单位缺失');
    if (!f.scope) issues.push('业务口径缺失');
    if (f.category==='待分类') issues.push('需确认事实性质');
    const value=String(f.value??'').replace(/,/g,'');
    if (d && value && !d.pages.some(pg=>pg.text.replace(/,/g,'').includes(value))) issues.push('摘录中未直接定位原数值');
    return {id:f.id,label:f.label,value:f.value,unit:f.unit,period:f.period,scope:f.scope,category:f.category,sourceId:f.sourceId,location:f.location,issues};
  });
  const numericComparisons=[];
  for(const [base,label] of [['shared_price','全国订单平均单价'],['shared_orders','全国共享订单量'],['shared_revenue','全国共享收入'],['cz_revenue','常州共享收入']]) {
    const a=p.facts.find(f=>f.id===base+'_2024'),b=p.facts.find(f=>f.id===base+'_2025');
    if(a&&b&&a.reviewed&&b.reviewed&&a.scope===b.scope&&a.unit===b.unit&&String(a.value).trim()&&String(b.value).trim()&&Number.isFinite(Number(a.value))&&Number.isFinite(Number(b.value)))numericComparisons.push({label,scope:a.scope,previous:Number(a.value),current:Number(b.value),unit:a.unit,direction:Number(b.value)>Number(a.value)?'上升':Number(b.value)<Number(a.value)?'下降':'持平'});
  }
  return {checked:items.length,needsReview:items.filter(i=>i.issues.length).length,items,numericComparisons};
}
function executeTool(p, name, args) {
  const def=tools.find(t=>t.function.name===name)?.function;
  if (!def || !args || typeof args!=='object' || Array.isArray(args)) throw Error('不在工具白名单或参数格式错误');
  if (Object.keys(args).some(k=>!Object.hasOwn(def.parameters.properties,k)) || def.parameters.required.some(k=>!Object.hasOwn(args,k))) throw Error('工具参数不符合定义');
  if (name==='search_sources') {
    if (typeof args.query!=='string' || !args.query.trim() || args.query.length>160) throw Error('检索词应为1至160字');
    return C.search(p.docs,args.query).slice(0,8);
  }
  if (name==='read_page') {
    const d=p.docs.find(d=>d.id===args.docId), pg=d?.pages.find(pg=>pg.page===args.page);
    if (!pg) throw Error('资料或页码不存在');
    return {docId:d.id,title:d.title,kind:d.kind,url:d.url||'',page:pg.page,text:pg.text,sha256:digest(pg.text)};
  }
  if (name==='check_facts') return factCheck(p);
  if (name==='calculate') {
    switch(args.kind) {
      case 'finance': return {kind:args.kind,inputs:p.financeInputs,result:C.finance(p.financeInputs)};
      case 'scenarios': return {kind:args.kind,inputs:p.financeInputs,result:C.scenarioSet(p.financeInputs)};
      case 'carbon': return {kind:args.kind,inputs:p.carbonRows,result:C.carbon(p.carbonRows),basis:p.factorNote};
      case 'behavior': return {kind:args.kind,inputs:p.behaviorInputs,result:C.behavior(p.behaviorInputs)};
      case 'historical_city': case 'historical_national': {
        const inputs=R.historicalPreset(p,args.kind==='historical_city');
        return {kind:args.kind,inputs,result:R.historical(inputs)};
      }
      default: throw Error('未知计算工具');
    }
  }
}
function validateReport(report, p, observations) {
  const issues=[];
  const checkText=(s,name)=>{
    if(typeof s!=='string'||!s.trim()||s.length>3000) {issues.push(name+'缺少有效文本');return;}
    if(/[0-9０-９]|[〇零一二三四五六七八九十百千万亿两]{2,}(?:年|万|元|人次|笔|米|成|个百分点)/.test(s))issues.push(name+'含手写数字，数字应由计算表或原文引用展示');
    const clauses=s.split(/[。；，]/);
    if(clauses.some(t=>!/(?:不能|不应|不等于|不代表|不可|误|超出|不宜)/.test(t)&&/(?:说明|表明|反映|存在|出现|导致|形成|属于|处于)[^。；，]{0,12}(?:经营亏损|营业亏损|净亏损|亏损状态)/.test(t)))issues.push(name+'仅有收入与营业成本时应表述毛利，不应推断经营或净亏损');
    if(/成本口径与收入口径不同/.test(s)&&p.docs.some(d=>d.pages.some(pg=>pg.text.includes('收入与成本为业务分部口径'))))issues.push(name+'与收入成本同为业务分部口径的材料相矛盾');
    const price=factCheck(p).numericComparisons.find(x=>x.label==='全国订单平均单价');
    if(price?.direction==='上升'&&clauses.some(t=>!/(?:不能|不应|而非|并非|不是|误|上升|上行|提高|增加)/.test(t)&&/(?:均价|单价)(?:同期|同比|环比|亦|也|持续|出现|有所|明显|大幅|小幅|整体|总体|呈现|的)?(?:下降|下滑|减少)/.test(t)))issues.push(name+'将全国单价方向写反，应逐项核对单价与订单变化');
  };
  if (!report || typeof report!=='object' || Array.isArray(report)) return ['报告不是JSON对象'];
  checkText(report.title,'标题');checkText(report.summary,'摘要');checkText(report.financialDiscussion,'财务分析');
  if (!Array.isArray(report.claims)||report.claims.length<2||report.claims.length>6) issues.push('需提供2至6条论述');
  for (const [i,c] of (Array.isArray(report.claims)?report.claims:[]).entries()) {
    checkText(c.statement,'论述'+(i+1));
    if (!['事实','推论','观点'].includes(c.type)) issues.push('论述分类无效');
    if (!Array.isArray(c.citations)||!Array.isArray(c.toolIds)) {issues.push('引用列表格式错误');continue;}
    if(c.type==='事实'&&!c.citations.length) issues.push('事实缺少原文引用');
    if(!c.citations.length&&!c.toolIds.length) issues.push('论述没有证据');
    for (const cite of c.citations) {
      const obs=observations.find(o=>o.name==='read_page'&&!o.error&&o.args.docId===cite.docId&&o.args.page===cite.page);
      if(!obs||typeof cite.quote!=='string'||cite.quote.length<8||cite.quote.length>160||!obs.result.text.includes(cite.quote)) issues.push('引用未定位已读取原文：'+String(cite.docId));
    }
    if(c.toolIds.some(id=>!observations.some(o=>o.id===id&&!o.error))) issues.push('引用了不存在的工具结果');
  }
  for(const k of ['risks','followups']) {if(!Array.isArray(report[k])||!report[k].length||report[k].length>8) issues.push(k+'需1至8项'); else report[k].forEach(s=>checkText(s,k));}
  return issues;
}
function renderReport(report, observations, id) {
  const lines=['# '+report.title,'',report.summary,'','## 研究判断'];
  report.claims.forEach((c,i)=>{lines.push('',`${i+1}. 【${c.type}】${c.statement}`);c.citations.forEach(x=>lines.push(`   来源：${x.docId}，第${x.page}页；原文：${x.quote}`));if(c.toolIds.length)lines.push('   工具依据：'+c.toolIds.join('、'));});
  lines.push('','## 确定性计算底稿');
  for (const o of observations.filter(o=>o.name==='calculate'&&!o.error)) {
    lines.push('',`### ${o.args.kind} · ${o.id}`,'```json',JSON.stringify(o.result,null,2),'```');
  }
  lines.push('','## 财务含义',report.financialDiscussion,'','## 风险与跟踪',...report.risks.map(s=>'- '+s),...report.followups.map(s=>'- 跟踪：'+s),'',`运行编号：${id}。报告由实际模型调用与程序计算生成，引用定位检查不替代专业复核，不构成投资建议。`);
  return lines.join('\n');
}
async function runAgent({project,task,provider,runRoot,onEvent,signal,sourceRevision='unversioned'}) {
  const p=validateProject(project);
  if(typeof task!=='string'||task.trim().length<2||task.length>1800)throw Error('研究任务应为2至1800字');
  const id='run-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex');
  const directory=path.join(runRoot,id),audit=createAudit(directory,onEvent),observations=[];
  const snapshot={task,project:p}, snapshotHash=digest(snapshot);
  fs.writeFileSync(path.join(directory,'input.json'),JSON.stringify(snapshot,null,2));
  const sourceFiles={};
  for(const name of ['server/agent.cjs','server/audit.cjs','server/provider.cjs','server/prompts.cjs','dist/core.js','dist/research.js','dist/finance-engine.js'])sourceFiles[name]=digest(fs.readFileSync(path.resolve(__dirname,'..',name),'utf8').replace(/\r\n/g,'\n'));
  const manifest={format:'lvxing-agent-run',schemaVersion:1,appVersion:VERSION,id,sourceRevision,sourceFiles,sourceHash:digest(sourceFiles),startedAt:new Date().toISOString(),status:'running',provider:provider.name,requestedModel:provider.model,endpoint:provider.endpoint,promptVersion:P.version,promptHash:digest(P),snapshotHash,logIntegrity:'SHA-256链用于完整性检查，不是可信时间戳或防管理员篡改签名',reproduction:'replay无需联网复核计算、引用与日志；rerun真实模型不保证逐字一致',files:{},usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0}};
  const messages=[{role:'system',content:P.system},{role:'user',content:JSON.stringify({task,profile:p.profile,policy:p.policy,financeInputs:p.financeInputs,availableDocuments:p.docs.map(d=>({id:d.id,title:d.title,pages:d.pages.map(pg=>pg.page)}))})}];
  let calls=0;
  async function invoke(extra={}) {
    if(signal?.aborted)throw Error('任务已取消');
    if(++calls>8)throw Error('达到本任务模型调用上限');
    const request={messages:structuredClone(messages),...extra};
    audit.append('model.request',{call:calls,model:provider.model,request});
    const start=Date.now(),response=await provider.chat(request,signal);
    audit.append('model.response',{call:calls,durationMs:Date.now()-start,...response});
    manifest.actualModel=response.model; manifest.lastResponseId=response.id;
    for(const k of Object.keys(manifest.usage))manifest.usage[k]+=response.usage?.[k]||0;
    messages.push(response.message);return response.message;
  }
  try {
    audit.append('run.start',{id,snapshotHash,sourceRevision,model:provider.model,promptVersion:P.version});
    for (const d of p.docs) audit.append('file.register',{docId:d.id,title:d.title,pages:d.pages.map(pg=>({page:pg.page,sha256:digest(pg.text)}))});
    for(let round=0;round<5;round++) {
      const answer=await invoke({tools,tool_choice:'auto'}), requests=answer.tool_calls||[];
      if(!requests.length) {
        const needed=['search_sources','read_page','check_facts','calculate'].filter(n=>!observations.some(o=>o.name===n&&!o.error));
        if(!needed.length)break;
        messages.push({role:'user',content:'尚未完成必要步骤，请调用：'+needed.join('、')+'。不要直接写最终报告。'});continue;
      }
      if(requests.length>10||observations.length+requests.length>24)throw Error('超过工具调用限额');
      for(const call of requests) {
        const name=call.function?.name;let args={},result,error;
        const tid='tool-'+(observations.length+1);
        audit.append('tool.request',{id:tid,providerCallId:call.id,name,arguments:call.function?.arguments});
        try {
          if(typeof call.function?.arguments!=='string'||call.function.arguments.length>4000)throw Error('工具参数过长或缺失');
          args=JSON.parse(call.function.arguments);result=executeTool(p,name,args);
          if(name==='search_sources')audit.append('file.search',{id:tid,query:args.query,scope:p.docs.map(d=>({id:d.id,sha256:digest(d.pages)})),hits:result});
          if(name==='read_page')audit.append('file.read',{id:tid,docId:args.docId,page:args.page,sha256:result.sha256});
          if(name==='calculate')audit.append('calculation',{id:tid,...result});
        } catch(e) {error=e.message;result={error};}
        const obs={id:tid,name,args,result,...(error?{error}:{})};observations.push(obs);audit.append('tool.result',obs);
        messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify({toolId:tid,...(Array.isArray(result)?{matches:result}:result)})});
      }
      if(['search_sources','read_page','check_facts','calculate'].every(n=>observations.some(o=>o.name===n&&!o.error))&&round>=1)break;
    }
    const missing=['search_sources','read_page','check_facts','calculate'].filter(n=>!observations.some(o=>o.name===n&&!o.error));
    if(missing.length)throw Error('模型未完成必需任务：'+missing.join('、'));
    const allowedCitations=observations.filter(o=>o.name==='read_page'&&!o.error).map(o=>({docId:o.result.docId,page:o.result.page,kind:o.result.kind}));
    messages.push({role:'user',content:P.report+'\n仅允许引用以下已经读取的页：'+JSON.stringify(allowedCitations)});
    let report,issues;
    for(let attempt=0;attempt<2;attempt++) {
      const reply=await invoke({response_format:{type:'json_object'}});
      try {report=JSON.parse(reply.content);issues=validateReport(report,p,observations);} catch {issues=['模型未返回有效JSON'];}
      audit.append('report.validation',{attempt:attempt+1,passed:issues.length===0,issues});
      if(!issues.length)break;
      messages.push({role:'user',content:'修正以下问题并重新输出完整JSON：'+issues.join('；')+'。只可引用这些页：'+JSON.stringify(allowedCitations)});
    }
    if(issues.length)throw Error('报告未通过证据检查：'+issues.join('；'));
    const output={id,report,observations,validation:{passed:true,checks:['原文逐字引用','已读取页定位','工具ID存在','叙述数字移交程序表格'],humanReviewRequired:true}};
    fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(output,null,2));
    fs.writeFileSync(path.join(directory,'report.md'),renderReport(report,observations,id));
    audit.append('report.generated',{reportHash:digest(output),claimCount:report.claims.length});
    manifest.status='completed';
  } catch(e) {
    manifest.status=signal?.aborted?'cancelled':'failed';manifest.error=e.message;
    audit.append('run.error',{message:e.message});
  } finally {
    manifest.finishedAt=new Date().toISOString();manifest.modelCalls=calls;manifest.toolCalls=observations.length;
    audit.append('run.finish',{status:manifest.status,usage:manifest.usage});
    manifest.eventCount=audit.events.length;manifest.logHead=verifyEvents(audit.events);
    for(const name of ['input.json','run.jsonl','report.json','report.md'])if(fs.existsSync(path.join(directory,name)))manifest.files[name]=digest(fs.readFileSync(path.join(directory,name),'utf8'));
    fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2));
  }
  return {id,directory,manifest};
}
function replay(directory) {
  const read=name=>fs.readFileSync(path.join(directory,name),'utf8');
  const manifest=JSON.parse(read('manifest.json')),input=JSON.parse(read('input.json'));
  for(const [file,hash] of Object.entries(manifest.files)) {
    if(!['input.json','run.jsonl','report.json','report.md'].includes(file))throw Error('运行文件白名单错误');
    if(digest(read(file))!==hash)throw Error('文件摘要不匹配：'+file);
  }
  if(digest(input)!==manifest.snapshotHash)throw Error('输入快照摘要不一致');
  const p=validateProject(input.project),events=read('run.jsonl').trim().split('\n').map(JSON.parse);
  if(verifyEvents(events)!==manifest.logHead||events.length!==manifest.eventCount)throw Error('日志不完整');
  const observations=events.filter(e=>e.type==='tool.result').map(e=>e.data);
  let checked=0;
  for(const o of observations)if(!o.error) {const result=executeTool(p,o.name,o.args);if(canonical(result)!==canonical(o.result))throw Error('工具重算不一致：'+o.id);checked++;}
  if(manifest.status==='completed') {
    const output=JSON.parse(read('report.json')),issues=validateReport(output.report,p,observations);
    if(issues.length)throw Error('报告复核失败：'+issues.join('；'));
    if(renderReport(output.report,observations,manifest.id)!==read('report.md'))throw Error('报告渲染不一致');
  }
  return {id:manifest.id,status:manifest.status,events:events.length,toolsReplayed:checked,passed:true,modelRerun:false};
}
module.exports={VERSION,tools,validateProject,factCheck,executeTool,validateReport,renderReport,runAgent,replay};
