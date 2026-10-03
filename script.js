'use strict';

const { parseLink, buildLink } = window.VrcLinks;
const byId = id => document.getElementById(id);

const input = byId('link');
const results = byId('results');
const error = byId('error');
const clearButton = byId('clear');
const openButton = byId('open');
const buildForm = byId('build-form');
const buildError = byId('build-error');
const feedback = byId('feedback');
const copyButtons = [...document.querySelectorAll('[data-copy]')];
const copyLabels = new Map(copyButtons.map(button => [button, button.textContent]));
const copyTimers = new Map();
let currentLink = null;

function resetCopyButtons() {
  for (const [button, timer] of copyTimers) {
    clearTimeout(timer);
    button.textContent = copyLabels.get(button);
  }
  copyTimers.clear();
}

function showLink(link) {
  const details = link.details;
  byId('world').textContent = link.world;
  byId('instance').textContent = link.instance || 'no instance in this link';
  byId('access').textContent = details.access;
  byId('region').textContent = details.region;
  byId('number').textContent = details.number || '—';
  byId('flags').textContent = details.flags.join(' · ');
  byId('flags').hidden = details.flags.length === 0;

  const owner = byId('owner');
  const ownerUrl = details.groupUrl || details.ownerUrl;
  byId('owner-row').hidden = !ownerUrl;
  byId('owner-label').textContent = details.group ? 'group' : 'owner';
  owner.textContent = details.group || details.owner || '';
  owner.removeAttribute('href');
  if (ownerUrl) owner.href = ownerUrl;

  byId('web').href = link.launch;
  byId('world-page').href = link.worldUrl;
  byId('invite-note').hidden = !link.shortName;
  byId('build-world').value = link.world;
  byId('build-instance').value = link.instance;

  for (const format of ['desktop', 'steam', 'full']) {
    byId(format + '-value').value = link[format];
  }
  document.querySelector('[data-copy="instance"]').disabled = !link.instance;

  // A shortName carries invite context that the desktop URL doesn't keep.
  const useWebsite = Boolean(link.shortName || !link.instance);
  openButton.href = useWebsite ? link.launch : link.desktop;
  openButton.target = useWebsite ? '_blank' : '_self';
  openButton.rel = 'noopener noreferrer';
  results.hidden = false;
}

function update() {
  currentLink = null;
  results.hidden = true;
  error.hidden = true;
  error.textContent = '';
  input.removeAttribute('aria-invalid');
  clearButton.hidden = !input.value;
  openButton.removeAttribute('href');
  resetCopyButtons();

  if (!input.value.trim()) return;

  try {
    currentLink = parseLink(input.value);
    showLink(currentLink);
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Some browsers block the Clipboard API when index.html is opened directly.
  }

  const field = document.createElement('textarea');
  const previousFocus = document.activeElement;
  field.value = text;
  field.setAttribute('aria-label', 'Copy text');
  field.style.cssText = 'position: fixed; top: 0; left: -9999px;';
  document.body.append(field);
  field.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    field.remove();
    previousFocus?.focus();
  }
  if (!copied) throw new Error('Couldn’t copy. Select the text and copy it manually.');
}

async function copyFormat(button) {
  const text = currentLink?.[button.dataset.copy];
  if (!text) return;

  try {
    await copyText(text);
    button.textContent = 'copied';
    feedback.textContent = 'Copied to clipboard.';
    clearTimeout(copyTimers.get(button));
    copyTimers.set(button, setTimeout(() => {
      button.textContent = copyLabels.get(button);
      copyTimers.delete(button);
    }, 1400));
  } catch (err) {
    feedback.textContent = err.message;
    error.textContent = err.message;
    error.hidden = false;
  }
}

function downloadJson() {
  if (!currentLink) return;

  const json = JSON.stringify(currentLink, null, 2) + '\n';
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'vrchat-link.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

input.addEventListener('input', update);

clearButton.addEventListener('click', () => {
  input.value = '';
  buildForm.reset();
  buildError.hidden = true;
  update();
  input.focus();
});

buildForm.addEventListener('submit', event => {
  event.preventDefault();
  buildError.hidden = true;

  try {
    const link = buildLink(byId('build-world').value, byId('build-instance').value);
    input.value = link.launch;
    update();
    byId('builder').open = false;
    input.focus();
  } catch (err) {
    buildError.textContent = err.message;
    buildError.hidden = false;
  }
});

for (const button of copyButtons) {
  button.addEventListener('click', () => copyFormat(button));
}
byId('export').addEventListener('click', downloadJson);
update();

// Optional browser integration. The page works without it.
if (document.modelContext?.registerTool) {
  const lifetime = new AbortController();
  const tool = {
    name: 'parse_vrchat_link',
    description: 'Parse a VRChat link and show its IDs and launch links.',
    inputSchema: {
      type: 'object',
      properties: { link: { type: 'string' } },
      required: ['link'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(value) {
      const parsed = parseLink(value?.link);
      input.value = value.link;
      update();
      return parsed;
    },
  };

  try {
    Promise.resolve(document.modelContext.registerTool(tool, {
      signal: lifetime.signal,
    })).catch(() => {});
    window.addEventListener('pagehide', () => lifetime.abort(), { once: true });
  } catch {
    // Older implementations can throw before returning a promise.
  }
}
