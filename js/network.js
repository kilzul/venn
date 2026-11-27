let peer = null;
let conn = null;

function makeSessionCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        code += characters[randomIndex];
    }
    return code;
}

export function hostSession(callbacks) {
    closeSession();

    const code = makeSessionCode();
    const currentPeer = new Peer("venn-" + code);
    peer = currentPeer;

    currentPeer.on("open", () => {
        if (peer !== currentPeer) return;
        callbacks.onCode(code);
    });
    currentPeer.on("error", (err) => {
        if (peer !== currentPeer) return;
        console.error("Peer error:", err);

        if (err.type === "unavailable-id") {
            console.warn("Unavailable session code, retrying...");
            closeSession();
            hostSession(callbacks);
            return;
        }

        closeSession();
        callbacks.onError?.("Couldn't host session. Try again.");
    });
    currentPeer.on("connection", (incoming) => {
        if (peer !== currentPeer) {
            incoming.close();
            return;
        }
        if (conn) {
            incoming.close();
            return;
        }

        conn = incoming;
        incoming.on("data", (data) => {
            if (conn === incoming) {
                callbacks.onMessage(data);
            }
        });
        incoming.on("close", () => {
            if (conn !== incoming) return;
            conn = null;
            callbacks.onClose();
        });
        callbacks.onPartnerConnected(incoming);
    });
}

export function closeSession() {
    const currentConn = conn;
    const currentPeer = peer;
    conn = null;
    peer = null;

    currentConn?.close();
    currentPeer?.destroy();
}

export function joinSession(code, callbacks) {
    closeSession();
    code = code.trim().toUpperCase();
    let connectionTimeout = null;

    const clearConnectionTimeout = () => {
        if (connectionTimeout !== null) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
        }
    };

    const currentPeer = new Peer();
    peer = currentPeer;
    currentPeer.on("open", () => {
        if (peer !== currentPeer) return;
        const outgoing = currentPeer.connect("venn-" + code);
        conn = outgoing;
        connectionTimeout = setTimeout(() => {
            connectionTimeout = null;
            closeSession();
            callbacks.onError?.("Couldn't connect");
        }, 10_000);

        outgoing.on("open", () => {
            if (conn !== outgoing) {
                outgoing.close();
                return;
            }
            clearConnectionTimeout();
            callbacks.onConnected?.();
        });
        outgoing.on("data", (data) => {
            if (conn === outgoing) {
                callbacks.onMessage?.(data);
            }
        });
        outgoing.on("close", () => {
            if (conn !== outgoing) return;
            clearConnectionTimeout();
            conn = null;
            callbacks.onClose?.();
        });
    });
    currentPeer.on("error", (error) => {
        if (peer !== currentPeer) return;
        clearConnectionTimeout();
        console.error("Peer error:", error);
        const message = error.type === "peer-unavailable"
            ? "That code wasn't found."
            : "Couldn't connect. Try again.";
        closeSession();
        callbacks.onError?.(message);
    });
}

export function sendMessage(message) {
    if (!conn) {
        console.error("No active connection to send message.");
        return;
    } else {
        conn.send(message);
    }
}
