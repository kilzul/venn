export const $ = x => document.getElementById(x);

function renderMovieCard(movie) {
    $("movie-title").textContent = movie.title;

    $("year").textContent = movie.year;

    const cover = $("movie-cover");
    cover.src = movie.cover;
    cover.hidden = !movie.cover;

    $("desc").textContent = movie.desc;

    const genres = $("genres");
    genres.innerHTML = "";
    for (const name of movie.genres) {
        const pill = document.createElement("span");
        pill.classList.add("genre-pill");
        pill.textContent = name;
        genres.appendChild(pill);
    }

    $("score").textContent = movie.score;
}

function renderYouTubeCard(video) {
    $("yt-title").textContent = video.title;

    $("yt-channel").textContent = video.channel;

    $("yt-cover").src = video.cover;
    $("yt-cover").hidden = !video.cover;

    $("yt-views-count").textContent = video.views;
}

export function renderCard(card) {
    if (card.type !== "video") {
        $("movie-tv-card").hidden = false;
        $("youtube-card").hidden = true;
        renderMovieCard(card);
    } else {
        $("movie-tv-card").hidden = true;
        $("youtube-card").hidden = false;
        renderYouTubeCard(card);
    }
}