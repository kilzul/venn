const BASE_URL = "https://www.lookmovie2.to/movies";

export function buildWatchUrl(card) {
    const query = encodeURIComponent(card.title);
    return `${BASE_URL}/search/?q=${query}`;
}