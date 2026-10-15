'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {sample}=require('../scripts/sample.cjs');
const A=require('../server/agent.cjs'),{digest,createAudit,verifyEvents}=require('../server/audit.cjs');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
const p=A.validateProject(sample());
test('受控样例可验证',()=>assert.equal(p.docs.length,5));
test('拒绝重复资料编号',()=>{const q=sample();q.docs.push(q.docs[0]);assert.throws(()=>A.validateProject(q));});
test('拒绝负页码',()=>{const q=sample();q.docs[0].pages[0].page=-1;assert.throws(()=>A.validateProject(q));});
test('拒绝重复页码',()=>{const q=sample();q.docs[0].pages.push(q.docs[0].pages[0]);assert.throws(()=>A.validateProject(q));});
test('拒绝超长资料页',()=>{const q=sample();q.docs[0].pages[0].text='x'.repeat(30001);assert.throws(()=>A.validateProject(q));});
test('工具白名单禁止任意代码',()=>assert.throws(()=>A.executeTool(p,'shell',{cmd:'echo unsafe'})));
test('禁止检索工具额外URL参数',()=>assert.throws(()=>A.executeTool(p,'search_sources',{query:'常州',url:'https://example.com'})));
test('检索返回原页码',()=>assert.ok(A.executeTool(p,'search_sources',{query:'常州'}).some(x=>x.page===57)));
test('读取保留来源和SHA256',()=>assert.equal(A.executeTool(p,'read_page',{docId:'policy',page:1}).sha256.length,64));
test('读取不存在的页码拒绝',()=>assert.throws(()=>A.executeTool(p,'read_page',{docId:'policy',page:999})));
test('事实核验保留待分类',()=>assert.ok(A.factCheck(p).needsReview>0));
test('收费收入由工具计算',()=>assert.equal(A.executeTool(p,'calculate',{kind:'finance'}).result.deltaRevenueWan,64.8));
test('免费订单无补偿收入为零',()=>{const q=structuredClone(p);Object.assign(q.financeInputs,{paidOrdersWan:0,freeOrdersWan:30});assert.equal(A.executeTool(q,'calculate',{kind:'finance'}).result.deltaRevenueWan,0);});
test('成本未知不输出利润',()=>{const q=structuredClone(p);q.financeInputs.cost=null;assert.equal(A.executeTool(q,'calculate',{kind:'finance'}).result.contributionWan,null);});
test('全国历史复算保留残差',()=>assert.equal(A.executeTool(p,'calculate',{kind:'historical_national'}).result.residual,10.3));
test('碳核算使用工作区参数',()=>assert.equal(A.executeTool(p,'calculate',{kind:'carbon'}).result.reductionKg,78.8));
const observations=[{id:'tool-1',name:'read_page',args:{docId:'policy',page:1},result:A.executeTool(p,'read_page',{docId:'policy',page:1})},{id:'tool-2',name:'calculate',args:{kind:'finance'},result:A.executeTool(p,'calculate',{kind:'finance'})}];
const report={title:'绿色交通研究',summary:'政策需要经过需求和结算环节传导。',claims:[{type:'事实',statement:'方案提出绿色交通发展方向。',citations:[{docId:'policy',page:1,quote:'常州市国家碳达峰试点实施方案提出绿色交通发展方向'}],toolIds:[]},{type:'推论',statement:'情景收入增加不等于利润增加。',citations:[],toolIds:['tool-2']}],financialDiscussion:'应结合收费、成本和结算条件分析经营影响。',risks:['城市结算条件仍需核实'],followups:['持续跟踪实际订单和到账情况']};
test('有效引用通过结构核验',()=>assert.deepEqual(A.validateReport(report,p,observations),[]));
test('伪造原文引用被阻止',()=>{const q=structuredClone(report);q.claims[0].citations[0].quote='没有出现过的营业利润数据';assert.ok(A.validateReport(q,p,observations).length);});
test('未读取资料页不能引用',()=>assert.ok(A.validateReport(report,p,[]).length));
test('手写数字被要求改由工具展示',()=>{const q=structuredClone(report);q.summary='收入100万元';assert.ok(A.validateReport(q,p,observations).length);});
test('不存在的工具引用被阻止',()=>{const q=structuredClone(report);q.claims[1].toolIds=['missing'];assert.ok(A.validateReport(q,p,observations).length);});
test('中文数字不能规避数值规则',()=>{const q=structuredClone(report);q.summary='收入达到三十万元';assert.ok(A.validateReport(q,p,observations).length);});
test('毛利不能替代经营亏损判断',()=>{const q=structuredClone(report);q.financialDiscussion='该业务处于经营亏损状态';assert.ok(A.validateReport(q,p,observations).length);});
test('单价方向错误被拦截',()=>{const q=structuredClone(report);q.claims[0].statement='全国订单平均单价下降';assert.ok(A.validateReport(q,p,observations).length);});
test('事实核验明确全国均价上升',()=>assert.equal(A.factCheck(p).numericComparisons.find(x=>x.label==='全国订单平均单价').direction,'上升'));
test('正确的否定表述不会被误拦',()=>{const q=structuredClone(report);q.financialDiscussion='毛利为负不能直接写成经营亏损。全国订单平均单价上升，而全国订单量下降，不能把订单下降误写为单价下降。';assert.deepEqual(A.validateReport(q,p,observations),[]);});
test('并列指标方向分别识别',()=>{const q=structuredClone(report);q.summary='订单量下降、平均单价上升，收入下降。';assert.deepEqual(A.validateReport(q,p,observations),[]);});
test('量价效应解释不被误判为价格下降',()=>{const q=structuredClone(report);q.summary='订单量效应与单价效应：订单量下降带来负向影响，平均单价上升带来正向影响，收入下降由订单量收缩驱动，而非单价下降。';assert.deepEqual(A.validateReport(q,p,observations),[]);});
test('SHA256与键顺序无关',()=>assert.equal(digest({a:1,b:2}),digest({b:2,a:1})));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lvxing-agent-tests-'));
test('日志不截断并校验完整链',()=>{const a=createAudit(path.join(tmp,'chain'));for(let i=0;i<95;i++)a.append('test',{i});assert.equal(a.events.length,95);assert.equal(verifyEvents(a.events),a.events.at(-1).hash);});
test('日志篡改被发现',()=>{const a=createAudit(path.join(tmp,'tamper'));a.append('test',{n:1});a.events[0].data.n=2;assert.throws(()=>verifyEvents(a.events));});
async function integration(){
  let calls=0;
  const provider={name:'UNIT_TEST_MOCK_NOT_LIVE',model:'fixture',endpoint:'test-only',chat:async()=>{
    calls++;let message;
    const call=(id,name,args)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
    if(calls===1)message={role:'assistant',content:null,tool_calls:[call('a','search_sources',{query:'绿色'}),call('b','check_facts',{}),call('c','calculate',{kind:'finance'})]};
    else if(calls===2)message={role:'assistant',content:null,tool_calls:[call('d','read_page',{docId:'policy',page:1})]};
    else {const q=structuredClone(report);q.claims[1].toolIds=['tool-3'];message={role:'assistant',content:JSON.stringify(q)};}
    return {model:'UNIT_TEST_MOCK_NOT_LIVE',message,usage:{total_tokens:0}};
  }};
  const r=await A.runAgent({project:sample(),task:'测试任务',provider,runRoot:tmp});
  assert.equal(r.manifest.status,'completed',r.manifest.error);assert.equal(A.replay(r.directory).toolsReplayed,4);count++;
  console.log('PASS 模拟供应商编排、落盘及离线复核（非真实模型评测）');
  console.log(JSON.stringify({suite:'agent-contract',passed:count,liveModel:false}));
}
integration().catch(e=>{console.error(e);process.exitCode=1;});
