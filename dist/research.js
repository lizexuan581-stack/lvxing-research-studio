(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else root.StudioResearch=factory(root.StudioCore);})(globalThis,function(C){
  'use strict';
  const version='1.3.0';
  const kinds=['披露事实','政策目标','代理参数','情景假设'];
  const statuses={pending:'待补资料',watch:'持续观察',met:'条件满足',failed:'条件未满足'};
  function normalize(p){
    p.details={segment:'',period:'',publisher:'',region:'',effective:'',execution:'待核实',payer:'',location:'',...(p.details||{})};
    p.financeInputs.fixedExpense??=0;p.financeInputs.extraIncentive??=0;
    p.scenarios??=[];
    p.tracking??=[
      {id:'paid',label:'收费需求',condition:'同口径收费订单与复购表现得到持续验证',status:'pending',observation:'',sourceId:''},
      {id:'contract',label:'结算依据',condition:'付款主体、有效合同与当期收入确认条件明确',status:'pending',observation:'',sourceId:''},
      {id:'cost',label:'成本覆盖',condition:'新增收入覆盖边际成本、固定支出与企业激励',status:'pending',observation:'',sourceId:''},
      {id:'cash',label:'现金回收',condition:'到账周期与新增投入匹配，所需现金支出有资金安排',status:'pending',observation:'',sourceId:''}
    ];
    p.counterEvidence??='';p.history??=null;
    p.facts.forEach(f=>{if(!kinds.includes(f.category))f.category='待分类';});
    return p;
  }
  function validate(p){
    normalize(p);
    if(Object.values(p.details).some(x=>typeof x!=='string'||x.length>5000))throw Error('研究范围或事件字段格式不正确');
    if(!Array.isArray(p.scenarios)||p.scenarios.length>12||!Array.isArray(p.tracking)||p.tracking.length>12)throw Error('对比情景或跟踪项超过12项');
    for(const s of p.scenarios){if(!/^[\w-]+$/.test(s.id)||typeof s.name!=='string'||typeof s.createdAt!=='string')throw Error('情景记录格式错误');C.finance(s.inputs);}
    for(const t of p.tracking)if(!/^[\w-]+$/.test(t.id)||!statuses[t.status]||['label','condition','observation','sourceId'].some(k=>typeof t[k]!=='string'))throw Error('跟踪项格式错误');
    if(p.history)p.history.result=historical(p.history.inputs);
    if(p.financeResult)p.financeResult=C.finance(p.financeInputs);
    if(p.carbonResult)p.carbonResult=C.carbon(p.carbonRows);
    if(p.behaviorResult)p.behaviorResult=C.behavior(p.behaviorInputs);
    if(typeof p.counterEvidence!=='string')throw Error('反向证据格式错误');
    return p;
  }
  function number(x,name,nullable=false){if(nullable&&(x===null||x===undefined||x===''))return null;if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>1e10)throw Error(name+'须为0—100亿之间的数值');return x;}
  // Decimal arithmetic retains nine decimal places internally; monetary outputs round only for display.
  const S=1000000000n;
  function fixed(v){const s=String(v),m=s.match(/^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);if(!m)throw Error('十进制数值格式错误');const digits=BigInt(m[1]+(m[2]||'')),power=9+Number(m[3]||0)-(m[2]||'').length;return power>=0?digits*10n**BigInt(power):div(digits,10n**BigInt(-power));}
  function div(n,d){if(d<=0n)throw Error('除数须大于零');return n<0n?-((-n+d/2n)/d):(n+d/2n)/d;}
  function display(v){return Number(div(v,10000000n))/100;}
  function historical(v){
    const a=number(v.revenue0,'前期收入'),b=number(v.revenue1,'本期收入');
    const ca=number(v.cost0,'前期成本',true),cb=number(v.cost1,'本期成本',true);
    const q0=number(v.orders0,'前期订单',true),q1=number(v.orders1,'本期订单',true),p0=number(v.price0,'前期单价',true),p1=number(v.price1,'本期单价',true);
    const parent=number(v.parentRevenue,'同口径整体收入',true);
    if(!v.scope||!v.period0||!v.period1||v.period0===v.period1)throw Error('请填写相同业务范围与两个不同的可比期间');
    if(parent!==null&&b>parent)throw Error('业务收入不能大于所填同口径整体收入');
    const delta=fixed(b)-fixed(a),complete=[q0,q1,p0,p1].every(x=>x!==null);
    const volume=complete?div((fixed(q1)-fixed(q0))*fixed(p0),S):null;
    const price=complete?div(fixed(q1)*(fixed(p1)-fixed(p0)),S):null;
    return {deltaRevenue:display(delta),growth:a===0?null:Number(delta)/Number(fixed(a))*100,
      gross0:ca===null?null:display(fixed(a)-fixed(ca)),gross1:cb===null?null:display(fixed(b)-fixed(cb)),
      margin0:ca===null||a===0?null:(a-ca)/a*100,margin1:cb===null||b===0?null:(b-cb)/b*100,
      volumeEffect:volume===null?null:display(volume),priceEffect:price===null?null:display(price),
      residual:complete?display(delta-volume-price):null,share:parent===null||parent===0?null:b/parent*100,
      orderGrowth:q0===null||q1===null||q0===0?null:(q1/q0-1)*100,priceGrowth:p0===null||p1===null||p0===0?null:(p1/p0-1)*100};
  }
  function historicalPreset(p,city=false){
    const ids=city?['cz_revenue_2024','cz_revenue_2025']:['shared_revenue_2024','shared_revenue_2025','shared_orders_2024','shared_orders_2025','shared_price_2024','shared_price_2025','shared_cost_2025'];
    const fs=ids.map(id=>p.facts.find(f=>f.id===id));
    if(fs.some(f=>!f||!f.sourceId||!p.docs.some(d=>d.id===f.sourceId)))throw Error('当前研究缺少配套案例字段或来源；请手动填写历史数据');
    const values=fs.map((f,i)=>{const period=fs[i===0||i===2||i===4?0:1].period;if(f.scope!==fs[0].scope||f.period!==period||f.unit!==(i===2||i===3?'万笔':i===4||i===5?'元/笔':'万元'))throw Error('案例字段范围、期间或单位已改变，请人工核对后手动填写');if(!f.reviewed||!['待分类','披露事实'].includes(f.category)||String(f.value).trim()===''||!Number.isFinite(Number(f.value)))throw Error('案例字段仍待核实或不是披露事实，请先核对');return Number(f.value);});
    const inputs={scope:fs[0].scope,period0:fs[0].period,period1:fs[1].period,revenue0:values[0],revenue1:values[1],cost0:null,cost1:city?null:values[6],orders0:city?null:values[2],orders1:city?null:values[3],price0:city?null:values[4],price1:city?null:values[5],parentRevenue:null,source:fs.map(f=>`${f.label}（${f.period}）：${f.value}${f.unit}；${f.source} ${f.location}`).join('\n')};
    historical(inputs);return inputs;
  }
  function mapOrders(v,change){
    ['population','tripsPerPerson'].forEach(k=>number(v[k],k));
    if(!Number.isFinite(change)||change< -1||change>1)throw Error('份额变化范围错误');
    ['coverage','supply','capture','paidShare'].forEach(k=>{if(typeof v[k]!=='number'||!Number.isFinite(v[k])||v[k]<0||v[k]>100)throw Error('各比例须为0—100%');});
    if(!v.period?.trim()||!v.basis?.trim())throw Error('请填写研究期间和数量依据或假设说明');
    const total=v.population*v.tripsPerPerson*change*v.coverage/100*v.supply/100*v.capture/100/10000;
    if(Math.abs(total)>1e7)throw Error('映射结果超过财务工具允许的订单范围');
    // A declining unpaid service base needs separate cost-saving assumptions, not negative "new free" orders.
    if(total<0&&v.paidShare!==100)throw Error('负向份额场景请将收费比例设为100%；免费订单减少需另建成本节约假设');
    const paid=Number((total*v.paidShare/100).toFixed(4)),free=Number((total*(1-v.paidShare/100)).toFixed(4));
    return {totalWan:Number(total.toFixed(4)),paidOrdersWan:paid,freeOrdersWan:free};
  }
  function reportInputs(p){return {profile:p.profile,details:p.details,policy:p.policy,docs:p.docs.map(d=>({id:d.id,title:d.title,url:d.url,hash:C.hash(JSON.stringify(d.pages))})),facts:p.facts,carbonRows:p.carbonRows,factorNote:p.factorNote,carbonResult:p.carbonResult,behaviorInputs:p.behaviorInputs,behaviorResult:p.behaviorResult,orderMapping:p.orderMapping,financeInputs:p.financeInputs,financeResult:p.financeResult,history:p.history,scenarios:p.scenarios,tracking:p.tracking,counterEvidence:p.counterEvidence,conclusion:p.conclusion};}
  const signature=p=>C.hash(JSON.stringify(reportInputs(p)));
  function reportAppendix(p){
    const f=n=>n===null||n===undefined?'未计算':Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});
    const d=p.details,h=p.history;
    const out=['','## 九、研究口径与政策事件',`业务分部：${d.segment||'待填写'}；研究期间：${d.period||'待填写'}。`,
      `发布主体：${d.publisher||'待核实'}；适用地区：${d.region||p.profile.city}；生效期间：${d.effective||'待核实'}。`,
      `执行状态：${d.execution}；资金承担者：${d.payer||'待核实'}；原文定位：${d.location||'待补充'}。`,
      '','## 十、历史经营复算'];
    if(h){const r=h.result;out.push(`${h.inputs.scope}；${h.inputs.period0} → ${h.inputs.period1}；收入变化${f(r.deltaRevenue)}万元，变动率${f(r.growth)}%。`,`本期毛利${f(r.gross1)}万元，毛利率${f(r.margin1)}%；量效应${f(r.volumeEffect)}万元，价效应${f(r.priceEffect)}万元，桥接残差${f(r.residual)}万元。`,'数据说明：'+(h.inputs.source||'手动输入，待核实'));}else out.push('未保存历史复算。');
    out.push('','## 十一、经营费用与情景对比',`新增固定经营支出${f(p.financeInputs.fixedExpense)}万元；企业另行承担的现金激励${f(p.financeInputs.extraIncentive)}万元。零值代表本次未计入，并非证明不存在该项支出。`);
    for(const s of p.scenarios){const r=C.finance(s.inputs);out.push(`- ${s.name}（${s.createdAt}）：收入增量${f(r.deltaRevenueWan)}万元，经营贡献${f(r.contributionWan)}万元；说明：${s.note||'未填写'}。`);}
    out.push('','## 十二、跟踪条件与反向证据',...p.tracking.map(t=>`- ${t.label}：${t.condition}；状态：${statuses[t.status]}；观察：${t.observation||'待补充'}；来源：${p.docs.find(d=>d.id===t.sourceId)?.title||'未关联'}。`),'反向证据及可推翻结论的条件：'+(p.counterEvidence||'待研究者补充。'));
    return out.join('\n');
  }
  function manifest(p){return {format:'lvxing-run-manifest',schemaVersion:2,appVersion:version,projectId:p.id,exportedAt:new Date().toISOString(),inputFingerprint:signature(p),fingerprintNote:'FNV变更标记，非密码学签名',capabilities:{pdfText:true,deterministicModels:true,externalLLM:!!p.agentRuns?.some(r=>r.manifest?.status==='completed'&&!r.replay),agentIntegration:'DeepSeek via paired local gateway',ocr:false,cloudSync:false},inputs:reportInputs(p),latestReport:p.reports[0]?{id:p.reports[0].id,createdAt:p.reports[0].createdAt,inputHash:p.reports[0].inputHash}:null,runCount:p.runs.length};}
  function tests(){
    const results=[],check=(name,fn)=>{try{if(!fn())throw Error('结果不符');results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}},reject=fn=>{try{fn();return false;}catch{return true;}};
    const h={scope:'全国共享出行业务',period0:'2024年',period1:'2025年',revenue0:10752.02,revenue1:8232.51,cost0:null,cost1:11630.34,orders0:6719.3,orders1:3806.05,price0:1.6,price1:2.16,parentRevenue:null};
    const f={baseline:2934.75,paidOrdersWan:30,freeOrdersWan:0,price:2.16,cost:1,compensation:0,contractVerified:false,fixedExpense:4,extraIncentive:2,capex:0,workingCapital:0,otherCash:0};
    const m={population:100000,tripsPerPerson:10,coverage:50,supply:80,capture:20,paidShare:60,period:'情景期间',basis:'人工假设'};
    check('量价拆解：量效应−4661.20万元',()=>historical(h).volumeEffect===-4661.2);
    check('量价拆解：价效应2131.39万元',()=>historical(h).priceEffect===2131.39);
    check('保留披露收入桥接残差10.30万元',()=>historical(h).residual===10.3);
    check('毛利复算−3397.83万元',()=>historical(h).gross1===-3397.83);
    check('前期零收入不生成增长率',()=>historical({...h,revenue0:0}).growth===null);
    check('缺少订单不补造量价结果',()=>historical({...h,orders0:null}).volumeEffect===null);
    check('拒绝业务收入大于整体收入',()=>reject(()=>historical({...h,parentRevenue:100})));
    check('拒绝相同期间历史同比',()=>reject(()=>historical({...h,period1:h.period0})));
    check('固定费用与企业激励扣减正确',()=>C.finance(f).contributionWan===28.8);
    check('经营门槛包含新增费用',()=>C.finance(f).breakEvenPrice===1.2);
    check('缺成本时即使填费用也保留未知',()=>C.finance({...f,cost:null}).contributionWan===null);
    check('费用参与敏感性矩阵中央格',()=>C.sensitivity(f).cells[2][2]===28.8);
    check('分层映射拆出收费0.48万笔',()=>mapOrders(m,.1).paidOrdersWan===.48);
    check('分层映射拆出免费0.32万笔',()=>mapOrders(m,.1).freeOrdersWan===.32);
    check('零覆盖不产生新增服务量',()=>mapOrders({...m,coverage:0},.1).totalWan===0);
    check('拒绝超过100%的承接比例',()=>reject(()=>mapOrders({...m,capture:110},.1)));
    check('映射必须保留期间与依据',()=>reject(()=>mapOrders({...m,basis:''},.1)));
    check('负向免费订单需要独立成本模型',()=>reject(()=>mapOrders(m,-.1)));
    return results;
  }
  return {version,kinds,statuses,normalize,validate,historical,historicalPreset,mapOrders,reportInputs,signature,reportAppendix,manifest,tests};
});
