// Run with: node test-generation.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'code.js'), 'utf8');
function page(name) {
  return { name, children: [], removed: false,
    async loadAsync() {}, getSharedPluginData() { return this.targetId; },
    setSharedPluginData(_, __, value) { this.targetId = value; },
    appendChild(n) {
      if (n.parent) n.parent.children = n.parent.children.filter(c => c !== n);
      this.children.push(n); n.parent = this;
    }, remove() { this.removed = true; } };
}
const original = page('Source');
const docs = page('Existing docs'); docs.targetId = 'target';
function frame(name, width) {
  return { id: name, name, width, setSharedPluginData() {},
    remove() { this.removed = true; this.parent.children = this.parent.children.filter(c => c !== this); } };
}
const old = frame('Old docs', 900); docs.appendChild(old);
const note = frame('User note', 200); docs.appendChild(note);
const stagingPages = [];
const context = vm.createContext({
  figma: {
    currentPage: original, root: { children: [original, docs] },
    getNodeByIdAsync: async () => ({ id: 'target', findAll: () => [] }),
    loadFontAsync: async () => {},
    createPage() { const p = page('Staging'); stagingPages.push(p); return p; },
    async setCurrentPageAsync(p) { this.currentPage = p; },
    viewport: { scrollAndZoomIntoView() {} }
  }, analyze: async () => ({ name: 'Inputs' }),
  MARKER_NS: 'cofig', MARKER_KEY: 'target', OWNED_KEY: 'generated', GUTTER: 120,
  isOurs: n => n !== note,
  buildThumb: () => frame('Thumb', 380),
  buildIntroduction: () => frame('Intro', 1049),
  buildVariations: () => { throw new Error('specimen failure'); }
});
vm.runInContext(source.slice(source.indexOf('async function generate(cfg)'), source.indexOf('function defaultContent(data)')), context);
const cfg = { targetId: 'target', sections: { introduction: true, variations: true } };
(async () => {
  await assert.rejects(context.generate(cfg), /specimen failure/);
  assert.equal(old.removed, undefined, 'failure must preserve existing docs');
  assert.equal(stagingPages[0].removed, true, 'failure removes partial frames with their page');
  assert.equal(context.figma.currentPage, original, 'failure restores original page');
  context.buildVariations = () => frame('Variations', 1096);
  await context.generate(cfg);
  assert.equal(old.removed, true, 'success replaces old generated sections');
  assert.equal(note.removed, undefined, 'success preserves user content');
  assert.equal(stagingPages[1].removed, true);
  const output = docs.children.filter(n => n !== note);
  assert.deepEqual(output.map(n => n.x), [0, 500, 1669]);
  console.log('Generation rollback, section spacing, and preservation of user content passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
