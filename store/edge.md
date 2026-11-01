# Microsoft Edge Add-ons: Mail Deck

Edge runs Chrome extensions as they are, so the same package goes to the Edge Add-ons website: `dist/mail-deck-<version>.zip` from `tools/package.sh`. The first submission is made by hand in Partner Center; later versions can go through the Edge Add-ons API.

## 1. Developer account (once, free)

1. Have a personal Microsoft account (MSA). The Edge program does not take work or school accounts; signing in with a personal GitHub account also works and creates an MSA if needed.
2. Open Partner Center, https://partner.microsoft.com/dashboard/microsoftedge/overview, and sign in. If the registration form does not open by itself: Account settings → Programs → **Get started** on the Microsoft Edge card.
3. Fill in the form: country or region (it cannot be changed later), account type **Individual** (a company account needs an approver and a verification of three to five business days), publisher display name, contact details; accept the agreement; **Finish**. Microsoft confirms the enrollment by email.

There is no registration fee.

## 2. First submission (by hand)

1. In the Edge program, **Create new extension**.
2. **Packages**: upload `dist/mail-deck-<version>.zip` → **Continue**.
3. **Availability**: Visibility *Public*, Markets *all*.
4. **Properties**: Category *Productivity*; Website `https://nord-express.github.io/mail-deck/`; Support contact `https://github.com/nord-express/mail-deck/issues`.
5. **Privacy**: the same answers as the Chrome Web Store, from `store/listing.md` → *Privacy tab*: the single purpose, the permission justifications table (including `sidePanel`, `declarativeNetRequestWithHostAccess` and the optional host permissions of the other mail services), "no remote code", the data usage boxes, and the privacy policy URL `https://nord-express.github.io/mail-deck/privacy.html`.
6. **Store listings**: English (and any language from `store/listing-translations.md`): the description from `store/listing.md`, the screenshots `store/screenshot-1-inbox.png` … `screenshot-6-settings.png` (1280×800) and the promo tile `store/promo-440x280.png`. The page states which image sizes it accepts; if it asks for a store logo of its own size, render one from `tools/icons.html`. Every language row has to show *Complete* before publishing.
7. **Publish** → add notes for certification, for example: "Sign in to any Gmail account in the browser; the toolbar panel lists its unread mail. Yahoo Mail, AOL Mail, Proton Mail, Yandex Mail and Mail.ru are off by default: sign in on the service's site, then turn it on in Settings → Other mail, which asks for that service's sites. No account of ours is needed." → **Publish**. Certification takes up to seven business days.

After approval, note the extension's **Product ID** (a GUID): the extension's Overview page in Partner Center → *Extension identity*, or the page address.

## 3. Later versions through the API

The Edge Add-ons API (v1.1) uploads a new package to an existing extension and publishes it. It cannot create an extension or change its listing, which stay in Partner Center.

**Credentials:** Partner Center → Microsoft Edge → **Publish API** → *Create API credentials*. The page shows a **Client ID** and **API keys**, each key with its expiry date; a new key has to be made before the old one expires.

Keep them next to the Chrome credentials, outside the repo:

```sh
cat > ~/.config/mail-deck/edge.env <<'EOF'
EDGE_PRODUCT_ID=<the Product ID GUID>
EDGE_CLIENT_ID=<Client ID>
EDGE_API_KEY=<API key>
EOF
chmod 600 ~/.config/mail-deck/edge.env
```

**Requests** (headers on every call: `Authorization: ApiKey $EDGE_API_KEY` and `X-ClientID: $EDGE_CLIENT_ID`; base `https://api.addons.microsoftedge.microsoft.com`):

1. Upload the package to the draft: `POST /v1/products/$EDGE_PRODUCT_ID/submissions/draft/package` with `Content-Type: application/zip` and the zip as the body. The answer is `202 Accepted` with a `Location` header holding an operation ID.
2. Check the upload: `GET /v1/products/$EDGE_PRODUCT_ID/submissions/draft/package/operations/$operationID` until it reports success.
3. Publish the draft: `POST /v1/products/$EDGE_PRODUCT_ID/submissions` with optional certification notes in the body; again `202 Accepted` and an operation ID in `Location`.
4. Check the publication: `GET /v1/products/$EDGE_PRODUCT_ID/submissions/operations/$operationID`.

The version in `extension/manifest.json` has to be higher than the published one, as on the Chrome Web Store. One user on Microsoft Q&A reports that a submission accepted by the API (202) did not show its new status in Partner Center at once, so check the dashboard after the first automated publish.

A `tools/publish.py edge` command can be built on these four calls once the credentials exist.

## Sources

- Register as a Microsoft Edge extension developer: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account
- Register and sign in to Partner Center using a GitHub account: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/github
- Publish a Microsoft Edge extension: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- Verify your company account information: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/verify-microsoft-edge-program
- Update a Microsoft Edge extension: https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension
- Use the REST API to update an extension: https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api
- REST API reference for updating an extension: https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/addons-api-reference
- Microsoft Q&A, status not updating after publishing via the API: https://learn.microsoft.com/en-us/answers/questions/1428784/add-ons-api-status-not-updating-after-publishing
