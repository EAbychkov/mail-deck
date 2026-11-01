# Mail Deck: privacy policy

Last updated: 2026-11-01

Mail Deck has no servers, no analytics and no tracking. Nothing it reads leaves your browser except the requests it sends to the mail services themselves: to Google for Gmail, and to each other mail service you turn on. If you turn on the AI assistant with your own OpenAI or Anthropic key, the mail you ask about also goes to that provider, as described below.

## What it reads from Gmail

- **Unread mail.** Mail Deck reads the Gmail Atom feed (`mail.google.com/mail/u/N/feed/atom`) for each Google account you are signed in to in this browser. The browser sends your existing Google session cookies with those requests. Mail Deck never asks for, sees or stores your password.
- **Message text.** When you open a message in the panel, or point at it, Mail Deck loads that conversation's print view from `mail.google.com` and shows it in the panel, with links to its attachments.
- **Gmail search.** When the panel opens, Mail Deck asks Gmail's own search on `mail.google.com` for the unread mail of each inbox, to show which mail is starred and the mail past the 20 the feed lists. When you type in the panel's search field, that query goes to the same search of each of your inboxes.
- **Account pictures.** About once a week Mail Deck loads each signed-in account's Gmail page from `mail.google.com` to find that account's own picture, which the panel then shows from Google's image server (`lh3.googleusercontent.com`).
- **Gmail's action token.** To mark mail as read, archive, delete or report spam, Mail Deck reads the `GMAIL_AT` cookie that Gmail sets for `mail.google.com` and sends it back to `mail.google.com` with the action, the same way the Gmail web page does.
- **Gmail tab requests.** If "Check when Gmail tabs or the network change" is on in settings (it is by default), Mail Deck notices when a Gmail tab sends a request to `mail.google.com` so it can refresh the unread count. It does not read, block or change those requests.

## Other mail services

Yahoo Mail, AOL Mail, Proton Mail, Yandex Mail and Mail.ru are off until you turn one on in Settings → Other mail. Chrome then asks you to allow that service's sites, listed below, one service at a time. Until you allow them, Mail Deck sends that service nothing. Turning a service off removes the permission again.

Each service is read the way its own web page reads it, with the session your browser already has on its site. Mail Deck never asks for, sees or stores your password, an app password or an OAuth token. As with Gmail, it reads the unread mail of the inbox (the sender, the subject, the time and, where the service gives one, a short snippet) and sends your actions, such as mark as read, archive, delete or report spam, back to the same service.

- **Yahoo Mail** (`mail.yahoo.com`). Mail Deck loads the Yahoo Mail page to read the mailbox id, your address and the token the page uses for changes. With those it asks Yahoo's mail interface on the same host (`mail.yahoo.com/ws/v3/batch`) for the folders and the unread inbox mail of the signed-in account, for a message's text when you open it in the panel, and to carry out your actions.
- **AOL Mail** (`mail.aol.com`). Mail Deck loads the AOL Mail page for a request id, then `mail.aol.com/ws/v3/mailboxes` for the mailbox id, your address and the token for changes. With those it asks `mail.aol.com/ws/v3/batch` for the folders and the newest inbox mail, of which it keeps the unread, for a message's text when you open it in the panel, and to carry out your actions.
- **Proton Mail** (`mail.proton.me`). Mail Deck reads the web app's version number from `mail.proton.me/assets/version.json`, without cookies, because Proton's interface expects it with every request. It then asks that interface (`mail.proton.me/api/`) which account each signed-in session is, the inbox's unread count, and the sender, subject and time of up to 20 unread messages, and sends your actions there. It never fetches message bodies, which are end-to-end encrypted, and never touches your keys: a Proton message opens on Proton's site. When a session has expired, Mail Deck renews it the way Proton's web app does (`mail.proton.me/api/auth/refresh`), unless a Proton Mail tab is open, which renews it itself. To tell, it looks only at the addresses of open tabs on `mail.proton.me`.
- **Proton's session cookies.** Proton's interface wants each session's id in a header (`x-pm-uid`). Mail Deck finds that id in the names of Proton's session cookies (`AUTH-<id>`, set for `mail.proton.me/api/`), which it lists with Chrome's cookies permission. It uses only the names, and only to address Proton's own interface. The cookies themselves go only to `mail.proton.me`, sent by the browser as it sends them for the web app.
- **Yandex Mail** (`api.passport.yandex.ru`, `mail.yandex.ru`, `mail.360.yandex.ru`). Mail Deck asks `api.passport.yandex.ru/accounts` which Yandex accounts the browser is signed in to. For each one it loads the mailbox page on `mail.yandex.ru`, or on `mail.360.yandex.ru` for a Yandex 360 mailbox, to read the token the page uses, and asks the mail interface on the same host (`/web-api/models/liza1`) for the unread inbox mail, the unread count and the folder list, and to carry out your actions. When you open a message in the panel, Mail Deck downloads that message's original from the same host and reads it inside the extension.
- **Mail.ru** (`portal.mail.ru`, `e.mail.ru`). Mail Deck asks `portal.mail.ru/NaviData` which Mail.ru mailboxes the browser is signed in to. For each one it gets the mailbox's token from `e.mail.ru/api/v1/user/short`, then asks `e.mail.ru/api/v1/` for the unread inbox mail and the folder counts, for a message when you open it in the panel, and to carry out your actions.

The interfaces of Yahoo Mail, AOL Mail, Yandex Mail and Mail.ru expect requests that come from their own web page. For each of these services you turn on, Mail Deck adds a Chrome rule (`declarativeNetRequest`, kept for the browser session) that sets the `Origin` and `Referer` headers to the service's own address, only on Mail Deck's own requests to that interface: `mail.yahoo.com/ws/`, `mail.aol.com/ws/`, `mail.yandex.ru/web-api`, `mail.360.yandex.ru/web-api` and `e.mail.ru/api/`. The rule matches only requests the extension itself sends in the background, never a request from a tab, and it does not read, block or change anything else. Turning the service off removes its rule. Proton Mail needs no such rule.

## The page you are on

When you open the panel with its toolbar button or its keyboard shortcut, Chrome lets Mail Deck read the address of the tab you are on, for that tab only (the `activeTab` permission). Mail Deck takes the site's domain from it and shows, at the top of the panel, the unread mail whose sender is that site, with a one-time code ready to copy. The comparison happens inside the panel. The address is not stored and is not sent anywhere. In the side panel this works only for tabs on which you used the toolbar button.

## AI assistant

The AI assistant is off until you turn it on in Settings → AI. It can summarize the conversation you are reading, with its key points, what it asks of you and its dates (with links that open Google Calendar's own "new event" page), and it can mark unread mail that waits for your reply. You choose where it runs:

- **On this computer.** Chrome's built-in model runs on your device, and nothing is sent anywhere. Chrome downloads the model from Google once, when you press Download.
- **OpenAI or Anthropic, with your own API key.** When you connect a provider, Chrome asks you to allow its site (`api.openai.com` or `api.anthropic.com`); until then Mail Deck sends it nothing. Requests go from your browser straight to that provider, with your key; Mail Deck has no servers in between. A summary sends the text of that conversation (sender names, dates and message text) with its subject, and the current date, time and time zone so that dates such as "tomorrow at 3" can be read. It is sent when you press Summary, or by itself for long mail if you chose that. "Waiting for your reply" sends the sender, subject and preview of unread mail from the last 14 days, up to 20 messages at a time, and leaves out mail from automated senders such as no-reply addresses. The provider handles this data under its own terms for API use: [OpenAI](https://openai.com/policies/row-privacy-policy/), [Anthropic](https://www.anthropic.com/legal/privacy).

Your API key is kept only in this browser's extension storage on your device (`chrome.storage.local`). It is never part of a settings backup or of Chrome sync, and it is sent only to its own provider. Disconnect removes the key and Chrome's access to the provider. Summaries are kept in session storage, in memory only, until the browser closes. Whether a mail waits for your reply (yes or no, and a few words why) is kept on your device for 30 days, so the same mail is not sent again.

## Where it goes

To the mail services themselves: `mail.google.com` for Gmail, and the sites above for each other service you turn on. A service's mail, addresses and tokens go only to that service. To the AI provider you connected, if you did, as described above. And to Google in two more cases:

- **Sender icons.** For mail in your Gmail inboxes, the panel shows the sender's site icon from Google's icon service (`www.google.com/s2/favicons`), which receives the sender's domain, such as `github.com`, never an address or a message. Like any request your browser makes to Google, it may carry your Google cookies. Mail of the other services gets no icon from Google. "Show sender logos" in settings turns this off.
- **Chrome sync.** If you turn on the settings copy in Chrome sync, your Mail Deck settings are stored with `chrome.storage.sync`, which Chrome keeps in your Google account like your other synced data. It is off by default.

A Gmail message you open in the panel shows its pictures through Google's image proxy, as Gmail does. In a message of another service, pictures from the internet stay hidden until you press Show pictures, since loading them can tell the sender that the message was opened.

Mail Deck does not send your mail, addresses, cookies or settings to its author, or to anyone other than the services named above. It does not sell or share data, and it does not use your data for advertising or credit decisions.

## What it stores

Your settings (including which mail services you turned on), the order of your inboxes, the reminders you set and the current unread counts are kept in the browser's extension storage (`chrome.storage`) on your device. So that a message opens at once, the last dozen messages you opened (or, in Gmail, pointed at), from any service, and Gmail's answers to the panel's searches, are kept in the session part of that storage: in memory only, never written to disk, and gone when the browser closes. The same session storage holds what the other services need between checks: the tokens their pages hand out, which Proton session is which account, each service's last answer, shown for up to 30 minutes when a check fails, and which listed message belongs to which mailbox. Reminders never reach Gmail or any other service. Removing the extension deletes all of it, except a settings copy you chose to keep in Chrome sync, which you can turn off in settings.

## Contact

Questions or problems: open an issue at https://github.com/nord-express/mail-deck/issues.
