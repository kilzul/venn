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

export function showConfetti() {
    if (prefersReducedMotion) return;

    const container = document.getElementById("confetti-container");
    const cover = document.getElementById("celebration-cover");
    if (!container || !cover) return;

    const containerBounds = container.getBoundingClientRect();
    const coverBounds = cover.getBoundingClientRect();
    const coverLeft = coverBounds.left - containerBounds.left;
    const coverTop = coverBounds.top - containerBounds.top;
    const coverRight = coverBounds.right - containerBounds.left;
    const coverBottom = coverBounds.bottom - containerBounds.top;

    for (let i = 0; i < 45; i++) {
        const confetti = document.createElement("span");
        confetti.classList.add("confetti");
        const side = Math.floor(Math.random() * 4);
        const along = Math.random();
        let startX;
        let startY;
        let x;
        let y;

        if (side === 0) {
            startX = coverLeft + along * coverBounds.width;
            startY = coverTop - 8;
            x = Math.random() * 80 - 40;
            y = -(40 + Math.random() * 60);
        } else if (side === 1) {
            startX = coverRight + 4;
            startY = coverTop + along * coverBounds.height;
            x = 40 + Math.random() * 60;
            y = Math.random() * 80 - 40;
        } else if (side === 2) {
            startX = coverLeft + along * coverBounds.width;
            startY = coverBottom + 4;
            x = Math.random() * 80 - 40;
            y = 40 + Math.random() * 60;
        } else {
            startX = coverLeft - 8;
            startY = coverTop + along * coverBounds.height;
            x = -(40 + Math.random() * 60);
            y = Math.random() * 80 - 40;
        }

        confetti.style.setProperty("--start-x", `${startX}px`);
        confetti.style.setProperty("--start-y", `${startY}px`);
        confetti.style.setProperty("--x", `${x}px`);
        confetti.style.setProperty("--y", `${y}px`);
        confetti.style.setProperty("--r", `${Math.random() * 160 - 90}deg`);
        confetti.style.setProperty("--d", `${0.6 + Math.random() * 0.6}s`);
        confetti.style.setProperty(
            "--confetti-color",
            `hsl(${Math.floor(Math.random() * 360)}, 85%, 60%)`
        );
        confetti.onanimationend = () => confetti.remove();
        container.appendChild(confetti);
    }
}