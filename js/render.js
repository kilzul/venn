export const $ = x => document.getElementById(x);

function renderMovieCard(movie) {
    $("movie-title").textContent = movie.title;
    $("year").textContent = movie.year;
    $("movie-cover").src = movie.cover;
    $("desc").textContent = movie.desc;
    $("rt-score").textContent = movie.rtScore;
    $("imdb-score").textContent = movie.imdbScore;
}

function renderYouTubeCard(video) {
    $("yt-title").textContent = video.title;
    $("yt-channel").textContent = video.channel;
    $("yt-cover").src = video.cover;
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