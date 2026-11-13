export const $ = x => document.getElementById(x);

function renderMovieCard(movie) {
    $("movie-title").textContent = movie.title; // raw: title // fallback: leave field blank
    $("year").textContent = movie.year; // raw: release_date // change: year.slice(0, 4) // fallback: leave field blank
    $("movie-cover").src = movie.cover; // raw: poster_path // change: "https://image.tmdb.org/t/p/w500" + poster_path // fallback: placeholder image
    $("desc").textContent = movie.desc; // raw: overview // fallback: "No description available."
    $("score").textContent = movie.score; // raw: vote_average // change: Math.round((score * 10) / 10) // fallback: N/A

    movie.id = "movie-" + movie.id; // raw: id // change: "movie-" + id // fallback: leave field blank
    
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