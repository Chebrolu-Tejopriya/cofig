// Run with: node test-ui.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, 'ui.html'), 'utf8');
const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'DOM IDs must be unique');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = {};
const messages = [];
function element(id) {
  return elements[id] ||= { value: '', textContent: '', className: '', disabled: false,
    addEventListener(event, handler) { this[event] = handler; } };
}
const context = vm.createContext({
  document: { getElementById: element, querySelectorAll: () => [] },
  parent: { postMessage: message => messages.push(message.pluginMessage) },
  state: { cfg: { targetId: 'component', status: 'Published' } }
});
vm.runInContext(script.slice(script.indexOf('  function post(msg)'), script.indexOf('  /* ---------- rendering')), context);
vm.runInContext(script.slice(script.indexOf("  $('generate').addEventListener"), script.indexOf('  function themeText')), context);
element('status').value = 'Published';
element('generate').click();
assert.equal(messages[0].type, 'generate');
assert.equal(messages[0].config.targetId, 'component');
assert.equal(element('generate').disabled, true);
assert.match(element('generationStatus').textContent, /Generating/);
context.setStatus('Font unavailable', 'error');
assert.equal(element('generationStatus').textContent, 'Font unavailable');
assert.equal(element('generationStatus').className, 'status error');
assert.equal(element('status').value, 'Published', 'progress must preserve component status');
console.log('Generate dispatch, visible errors, and unique UI IDs passed.');
