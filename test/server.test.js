import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('../src/index.js', import.meta.url));
test('MCP server lists and invokes design tools over stdio', async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(t => t.name).sort(), ['design_brief', 'design_review_checklist']);
    const brief = await client.callTool({ name: 'design_brief', arguments: { product: 'Planner', audience: 'Students', goal: 'Plan a week', platform: 'mobile' } });
    assert.match(brief.content[0].text, /Students/);
    assert.match(brief.content[0].text, /safe areas/);
    const checklist = await client.callTool({ name: 'design_review_checklist', arguments: { platform: 'web', focus: 'accessibility' } });
    assert.match(checklist.content[0].text, /keyboard/);
    assert.doesNotMatch(checklist.content[0].text, /## Simplicity/);
    const usability = await client.callTool({ name: 'design_review_checklist', arguments: { platform: 'web', focus: 'usability' } });
    assert.match(usability.content[0].text, /undo, cancel, or recover/);
    const invalid = await client.callTool({ name: 'design_brief', arguments: { product: 'x', audience: 'y', goal: 'z', platform: 'invalid' } });
    assert.equal(invalid.isError, true);
  } finally { await client.close(); }
});

test('safety checklist addresses honest choices and sensitive data', async () => {
  const { reviewChecklist } = await import('../src/design.js');
  const output = reviewChecklist({ platform: 'mobile', focus: 'safety' });
  assert.match(output, /deceptive consent/);
  assert.match(output, /sensitive data/i);
  assert.doesNotMatch(output, /## Responsiveness/);
});

test('skill references its curated research file and includes all usability heuristics', async () => {
  const { readFile } = await import('node:fs/promises');
  const skill = await readFile(new URL('../skills/interface-design/SKILL.md', import.meta.url), 'utf8');
  const research = await readFile(new URL('../skills/interface-design/references/research.md', import.meta.url), 'utf8');
  assert.match(skill, /\]\(references\/research\.md\)/);
  assert.match(skill, /10\. \*\*Help and documentation/);
  assert.match(skill, /untrusted reference material/);
  assert.match(research, /W3C Web Accessibility Initiative/);
});
