// UI composition for the plan-aligned research workflow. All user text is escaped.
export function createResearchStudio(api) {
  const {project,getState,route,actions,render,persist,record,go,modal,closeDialog,toast,download,btn,tag,input,textfield,textarea,esc,fmt,uid,readFinance,readBehavior,setReport,getReport}=api;
  const C=window.StudioCore,R=window.StudioResearch,$=s=>document.querySelector(s);
  const sources=(id='')=>'<option value="">待补充来源</option>'+project().docs.map(d=>`<option value="${esc(d.id)}" ${d.id===id?'selected':''}>${esc(d.title)}</option>`).join('');
  const select=(label,id,options)=>`<label class="field"><span>${label}</span><select id="${id}">${options}</select></label>`;
  const panel=(title,note,body,extra='')=>`<div class="panel v2-panel"><div class="panel-header"><div><h2>${title}</h2><p>${note}</p></div>${extra}</div>${body}</div>`;
  const num=(id,nullable=false)=>{const val=$('#'+id).value.trim();if(!val&&nullable)return null;if(!val||!Number.isFinite(Number(val)))throw Error('请填写有效数值');return Number(val);};
  const wrap=(key,fn)=>{const prior=actions[key];actions[key]=el=>fn(prior,el);};
  const add=(html,first=false)=>{const sec=$('#main>section');if(first)sec.querySelector('.page-header').insertAdjacentHTML('afterend',html);else sec.insertAdjacentHTML('beforeend',html);};
  const date=t=>new Date(t).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  function readDetails(){const d={...project().details};Object.keys(d).forEach(k=>{if($('#detail-'+k))d[k]=$('#detail-'+k).value.trim();});return d;}
  function readHistory(){const old=project().history?.inputs||{};return {...old,scope:$('#hScope').value.trim(),period0:$('#hPeriod0').value.trim(),period1:$('#hPeriod1').value.trim(),source:$('#hSource').value.trim(),...Object.fromEntries(['revenue0','revenue1','cost0','cost1','orders0','orders1','price0','price1','parentRevenue'].map(k=>[k,num('h-'+k,!k.startsWith('revenue'))]))};}
  function fillHistory(v){$('#hScope').value=v.scope;$('#hPeriod0').value=v.period0;$('#hPeriod1').value=v.period1;$('#hSource').value=v.source;for(const k of ['revenue0','revenue1','cost0','cost1','orders0','orders1','price0','price1','parentRevenue'])$('#h-'+k).value=v[k]??'';$('#historyNotice').textContent='已载入字段。请核对可比期间与来源，点击复算后保存。';}
  function applyMapping(p){if(p.orderMapping?.version===2){const r=R.mapOrders(p.orderMapping,p.behaviorResult.change);Object.assign(p.financeInputs,{paidOrdersWan:r.paidOrdersWan,freeOrdersWan:r.freeOrdersWan});p.financeResult=null;}else if(p.orderMapping){p.financeInputs.paidOrdersWan=Number((p.orderMapping.trips*p.behaviorResult.change*p.orderMapping.share/100/10000).toFixed(4));p.financeResult=null;}}
  function invalidateCarbon(){const p=project();if(p.carbonLinked){p.behaviorResult=null;if(p.orderMapping)p.financeResult=null;}persist();}

  actions['motion-toggle']=()=>{const s=getState();s.motionPaused=!s.motionPaused;document.body.classList.toggle('motion-paused',s.motionPaused);document.querySelectorAll('[data-action="motion-toggle"]').forEach(b=>{b.textContent=b.id==='motionControl'?(s.motionPaused?'动态已暂停':'动态开启'):(s.motionPaused?'开启动态':'暂停动态');if(b.id==='motionControl')b.setAttribute('aria-pressed',String(!s.motionPaused));});persist();};
  actions['jump-tool']=el=>{const node=$('#'+el.dataset.target);if(node?.tagName==='DETAILS')node.open=true;node?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches||getState().motionPaused?'instant':'smooth',block:'start'});};
  actions['save-details']=()=>{project().details=readDetails();record('研究范围与政策事件',project().details,{saved:true});render();toast('研究范围和事件字段已保存');};
  wrap('save-policy',(old,el)=>{const details=readDetails();old(el);project().details=details;persist();render();});
  wrap('save-project',(old,el)=>{const detail=el.dataset.edit==='true'?{...project().details}:null;old(el);if(detail)project().details=detail;R.normalize(project());persist();render();});
  for(const name of ['add-carbon','remove-carbon'])wrap(name,(old,el)=>{old(el);invalidateCarbon();render();});
  actions['calculate-behavior']=()=>{
    const p=project(),v=readBehavior(),r=C.behavior(v),start=performance.now();
    if(p.orderMapping?.version===2)R.mapOrders(p.orderMapping,r.change); // validate before changing a saved model
    if(p.carbonLinked&&v.carbonKg!==p.carbonResult?.perTripKg)p.carbonLinked=false;
    p.behaviorInputs=v;p.behaviorResult=r;applyMapping(p);record('行为情景模拟',v,r,start);render();toast('行为情景已保存'+(p.orderMapping?'；关联订单参数已更新，财务结果需重算':'；可继续设置订单映射'));
  };
  actions['map-orders']=()=>{
    const p=project();if(!p.behaviorResult)throw Error('请先运行并保存行为模拟');
    const v=p.orderMapping?.version===2?p.orderMapping:{population:100000,tripsPerPerson:10,coverage:100,supply:100,capture:20,paidShare:100,period:p.details.period,basis:''};
    modal('从出行变化到业务订单',`<p class="hint">依次考虑研究人群、同期出行频次、地域重合、供给承接和竞争分流。以下默认数值仅作方法演示。</p><div class="field-grid">${input('目标人群','mPopulation',v.population,'人','min="0"')}${input('同期人均出行次数','mTrips',v.tripsPerPerson,'次','min="0"')}${input('地域覆盖','mCoverage',v.coverage,'%','min="0" max="100"')}${input('供给承接','mSupply',v.supply,'%','min="0" max="100"')}${input('竞争后业务承接','mCapture',v.capture,'%','min="0" max="100"')}${input('新增订单收费比例','mPaid',v.paidShare,'%','min="0" max="100"')}</div>${textfield('研究期间','mPeriod',v.period,'与财务情景保持同一期间')}${textarea('数量依据 / 假设说明','mBasis',v.basis,2)}<div class="formula">新增服务量 = 人群 × 次数 × 份额变化 × 覆盖 × 供给 × 承接<small>再按收费比例拆分收费与免费订单。该模型未经城市样本校准。</small></div>`,btn('拆分并带入财务参数','confirm-map'));
  };
  actions['confirm-map']=()=>{
    const p=project(),v={version:2,population:num('mPopulation'),tripsPerPerson:num('mTrips'),coverage:num('mCoverage'),supply:num('mSupply'),capture:num('mCapture'),paidShare:num('mPaid'),period:$('#mPeriod').value.trim(),basis:$('#mBasis').value.trim()},r=R.mapOrders(v,p.behaviorResult.change);
    p.orderMapping=v;Object.assign(p.financeInputs,{paidOrdersWan:r.paidOrdersWan,freeOrdersWan:r.freeOrdersWan});p.financeResult=null;record('出行量与收费结构映射',{...v,change:p.behaviorResult.change},r);closeDialog();go('finance');toast('已分开带入收费与免费订单，请核对并计算');
  };
  wrap('preset',(old,el)=>{project().orderMapping=null;old(el);});
  actions['calculate-finance']=()=>{
    const p=project(),start=performance.now(),v={...readFinance(),fixedExpense:num('fFixed'),extraIncentive:num('fIncentive')},r=C.finance(v);
    if(p.orderMapping&&(v.paidOrdersWan!==p.financeInputs.paidOrdersWan||v.freeOrdersWan!==p.financeInputs.freeOrdersWan))p.orderMapping=null;
    p.financeInputs=v;p.financeResult=r;record('财务情景测算',v,r,start);render();toast('测算已保存：收入增量 '+fmt(r.deltaRevenueWan)+' 万元');
  };
  actions['history-preset']=el=>{fillHistory(R.historicalPreset(project(),el.dataset.id==='city'));};
  actions['calculate-history']=()=>{const p=project(),v=readHistory(),start=performance.now(),r=R.historical(v);p.history={inputs:v,result:r,createdAt:new Date().toISOString()};record('历史经营复算',v,r,start);render();$('#historyTool').open=true;$('#historyTool').scrollIntoView({block:'start'});toast('历史同比、毛利和量价拆解已保存');};
  actions['export-history']=()=>{const h=project().history;if(!h)throw Error('请先保存一次历史复算');download('绿行智研_历史复算.csv',C.safeCSV([['项目','结果','单位'],['业务范围',h.inputs.scope,''],['前期',h.inputs.period0,''],['本期',h.inputs.period1,''],...Object.entries({收入变化:'deltaRevenue',收入变动率:'growth',本期毛利:'gross1',本期毛利率:'margin1',量效应:'volumeEffect',价效应:'priceEffect',残差:'residual',业务占比:'share'}).map(([name,k])=>[name,h.result[k],['growth','margin1','share'].includes(k)?'%':'万元']),['来源与口径',h.inputs.source,'']]),'text/csv;charset=utf-8');};
  actions['save-scenario']=()=>{
    const p=project();if(!p.financeResult)throw Error('请先运行并保存财务测算');if(p.scenarios.length>=12)throw Error('最多保留12个对比情景，请先导出备份再移除旧项');
    // The form may contain edits not yet calculated. Never label the previous result as the new inputs.
    const live={...readFinance(),fixedExpense:num('fFixed'),extraIncentive:num('fIncentive')};
    if(Object.entries(live).some(([k,v])=>v!==p.financeInputs[k]))throw Error('表单有未计算的修改，请先点击计算并保存');
    modal('保存当前情景',textfield('情景名称','scenarioName','情景 '+(p.scenarios.length+1))+textarea('适用条件与假设','scenarioNote','',3)+'<p class="hint">保留当前输入快照，不覆盖其他情景。研究包备份包含所有保存情景。</p>',btn('保存到对比库','confirm-scenario'));
  };
  actions['confirm-scenario']=()=>{const p=project(),name=$('#scenarioName').value.trim();if(!name)throw Error('请填写情景名称');p.scenarios.unshift({id:uid(),name,note:$('#scenarioNote').value.trim(),createdAt:new Date().toISOString(),inputs:structuredClone(p.financeInputs),result:structuredClone(p.financeResult),context:{...p.profile,...p.details}});persist();closeDialog();render();$('#scenarioTool').open=true;$('#scenarioTool').scrollIntoView({block:'start'});toast('情景已加入对比');};
  actions['load-scenario']=el=>{const s=project().scenarios.find(x=>x.id===el.dataset.id);if(!s)throw Error('情景不存在');project().financeInputs=structuredClone(s.inputs);project().financeResult=null;project().orderMapping=null;persist();render();window.scrollTo({top:0});toast('已载入“'+s.name+'”参数，请重新计算');};
  actions['remove-scenario']=el=>modal('移除这个对比情景？','<p>只移除对比库中的快照，不删除当前参数或运行记录。已导出的研究包仍可恢复该快照。</p>',btn('取消','close','outline')+btn('确认移除','confirm-remove-scenario','danger',`data-id="${esc(el.dataset.id)}"`));
  actions['confirm-remove-scenario']=el=>{const p=project();p.scenarios=p.scenarios.filter(s=>s.id!==el.dataset.id);persist();closeDialog();render();$('#scenarioTool').open=true;toast('已移除该情景；已有研究包备份不受影响');};
  actions['export-comparison']=()=>{const p=project();if(!p.scenarios.length)throw Error('请先保存情景');download('绿行智研_情景对比.csv',C.safeCSV([['情景','收费订单/万笔','免费订单/万笔','单价/元','边际成本/元','固定支出/万元','另付激励/万元','收入变化/万元','经营贡献/万元','现金差额/万元','说明'],...p.scenarios.map(s=>{const v=s.inputs,r=C.finance(v);return [s.name,v.paidOrdersWan,v.freeOrdersWan,v.price,v.cost,v.fixedExpense||0,v.extraIncentive||0,r.deltaRevenueWan,r.contributionWan,r.cashAfterInputsWan,s.note];})]),'text/csv;charset=utf-8');};
  wrap('add-fact',(old,el)=>{old(el);factCategory();});
  wrap('edit-fact',(old,el)=>{old(el);factCategory(project().facts.find(f=>f.id===el.dataset.id));});
  wrap('candidate-fact',(old,el)=>{old(el);factCategory();});
  wrap('save-fact',(old,el)=>{const category=$('#factCategory').value;old(el);project().facts.find(f=>f.id===el.dataset.id).category=category;persist();render();});
  function factCategory(f){$('#dialog .dialog-bottom').insertAdjacentHTML('beforebegin',select('信息性质（核对原文不等于目标已经实现）','factCategory',['待分类',...R.kinds].map(k=>`<option ${k===(f?.category||'待分类')?'selected':''}>${k}</option>`).join('')));}
  actions['export-facts']=()=>download('绿行智研_事实与假设.csv',C.safeCSV([['指标','数值','单位','期间','范围','性质','复核','来源','位置'],...project().facts.map(f=>[f.label,f.value,f.unit,f.period,f.scope,f.category,f.reviewed?'已核对原文':'待核对',project().docs.find(d=>d.id===f.sourceId)?.title||'待补',f.location])]),'text/csv;charset=utf-8');
  actions['track-edit']=el=>{
    const p=project(),t=p.tracking.find(x=>x.id===el.dataset.id)||{id:uid(),label:'',condition:'',status:'pending',observation:'',sourceId:''};
    if(!el.dataset.id&&p.tracking.length>=12)throw Error('最多12条跟踪条件');
    modal('编辑研究跟踪条件',textfield('跟踪主题','tLabel',t.label)+textarea('判断阈值 / 触发条件','tCondition',t.condition,2)+select('当前状态','tStatus',Object.entries(R.statuses).map(([k,v])=>`<option value="${k}" ${t.status===k?'selected':''}>${v}</option>`).join(''))+textarea('本次观察与原文定位','tObservation',t.observation,3)+select('关联资料','tSource',sources(t.sourceId)),btn('保存跟踪项','track-save','',`data-id="${esc(t.id)}"`));
  };
  actions['track-save']=el=>{
    const p=project(),t={id:el.dataset.id,label:$('#tLabel').value.trim(),condition:$('#tCondition').value.trim(),status:$('#tStatus').value,observation:$('#tObservation').value.trim(),sourceId:$('#tSource').value};
    if(!t.label||!t.condition)throw Error('请填写主题与触发条件');
    if(['met','failed'].includes(t.status)&&(!t.observation||!t.sourceId))throw Error('判断满足或不满足前，请补充观察、定位和资料来源');
    const i=p.tracking.findIndex(x=>x.id===t.id);if(i<0)p.tracking.push(t);else p.tracking[i]=t;
    record('研究跟踪条件更新',t,{status:t.status});closeDialog();render();toast('跟踪条件已保存；重新生成报告即可纳入');
  };
  actions['save-counter']=()=>{project().counterEvidence=$('#counterEvidence').value.trim();persist();updateFreshness();toast('反向证据已保存，生成报告时会一并纳入');};
  wrap('save-conclusion',(old,el)=>{old(el);updateFreshness();});
  function updateFreshness(){const p=project(),shown=p.reports.find(r=>r.text===(getReport()||p.reports[0]?.text));if(shown&&shown.inputHash!==R.signature(p)){const el=$('.report-freshness');if(el){el.classList.remove('fresh');el.querySelector('span').textContent='↻ 当前底稿已更新，请重新生成报告';}}}
  actions['generate-report']=()=>{
    const p=project();if($('#reportConclusion'))p.conclusion=$('#reportConclusion').value;if($('#counterEvidence'))p.counterEvidence=$('#counterEvidence').value.trim();
    if(!p.docs.length)throw Error('请先添加研究资料');
    const start=performance.now(),text=C.report(p)+R.reportAppendix(p),item={id:uid(),createdAt:new Date().toISOString(),text,inputHash:R.signature(p),schemaVersion:2,snapshot:R.reportInputs(structuredClone(p))};
    p.reports.unshift(item);p.reports=p.reports.slice(0,20);setReport(text);record('报告编排',{inputHash:item.inputHash},{reportId:item.id,characters:text.length},start);render();toast('已生成包含历史底稿、情景对比和跟踪条件的新版本');
  };
  actions['export-manifest']=()=>download('manifest.json',JSON.stringify(R.manifest(project()),null,2));
  actions['export-runlog']=()=>download('run.jsonl',project().runs.slice().reverse().map(r=>JSON.stringify(r)).join('\n'),'application/x-ndjson;charset=utf-8');
  wrap('export-finance',(old)=>{const p=project(),r=p.financeResult;if(!r)throw Error('请先计算并保存');download('绿行智研_财务测算.csv',C.safeCSV([['指标','数值','单位'],...Object.entries({baseline:'收入基准',paidOrdersWan:'收费订单净变化',freeOrdersWan:'新增免费订单',price:'订单单价',cost:'边际成本',compensation:'合同收入输入',fixedExpense:'新增固定经营支出',extraIncentive:'另行承担现金激励',capex:'新增资本支出',workingCapital:'新增营运资金',otherCash:'其他现金支出'}).map(([k,n])=>[n,p.financeInputs[k],['price','cost'].includes(k)?'元/笔':k.includes('Orders')?'万笔':'万元']),['合同计入条件',p.financeInputs.contractVerified?p.financeInputs.contractRef:'未核实，不计入',''],['收入增量',r.deltaRevenueWan,'万元'],['增量经营贡献',r.contributionWan,'万元'],['扣所填现金支出后差额',r.cashAfterInputsWan,'万元'],['性质','情景假设；不等于净利润或完整自由现金流','']]),'text/csv;charset=utf-8');});

  function cityScene(){return `<div class="city-scene" aria-hidden="true"><div class="scene-glow"></div><div class="scene-label">GREEN MOBILITY · RESEARCH IN MOTION</div><svg class="city-svg" viewBox="0 0 560 350"><defs><linearGradient id="tower" x2="1" y2="1"><stop stop-color="#8dd1b7" stop-opacity=".35"/><stop offset="1" stop-color="#183d37" stop-opacity=".2"/></linearGradient><linearGradient id="routeGlow"><stop stop-color="#65d6bb"/><stop offset="1" stop-color="#d8f49e"/></linearGradient></defs><g class="city-grid" fill="none" stroke="#87c5a0" stroke-opacity=".18"><path d="M20 225 280 90 540 225 280 360Z M85 259 345 124 M150 292 410 158 M215 326 475 192 M85 192 345 326 M150 158 410 292 M215 124 475 259"/></g><g fill="url(#tower)" stroke="#a8e5be" stroke-opacity=".45" stroke-linejoin="round"><path d="m107 226 0-82 43-23 38 20v82l-41 24Z m0-82 40 22 41-25 m-41 25v81"/><path d="m239 220 0-137 46-24 45 24v137l-45 24Z m0-137 46 24 45-24 m-45 24v137"/><path d="m365 235 0-101 37-21 39 21v101l-39 22Z m0-101 37 22 39-22 m-39 22v101"/></g><g fill="#dcf4a6" opacity=".6"><path d="m119 163 15 8v5l-15-8z m0 17 15 8v5l-15-8z m0 17 15 8v5l-15-8z m132-90 20 10v5l-20-10z m0 18 20 10v5l-20-10z m0 18 20 10v5l-20-10z m126 8 12 7v5l-12-7z m0 17 12 7v5l-12-7z"/></g><path d="M45 247 195 320 298 267 480 175" stroke="#51a592" stroke-width="12" stroke-opacity=".18" fill="none"/><path class="route-stream" d="M45 247 195 320 298 267 480 175" stroke="url(#routeGlow)" stroke-width="2" fill="none"/><g class="map-nodes" fill="#d9f59c"><circle cx="45" cy="247" r="5"/><circle cx="195" cy="320" r="5"/><circle cx="298" cy="267" r="5"/><circle cx="480" cy="175" r="5"/></g><g fill="#8cd2b1"><ellipse cx="193" cy="236" rx="14" ry="6"/><path d="M193 236v-23" stroke="#addc9c"/><circle cx="193" cy="207" r="14" opacity=".6"/><ellipse cx="459" cy="270" rx="14" ry="6"/><path d="M459 270v-24" stroke="#addc9c"/><circle cx="459" cy="242" r="15" opacity=".6"/></g></svg><div class="scene-chip chip-policy"><span class="signal-dot"></span>政策信号<small>从原始资料出发</small></div><div class="scene-chip chip-model">ƒ(x)　条件计算<small>把影响拆成可检查的变量</small></div><div class="scene-chip chip-output">↗　研究输出<small>结论与依据一起交付</small></div></div>`;}
  function overviewView(){
    const p=project();$('.orbit-visual')?.replaceWith(document.createRange().createContextualFragment(cityScene()));
    $('.hero>div:first-child>p').textContent='整理政策证据，推演出行情景，算清经营影响。让每一步研究，都能回到依据。';
    $('.hero-note').textContent=[p.profile.city,p.profile.company,p.details.segment||'待补业务范围'].join(' · ');
    $('.hero').insertAdjacentHTML('afterend',`<div class="research-ribbon"><span><i class="signal-dot"></i> RESEARCH STUDIO <b>1.2</b></span><p>资料 → 政策 → 环境与行为 → 经营影响 → 研究交付</p>${btn(getState().motionPaused?'开启动态':'暂停动态','motion-toggle','outline small')}</div>`);
    add(panel('下一步，把问题问得更具体','按研究底稿的完成情况，直接进入需要补充的环节。',`<div class="task-cards">${[
      ['policy','01','明确研究范围',p.details.period?`${p.details.period} · ${p.details.segment||'业务分部待填'}`:'补齐业务分部、研究期间与政策六要素。','mint'],
      ['finance','02','比较经营变化',p.history?`已保存${p.history.inputs.period0}—${p.history.inputs.period1}历史复算`:'核对历史同比、成本结构，再比较新的情景。','lavender'],
      ['report','03','跟踪兑现条件',`${p.tracking.filter(t=>t.status==='met').length}/${p.tracking.length}项条件标记为满足；在报告里保留反向证据。`,'sand']
    ].map(([r,n,t,d,color])=>`<button class="task-card ${color}" data-route="${r}"><span class="task-number">${n}</span><b>${t}</b><p>${esc(d)}</p><span class="task-arrow">↗</span></button>`).join('')}</div>`));
  }
  function policyView(){
    const d=project().details;
    add(panel('研究范围与政策六要素','先限定对象和期间，再判断政策如何传到业务。',`<div class="detail-grid">${textfield('业务分部','detail-segment',d.segment,'例如：共享出行业务')}${textfield('研究期间','detail-period',d.period,'例如：2025年全年 / 未来12个月情景')}${textfield('发布主体','detail-publisher',d.publisher)}${textfield('适用地区','detail-region',d.region||project().profile.city)}${textfield('生效期间','detail-effective',d.effective)}${select('执行状态','detail-execution',['待核实','政策目标','试点执行','已实施','已终止'].map(k=>`<option ${d.execution===k?'selected':''}>${k}</option>`).join(''))}${textfield('资金承担者','detail-payer',d.payer,'用户 / 政府采购 / 企业 / 待核实')}${textfield('原文定位','detail-location',d.location,'页码、条款、发布日期')}</div><p class="hint">政策措施、影响路径与关联来源在下方事件卡保存。政策目标与实际执行分开登记。</p>`,btn('保存范围与事件字段','save-details','outline small')),true);
  }
  function docsView(){
    const p=project();add(`<div class="evidence-strip">${['待分类',...R.kinds].map(k=>`<div><b>${p.facts.filter(f=>f.category===k).length}</b><span>${k}</span></div>`).join('')}${btn('导出事实表','export-facts','outline small')}</div>`,true);
    $('#main .tabs')?.insertAdjacentHTML('afterend','<p class="v2-caption">“已核对”表示对照过原文；信息性质在编辑字段中选择，目标与假设仍不会自动变成已实现业绩。</p>');
    document.querySelectorAll('button[data-action="edit-fact"]').forEach(el=>{const f=p.facts.find(x=>x.id===el.dataset.id);el.closest('tr')?.querySelector('td')?.insertAdjacentHTML('beforeend',`<small class="fact-kind">${esc(f?.category||'待分类')}</small>`);});
  }
  function carbonView(){
    const p=project(),r=p.carbonResult;
    add(panel('看清每一种替代方式的贡献','计算式：出行次数 × 单次里程 ×（基准排放因子 − 情景排放因子）。',r?`<div class="carbon-bars">${r.items.map(x=>`<div class="carbon-bar"><div><b>${esc(x.name)}</b><span>${fmt(x.reductionKg)} kg CO₂e</span></div><div class="bar-track"><i class="${x.reductionKg<0?'negative':''}" style="--bar:${Math.max(1,Math.abs(x.reductionKg)/Math.max(...r.items.map(y=>Math.abs(y.reductionKg)),1)*100)}%"></i></div><p>${fmt(x.trips,0)}次 × ${fmt(x.km)}km × (${fmt(x.base,3)} − ${fmt(x.green,3)})</p></div>`).join('')}</div><div class="mini-insight"><b>输入、单位与来源一起看</b><p>${esc(p.factorNote)}</p></div>`:'<div class="mini-insight"><b>先核算，再解释</b><p>保存一次计算后，这里按出行方式展示减排差额。负值表示排放增加，不会被截成零。</p></div>'));
  }
  function behaviorView(){
    const p=project(),m=p.orderMapping;
    add(panel('让份额变化落到服务量','从研究人群到收费订单，中间每一步都要写出条件。',`<div class="mapping-chain">${['目标人群','出行频次','份额变化','地域覆盖','供给承接','竞争分流','收费结构'].map((t,i)=>`<span><small>0${i+1}</small>${t}</span>`).join('')}</div>${m?.version===2?`<div class="mini-insight"><b>已保存映射 · ${esc(m.period)}</b><p>${esc(m.basis)}</p><p>收费订单变化 ${fmt(p.financeInputs.paidOrdersWan,4)} 万笔 · 免费订单增加 ${fmt(p.financeInputs.freeOrdersWan,4)} 万笔</p></div>`:'<p class="hint">只拥有行为曲线时，不能直接认定企业订单增长。设置映射后，收费与免费订单分别进入财务模型。</p>'}<div class="actions v2-space">${btn('设置订单映射','map-orders','outline')}${btn('查看财务参数 →','to-report-finance','outline')}</div>`));
  }
  actions['to-report-finance']=()=>go('finance');
  function historyView(){
    const h=project().history,v=h?.inputs||{},r=h?.result;
    return `<details class="tool-disclosure" id="historyTool"><summary><span><small>HISTORICAL REVIEW</small><b>历史经营复算</b><em>同比、毛利、量价拆解和业务占比</em></span><span class="expand-mark">＋</span></summary><div class="tool-body"><div class="actions">${btn('载入全国案例字段','history-preset','outline small','data-id="national"')}${btn('载入常州案例字段','history-preset','outline small','data-id="city"')}${btn('导出复算底稿','export-history','outline small')}</div><p class="hint v2-space">只从当前研究已关联的案例事实取值，不自动抓取外部数据。缺失成本或订单可留空。</p>${textfield('业务与地区口径','hScope',v.scope||'')}<div class="field-grid">${textfield('前期','hPeriod0',v.period0||'')}${textfield('本期','hPeriod1',v.period1||'')}</div><div class="history-input-grid">${[['revenue','收入','万元'],['cost','成本（可空）','万元'],['orders','订单（可空）','万笔'],['price','单价（可空）','元/笔']].map(([k,n,u])=>`<div>${input('前期'+n,'h-'+k+'0',v[k+'0'],u,'min="0" step="any"')}${input('本期'+n,'h-'+k+'1',v[k+'1'],u,'min="0" step="any"')}</div>`).join('')}</div>${input('同期间整体收入（用于占比，可空）','h-parentRevenue',v.parentRevenue,'万元','min="0" step="any"')}${textarea('来源、页码与可比性说明','hSource',v.source||'',3)}<p id="historyNotice" class="hint"></p><div class="actions v2-space">${btn('复算并保存','calculate-history')}</div>${r?`<div class="historical-results"><div><small>收入变化</small><b>${fmt(r.deltaRevenue)}<em>万元</em></b></div><div><small>收入变动率</small><b>${fmt(r.growth)}<em>%</em></b></div><div><small>本期毛利</small><b>${fmt(r.gross1)}<em>万元</em></b></div><div><small>本期毛利率</small><b>${fmt(r.margin1)}<em>%</em></b></div></div><div class="bridge-grid">${[['订单量效应',r.volumeEffect,'(本期量 − 前期量) × 前期价'],['单价效应',r.priceEffect,'本期量 × (本期价 − 前期价)'],['桥接残差',r.residual,'披露收入变化 − 量效应 − 价效应']].map(([t,n,f])=>`<div><span>${t}</span><b>${fmt(n)}<small> 万元</small></b><p>${f}</p></div>`).join('')}</div><p class="hint">前期收入为零时不输出增长率。披露单价四舍五入、口径差异可能形成残差，不能改写收入去凑平。业务占比：${fmt(r.share)}%。表单更改后请复算，以上为上次保存结果。</p>`:''}</div></details>`;
  }
  function scenarioView(){const p=project();return `<details class="tool-disclosure" id="scenarioTool"><summary><span><small>SCENARIO LIBRARY</small><b>保存情景与横向对比</b><em>${p.scenarios.length} / 12 个参数快照 · 不覆盖当前研究</em></span><span class="expand-mark">＋</span></summary><div class="tool-body"><div class="actions">${btn('保存当前财务情景','save-scenario')}${btn('导出对比表','export-comparison','outline')}</div>${p.scenarios.length?`<div class="table-wrap v2-space"><table><thead><tr><th>情景 / 研究期间</th><th>收费 / 免费（万笔）</th><th>收入增量（万元）</th><th>经营贡献（万元）</th><th>现金差额（万元）</th><th>操作</th></tr></thead><tbody>${p.scenarios.map(s=>{const r=C.finance(s.inputs);return `<tr><td><strong>${esc(s.name)}</strong><small>${esc(s.context?.period||'期间待填写')} · ${date(s.createdAt)}</small><small>${esc(s.note)}</small></td><td>${fmt(s.inputs.paidOrdersWan)} / ${fmt(s.inputs.freeOrdersWan)}</td><td>${fmt(r.deltaRevenueWan)}</td><td>${fmt(r.contributionWan)}</td><td>${fmt(r.cashAfterInputsWan)}</td><td>${btn('载入参数','load-scenario','outline small',`data-id="${esc(s.id)}"`)} ${btn('移除','remove-scenario','outline small',`data-id="${esc(s.id)}"`)}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty"><b>把可比较的假设放在一起</b>先计算一个情景，保存后调整订单、单价或支出，再保存下一组。缺失成本的结果继续留空。</div>'}</div></details>`;}
  function financeView(){
    const p=project();
    $('#fRef').closest('.field').insertAdjacentHTML('afterend',`<div class="expense-box"><b>把新增经营支出算完整</b><div class="field-grid">${input('新增固定经营支出','fFixed',p.financeInputs.fixedExpense,'万元','min="0" step=".01"')}${input('另行承担的现金激励','fIncentive',p.financeInputs.extraIncentive,'万元','min="0" step=".01"')}</div><p class="hint">不重复扣除已包含在实收价中的优惠。零值仅代表本次未计入。经营贡献 = 收入增量 − 新增订单成本 − 固定经营支出 − 另付激励。</p></div>`);
    add(`<div class="tool-nav"><span>研究工具</span>${btn('历史经营复算 ↓','jump-tool','outline small','data-target="historyTool"')}${btn('情景保存与对比 ↓','jump-tool','outline small','data-target="scenarioTool"')}${btn('保存当前情景','save-scenario','outline small')}</div>`,true);
    add(historyView()+scenarioView());
    if(p.orderMapping?.version===2)$('#fPaid').closest('.field-grid').insertAdjacentHTML('beforebegin',`<div class="alert green">订单来自已保存行为映射：${esc(p.orderMapping.period)}。手动更改收费或免费订单后，将解除映射。</div>`);
  }
  function trackingView(){const p=project();return panel('研究还需要哪些证据？','把结论成立的条件写清楚，也保留可能推翻结论的材料。',`<div class="tracking-grid">${p.tracking.map(t=>`<div class="tracking-card"><div class="row between"><b>${esc(t.label)}</b>${tag(R.statuses[t.status],t.status==='met'?'':t.status==='failed'?'orange':'gray')}</div><p>${esc(t.condition)}</p>${t.observation?`<small>${esc(t.observation)}</small>`:''}<div class="row between"><span class="hint">${t.sourceId?'已关联资料':'来源待补充'}</span>${btn('更新记录','track-edit','outline small',`data-id="${esc(t.id)}"`)}</div></div>`).join('')}</div><details class="counter-details"><summary>反向证据与结论修订条件</summary>${textarea('哪些事实会改变当前判断？','counterEvidence',p.counterEvidence,3)}${btn('保存反向证据','save-counter','outline small')}</details>`,btn('＋ 添加跟踪项','track-edit','outline small'));}
  function reportView(){
    const p=project(),text=getReport()||p.reports[0]?.text,shown=p.reports.find(r=>r.text===text),fresh=shown?.schemaVersion===2&&shown.inputHash===R.signature(p);
    add(`<div class="report-freshness ${fresh?'fresh':''}"><span>${fresh?'✓ 当前已保存底稿与报告一致':shown?'↻ 当前底稿或报告格式已更新，请重新生成':'○ 尚未生成报告'}</span><small>${shown?'版本生成于 '+date(shown.createdAt):'生成后保留版本快照，不随参数悄悄改写。'}</small></div>`,true);
    add(trackingView());
    $('.report-side .actions')?.insertAdjacentHTML('beforeend',btn('导出 manifest','export-manifest','outline small')+btn('导出运行日志','export-runlog','outline small'));
  }
  function proofView(){add(panel('研究交付清单','从资料到报告，所有输出集中管理。',`<div class="deliverables">${[['docs','来源与事实表','文字型PDF、本地检索、信息分类'],['policy','政策事件卡','研究范围、六要素、影响路径'],['finance','财务与历史底稿','同比、毛利、量价、情景对比'],['report','研究备忘录','跟踪条件、反向证据、版本检查']].map(([r,t,d])=>`<button data-route="${r}"><b>${t} ↗</b><span>${d}</span></button>`).join('')}</div><div class="actions v2-space">${btn('下载 manifest.json','export-manifest','outline')}${btn('下载 run.jsonl','export-runlog','outline')}</div><p class="hint v2-space">manifest保存本次输入与模块信息；run.jsonl按发生顺序记录研究动作，便于定位参数变更与输出版本。</p>`));}
  function mount(){
    const p=R.normalize(project());document.body.classList.toggle('motion-paused',!!getState().motionPaused);
    ({overview:overviewView,docs:docsView,policy:policyView,carbon:carbonView,behavior:behaviorView,finance:financeView,report:reportView,proof:proofView}[route()]||(()=>{}))();
    if(!$('#motionControl'))$('.top-actions').insertAdjacentHTML('afterbegin',`<button id="motionControl" class="motion-control" data-action="motion-toggle" aria-label="暂停或开启动画">动态</button>`);
    $('#motionControl').textContent=getState().motionPaused?'动态已暂停':'动态开启';$('#motionControl').setAttribute('aria-pressed',String(!getState().motionPaused));
  }
  return {render:mount,invalidateCarbon};
}
