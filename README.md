# vrc-link-tools

A little VRChat link tool. Paste a link, check the instance details, then copy whatever format you need.

Plain HTML, CSS and JS. No install step. Open `index.html` and it works.

## What it does

- Shows access type, region, instance number and owner/group links
- Copies launch links and Discord invites
- Gives you the desktop URL and Steam launch argument
- Builds a link when you have the world and instance IDs separately
- Exports the result as JSON

Everything runs locally. Links aren't saved or sent anywhere by the tool.

## Links it accepts

World pages, full launch links, `vrchat://launch` URLs, and raw `wrld_…` or `world:instance` IDs. The `…` needs to be the full ID, of course.

Short invites like `/i/…` need to be opened on VRChat first. Paste the full launch link you get from there.

The details come from the URL, so there are no live player counts or world names. The builder doesn't create a room; use the world page for that. [VRChat explains instance creation here.](https://ask.vrchat.com/t/developer-update-2-may-2024/24284)

If the link has a `shortName` invite code, use the web link to share it. The desktop format only carries the full instance ID. Joining still depends on VRChat permissions.

## Files

`parser.js` handles links and instance tags. `script.js` connects it to the page. The styles are in `style.css`.

## Hosting

Any static host works. For GitHub Pages: **Settings → Pages → Deploy from a branch → main → / (root)**.

If copying doesn't work when opening the file directly, try a local web server. Desktop links need VRChat installed.

## Tests

With Node installed: `node --test tests/parser.test.cjs`

MIT licensed. Not affiliated with VRChat.
