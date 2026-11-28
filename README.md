# venn.

*For long distance relationships, with nothing to watch.*

Venn helps two people pick something to watch together. You each swipe through the same set of movies. When you both like the same one, Venn tells you both, asks whether you really want to watch it, and, if you both say yes, gives you a link to find it.

> **Status:** Movies and TV mode works end to end. **YouTube mode is coming soon.** The Chrome extension version is in progress.


## How it works

1. One person **hosts** a session and shares the 6-character code. The other person **joins** with it.
2. Each person ranks their favourite genres (up to five). Your first pick counts the most.
3. The host combines both people's picks, with shared genres ranking highest, and builds one deck of movies from TMDB.
4. You both swipe the same deck at your own pace. Heart to like, X to skip. Your likes are shared with your partner, and your skips are not.
5. When you both like the same movie, a match screen interrupts both of you. Each person chooses **Watch** or **No thanks**, and the screen stays up until you have both chosen.
6. If you both choose Watch, a celebration screen shows the movie with a link to look it up. Otherwise, swiping carries on.

There are no accounts and no Venn server. Your partner's likes and votes travel directly between your two browsers.

## Features

- Host and join with a short session code
- Ranked genre preferences, remembered between visits
- A shared deck built from both people's tastes
- Live like syncing and match detection on both sides
- A shared Watch / No thanks vote before anything is decided
- Swipe animations and a typing intro
- Light and dark colour schemes

## Coming soon

- **YouTube mode:** swipe on videos instead of movies, with preferences for video categories and, possibly, specific YouTubers you want to watch.
- **Chrome extension:** Venn as a small popup window in the browser (see below).
- **More cards when the deck runs out:** the host fetches the next batch, and whoever finishes first sees a waiting screen until their partner catches up.

## Built with

- Vanilla JavaScript (ES modules), HTML and CSS, with no build step
- [TMDB API](https://www.themoviedb.org/) for movie data and posters
- [PeerJS](https://peerjs.com/) (WebRTC) for the connection between two people
- `localStorage` for saved preferences
- Chrome extension (Manifest V3), in progress

## Getting started

### Requirements

- A modern Chrome-based browser
- A free [TMDB](https://www.themoviedb.org/) account and API key
- A way to serve local files (see step 3)

### 1. Get the code

```bash
git clone <your-repo-url>
cd venn
```

### 2. Add your API key

Create a file called `config.js` in the project's top folder:

```js
export const TMDB_API_KEY = "your-key-here";
```

`config.js` is listed in `.gitignore` so your key is never committed. Don't remove it from there.

### 3. Run it locally

Browsers block ES modules when you open an HTML file straight from disk, so serve the folder. Any of these works:

- In VS Code, install **Live Server**, right-click `index.html`, and choose **Open with Live Server**
- `npx serve`
- `python -m http.server`

Then open the address it prints.

### 4. Try it on your own with two windows

Open Venn in a normal window and again in a **private window**. Private windows have their own saved preferences, so the two windows behave like two different people. Host in one, and join with the code in the other.

## Settings

The movie search settings live in the `movieFilters` object in the JavaScript (currently region `CA`, free streaming only). Change the region code to match where you and your partner watch.

## Chrome extension (in progress)

Venn is being packaged as a Chrome extension that opens as a small popup window, so a session stays alive while you browse.

1. Create an `icons/` folder with `icon16.png`, `icon48.png` and `icon128.png`.
2. Go to `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the project folder (the one containing `manifest.json`).
4. Click the Venn icon in the toolbar.

After changing any file, press the reload arrow on the extension's card. To test with two people on one computer, load the extension in two separate Chrome profiles.

## Project structure

```
venn/
├── index.html
├── manifest.json        (extension)
├── background.js        (extension)
├── config.js            (your API key, not committed)
├── css/
│   └── style.css
├── js/
│   ├── main.js          screens, swiping, match and vote flow
│   ├── api.js           TMDB requests and turning movies into Venn cards
│   ├── matching.js      combining two people's genre rankings
│   ├── network.js       PeerJS: hosting, joining and sending messages
│   ├── render.js        drawing a card on the page
│   └── links.js         building the "watch" link
├── lib/
│   └── peerjs.min.js    PeerJS, bundled locally
└── icons/               (extension)
```

## Known limitations

- Both people need to be online at the same time. A session ends if the host closes the window.
- Venn uses PeerJS's free public server to introduce the two browsers. Some networks block direct browser-to-browser connections, in which case joining can fail.
- One partner per session.
- Movies are limited to what TMDB lists for your region, so availability varies.
- The TMDB API key sits in browser code, so anyone using the app can read it. That is fine for a personal key you can regenerate, but don't publish a key you care about.

## Credits and attribution

- This product uses the TMDB API but is not endorsed or certified by TMDB. Movie data and posters are from TMDB. Check TMDB's current attribution guidelines before sharing the app publicly.
- [PeerJS](https://peerjs.com/) is open source (MIT).
- Icons are from [Feather](https://feathericons.com/) (MIT).