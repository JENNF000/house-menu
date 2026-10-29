# The House Menu

A menu of meals, desserts and cocktails for guests, and a recipe box for you. It installs on your phone like an app, works offline, and is hosted for free on GitHub Pages.

- **Guests** see the menu. Tapping a dish opens its recipe (you can turn that off).
- **You** sign in to the kitchen on your own devices to add and edit dishes, upload photos, and manage tags. Your changes stay on that device until you press **Publish**. Publishing saves them to this repository, and the live site updates about a minute later.

## 1. Put it on GitHub Pages

1. Sign in at [github.com](https://github.com) and create a new repository, for example `house-menu`. Make it **Public**, because GitHub Pages is free only for public repositories on a free account.
2. On the new repository's page, choose **Add file → Upload files**. Drag in everything in this folder, including the `icons` and `images` folders, then press **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose the branch `main` and the folder `/ (root)`, then press **Save**.
4. After a minute or two the site is live at `https://YOUR-USERNAME.github.io/house-menu/`.

## 2. Install it on your phone

- **iPhone (Safari):** open the site, tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** open the site, tap the **⋮** menu, then **Install app** (or **Add to Home screen**).

Once a device has opened the site, it works offline.

## 3. Sign in to the kitchen (so you can edit)

The app saves your edits to GitHub, so it needs a key that can write to this one repository.

1. Go to [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. Give it a name like *House Menu*, and set an expiration you're comfortable with (up to a year).
3. Under **Repository access**, choose **Only select repositories** and pick `house-menu`.
4. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**.
5. Press **Generate token** and copy it. It starts with `github_pat_`.
6. On the site, tap **Kitchen** at the very bottom of the page. Enter your GitHub username, the repository name, and the token, then press **Connect**.

Do this once on each device you want to edit from. The token is stored only in that device's browser. It is never published, and guests never see a Kitchen button. When the token expires, make a new one and enter it in **Settings**.

## Editing and publishing

- Tap **Edit menu**, then **Add dish**, or open any dish and tap **Edit**.
- In the Method field, wrap amounts in `*asterisks*` to show them in **bold**.
- If you leave the tags empty, they're created automatically from the ingredients. This works for English and Chinese recipes.
- Photos are resized before saving. When you publish, they go into the `images` folder.
- When the bar says **Unpublished changes on this device**, press **Publish** to update the live menu, or **Discard** to drop the changes.
- If you published from another device in the meantime, the app warns you before replacing that version.
- **Settings → Download menu.json** saves a backup of the whole menu.

## AI illustrations, taste lines and tag suggestions (optional)

In **Settings**, paste a Claude API key from [console.anthropic.com](https://console.anthropic.com). With a key, the app can:

- draw an illustration for a dish (**Illustrate with AI**),
- write the cocktail taste line when you leave it blank,
- suggest tags.

The key stays in that device's browser, and usage is billed to your Anthropic API account. Without a key, everything else works the same, and dishes get the built-in drawing.

## Privacy

The repository is public, so **anyone can read `menu.json`, including every recipe**. Turning off *Guests can open recipes* only hides recipes inside the app. If the recipes need to stay private, keep the repository private and use a host that supports private sites.

## Changing the app itself

The app is plain HTML, CSS and JavaScript with no build step: `index.html`, `styles.css`, `app.js`, `sw.js` (offline support) and `manifest.webmanifest` (install details). After you edit any of these, change `VERSION` in `sw.js` (for example to `house-menu-v2`) so installed copies pick up the new files.
