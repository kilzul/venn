import { TMDB_API_KEY } from '../config.js';

async function fetchMovies(filters) {
    const params = new URLSearchParams({
        api_key: TMDB_API_KEY,
        with_genres: filters.genreIds.join(","),
        watch_region: filters.region,
        page: filters.page
    });

    const response = await fetch(`https://api.themoviedb.org/3/discover/movie?${params}`);

    if (!response.ok) {
        throw new Error(`TMDB request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.results;
}

async function start() {
    try {
        const rawMovies = await fetchMovies({ genreIds: [28, 35], region: "CA", page: 1 });
        console.log(rawMovies);
    } catch (error) {
        console.error(error);
    }
}

start();