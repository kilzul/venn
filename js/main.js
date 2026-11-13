import { $, renderCard } from "./render.js";
import { fetchMovies, fetchGenreLookup, translateMovie } from "./api.js";

const filters = {
    genreIds: [28, 35], // Action, Comedy
    region: "CA",
    type: "free",
    page: 1
};

 
let session = null;

async function createSession(filters, genreList) {
    const rawMovies = await fetchMovies(filters);
    const deck = rawMovies.map(raw => translateMovie(raw, genreList));
    return {
        mode: "movies",
        filters: filters,
        deck: deck,
        index: 0,
        seenIds: [],
        likedIds: []
    };
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
    $("movie-title").textContent = "No more cards!";
    $("year").textContent = "";
    $("desc").textContent = "";
    $("imdb-score").textContent = "";
    $("movie-cover").hidden = true;
    $("like-button").hidden = true;
    $("skip-button").hidden = true;
}

async function start() {
    $("loading-screen").hidden = false;
    try {
        const genreList = await fetchGenreLookup();
        session = await createSession(filters, genreList);
        console.log("deck size:", session.deck.length);
        showCurrentCard();
    } catch (error) {
        console.error(error);
        $("movie-title").textContent = "Couldn't load movies.";
    } finally {
        $("loading-screen").hidden = true;
    }
}

$("like-button").addEventListener("click", () => handleChoice(true));
$("skip-button").addEventListener("click", () => handleChoice(false));

start();
