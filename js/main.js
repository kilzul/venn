import { $, renderCard } from "./render.js";
import { fetchMovies, fetchGenreLookup, translateMovie } from "./api.js";
import { hostSession, joinSession, closeSession, sendMessage } from "./network.js";
import { MAX_PICKS, combinePrefs } from "./matching.js";




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
        const score = getScore(genreId);
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

        session = {
            mode: "movie",
            genreIds: result.genreIds,
            deck: result.deck,
            index: 0,
            seenIds: [],
            likedIds: []
        };
        console.log("host deck:", session.deck.length, "genres:", session.genreIds);

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

function handleChoice(liked) {
    if (!session) return;

    const movie = session.deck[session.index];
    if (!movie) return;

    session.seenIds.push(movie.id);
    if (liked) {
        session.likedIds.push(movie.id);
    }

    session.index = session.index + 1;
    showCurrentCard();
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
    role === "host" ? $("host-status").textContent = "" : $("join-status").textContent = "";
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
        role === "host" ? $("host-status").textContent = "Couldn't load genres. Try again." : $("join-status").textContent = "Couldn't load genres. Try again.";
    } finally {
        $("loading-screen").hidden = true;
    }
}

// session config

const handlers = {
    // placeholder msgs for testing
    "prefs": (message) => {
        partnerPrefs = message.genreOrder;
        tryBuildDeck();
    },

    "deck": (message) => {
        session = {
            mode: "movie",
            genreIds: message.genreIds,
            deck: message.deck,
            index: 0,
            seenIds: [],
            likedIds: []
        };
        resetSwipeScreen();
        changePageTo("swipe");
        showCurrentCard();
    }
};

function handleMessage(message) {
    const handler = handlers[message.type];

    if (!handler) {
        console.warn("Unknown message type:", message.type);
        return;
    }

    handler(message);
}

function handleClose() {
    if (role === null) return;
    const disconnectedRole = role;
    role = null;

    closeSession();
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

function showCode() {
    $("session-code").textContent = session.code;
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
            session = { code };
            showCode();
        },
        onPartnerConnected: (conn) => {
            console.log("Partner connected:", conn.peer);
            $("host-status").textContent = "Partner connected!";
            showPrefsPage();
        },
        onMessage: handleMessage,
        onClose: handleClose
    });
});

$("join-session-button").addEventListener("click", () => {
    resetSessionState();
    role = "guest";
    $("join-status").textContent = "Connecting...";

    joinSession($("session-code-input").value, {
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

window.addEventListener("beforeunload", closeSession);
