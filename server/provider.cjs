'use strict';
const DEFAULT_MODEL = 'deepseek-flash';
const ENDPOINT = 'https://api.deepseek.com';
function createDeepSeek({apiKey, model = DEFAULT_MODEL, timeoutMs = 90000, fetchImpl = fetch}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw Error('未配置 DeepSeek API 密钥');
  if (!/^[a-zA-Z0-9_.:-]{1,100}$/.test(model)) throw Error('模型名称无效');
  async function chat(request, signal) {
    const body = {model, temperature: 0, max_tokens: 2200, stream: false, thinking: {type: 'disabled'}, ...request};
    const response = await fetchImpl(ENDPOINT + '/chat/completions', {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey},
      body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])])
    });
    if (!response.ok) {
      // Never log upstream error bodies: they may contain credentials or submitted text.
      await response.body?.cancel();
      const names = {401:'密钥认证失败，请轮换或重新配置',402:'模型账户余额不足',429:'模型调用限流，请稍后重试'};
      throw Error('DeepSeek HTTP ' + response.status + '：' + (names[response.status] || '服务请求失败'));
    }
    const payload = await response.json();
    const message = payload.choices?.[0]?.message;
    if (!message || typeof message !== 'object') throw Error('模型响应缺少消息');
    if (payload.choices[0].finish_reason === 'length') throw Error('模型输出达到长度上限，未作为完成报告发布');
    // Deliberately omit reasoning_content. Only the visible answer/tool requests are audit outputs.
    return {id:payload.id, model:payload.model, created:payload.created, usage:payload.usage,
      finishReason:payload.choices[0].finish_reason,
      message:{role:'assistant', content:message.content || null, ...(message.tool_calls ? {tool_calls:message.tool_calls} : {})}};
  }
  return {name:'DeepSeek', model, endpoint:ENDPOINT, chat};
}
module.exports = {DEFAULT_MODEL, ENDPOINT, createDeepSeek};
