'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function sample(){const ctx={window:{},LXEngine:require('../dist/finance-engine.js')};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/data.js'),'utf8'),ctx);const p=JSON.parse(JSON.stringify(ctx.window.StudioData.seed()));require('../dist/research.js').normalize(p);return p;}
module.exports={sample};
