'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const zipPath = path.join(__dirname, '../plugin/open-pythh-venture-intelligence-v0.2.1.zip');

function listZip(filePath) {
  const data = fs.readFileSync(filePath);
  // Local file headers: PK\x03\x04. Names are enough for the upload contract.
  const names = [];
  let offset = 0;
  while (offset + 30 < data.length) {
    if (data.readUInt32LE(offset) !== 0x04034b50) break;
    const nameLen = data.readUInt16LE(offset + 26);
    const extraLen = data.readUInt16LE(offset + 28);
    const compSize = data.readUInt32LE(offset + 18);
    const name = data.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
    names.push(name);
    offset += 30 + nameLen + extraLen + compSize;
  }
  return names;
}

test('ChatGPT skills zip omits MCP config and screenshots', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '../plugin/mcp.json')), false);
  assert.equal(fs.existsSync(path.join(__dirname, '../plugin/.mcp.json')), false);

  const names = listZip(zipPath);
  assert.ok(names.includes('plugin.json'));
  assert.ok(names.includes('.codex-plugin/plugin.json'));
  assert.ok(names.some((name) => name.startsWith('skills/') && name.endsWith('/SKILL.md')));
  assert.ok(names.includes('assets/logo.png'));
  assert.ok(names.includes('assets/icon.png'));
  assert.equal(names.some((name) => /mcp/i.test(name)), false);
  assert.equal(names.some((name) => /screenshot/i.test(name)), false);

  const root = JSON.parse(fs.readFileSync(path.join(__dirname, '../plugin/plugin.json'), 'utf8'));
  const iface = root.extensions['com.openai'].interface;
  assert.equal(root.author.name, iface.developerName);
  assert.equal(iface.screenshots, undefined);
  assert.equal(root.mcpServers, undefined);

  const codex = JSON.parse(fs.readFileSync(path.join(__dirname, '../plugin/.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(codex.mcpServers, undefined);
  assert.equal(codex.interface.screenshots, undefined);
  assert.equal(codex.author.name, codex.interface.developerName);
});

test('SPA fallback leaves the OpenAI domain challenge to its own route', () => {
  const src = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');
  assert.match(src, /\(\?!\\\/\\\.well-known\\\/\)/);
  assert.match(src, /app\.get\('\/\.well-known\/openai-apps-challenge'/);
});

test('MCP host exposes the OpenAI domain challenge', () => {
  const src = fs.readFileSync(path.join(__dirname, '../mcp-server/src/index.ts'), 'utf8');
  assert.match(src, /app\.get\("\/\.well-known\/openai-apps-challenge"/);
  assert.match(src, /OPENAI_APPS_CHALLENGE_TOKEN/);
});
