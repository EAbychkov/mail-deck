# Mail Deck

Chrome extension in `extension/` (no build step). `tools/package.sh` zips it into `dist/`.

## Publishing

Use the `publish` skill (`.claude/skills/publish/SKILL.md`), or directly:

    python3 tools/publish.py status    # live / in review / last upload
    python3 tools/publish.py submit    # package, upload, send to review
    python3 tools/publish.py cancel    # take back the version in review
    python3 tools/publish.py reviews   # latest reviews; stats [DAYS]: rating, installs, users
    python3 tools/publish.py rollback VERSION NEW REASON   # ship an earlier version again

The store listing (text per language, screenshots) and the Privacy tab have no API: they are
changed in the Developer Dashboard. Claude in Chrome cannot script Chrome Web Store pages, so the
dashboard is driven through the `playwright` MCP server (local scope, `@playwright/mcp@0.0.83
--cdp-endpoint http://127.0.0.1:9333`) attached to a separate Chrome profile started by
`tools/dashboard-browser.sh` and signed in to the publisher's Google account. Close that browser
when done: while it runs, any local program can drive it.

Credentials are in `~/.config/mail-deck/` (not in the repo). Commit and bump `version` in
`extension/manifest.json` before submitting, with the version's notes under `## <version>` in
`CHANGELOG.md`. A pushed version is released on GitHub by `.github/workflows/release.yml` (tag, zip,
notes); never create releases by hand.
