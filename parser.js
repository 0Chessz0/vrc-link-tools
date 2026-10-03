/* Shared by the page and the Node tests. */
(function () {
  'use strict';

  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const worldId = new RegExp('^wrld_' + uuid + '$', 'i');
  const userId = new RegExp('^usr_' + uuid + '$', 'i');
  const groupId = new RegExp('^grp_' + uuid + '$', 'i');
  const regions = { us: 'US West', use: 'US East', eu: 'Europe', jp: 'Japan' };
  const groupAccess = { public: 'Group public', plus: 'Group+', members: 'Group members' };
  const knownTag = /^(?:private|friends|hidden|group|groupAccessType|region|nonce|ageGate)\([^()]+\)$|^(?:canRequestInvite|ageGate)$/;

  function splitId(id) {
    const colon = id.indexOf(':');
    if (colon === -1) return { world: id, instance: '' };
    return { world: id.slice(0, colon), instance: id.slice(colon + 1) };
  }

  function decodeId(id) {
    try {
      return decodeURIComponent(id);
    } catch {
      throw new Error('The link has broken URL encoding.');
    }
  }

  function describeInstance(instance) {
    const [number, ...tags] = instance ? instance.split('~') : [null];

    function tagValue(name) {
      const prefix = name + '(';
      const tag = tags.find(tag => tag.startsWith(prefix) && tag.endsWith(')'));
      return tag ? tag.slice(prefix.length, -1) : null;
    }

    const group = tagValue('group');
    const owner = tagValue('private') || tagValue('friends') || tagValue('hidden');
    const regionCode = tagValue('region');
    const unknownTags = tags.some(tag => !knownTag.test(tag));
    let access = instance ? 'Public' : 'Not specified';

    if (group) {
      access = groupAccess[tagValue('groupAccessType')] || 'Group (unspecified)';
    } else if (tagValue('private')) {
      access = tags.includes('canRequestInvite') ? 'Invite+' : 'Invite only';
    } else if (tagValue('friends')) {
      access = 'Friends only';
    } else if (tagValue('hidden')) {
      access = 'Friends+';
    } else if (unknownTags) {
      access = 'Unknown';
    }

    const flags = [];
    if (tags.includes('canRequestInvite')) flags.push('Invite requests enabled');
    if (tags.includes('ageGate') || tagValue('ageGate') === 'true') flags.push('18+ age gate');
    if (unknownTags) flags.push('Unrecognized tags preserved');

    const details = {
      number,
      access,
      region: regions[regionCode] || regionCode || 'Not specified',
      owner,
      ownerUrl: userId.test(owner || '') ? 'https://vrchat.com/home/user/' + owner : null,
      group,
      groupUrl: groupId.test(group || '') ? 'https://vrchat.com/home/group/' + group : null,
      flags,
      tags,
    };
    if (instance) details.regionCode = regionCode;
    return details;
  }

  function readUrl(text) {
    let url;
    try {
      url = new URL(text);
    } catch {
      throw new Error('Paste a VRChat link or a world:instance ID.');
    }

    if (url.protocol === 'vrchat:' && url.hostname === 'launch' && /^\/?$/.test(url.pathname)) {
      return splitId(url.searchParams.get('id') || '');
    }

    const vrchatHost = /^(www\.)?vrchat\.com$/i.test(url.hostname);
    if (!/^https?:$/.test(url.protocol) || !vrchatHost || url.username || url.password || url.port) {
      throw new Error('Use a vrchat.com or vrchat://launch link.');
    }

    if (/^\/i\//.test(url.pathname) || /^\/home\/invite\//.test(url.pathname)) {
      throw new Error('Open this short invite on VRChat, then paste the full launch link here.');
    }

    if (/^\/home\/launch\/?$/.test(url.pathname)) {
      for (const key of ['worldId', 'instanceId', 'shortName']) {
        if (url.searchParams.getAll(key).length > 1) {
          throw new Error('The link has duplicate ID parameters.');
        }
      }
      return {
        world: url.searchParams.get('worldId') || '',
        instance: url.searchParams.get('instanceId') || '',
        shortName: url.searchParams.get('shortName') || '',
      };
    }

    const path = url.pathname.match(/^\/home\/(?:world|instance)\/([^/]+)\/?$/);
    if (!path) throw new Error('Paste a world or instance link, rather than a profile.');
    return splitId(decodeId(path[1]));
  }

  function parseLink(input) {
    if (typeof input !== 'string' || !input.trim()) {
      throw new Error('Paste a VRChat link first.');
    }

    let text = input.trim().replace(/&amp;/g, '&');
    if (text.length > 8192) throw new Error('The link is too long.');
    if (/^(www\.)?vrchat\.com\//i.test(text)) text = 'https://' + text;

    const ids = /^wrld_/i.test(text) ? splitId(decodeId(text)) : readUrl(text);
    const { world, instance } = ids;
    const shortName = ids.shortName || '';

    if (!worldId.test(world)) throw new Error('No valid world ID in this link.');
    if (instance && !/^[a-z0-9_-]+(?:~[a-z0-9_.+()\-]+)*$/i.test(instance)) {
      throw new Error('The instance ID has invalid characters.');
    }
    if (shortName && !/^[a-z0-9_-]+$/i.test(shortName)) {
      throw new Error('The invite code has invalid characters.');
    }

    // Keep every instance tag. Dropping a nonce can break an invite.
    const params = new URLSearchParams({ worldId: world });
    if (instance) params.set('instanceId', instance);
    if (shortName) params.set('shortName', shortName);

    const full = world + (instance ? ':' + instance : '');
    const launch = 'https://vrchat.com/home/launch?' + params.toString();
    const desktop = 'vrchat://launch?id=' + encodeURIComponent(full);

    return {
      world,
      instance,
      shortName,
      launch,
      desktop,
      full,
      worldUrl: 'https://vrchat.com/home/world/' + world,
      discord: '[Join me in VRChat](<' + launch + '>)',
      steam: desktop,
      details: describeInstance(instance),
    };
  }

  function buildLink(worldInput, instanceInput = '') {
    if (typeof instanceInput !== 'string') throw new Error('Use an existing instance ID.');
    const { world } = parseLink(worldInput);
    const instance = instanceInput.trim();
    return parseLink(world + (instance ? ':' + instance : ''));
  }

  const api = { parseLink, describeInstance, buildLink };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.VrcLinks = api;
})();
