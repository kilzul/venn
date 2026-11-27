// imports
import { $, renderCard } from "./render.js";
import { fetchMovies, fetchGenreLookup, translateMovie } from "./api.js";
import { hostSession, joinSession, closeSession, sendMessage } from "./network.js";
import { MAX_PICKS, combinePrefs, getScore } from "./matching.js";
import { buildWatchUrl } from "./links.js";




const STORAGE_KEY = "venn-prefs";  // the one localStorage key for all prefs

const movieFilters = {
    region: "CA",
    type: "free",
    page: 1
};


let role = null;
let session = null;
let mode = "movie"; // placeholder, will change later


let partnerPrefs = null;
let myPrefsReady = false;
let prefs = loadPrefs();
let prefsLocked = false;


let genreList = null;


// saving and loading prefs from localstorage 

function loadPrefs() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                movie: { genreOrder: parsed.movie?.genreOrder ?? [] },
                yt: parsed.yt ?? {}
            };
        }
    } catch (error) {
        console.error("Couldn't read saved preferences:", error);
    }
    return { movie: { genreOrder: [] }, yt: {} };
}

function savePrefs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// in case tmdb changes list 
function cleanSavedGenres() {
    const validIds = genreList.map(genre => genre.id);
    prefs.movie.genreOrder = prefs.movie.genreOrder
        .filter(id => validIds.includes(id))
        .slice(0, MAX_PICKS);
}

function toggleGenre(genreId) {
    if (prefsLocked) return;
    const order = prefs.movie.genreOrder;
    const position = order.indexOf(genreId);
    const message = $("prefs-message");
    message.textContent = "";

    if (position !== -1) {
        order.splice(position, 1);
    } else if (order.length < MAX_PICKS) {
        order.push(genreId);         // goes to the end of the list
    } else {
        message.textContent = `You can only pick up to ${MAX_PICKS}. Unselect one first.`;
    }

    refreshGenreButtons();
}

// prefs screen


function createGenreButtons() {
    const container = $("genre-container");
    container.innerHTML = "";

    for (const genre of genreList) {
        const button = document.createElement("button");
        button.classList.add("genre-button");
        button.dataset.genreId = genre.id;

        const name = document.createElement("span");
        name.textContent = genre.name;

        const score = document.createElement("span");
        score.classList.add("genre-score");

        button.append(name, score);
        button.addEventListener("click", () => toggleGenre(genre.id));
        container.appendChild(button);
    }

    refreshGenreButtons();
}


function refreshGenreButtons() {
    const buttons = document.querySelectorAll(".genre-button");

    buttons.forEach(button => {
        const genreId = Number(button.dataset.genreId);
        const score = getScore(prefs.movie.genreOrder, genreId);
        const scoreLabel = button.querySelector(".genre-score");

        if (score > 0) {
            button.classList.add("selected");
            scoreLabel.textContent = score;
        } else {
            button.classList.remove("selected");
            scoreLabel.textContent = "";
        }
    });

    $("prefs-continue").disabled = prefsLocked || prefs.movie.genreOrder.length === 0;
}

// deck building and swiping

async function loadMovieDeck(genreIds) {
    const ids = [...genreIds];   // a copy

    while (true) {
        const rawMovies = await fetchMovies({ ...movieFilters, genreIds: ids });

        if (rawMovies.length > 0 || ids.length === 0) {
            return {
                genreIds: ids,
                deck: rawMovies.map(raw => translateMovie(raw, genreList))
            };
        }

        ids.pop();
    }
}

async function tryBuildDeck() {
    if (role !== "host") return;
    if (!myPrefsReady || partnerPrefs === null) return;

    $("loading-screen").hidden = false;

    try {
        const combined = combinePrefs(prefs.movie.genreOrder, partnerPrefs);
        const result = await loadMovieDeck(combined);

        session = makeSession(result.deck, result.genreIds);
        sendMessage({ type: "deck", genreIds: result.genreIds, deck: result.deck });

        resetSwipeScreen();
        changePageTo("swipe");
        showCurrentCard();
    } catch (error) {
        console.error(error);
        $("prefs-status").textContent = "Couldn't build the deck. Try again.";
        myPrefsReady = false;
        prefsLocked = false;
        refreshGenreButtons();
    } finally {
        $("loading-screen").hidden = true;
    }
}

// swipe scren

function resetSwipeScreen() {
    $("like-button").hidden = false;
    $("skip-button").hidden = false;
    $("back-to-prefs").hidden = true;
}

function showCurrentCard() {
    const movie = session.deck[session.index];

    if (movie === undefined) {
        showDeckEmpty();
        return;
    }

    renderCard(movie);
}

function findCard(id) {
    return session.deck.find(card => card.id === id);
}

function isMatch(id) {
    return session.likedIds.includes(id)
        && session.partnerLikedIds.includes(id)
        && !session.matchedIds.includes(id);
}

function handleNewMatch(id) {
    session.matchedIds.push(id);

    if (session.currentMatchId === null) {
        showMatch(id);
    } else {
        session.pendingMatches.push(id);
    }
}

function showMatch(id) {
    const card = findCard(id);

    $("found-media-cover").src = card.cover;
    $("found-media-cover").hidden = !card.cover;
    $("found-title").textContent = card.title;
    $("found-description").textContent = card.description;
    $("found-skip-button").hidden = false;
    session.currentMatchId = id;
    updateMatchStatus();
    changePageTo("found");
}

function handleChoice(liked) {
    if (!session) return;

    const movie = session.deck[session.index];
    if (!movie) return;

    session.seenIds.push(movie.id);
    if (liked) {
        session.likedIds.push(movie.id);
        sendMessage({
            type: "like",
            movieId: movie.id
        });
    }

    session.index = session.index + 1;

    if (liked && isMatch(movie.id)) {
        handleNewMatch(movie.id);
    } else {
        showCurrentCard();
    }
}

function castVote(choice) {
    if (!session || session.currentMatchId === null) return;

    const id = session.currentMatchId;
    if (session.myVotes[id] !== undefined) return;

    session.myVotes[id] = choice;
    sendMessage({ type: "vote", movieId: id, choice: choice });

    updateMatchStatus();
    checkResolution(id);
}

function updateMatchStatus() {
    const id = session.currentMatchId;
    if (id === null) return;

    const mine = session.myVotes[id];
    const theirs = session.partnerVotes[id];

    let text = "";
    if (mine !== undefined) {
        text = "Waiting for your partner...";
    } else if (theirs === "watch") {
        text = "Your partner wants to watch this!";
    }

    $("watch-status").textContent = text;
    $("watch-button").disabled = mine !== undefined;
    $("found-skip-button").disabled = mine !== undefined;
}

function checkResolution(id) {
    const mine = session.myVotes[id];
    const theirs = session.partnerVotes[id];

    if (mine === undefined || theirs === undefined) return;
    if (session.resolvedIds.includes(id)) return;

    session.resolvedIds.push(id);

    if (mine === "watch" && theirs === "watch") {
        showCelebration(id);
    } else {
        continueAfterMatch();
    }
}

function continueAfterMatch() {
    session.currentMatchId = null;

    const next = session.pendingMatches.shift();
    if (next !== undefined) {
        showMatch(next);
        return;
    }

    changePageTo("swipe");
    showCurrentCard();
}

function showCelebration(id) {
    const card = findCard(id);

    $("celebration-cover").src = card.cover;
    $("celebration-cover").hidden = !card.cover;
    $("celebration-title").textContent = card.title;
    $("celebration-description").textContent = card.description;
    $("watch-link").href = buildWatchUrl(card);

    changePageTo("celebration");
}

function showDeckEmpty() {
    $("movie-tv-card").hidden = false;
    $("youtube-card").hidden = true;
    $("movie-title").textContent = "No more cards!";
    $("year").textContent = "";
    $("desc").textContent = "";
    $("score").textContent = "";
    $("genres").innerHTML = "";
    $("movie-cover").hidden = true;
    $("like-button").hidden = true;
    $("skip-button").hidden = true;
    $("back-to-prefs").hidden = false;
}

// switch screens

function changePageTo(pageId) {
    if (!document.getElementById(pageId)) {
        console.warn("No page with id:", pageId);
        return;
    }

    document.querySelectorAll(".page").forEach(page => {
        page.hidden = page.id !== pageId;
    });
}

async function showPrefsPage() {
    setSessionStatus("");
    $("prefs-status").textContent = "";
    $("loading-screen").hidden = false;

    try {
        if (!genreList) {
            genreList = await fetchGenreLookup();
        }
        cleanSavedGenres();
        createGenreButtons();
        changePageTo("preferences");
    } catch (error) {
        console.error(error);
        setSessionStatus("Couldn't load genres. Try again.");
    } finally {
        $("loading-screen").hidden = true;
    }
}

function setSessionStatus(text) {
    const statusId = role === "host" ? "host-status" : "join-status";
    $(statusId).textContent = text;
}

// session config

const handlers = {
    "prefs-ready": (message) => {
        if (role !== "host" || !Array.isArray(message.genreOrder)) return;
        partnerPrefs = message.genreOrder;
        tryBuildDeck();
    },

    "deck": (message) => {
        if (role !== "guest") return;
        session = makeSession(message.deck, message.genreIds);
        resetSwipeScreen();
        changePageTo("swipe");
        showCurrentCard();
    },

    "like": (message) => {
        if (!session) return;

        const known = session.deck.some(movie => movie.id === message.movieId);
        if (!known) return;

        if (!session.partnerLikedIds.includes(message.movieId)) {
            session.partnerLikedIds.push(message.movieId);
        }

        if (isMatch(message.movieId)) {
            handleNewMatch(message.movieId);
        }
    },

    "vote": (message) => {
        if (!session) return;
        if (!findCard(message.movieId)) return;
        if (message.choice !== "watch" && message.choice !== "no") return;
        if (session.partnerVotes[message.movieId] !== undefined) return;

        session.partnerVotes[message.movieId] = message.choice;
        updateMatchStatus();
        checkResolution(message.movieId);
    }
};

function handleMessage(message) {
    if (!message || typeof message.type !== "string") return;
    if (!Object.hasOwn(handlers, message.type)) {
        console.warn("Unknown message type:", message.type);
        return;
    }

    handlers[message.type](message);
}

function handleClose() {
    if (role === null) return;
    const disconnectedRole = role;
    role = null;

    closeSession();
    resetSessionState();
    const statusId = disconnectedRole === "host" ? "host-status" : "join-status";
    $(statusId).textContent = "Your partner disconnected.";

    $("host-session-button").disabled = false;
    $("join-session-button").disabled = false;
    changePageTo("session-menu");
}

function resetSessionState() {
    partnerPrefs = null;
    myPrefsReady = false;
    prefsLocked = false;
    session = null;
}

function makeSession(deck, genreIds) {
    return {
        mode: "movie",
        genreIds: genreIds,
        deck: deck,
        index: 0,
        seenIds: [],
        likedIds: [],
        partnerLikedIds: [],
        matchedIds: [],
        currentMatchId: null,
        myVotes: {},
        partnerVotes: {},
        resolvedIds: [],
        pendingMatches: []
    };
}

function showCode(code) {
    $("session-code").textContent = code
    $("session-code-display").hidden = false;
    $("host-status").textContent = "Waiting for partner...";
}

// event listeners

$("start-button").addEventListener("click", () => {
    changePageTo("session-menu");
});

$("host-session-button").addEventListener("click", () => {
    resetSessionState(); 
    role = "host";

    hostSession({
        onCode: (code) => {
            showCode(code);
        },
        onPartnerConnected: (conn) => {
            $("host-status").textContent = "Partner connected!";
            showPrefsPage();
        },
        onMessage: handleMessage,
        onError: (message) => {
            $("host-status").textContent = message;
        },
        onClose: handleClose
    });
});

$("join-session-button").addEventListener("click", () => {
    const code = $("session-code-input").value.trim();
    if (!code) {
        $("join-status").textContent = "Enter a code first.";
        return;
    }

    resetSessionState();
    role = "guest";
    $("join-status").textContent = "Connecting...";

    joinSession(code, {
        onConnected: () => {
            $("join-status").textContent = "Connected!";
            showPrefsPage();
        },
        onMessage: handleMessage,
        onClose: handleClose,
        onError: (message) => {
            $("join-status").textContent = message;
        }
    });
});

$("choose-movie").addEventListener("click", async () => {
    mode = "movie";
    showPrefsPage();
});



$("prefs-continue").addEventListener("click", () => {
    savePrefs();
    prefsLocked = true;
    refreshGenreButtons();

    if (role === "host") {
        myPrefsReady = true;
        tryBuildDeck();
    } else if (role === "guest") {
        sendMessage({ type: "prefs-ready", genreOrder: prefs.movie.genreOrder });
    }

    $("prefs-status").textContent = "Waiting for partner...";
});

$("back-to-prefs").addEventListener("click", () => {
    refreshGenreButtons();
    changePageTo("preferences");
});

$("like-button").addEventListener("click", () => handleChoice(true));
$("skip-button").addEventListener("click", () => handleChoice(false));
$("watch-button").addEventListener("click", () => castVote("watch"));
$("found-skip-button").addEventListener("click", () => castVote("no"));
$("keep-swiping-button").addEventListener("click", continueAfterMatch);

window.addEventListener("beforeunload", closeSession);
