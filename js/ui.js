import * as dom from "./dom.js";

export function logMessage(message, type = "info") {
    const now = new Date();
    const timeString = `[${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}]`;

    const logEntry = document.createElement("div");
    logEntry.className = `log-entry`;
    logEntry.innerHTML = `<span class="log-time">${timeString}</span> <span class="log-${type}">${message}</span>`;

    dom.messageLogEl.appendChild(logEntry);
    dom.messageLogEl.scrollTop = dom.messageLogEl.scrollHeight;

    //     console.log(`${timeString} ${message}`);
}

export function updatePeersList(peers, myId, selectPeerCallback) {
    dom.peersListEl.innerHTML = "";
    const otherPeers = peers.filter((peer) => peer.id !== myId);

    if (otherPeers.length === 0) {
        dom.peersListEl.classList.add("empty-state");
        const message = document.createElement("div");
        message.className = "message";
        message.textContent = "Searching for nearby devices...";
        dom.peersListEl.appendChild(message);
        return;
    }

    dom.peersListEl.classList.remove("empty-state");

    peers.forEach((peer) => {
        if (peer.id !== myId) {
            const peerItem = document.createElement("button");
            peerItem.className = "peer-item";
            peerItem.style.setProperty("--random-x", `${Math.random() * 4 - 2} px`);
            peerItem.style.setProperty("--random-y", `${Math.random() * 4 - 2} px`);

            const peerInfo = document.createElement("div");
            peerInfo.innerHTML = `<div class="peer-name">${peer.name || "Unknown"}</div><div class="peer-id">ID: ${peer.id}</div>`;
            peerItem.onclick = () => selectPeerCallback(peer);
            peerItem.appendChild(peerInfo);
            dom.peersListEl.appendChild(peerItem);
        }
    });
}

export function updateWsStatus(connected) {
    if (!connected) {
        dom.notify.classList.remove("hidden");
    } else {
        dom.notify.classList.add("hidden");
    }

    const txt = connected ? "Connected" : "Disconnected";
    const cls = connected ? "connected" : "disconnected";

    const el = document.getElementById("ws-status");
    el.textContent = txt;
    el.className = `status-value ${cls}`;

    const elM = document.getElementById("ws-status-m");
    elM.textContent = connected ? "●" : "●";
    elM.className = `status-value ${cls}`;
}

export function updateDcStatus(open) {
    const txt = open ? "Connected" : "Disconnected";
    const cls = open ? "connected" : "disconnected";

    const el = document.getElementById("dc-status");
    el.textContent = txt;
    el.className = `status-value ${cls} `;

    const elM = document.getElementById("dc-status-m");
    elM.textContent = cls ? "●" : "●";
    elM.className = `status-value ${cls} `;

    dom.messageInput.disabled = !open;
    dom.sendBtn.disabled = !open;
    dom.connectBtn.disabled = open;
}
