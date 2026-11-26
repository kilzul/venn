
export const MAX_PICKS = 5;

export function getScore(order, genreId) {
    const position = order.indexOf(genreId);
    if (position === -1) return 0;
    return MAX_PICKS - position;
}

export function combinePrefs(hostOrder, guestOrder) {
    // default cases
    if (hostOrder.length == 0 && guestOrder.length == 0) {
        return [];
    }
    if (hostOrder.length == 0) {
        return guestOrder;
    }
    if (guestOrder.length == 0) {
        return hostOrder;
    }
    if (hostOrder === guestOrder) {
        return hostOrder;
    }

    const genres = hostOrder.filter(genreId => guestOrder.includes(genreId));

    // default if no common genres 
    if (genres.length === 0) {
        const combinedWithScores = [...hostOrder, ...guestOrder].map(genreId => ({
            genreId: genreId,
            score: getScore(hostOrder, genreId) + getScore(guestOrder, genreId)
        }));
        combinedWithScores.sort((a, b) => b.score - a.score);
        return combinedWithScores.map(item => item.genreId);
    }

    const genresWithScores = genres.map(genreId => ({
        genreId: genreId,
        score: getScore(hostOrder, genreId) + getScore(guestOrder, genreId)
    }));

    genresWithScores.sort((a, b) => b.score - a.score);

    return genresWithScores.map(item => item.genreId);

}