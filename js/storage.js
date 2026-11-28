const STORAGE_KEY = "venn-prefs";  // the one localStorage key for all prefs

function defaultPrefs() {
    return { movie: { genreOrder: [] }, yt: {} };
}

// saving and loading prefs from localstorage

export function loadPrefs() {
    const defaults = defaultPrefs();

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                movie: { genreOrder: parsed.movie?.genreOrder ?? defaults.movie.genreOrder },
                yt: parsed.yt ?? defaults.yt
            };
        }
    } catch (error) {
        console.error("Couldn't read saved preferences:", error);
    }
    return defaults;
}

export function savePrefs(prefs) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
        console.error("Couldn't save preferences:", error);
    }
}