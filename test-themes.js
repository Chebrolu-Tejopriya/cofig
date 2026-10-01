// Run with: node test-themes.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'code.js'), 'utf8');
const alias = id => ({ type: 'VARIABLE_ALIAS', id });
const collections = {
  density: { id: 'density', name: 'Density', defaultModeId: 'compact', modes: [
    { modeId: 'compact', name: 'Compact' }, { modeId: 'comfort', name: 'Comfort' }
  ] },
  semantic: { id: 'semantic', name: 'Semantic', modes: [{ modeId: 'only', name: 'Only' }] }
};
const variables = {
  raised: { variableCollectionId: 'semantic', valuesByMode: { only: { r: 1, g: 1, b: 1 } } },
  height: { variableCollectionId: 'semantic', valuesByMode: { only: alias('spacing') } },
  spacing: { variableCollectionId: 'density', valuesByMode: { compact: 36, comfort: alias('height') } }
};
const target = { type: 'COMPONENT', resolvedVariableModes: { density: 'comfort' }, findAll: () => [
  { type: 'FRAME', boundVariables: { height: alias('height') } }
] };
const blocks = [];
const previewNode = (name, children = []) => ({ name, children, fills: [{ type: 'SOLID' }],
  findAll: () => [], setExplicitVariableModeForCollection() {} });
const context = vm.createContext({
  PREVIEW_SURFACES: {},
  figma: { variables: {
    getVariableByIdAsync: async id => variables[id] || null,
    getVariableCollectionByIdAsync: async id => collections[id] || null,
    getLocalVariablesAsync: async () => [{ id: 'raised', name: 'Surface/surface-raised', variableCollectionId: 'semantic' }],
    setBoundVariableForPaint: (paint, field, variable) => ({ ...paint, boundVariables: { [field]: alias(variable.id) } })
  } }, WIDTH: { variations: 800 },
  section: () => ({ body: [], section: {} }), add: (_, b) => blocks.push(b), block: b => b,
  variantRow: cells => cells, variantCell: (inst, caption) => ({ inst, caption,
    children: [previewNode('main-content', [previewNode('example-frame')])] }),
  specimenStage: instances => instances,
  makeInstance: () => ({ applied: [], setExplicitVariableModeForCollection(id, mode) {
    this.applied.push([id, mode]);
  }, findAll: () => [], remove() {} })
});
vm.runInContext(source.slice(source.indexOf('function defaultVariantOf'), source.indexOf('async function readTokens')) +
  source.slice(source.indexOf('function applyVariableMode'), source.indexOf('function anatomyStage')) +
  source.slice(source.indexOf('async function readThemes'), source.indexOf('async function analyze')) +
  source.slice(source.indexOf('var AXIS_STYLE'), source.indexOf('function buildUsage')), context);
(async () => {
  const data = await context.readThemes(target);
  assert.equal(data.themes.length, 1, 'follow aliases without including single-mode collections');
  assert.equal(data.themes[0].name, 'Density');
  assert.equal(data.themes[0].default, 'Comfort', 'use inherited resolved mode');
  assert.equal(data.warnings.length, 0, 'alias cycles terminate safely');
  assert.equal(data.surfaceVariableId, 'raised', 'use the semantic surface token for preview backgrounds');
  const preview = { fills: [{ type: 'SOLID' }], applied: [], findAll: () => [],
    setExplicitVariableModeForCollection(id, mode) { this.applied.push([id, mode]); } };
  context.bindPreviewSurface(preview, [{ id: 'colors', modes: [{ name: 'Dark', modeId: 'dark' }] }], 'raised', true);
  assert.equal(preview.fills[0].boundVariables.color.id, 'raised', 'keep the background bound to a variable');
  assert.equal(preview.applied[0][1], 'dark', 'resolve the bound background in Dark mode');
  context.buildVariations(target, { props: [] }, data);
  assert.equal(blocks.length, 1, 'render themes even without variant properties');
  assert.deepEqual(Array.from(blocks[0].content, c => c.caption), ['Density = Compact', 'Density = Comfort']);
  assert.equal(blocks[0].content[1].inst.applied[0][1], 'comfort');
  const anatomyInstance = context.makeInstance();
  context.applyAnatomyTheme(anatomyInstance, [data.themes[0], {
    id: 'colors', modes: [{ name: 'Light', modeId: 'light' }, { name: 'Dark', modeId: 'dark' }]
  }], true);
  assert.equal(anatomyInstance.applied[0][1], 'dark', 'dark anatomy must switch actual variable mode');
  assert.equal(anatomyInstance.applied.length, 1, 'anatomy must preserve density');
  blocks.length = 0;
  context.buildVariations(target, { props: [
    { key: 'Type', name: 'Type', figmaType: 'VARIANT', values: 'A\nB\nC\nD\nE\nF\nG' },
    { key: 'State', name: 'State', figmaType: 'VARIANT', values: 'Default\nDisabled' }
  ] }, data);
  assert.equal(blocks.length, 8, 'include all seven input types plus density');
  assert.equal(blocks[0].title, 'States - A', 'original state comparisons come first');
  assert.equal(blocks[7].title, 'Density');
  blocks.length = 0;
  context.makeInstance = () => ({ setExplicitVariableModeForCollection() { throw new Error('unavailable'); }, remove() {} });
  context.buildVariations(target, { props: [] }, data);
  assert.match(blocks[0].content[0].caption, /Preview unavailable/, 'a mode failure must not abort variations');
  const missing = await context.readThemes({ ...target, findAll: () => [{ boundVariables: { height: alias('missing') } }] });
  assert.equal(missing.warnings.length, 1, 'report inaccessible variables');
  new vm.Script(fs.readFileSync(require('node:path').join(__dirname, 'ui.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]);
  console.log('Theme detection, alias cycles, mode specimens, missing variables, and UI syntax passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
