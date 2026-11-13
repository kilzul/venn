

const session = {
    mode: "movies",
    deck: sampleMovies,
    index: 0,
    seenIds: [],
    likedIds: []
};

function showCurrentCard() {
    const movie = session.deck[session.index];

    if (movie === undefined) {
        showDeckEmpty();
        return;
    }

    renderCard(movie);
}

function handleChoice(liked) {
    const movie = session.deck[session.index];
    if (!movie) return;

    session.seenIds.push(movie.id);
    if (liked) {
        session.likedIds.push(movie.id);
    }

    session.index = session.index + 1;
    showCurrentCard();
}

$("like-button").addEventListener("click", () => handleChoice(true));
$("skip-button").addEventListener("click", () => handleChoice(false));

showCurrentCard();

function showDeckEmpty() {
    $("movie-title").textContent = "No more cards!";
    $("year").textContent = "";
    $("desc").textContent = "";
    $("rt-score").textContent = "";
    $("imdb-score").textContent = "";
    $("movie-cover").hidden = true;
    $("like-button").hidden = true;
    $("skip-button").hidden = true;
}