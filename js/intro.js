const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// splits the word into one span per letter, all invisible, plus a cursor
function prepareTitle(element) {
    const text = element.textContent;
    element.setAttribute("aria-label", text);
    element.textContent = "";

    const cursor = document.createElement("span");
    cursor.classList.add("cursor");
    cursor.setAttribute("aria-hidden", "true");

    const letters = [...text].map((char) => {
        const span = document.createElement("span");
        span.classList.add("letter");
        span.setAttribute("aria-hidden", "true");
        span.textContent = char;
        return span;
    });

    element.append(cursor, ...letters);
    return { letters, cursor };
}

// shows the letters one at a time, moving the cursor along
async function revealLetters(letters, cursor, { startDelay = 300, delay = 130, jitter = 70 } = {}) {
    await wait(startDelay);

    for (const letter of letters) {
        letter.classList.add("visible");
        letter.after(cursor);
        await wait(delay + Math.random() * jitter);
    }
}

export async function playIntro() {
    const title = document.querySelector("#title-page h2");
    const rest = document.querySelectorAll("#title-page > :not(h2)");

    if (!title || prefersReducedMotion) return;

    rest.forEach((element) => element.classList.add("title-rest", "intro-hidden"));
    const { letters, cursor } = prepareTitle(title);

    try {
        await document.fonts.load('1em "VennFont"');
        await revealLetters(letters, cursor);
        await wait(250);
    } catch (error) {
        console.error("Intro failed:", error);
        letters.forEach((letter) => letter.classList.add("visible"));
    } finally {
        rest.forEach((element) => element.classList.remove("intro-hidden"));
        setTimeout(() => cursor.remove(), 1500);
    }
}