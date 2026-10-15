'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {replay}=require('../server/agent.cjs');
let target=process.argv[2];
if(!target){console.error('用法：node scripts/replay.cjs 运行目录或agent-bundle.json');process.exit(1);}
target=path.resolve(target);
try {
  if(fs.statSync(target).isFile()) {
    const bundle=JSON.parse(fs.readFileSync(target,'utf8'));
    if(bundle.format!=='lvxing-agent-bundle')throw Error('不是智能体运行包');
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lvxing-replay-'));
    for(const [name,content] of Object.entries(bundle.files)) {
      if(!['input.json','manifest.json','run.jsonl','report.json','report.md'].includes(name)||typeof content!=='string')throw Error('不允许的运行文件');
      fs.writeFileSync(path.join(dir,name),content);
    }
    target=dir;
  }
  console.log(JSON.stringify(replay(target),null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
