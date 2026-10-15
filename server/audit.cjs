'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function canonical(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
function createAudit(directory, onEvent = () => {}) {
  fs.mkdirSync(directory, {recursive: true});
  const file = path.join(directory, 'run.jsonl');
  if (fs.existsSync(file)) throw Error('运行目录已存在，拒绝覆盖');
  const events = [];
  function append(type, data) {
    const event = {seq: events.length + 1, time: new Date().toISOString(), type, data, previousHash: events.at(-1)?.hash || '0'.repeat(64)};
    event.hash = digest(event);
    // Append and flush each event; never truncate a previous event.
    const fd = fs.openSync(file, 'a');
    try { fs.writeSync(fd, JSON.stringify(event) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    events.push(event); onEvent(event); return event;
  }
  return {append, events, file};
}
function verifyEvents(events) {
  let previousHash = '0'.repeat(64);
  for (let i = 0; i < events.length; i++) {
    const {hash, ...body} = events[i];
    if (body.seq !== i + 1 || body.previousHash !== previousHash || hash !== digest(body)) throw Error('日志链校验失败：第 ' + (i + 1) + ' 条');
    previousHash = hash;
  }
  return previousHash;
}
module.exports = {canonical, digest, createAudit, verifyEvents};
