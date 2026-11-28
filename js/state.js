import { loadPrefs } from "./storage.js";

export const state = {
    role: null,
    session: null,
    mode: "movie", // placeholder, will change later
    partnerPrefs: null,
    myPrefsReady: false,
    prefs: loadPrefs(),
    prefsLocked: false,
    genreList: null,
    swiping: false
};

export const movieFilters = {
    region: "CA",
    type: "free",
    page: 1
};

export function makeSession(deck, genreIds) {
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
        iFinished: false,
        partnerFinished: false,
        deckEnded: false,
        fetching: false,
        page: 1,
        matchesThisBatch: 0,
        myVotes: {},
        partnerVotes: {},
        resolvedIds: [],
        pendingMatches: []
    };
}

export function resetSessionState() {
    state.partnerPrefs = null;
    state.myPrefsReady = false;
    state.prefsLocked = false;
    state.session = null;
}

export function findCard(id) {
    return state.session.deck.find(card => card.id === id);
}

export function isMatch(id) {
    return state.session.likedIds.includes(id)
        && state.session.partnerLikedIds.includes(id)
        && !state.session.matchedIds.includes(id);
}