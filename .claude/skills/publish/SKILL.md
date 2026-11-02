---
name: publish
description: Publish a new Mail Deck version to the Chrome Web Store (upload and submit for review). Use when the user says "publish", "release", "опубликуй", "выкати версию", or asks about the store status.
---

# Publish Mail Deck to the Chrome Web Store

Everything is in `tools/publish.py` (V2 API, service account). Credentials live outside the repo, per machine:
`~/.config/mail-deck/cws-key.json` (chmod 600) and `~/.config/mail-deck/cws.env` (`CWS_PUBLISHER_ID=...`).
If they are missing, the setup is in the docstring of `tools/publish.py`; the service account is
`cws-publisher@mail-deck-publish.iam.gserviceaccount.com`, added in the Developer Dashboard under Settings.

## Steps

1. `git status`: the working tree must be committed; the store gets what `extension/` holds, so a dirty tree
   means shipping something nobody can reproduce. If it is dirty, say so and ask what to commit.
2. `python3 tools/publish.py status`: shows the manifest version, the live version and any revision in review.
   If a revision is already in review, stop: the store takes one at a time.
3. The version in `extension/manifest.json` must be higher than the live one (the script refuses otherwise).
   Bump it in the same commit as the change, as earlier commits did ("...; version 1.1.1"), and add its
   `## <version>` section to `CHANGELOG.md` in that commit (`submit` refuses without one).
   Pushing that commit to `main` makes the GitHub Release by itself (`.github/workflows/release.yml`: the tag,
   the same zip and the notes of the section), after the tests pass there; no `gh release` by hand.
4. `tools/test/run.sh`: every test must pass. If one fails, do not submit; report the failing lines.
5. Ask the user before submitting, unless they have said in this session (or in memory) that submissions need no
   confirmation. Then: `python3 tools/publish.py submit` (add `--staged` to hold it back after approval until
   it is published from the dashboard). `upload` alone only creates a draft.
6. Report the printed state and warnings. Review takes from hours to a few days; check later with `status`.

If the listing text or screenshots changed, `store/listing.md` and the images in `store/` are updated by hand in
the dashboard; the API only ships the package.
