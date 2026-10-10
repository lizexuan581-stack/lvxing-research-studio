const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'dist/app.js'),'utf8');
assert.ok(!/copyright-1|patent_notice_|annex-092|travel-home/.test(app),'private assets referenced');
for(const file of ['LICENSE','THIRD_PARTY_NOTICES.md','dist/vendor/LICENSE','dist/vendor/pdf.mjs','dist/vendor/pdf.worker.mjs']) assert.ok(fs.existsSync(path.join(root,file)),file);
assert.ok(!fs.existsSync(path.join(root,'.openai')),'private deployment metadata');
for(const file of ['app.js','core.js','data.js','finance-engine.js']) {
  const r=spawnSync(process.execPath,['--check',path.join(root,'dist',file)],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
}
const ctx={window:{},LXEngine:require('../dist/finance-engine.js')};
vm.runInNewContext(fs.readFileSync(path.join(root,'dist/data.js'),'utf8'),ctx);
const seed=ctx.window.StudioData.seed();
assert.equal(seed.docs.length,5);
assert.equal(seed.facts.length,12);
assert.ok(seed.facts.find(f=>f.id==='cz_revenue_2025').location.includes('57'));
assert.ok(seed.facts.find(f=>f.id==='shared_orders_2025').location.includes('58'));
assert.equal(seed.docs.find(d=>d.id==='inquiry').pages[0].page,57);
console.log('Public release checks passed: syntax, dependencies, private-asset exclusion and seed sources.');
