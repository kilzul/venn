import { TMDB_API_KEY } from "../config.js";

// conversion from raw tmdb to movie object data

// title // raw: title // fallback: leave field blank
// year // raw: release_date // change: year.slice(0, 4) // fallback: leave field blank
// cover // raw: poster_path // change: "https://image.tmdb.org/t/p/w500" + poster_path // fallback: placeholder image
// desc // raw: overview // fallback: "No description available."
// score // raw: vote_average // change: Math.round((score * 10) / 10) // fallback: N/A
// id // raw: id // change: "movie-" + id // fallback: leave field blank
    

const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const NO_POSTER = ""; // put a placeholder image path here later
const NO_DESC = "No description available.";

// ask tmdb for movies
export async function fetchMovies(filters) {
    const params = new URLSearchParams({
        api_key: TMDB_API_KEY,
        page: filters.page || 1
    });

    if (filters.genreIds && filters.genreIds.length > 0) {
        params.set("with_genres", filters.genreIds.join(","));
    }
    if (filters.region) {
        params.set("watch_region", filters.region);
    }
    if (filters.type) {
        params.set("with_watch_monetization_types", filters.type);
    }
    if (filters.year) {
        params.set("primary_release_year", filters.year);
    }
    if (filters.rating !== undefined) {
        params.set("vote_average.gte", Math.round(filters.rating * 10) / 10);
    }

    console.log(`${params}`); // for testing, remove later

    const response = await fetch(`https://api.themoviedb.org/3/discover/movie?${params}`);

    if (!response.ok) {
        throw new Error(`TMDB request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.results;
}

// ask TMDB for the genre list
export async function fetchGenreLookup() {
    const params = new URLSearchParams({ api_key: TMDB_API_KEY });

    const response = await fetch(`https://api.themoviedb.org/3/genre/movie/list?${params}`);

    if (!response.ok) {
        throw new Error(`TMDB request failed with status ${response.status}`);
    }

    const data = await response.json(); 
    return data.genres;
}

// helper function to turn ids into genres
function getGenreNames(ids, genreList) {
    const names = [];
    for (const id of (ids || [])) {
        const genre = genreList.find(g => g.id === id);
        if (genre) {
            names.push(genre.name);
        }
    }
    return names;
}

// convert ONE raw movie into card format
export function translateMovie(raw, genreList) {

    let year = ""; // default
    if (raw.release_date) {
        year = raw.release_date.slice(0, 4);
    }

    let cover = NO_POSTER; // default
    if (raw.poster_path) {
        cover = IMAGE_BASE + raw.poster_path;
    }

    let score = "N/A"; // default
    if (raw.vote_count > 0) {
        score = Math.round(raw.vote_average * 10) / 10;
    }

    return {
        id: "movie-" + raw.id,
        tmdbId: raw.id,
        title: raw.title,
        year: year,
        cover: cover,
        desc: raw.overview || NO_DESC,
        genres: getGenreNames(raw.genre_ids, genreList),
        score: score,
        type: "movie"
    };
}