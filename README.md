<div align="center">

<img src="extension/data/icons/red/128.png" width="88" height="88" alt="">

# Mail Deck

**Every inbox you are signed in to, in one panel.**<br>
Gmail, Yahoo Mail, AOL Mail, Proton Mail, Yandex Mail and Mail.ru. Read, archive and delete mail without opening a tab.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/hjlkjemogfgkpbbnogihekjcdmafecff?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white&color=4352e3)](https://chromewebstore.google.com/detail/mail-deck/hjlkjemogfgkpbbnogihekjcdmafecff)
[![Tests](https://github.com/nord-express/mail-deck/actions/workflows/test.yml/badge.svg)](https://github.com/nord-express/mail-deck/actions/workflows/test.yml)
[![License: MPL 1.1](https://img.shields.io/badge/license-MPL%201.1-blue)](LICENSE)

[Website](https://nord-express.github.io/mail-deck/) · [Features](#features) · [Other mail](#other-mail-services) · [Screens](#screens) · [Install](#install) · [Privacy](PRIVACY.md) · [Development](#development)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/hero-dark.png">
  <img src="docs/images/hero-light.png" alt="The Mail Deck panel: Gmail, Yahoo Mail and Yandex Mail mailboxes and an open message" width="860">
</picture>

</div>

## Features

- **All your inboxes at once.** Gmail and, once you turn them on, Yahoo Mail, AOL Mail, Proton Mail, Yandex Mail and Mail.ru. Each mailbox gets its own colour and its unread count, and a Google account its own picture too. The chips at the top narrow the list to one inbox.
- **Fast.** Every mailbox is checked at the same time, a Gmail message is fetched while you point at it, and the panel opens again without asking any mail service anything.
- **Read in place.** Click a message to read it in the panel: a Gmail conversation whole, attachments included, and mail from Yahoo, AOL, Yandex and Mail.ru too. Proton mail opens on Proton's site.
- **Search every Gmail inbox.** One search runs in all your Google accounts at once.
- **Later.** Put a message away until this evening, tomorrow or next week; it comes back with a notification.
- **One key per action.** Mark as read, archive, delete or report spam from the list, from the open message or from a notification.
- **Labels.** Watch chosen Gmail labels instead of the inbox, set per account, or only Gmail's Primary tab.
- **Your order.** Drag the inboxes into the order you want. Accounts you signed out of stay listed, one click from signing back in.
- **Meet in one click.** Each Gmail mailbox has a button that starts a Google Meet from its account.
- **Notifications and sound.** A desktop notification and an optional sound for new mail. Mute an inbox while it stays in the panel, set quiet hours and a quiet weekend, or notify only for, or never for, chosen senders and subjects.
- **Side panel and keyboard.** Keep the deck open beside the page, or open it with Alt+Shift+M. Text size is yours to set.
- **Backup.** Export your settings to a file, or keep a copy in Chrome sync.
- **Light and dark.** The panel and the settings follow your system theme.
- **Nothing in between.** No servers, no analytics. The extension talks only to Google and to the mail services you turn on, with the session your browser already has, and never sees your password.

## Other mail services

Yahoo Mail, AOL Mail, Proton Mail, Yandex Mail and Mail.ru work the way Gmail does: through the session the browser already has on the service's site. No password, no app password, no OAuth, no servers of ours.

1. Sign in on the service's site as usual.
2. In Mail Deck's settings, under **Other mail**, turn the service on. Chrome asks you to allow that service's sites.
3. Its mailboxes join the panel, the badge and the notifications.

Turning a service off removes the permission again. A service that fails for a moment keeps showing its last answer for up to 30 minutes.

| Service | Sites it asks for | Read in the panel | Archive |
|---|---|---|---|
| Yahoo Mail | `mail.yahoo.com` | yes | yes |
| AOL Mail | `mail.aol.com` | yes | yes |
| Proton Mail | `mail.proton.me` | no, opens on Proton's site: the mail is end-to-end encrypted | yes |
| Yandex Mail | `api.passport.yandex.ru`, `mail.yandex.ru`, `mail.360.yandex.ru` | yes | no |
| Mail.ru | `portal.mail.ru`, `e.mail.ru` | yes | no |

Mark as read, delete, report spam, Undo and Remind me later work for all of them. Search, stars, Google Meet, labels and the Primary tab are Gmail's, and only Gmail's mail is fetched ahead while you point at it. Proton Mail, Yandex Mail and Mail.ru show every account signed in on their site; Yahoo Mail and AOL Mail show the one their site has open.

None of these services has a public interface for this, so Mail Deck follows their own web apps, and a change on their side can stop one until Mail Deck is updated. What each one is asked, and why, is in the [privacy policy](PRIVACY.md).

## Screens

<table>
  <tr>
    <td width="50%" align="center">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/images/inbox-dark.png">
        <img src="docs/images/inbox-light.png" alt="Inbox with mail from Gmail, Yahoo Mail and Yandex Mail">
      </picture>
      <br><b>Inbox</b><br><sub>One card per mailbox, actions on hover</sub>
    </td>
    <td width="50%" align="center">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/images/read-dark.png">
        <img src="docs/images/read-light.png" alt="An open message with its actions">
      </picture>
      <br><b>Message</b><br><sub>The full text, with every action one click or key away</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/images/empty-dark.png">
        <img src="docs/images/empty-light.png" alt="All caught up: six mailboxes from several mail services">
      </picture>
      <br><b>All caught up</b><br><sub>Nothing unread, with a link to every inbox</sub>
    </td>
    <td width="50%" align="center">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/images/signin-dark.png">
        <img src="docs/images/signin-light.png" alt="Sign in to Gmail, or open Other mail services">
      </picture>
      <br><b>First run</b><br><sub>Sign in to Google and your mail shows up; other mail services are one click away</sub>
    </td>
  </tr>
  <tr>
    <td colspan="2" align="center">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/images/settings-dark.png">
        <img src="docs/images/settings-light.png" alt="Settings: Other mail, with a switch for each mail service">
      </picture>
      <br><b>Settings</b><br><sub>Other mail: one switch per service, and Chrome asks for that service's sites alone</sub>
    </td>
  </tr>
</table>

### Keys

| In the list | In a message | Does |
|---|---|---|
| <kbd>J</kbd> / <kbd>K</kbd> or arrows | | Move between messages |
| <kbd>Enter</kbd> | | Open the message |
| <kbd>R</kbd> | <kbd>R</kbd> | Mark as read |
| <kbd>E</kbd> | <kbd>E</kbd> | Archive |
| <kbd>Delete</kbd> | <kbd>Delete</kbd> | Delete |
| <kbd>!</kbd> | <kbd>!</kbd> | Report spam |
| <kbd>O</kbd> | <kbd>O</kbd> | Open in the web app |
| <kbd>B</kbd> | <kbd>B</kbd> | Remind me later |
| | <kbd>S</kbd> | Star (Gmail) |
| <kbd>Z</kbd> | <kbd>Z</kbd> | Undo the last action |
| <kbd>/</kbd> | | Search every Gmail inbox |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>↓</kbd> | | Move the inbox of the focused line up or down |
| | <kbd>Esc</kbd> | Back to the list, or out of the search |

The keys go by position, so they work with any keyboard layout. Archive is not there for Yandex Mail and Mail.ru.

## Install

**From the [Chrome Web Store](https://chromewebstore.google.com/detail/mail-deck/hjlkjemogfgkpbbnogihekjcdmafecff).**

**From source** (Chrome, Brave, Edge, any Chromium browser):

1. Download this repository and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the `extension` folder.
4. Sign in to Gmail in the same browser, or turn on another mail service in the settings under **Other mail**. The envelope on the toolbar shows your unread count.

## Development

```
extension/            the extension (load this folder unpacked)
  manifest.json
  core/               background: checking feeds, badge, notifications, actions
  core/services/      the other mail services, one file each: Yahoo, AOL, Proton, Yandex, Mail.ru
  core/services.js    runs them: their permissions, the Origin rules, their mailboxes in the check
  data/panel/         the toolbar panel
  data/settings/      the settings page
  _locales/           translations
store/                Chrome Web Store listing text and images
tools/build-icons.sh  renders the icons from tools/icons.html
tools/package.sh      zips the extension for the store into dist/
tools/publish.py      uploads that zip to the Chrome Web Store and submits it for review
tools/test/run.sh     runs the tests: scripts, locales, the background check, the mail services, the panel in headless Chrome
tools/test/services/  one test per mail service, against a fake of that service
docs/images/          the pictures in this README
```

Mail comes from Gmail's Atom feed of each signed-in account, the full text from the message's print view, and actions go to `mail.google.com` the way the Gmail page sends them.

Each of the other services is one file in `extension/core/services/` with the same shape: its `name`, the sites it needs (`origins`), its `signIn` and `compose` links, what it `can` do (`archive`, `spam`, `body`), and `collect`, `action` and `body`, which talk to the service the way its web app does. `extension/core/services.js` checks only the services turned on and granted, sets the Origin rules and hands their mailboxes to the check, so the panel takes them like Gmail's. `tools/test/services.test.js` tests that runner, and `tools/test/services/` has one test per service against a fake of it, so no account is needed.

There is no build step: edit a file, then reload the extension on `chrome://extensions`.

Package for the store:

```sh
tools/package.sh      # dist/mail-deck-<version>.zip
```

## License

[Mozilla Public License 1.1](LICENSE). Mail Deck grew out of Notifier for Gmail by InBasic; see [NOTICE.md](extension/NOTICE.md). The mail services in `extension/core/services/` adapt code from other open-source projects under MPL-2.0, MIT and Apache-2.0; each file names its sources and their licence at the top.

Mail Deck is not made by or affiliated with Google, Yahoo, AOL, Proton, Yandex or VK. Gmail is a trademark of Google LLC; the other names belong to their owners.
