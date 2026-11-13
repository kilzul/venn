import { TMDB_API_KEY } from '../config.js';

export async function fetchMovies(filters) {
    const params = new URLSearchParams({
        api_key: TMDB_API_KEY,
        with_genres: filters.genreIds.join(","),
        watch_region: filters.region,
        page: filters.page
    });

    if (filters.type) {
        params.set("with_watch_monetization_types", filters.type);
    }

    if (filters.desc) {
        params.set("overview", filters.desc);
    }

    if (filters.year) {
        params.set("primary_release_year", filters.year);
    }

    if (filters.title) {
        params.set("title", filters.title);
    }

    if (filters.rating) {
        params.set("vote_average.gte", (filters.rating * 10) / 10);
    }




    console.log(`${params}`); // for testing purposes, will likely remove later

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