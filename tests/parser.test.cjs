const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseLink, describeInstance, buildLink } = require('../parser.js');
const world = 'wrld_12345678-abcd-1234-abcd-123456789abc';
const instance = '12345~hidden(usr_12345678-abcd-1234-abcd-123456789abc)~region(eu)~nonce(abc-123)~canRequestInvite';

test('launch links keep their instance tags', () => {
  const result = parseLink(`https://vrchat.com/home/launch?worldId=${world}&instanceId=${encodeURIComponent(instance)}`);
  assert.equal(result.world, world);
  assert.equal(result.instance, instance);
  assert.deepEqual(parseLink(result.launch), result);
  assert.equal(parseLink(result.desktop).instance, instance);
});
test('friends and invite types', () => {
  const owner = 'usr_12345678-abcd-1234-abcd-123456789abc';
  const cases = [
    [`hidden(${owner})`, 'Friends+'],
    [`friends(${owner})`, 'Friends only'],
    [`private(${owner})`, 'Invite only'],
    [`private(${owner})~canRequestInvite`, 'Invite+'],
  ];
  for (const [tags, expected] of cases) {
    const info = describeInstance('123~' + tags + '~region(eu)');
    assert.equal(info.access, expected);
    assert.equal(info.region, 'Europe');
    assert.equal(info.ownerUrl, 'https://vrchat.com/home/user/' + owner);
  }
});
test('group access, region and age gate', () => {
  const group = 'grp_12345678-abcd-1234-abcd-123456789abc';
  for (const [mode, label] of [['public', 'Group public'], ['plus', 'Group+'], ['members', 'Group members']]) {
    const info = describeInstance(`123~group(${group})~groupAccessType(${mode})~region(use)~ageGate`);
    assert.equal(info.access, label);
    assert.equal(info.region, 'US East');
    assert.equal(info.groupUrl, 'https://vrchat.com/home/group/' + group);
    assert.ok(info.flags.includes('18+ age gate'));
  }
});
test('building a link from separate IDs', () => {
  const result = buildLink(`https://vrchat.com/home/world/${world}`, instance);
  assert.equal(result.instance, instance);
  assert.equal(result.world, world);
  assert.equal(buildLink(world).instance, '');
  assert.throws(() => buildLink(world, '<script>'));
});
test('sharing keeps the invite code and drops tracking', () => {
  const result = parseLink(`https://vrchat.com/home/launch?worldId=${world}&instanceId=123&shortName=abc&utm_source=test`);
  assert.ok(result.discord.includes('shortName=abc'));
  assert.ok(!result.launch.includes('utm_source'));
  assert.equal(result.full, world + ':123');
  assert.equal(result.worldUrl, 'https://vrchat.com/home/world/' + world);
});
test('unknown tags are kept', () => {
  const result = parseLink(world + ':123~futureMode(value)');
  assert.equal(result.details.access, 'Unknown');
  assert.ok(result.details.flags.includes('Unrecognized tags preserved'));
  assert.equal(result.instance, '123~futureMode(value)');
});
test('links without an instance', () => {
  for (const input of [world, `https://vrchat.com/home/world/${world}`, `vrchat.com/home/world/${world}`]) {
    const result = parseLink(input);
    assert.equal(result.instance, '');
    assert.equal(new URL(result.launch).searchParams.has('instanceId'), false);
  }
});
test('raw and URL-encoded IDs', () => {
  const id = `${world}:${instance}`;
  const inputs = [id, encodeURIComponent(id), `https://vrchat.com/home/instance/${encodeURIComponent(id)}`];
  for (const input of inputs) {
    assert.equal(parseLink(input).instance, instance);
  }
});
test('desktop URLs with a trailing slash', () => {
  assert.equal(parseLink(`vrchat://launch/?id=${encodeURIComponent(`${world}:12345~region(eu)`)}`).instance, '12345~region(eu)');
});
test('shortName in web links', () => {
  const parsed = parseLink(`https://vrchat.com/home/launch?worldId=${world}&instanceId=12345&shortName=Ab_cd-12`);
  assert.equal(new URL(parsed.launch).searchParams.get('shortName'), 'Ab_cd-12');
});
test('HTML-escaped ampersands', () => {
  assert.equal(parseLink(`https://vrchat.com/home/launch?worldId=${world}&amp;instanceId=123`).instance, '123');
});
test('bad IDs, profile links and short invites', () => {
  const inputs = ['', null, 'wrld_nope', 'https://vrchat.com/home/user/usr_123', 'https://vrchat.com/i/abc'];
  for (const input of inputs) {
    assert.throws(() => parseLink(input));
  }
});
test('reject lookalike domains and unsafe URLs', () => {
  const inputs = [
    `https://vrchat.com.evil.example/home/world/${world}`,
    `https://evil.example/?worldId=${world}`,
    'javascript:alert(1)',
    `https://person@vrchat.com/home/world/${world}`,
  ];
  for (const input of inputs) {
    assert.throws(() => parseLink(input));
  }
});
test('duplicate IDs, invalid characters and oversized input', () => {
  assert.throws(() => parseLink(`https://vrchat.com/home/launch?worldId=${world}&worldId=${world}`));
  assert.throws(() => parseLink(`${world}:123~region(eu)<script>`));
  assert.throws(() => parseLink('x'.repeat(8193)));
});
