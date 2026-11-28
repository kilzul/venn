// imports
import { $, renderCard } from "./render.js";
import { fetchMovies, fetchGenreLookup, translateMovie } from "./api.js";
import { hostSession, joinSession, closeSession, sendMessage } from "./network.js";
import { MAX_PICKS, combinePrefs, getScore } from "./matching.js";
import { buildWatchUrl } from "./links.js";
import { playIntro, showConfetti } from "./animations.js";
import { loadPrefs, savePrefs } from "./storage.js";
import { state, movieFilters, makeSession, resetSessionState, findCard, isMatch } from "./state.js";




const MAX_TMDB_PAGE = 500;


// animation helpers

function playCardAnimation(className) {
    const card = document.querySelector(".card:not([hidden])");
    if (!card) return Promise.resolve();

    card.classList.remove("card-enter", "card-leave-left", "card-leave-right");
    void card.offsetWidth;   // forces the browser to restart the animation
    card.classList.add(className);

    return new Promise((resolve) => {
        card.addEventListener("animationend", resolve, { once: true });
        setTimeout(resolve, 400);   // safety net if the event never fires
    });
}


// in case tmdb changes list 
function cleanSavedGenres() {
    const validIds = state.genreList.map(genre => genre.id);
    state.prefs.movie.genreOrder = state.prefs.movie.genreOrder
        .filter(id => validIds.includes(id))
        .slice(0, MAX_PICKS);
}

function toggleGenre(genreId) {
    if (state.prefsLocked) return;
    const order = state.prefs.movie.genreOrder;
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

    for (const genre of state.genreList) {
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
        const score = getScore(state.prefs.movie.genreOrder, genreId);
        const scoreLabel = button.querySelector(".genre-score");

        if (score > 0) {
            button.classList.add("selected");
            scoreLabel.textContent = score;
        } else {
            button.classList.remove("selected");
            scoreLabel.textContent = "";
        }
    });

    $("prefs-continue").disabled = state.prefsLocked || state.prefs.movie.genreOrder.length === 0;
}

// deck building and swiping

async function loadMovieDeck(genreIds) {
    const ids = [...genreIds];   // a copy

    while (true) {
        const rawMovies = await fetchMovies({ ...movieFilters, genreIds: ids });

        if (rawMovies.length > 0 || ids.length === 0) {
            return {
                genreIds: ids,
                deck: rawMovies.map(raw => translateMovie(raw, state.genreList))
            };
        }

        ids.pop();
    }
}

async function tryBuildDeck() {
    if (state.role !== "host") return;
    if (!state.myPrefsReady || state.partnerPrefs === null) return;

    $("loading-screen").hidden = false;

    try {
        const combined = combinePrefs(state.prefs.movie.genreOrder, state.partnerPrefs);
        const result = await loadMovieDeck(combined);

        state.session = makeSession(result.deck, result.genreIds);
        sendMessage({ type: "deck", genreIds: result.genreIds, deck: result.deck });

        showCurrentCard();
    } catch (error) {
        console.error(error);
        $("prefs-status").textContent = "Couldn't build the deck. Try again.";
        state.myPrefsReady = false;
        state.prefsLocked = false;
        refreshGenreButtons();
    } finally {
        $("loading-screen").hidden = true;
    }
}

function showCurrentCard() {
    const movie = state.session.deck[state.session.index];

    if (movie === undefined) {
        reachEndOfDeck();
        return;
    }

    changePageTo("swipe");
    renderCard(movie);
    playCardAnimation("card-enter");
}

function reachEndOfDeck() {
    if (!state.session.iFinished) {
        state.session.iFinished = true;
        sendMessage({ type: "finished" });
    }
    showEndOfDeck();
    checkBothFinished();
}

function showEndOfDeck() {
    if (state.session.currentMatchId !== null) return;

    let text;
    if (state.session.deckEnded) {
        text = "That's everything! No more movies to show.";
    } else if (state.session.iFinished && state.session.partnerFinished) {
        text = "Finding more movies...";
    } else {
        text = "Your partner is still swiping...";
    }

    $("waiting-text").textContent = text;
    $("retry-button").hidden = true;
    changePageTo("waiting");
}

function checkBothFinished() {
    if (state.role !== "host" || !state.session) return;
    if (!state.session.iFinished || !state.session.partnerFinished) return;
    if (state.session.fetching || state.session.deckEnded) return;
    loadMoreCards();
}

async function fetchMoreCards(currentSession) {
    const genreIds = [...currentSession.genreIds];
    let page = currentSession.page + 1;

    if (currentSession.matchesThisBatch === 0 && genreIds.length > 0) {
        genreIds.pop();
        page = 1;
    }

    const known = new Set(currentSession.deck.map(card => card.id));

    for (let attempt = 0; attempt < 10; attempt += 1) {
        let rawMovies = [];
        if (page <= MAX_TMDB_PAGE) {
            rawMovies = await fetchMovies({ ...movieFilters, genreIds, page });
        }

        if (rawMovies.length === 0) {
            if (genreIds.length === 0) return null;
            genreIds.pop();
            page = 1;
            continue;
        }

        const cards = rawMovies
            .map(raw => translateMovie(raw, state.genreList))
            .filter(card => {
                if (known.has(card.id)) return false;
                known.add(card.id);
                return true;
            });

        if (cards.length > 0) {
            return { cards, genreIds, page };
        }

        page += 1;
    }

    return null;
}

async function loadMoreCards() {
    if (state.role !== "host" || !state.session || state.session.fetching || state.session.deckEnded) return;

    const currentSession = state.session;
    currentSession.fetching = true;
    $("retry-button").hidden = true;
    $("waiting-text").textContent = "Finding more movies...";

    try {
        const result = await fetchMoreCards(currentSession);
        if (state.session !== currentSession || state.role !== "host") return;

        if (result === null) {
            currentSession.deckEnded = true;
            sendMessage({ type: "deck-end" });
            showEndOfDeck();
            return;
        }

        currentSession.page = result.page;
        currentSession.matchesThisBatch = 0;
        sendMessage({ type: "more", cards: result.cards, genreIds: result.genreIds });
        addCards(result.cards, result.genreIds);
    } catch (error) {
        console.error(error);
        if (state.session !== currentSession || state.role !== "host") return;
        $("waiting-text").textContent = "Couldn't load more movies.";
        $("retry-button").hidden = false;
    } finally {
        currentSession.fetching = false;
    }
}

function addCards(cards, genreIds) {
    state.session.deck.push(...cards);
    state.session.genreIds = genreIds;
    state.session.iFinished = false;
    state.session.partnerFinished = false;

    if (state.session.currentMatchId === null) {
        showCurrentCard();
    }
}

function handleNewMatch(id) {
    state.session.matchedIds.push(id);
    state.session.matchesThisBatch += 1;

    if (state.session.currentMatchId === null) {
        showMatch(id);
    } else {
        state.session.pendingMatches.push(id);
    }
}

function showMatch(id) {
    const card = findCard(id);

    $("found-media-cover").src = card.cover;
    $("found-media-cover").hidden = !card.cover;
    $("found-title").textContent = card.title;
    $("found-description").textContent = card.description;
    $("found-skip-button").hidden = false;
    state.session.currentMatchId = id;
    updateMatchStatus();
    changePageTo("found");
}

async function handleChoice(liked) {
    if (!state.session || state.swiping) return;

    const movie = state.session.deck[state.session.index];
    if (!movie) return;

    state.swiping = true;

    state.session.seenIds.push(movie.id);
    if (liked) {
        state.session.likedIds.push(movie.id);
        sendMessage({ type: "like", movieId: movie.id });
    }
    state.session.index = state.session.index + 1;

    try {
        await playCardAnimation(liked ? "card-leave-right" : "card-leave-left");
    } finally {
        state.swiping = false;
    }

    // the session can vanish or a match can open while the card is leaving
    if (!state.session || state.session.currentMatchId !== null) return;

    if (liked && isMatch(movie.id)) {
        handleNewMatch(movie.id);
    } else {
        showCurrentCard();
    }
}

function castVote(choice) {
    if (!state.session || state.session.currentMatchId === null) return;

    const id = state.session.currentMatchId;
    if (state.session.myVotes[id] !== undefined) return;

    state.session.myVotes[id] = choice;
    sendMessage({ type: "vote", movieId: id, choice: choice });

    updateMatchStatus();
    checkResolution(id);
}

function updateMatchStatus() {
    const id = state.session.currentMatchId;
    if (id === null) return;

    const mine = state.session.myVotes[id];
    const theirs = state.session.partnerVotes[id];

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
    const mine = state.session.myVotes[id];
    const theirs = state.session.partnerVotes[id];

    if (mine === undefined || theirs === undefined) return;
    if (state.session.resolvedIds.includes(id)) return;

    state.session.resolvedIds.push(id);

    if (mine === "watch" && theirs === "watch") {
        showCelebration(id);
    } else {
        continueAfterMatch();
    }
}

function continueAfterMatch() {
    state.session.currentMatchId = null;

    const next = state.session.pendingMatches.shift();
    if (next !== undefined) {
        showMatch(next);
        return;
    }

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

// switch screens

function changePageTo(pageId) {
    if (!document.getElementById(pageId)) {
        console.warn("No page with id:", pageId);
        return;
    }

    document.querySelectorAll(".page").forEach(page => {
        page.hidden = page.id !== pageId;
    });

    if (pageId === "celebration") {
        showConfetti();
    }
}

async function showPrefsPage() {
    setSessionStatus("");
    $("prefs-status").textContent = "";
    $("loading-screen").hidden = false;

    try {
        if (!state.genreList) {
            state.genreList = await fetchGenreLookup();
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
    const statusId = state.role === "host" ? "host-status" : "join-status";
    $(statusId).textContent = text;
}

// session config

const handlers = {
    "prefs-ready": (message) => {
        if (state.role !== "host" || !Array.isArray(message.genreOrder)) return;
        state.partnerPrefs = message.genreOrder;
        tryBuildDeck();
    },

    "deck": (message) => {
        if (state.role !== "guest") return;
        state.session = makeSession(message.deck, message.genreIds);
        showCurrentCard();
    },

    "like": (message) => {
        if (!state.session) return;

        const known = state.session.deck.some(movie => movie.id === message.movieId);
        if (!known) return;

        if (!state.session.partnerLikedIds.includes(message.movieId)) {
            state.session.partnerLikedIds.push(message.movieId);
        }

        if (isMatch(message.movieId)) {
            handleNewMatch(message.movieId);
        }
    },

    "vote": (message) => {
        if (!state.session) return;
        if (!findCard(message.movieId)) return;
        if (message.choice !== "watch" && message.choice !== "no") return;
        if (state.session.partnerVotes[message.movieId] !== undefined) return;

        state.session.partnerVotes[message.movieId] = message.choice;
        updateMatchStatus();
        checkResolution(message.movieId);
    },

    "finished": () => {
        if (!state.session) return;
        state.session.partnerFinished = true;
        if (state.session.iFinished) showEndOfDeck();
        checkBothFinished();
    },

    "more": (message) => {
        if (state.role !== "guest" || !state.session) return;
        if (!Array.isArray(message.cards) || !Array.isArray(message.genreIds)) return;

        const known = new Set(state.session.deck.map(card => card.id));
        const cards = message.cards.filter(card => {
            if (!card || known.has(card.id)) return false;
            known.add(card.id);
            return true;
        });
        addCards(cards, message.genreIds);
    },

    "deck-end": () => {
        if (state.role !== "guest" || !state.session) return;
        state.session.deckEnded = true;
        showEndOfDeck();
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
    if (state.role === null) return;
    const disconnectedRole = state.role;
    state.role = null;

    closeSession();
    resetSessionState();
    const statusId = disconnectedRole === "host" ? "host-status" : "join-status";
    $(statusId).textContent = "Your partner disconnected.";

    $("host-session-button").disabled = false;
    $("join-session-button").disabled = false;
    changePageTo("session-menu");
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
    state.role = "host";

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
    state.role = "guest";
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
    state.mode = "movie";
    showPrefsPage();
});



$("prefs-continue").addEventListener("click", () => {
    savePrefs(state.prefs);
    state.prefsLocked = true;
    refreshGenreButtons();

    if (state.role === "host") {
        state.myPrefsReady = true;
        tryBuildDeck();
    } else if (state.role === "guest") {
        sendMessage({ type: "prefs-ready", genreOrder: state.prefs.movie.genreOrder });
    }

    $("prefs-status").textContent = "Waiting for partner...";
});

$("like-button").addEventListener("click", () => handleChoice(true));
$("skip-button").addEventListener("click", () => handleChoice(false));
$("watch-button").addEventListener("click", () => castVote("watch"));
$("found-skip-button").addEventListener("click", () => castVote("no"));
$("keep-swiping-button").addEventListener("click", continueAfterMatch);
$("retry-button").addEventListener("click", loadMoreCards);

window.addEventListener("beforeunload", closeSession);

playIntro();

window.venn = { changePageTo, renderCard, get session() { return state.session; } }; // temp for testing
