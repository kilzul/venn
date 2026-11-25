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
    const code = makeSessionCode();
    peer = new Peer("venn-" + code);
    peer.on("open", (id) => {
        console.log("Hosting session with code:", code);
        callbacks.onCode(code);
    });
    peer.on("error", (err) => {
        if (err.type === "unavailable-id") {
            console.log("Unavailable id, retrying...");
            closeSession();
            hostSession(callbacks);
        }
    });
    peer.on("connection", (incoming) => {
        conn = incoming;
        console.log("Peer connected:", incoming.peer);
        incoming.on("data", (data) => {
            callbacks.onMessage(data);
        });
        incoming.on("close", () => {
            callbacks.onClose();
        });
        callbacks.onPartnerConnected(incoming);
    });
}

export function closeSession() {
    if (conn) {
        conn.close();
        conn = null;
    }
    if (peer) {
        peer.destroy();
        peer = null;
    }
}

export function joinSession(code, callbacks) {
    code = code.trim().toUpperCase();
    let connectionTimeout = null;

    const clearConnectionTimeout = () => {
        if (connectionTimeout !== null) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
        }
    };

    peer = new Peer();
    peer.on("open", () => {
        console.log("Joining session with code:", code);
        const outgoing = peer.connect("venn-" + code);
        conn = outgoing;
        connectionTimeout = setTimeout(() => {
            connectionTimeout = null;
            callbacks.onError?.("Couldn't connect");
        }, 10_000);

        outgoing.on("open", () => {
            clearConnectionTimeout();
            callbacks.onConnected?.();
        });
        outgoing.on("data", (data) => {
            callbacks.onMessage?.(data);
        });
        outgoing.on("close", () => {
            clearConnectionTimeout();
            callbacks.onClose?.();
        });
    });
    peer.on("error", (error) => {
        clearConnectionTimeout();
        console.error("Peer error:", error);
        if (error.type === "peer-unavailable") {
            callbacks.onError?.("That code wasn't found.");
        } else {
            callbacks.onError?.("Couldn't connect. Try again.");
        }
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
