# Changes

Each version that reaches `main` is released on GitHub with the notes of its section here
(`.github/workflows/release.yml`), and goes to the Chrome Web Store with `tools/publish.py submit`.

## 1.4.0

Mail Deck 1.4.0 brings an optional AI assistant, the mail of the site you're on, and a new icon.

**New**
- **Mail from the site you're on.** Open the panel on a website and that site's unread mail is at the top, from every inbox, with a fresh sign-in code ready to copy.
- **One-time codes** stand out in the list and in the message; a click or <kbd>C</kbd> copies them.
- **AI assistant** (off until you turn it on in Settings → AI): a summary of the conversation you're reading (key points, what it asks of you, dates with an "Add to Google Calendar" link), and **Waiting for your reply**, a chip that gathers unread mail from people who expect an answer. It runs with Chrome's built-in model on your computer, or with your own OpenAI or Anthropic API key, straight from your browser; the key stays on this computer.
- In the reader, <kbd>J</kbd> / <kbd>K</kbd> open the next or previous message; optionally the next one opens after an action.
- Notifications name their inbox, take an `[account]` placeholder and can repeat while the mail stays unread. Each inbox can be left out of the count, and the badge can count only mail since you last opened the panel.
- A new icon: the deck, dealt.

**Fixed**
- Offline (for example right after waking the laptop) no longer looks like being signed out; Undo brings mail back at once; label feeds no longer repeat notifications; checks by hand no longer notify about old mail; rechecks no longer wait for Chrome's 30-second alarm limit.
- Other services' mail: no remote picture loads before Show pictures; links always open in a tab of their own.
- Proton, Yandex, Mail.ru, Yahoo and AOL: a temporary error no longer drops a mailbox; Yandex mail with odd encodings reads correctly.
- Settings backups keep the mailbox order and put Gmail labels on the right account; many accessibility and right-to-left fixes; translations the background uses are complete in all 20 languages.

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/mail-deck/hjlkjemogfgkpbbnogihekjcdmafecff) (1.4.0 is in review and arrives there automatically once approved). The zip below is the same package, for loading unpacked.



## 1.3.3

Mail Deck (formerly Mail Deck for Gmail) now checks other mail services too, the same way it checks Gmail: through the session you are already signed in to in Chrome, with no passwords and no servers in between.

- **Other mail:** Yahoo Mail, AOL Mail, Proton Mail, Yandex Mail and Mail.ru. Each one is off until you turn it on in Settings → Other mail, and Chrome then asks for that service's site alone.
- Their mailboxes sit in the same panel as your Google accounts, with unread counts, notifications, read, delete and spam. Archive works where the service has one (Yahoo, AOL, Proton).
- Messages open in the panel (Proton mail opens on Proton's site, since it is end-to-end encrypted). Remote pictures in these messages load only when you click Show pictures.
- The project now lives at [github.com/nord-express/mail-deck](https://github.com/nord-express/mail-deck), with its website at [nord-express.github.io/mail-deck](https://nord-express.github.io/mail-deck/), and is published by Nord Express.

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/mail-deck/hjlkjemogfgkpbbnogihekjcdmafecff). The zip below is the same package, for loading unpacked.


