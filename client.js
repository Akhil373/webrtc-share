const myIdEl = document.getElementById("my-id");
const selectedPeerEl = document.getElementById("selected-peer");
const peersListEl = document.getElementById("peers-list");
const connectBtn = document.getElementById("call-btn");
const messageLogEl = document.getElementById("message-log");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const fileInput = document.getElementById("fileShare");
const fileShareBtn = document.getElementById("send-file-btn");
const nameEl = document.getElementById("my-name");
const fileProg = document.getElementById("file-progress");
const notify = document.getElementById("notify");
const createBtn = document.getElementById("create-btn");
const joinBtn = document.getElementById("join-btn");

let ROOM_ID = null;
let pendingRoom = null;

function logMessage(message, type = "info") {
    const now = new Date();
    const timeString = `[${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}]`;

    const logEntry = document.createElement("div");
    logEntry.className = `log-entry`;
    logEntry.innerHTML = `<span class="log-time">${timeString}</span> <span class="log-${type}">${message}</span>`;

    messageLogEl.appendChild(logEntry);
    messageLogEl.scrollTop = messageLogEl.scrollHeight;

    //     console.log(`${timeString} ${message}`);
}

function updatePeersList(peers) {
    peersListEl.innerHTML = "";
    const otherPeers = peers.filter((peer) => peer.id !== myId);

    if (otherPeers.length === 0) {
        peersListEl.classList.add("empty-state");
        const message = document.createElement("div");
        message.className = "message";
        message.textContent = "Searching for nearby devices...";
        peersListEl.appendChild(message);
        return;
    }

    peersListEl.classList.remove("empty-state");

    peers.forEach((peer) => {
        if (peer.id !== myId) {
            const peerItem = document.createElement("button");
            peerItem.className = "peer-item";
            peerItem.style.setProperty("--random-x", `${Math.random() * 4 - 2}px`);
            peerItem.style.setProperty("--random-y", `${Math.random() * 4 - 2}px`);

            const peerInfo = document.createElement("div");
            peerInfo.innerHTML = `<div class="peer-name">${peer.name || "Unknown"}</div><div class="peer-id">ID: ${peer.id}</div>`;
            peerItem.onclick = () => selectPeer(peer);
            peerItem.appendChild(peerInfo);
            peersListEl.appendChild(peerItem);
        }
    });
}

function selectPeer(peer) {
    targetId = peer.id;
    selectedPeerEl.textContent = `${peer.name} (${peer.id})`;
    connectBtn.disabled = false;

    const peerItems = peersListEl.querySelectorAll(".peer-item");
    peerItems.forEach((item) => {
        item.classList.remove("selected");
        const btn = item.querySelector(".select-btn");
        if (btn) btn.textContent = "Select";
    });

    for (let item of peerItems) {
        const idDiv = item.querySelector(".peer-id");
        if (idDiv && idDiv.textContent.includes(peer.id)) {
            item.classList.add("selected");
            const btn = item.querySelector(".select-btn");
            if (btn) {
                btn.textContent = "Selected";
                btn.classList.add("selected");
            }
            break;
        }
    }

    //     console.log(`Selected peer: ${peer.name} (${peer.id})`, "info");
}

function updateWsStatus(connected) {
    if (!connected) {
        notify.style.display = "block";
    } else {
        notify.style.display = "none";
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

function updateDcStatus(open) {
    const txt = open ? "Connected" : "Disconnected";
    const cls = open ? "connected" : "disconnected";

    const el = document.getElementById("dc-status");
    el.textContent = txt;
    el.className = `status-value ${cls}`;

    const elM = document.getElementById("dc-status-m");
    elM.textContent = cls ? "●" : "●";
    elM.className = `status-value ${cls}`;

    messageInput.disabled = !open;
    sendBtn.disabled = !open;
    connectBtn.disabled = open;
}

function sendDataChannelMessage() {
    const message = messageInput.value.trim();
    if (!message || !dc || dc.readyState !== "open") return;
    dc.send(message);
    logMessage(`You: ${message}`, "info");
    messageInput.value = "";
}

createBtn.addEventListener("click", () => {
    ROOM_ID = crypto.randomUUID().substring(0, 8);

    if (ws && ws.readyState === WebSocket.OPEN) {
        sendWsMessage({ type: "join-room", roomId: ROOM_ID });
    }
});

joinBtn.addEventListener("click", () => {
    const ROOM_CODE = document.getElementById("roomCode").value.trim();
    if (!ROOM_CODE || ROOM_CODE.length !== 8) {
        alert("Enter a room code");
        return;
    }
    ROOM_ID = ROOM_CODE;
    if (ws && ws.readyState === WebSocket.OPEN) {
        sendWsMessage({ type: "join-room", roomId: ROOM_ID });
    } else {
        pendingRoom = ROOM_ID;
    }
});

connectBtn.addEventListener("click", () => {
    if (targetId) {
        makeCall();
    }
});

sendBtn.addEventListener("click", sendDataChannelMessage);

messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendDataChannelMessage();
    }
});

fileInput.addEventListener("change", (e) => {
    const files = e.target.files;
    const fileNames = Array.from(files)
        .map((f) => f.name)
        .join(", ");
    document.getElementById("file-input-label").textContent = files.length
        ? `📁 ${fileNames}`
        : "";
});

fileShareBtn.addEventListener("click", sendFiles);

// const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const config = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
    ],
    iceCandidatePoolSize: 2,
};
const pc = new RTCPeerConnection(config);
let dc;
let myId = null;
let targetId = null;
let peerList = [];
let fileMetadata = null;
let ws = null;
let reconnectTimeout = null;
let isManuallyClosed = false;

function getUserDetails() {
    const userAgent = navigator.userAgent;
    let OSName = "Unknown OS";
    let browserName = "Unknown Browser";

    if (userAgent.indexOf("Win") !== -1) OSName = "Windows";
    else if (userAgent.indexOf("Mac") !== -1) OSName = "MacOS";
    else if (userAgent.indexOf("Linux") || userAgent.indexOf("X11") !== -1)
        OSName = "Linux";
    else if (userAgent.indexOf("Android") !== -1) OSName = "Android";
    else if (userAgent.indexOf("iOS") !== -1) OSName = "iOS";

    if (userAgent.indexOf("Chrome") !== -1 && userAgent.indexOf("Edge") === -1)
        browserName = "Chrome";
    else if (userAgent.indexOf("Firefox") !== -1) browserName = "Firefox";
    else if (
        userAgent.indexOf("Safari") !== -1 &&
        userAgent.indexOf("Chrome") === -1
    )
        browserName = "Safari";
    else if (userAgent.indexOf("Edge") !== -1) browserName = "Edge";
    else if (
        userAgent.indexOf("MSIE") !== -1 ||
        userAgent.indexOf("Trident") !== -1
    )
        browserName = "Internet Explorer";
    else if (userAgent.indexOf("Opera") !== -1 || userAgent.indexOf("OPR") !== -1)
        browserName = "Opera";

    return [OSName, browserName];
}

pc.oniceconnectionstatechange = () => {
    //     console.log(`ICE connection state: ${pc.iceConnectionState}`, "info");

    if (
        pc.iceConnectionState === "failed" ||
        pc.iceConnectionState === "disconnected"
    ) {
        logMessage("Connection failed. Try refreshing and reconnecting.", "error");
    } else if (pc.iceConnectionState === "connected") {
        logMessage("Peer-to-peer connection established!", "info");
    }
};

pc.onconnectionstatechange = () => {
    //     console.log(`Connection state: ${pc.connectionState}`, "info");
};

updateWsStatus(false);

function connectWebsocket() {
    if (isManuallyClosed) return;

    ws = new WebSocket("wss://webrtc-share.onrender.com");

    ws.onopen = () => {
        updateWsStatus(true);

        const [osName, browser] = getUserDetails();
        const myName = `${browser}@${osName}`;
        nameEl.textContent = myName;
        sendWsMessage({
            type: "register",
            name: myName,
        });
        if (ROOM_ID) sendWsMessage({ type: "join-room", roomId: ROOM_ID });
        if (pendingRoom) {
            sendWsMessage({ type: "join-room", roomId: pendingRoom });
            pendingRoom = null;
        }
    };

    ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        if (message.yourID) {
            myId = message.yourID;
            myIdEl.textContent = myId;
            return;
        }

        if (message.from === myId) return;
        else if (message.type === "joined") {
            document.getElementById("join-room").style.display = "none";
            document.getElementById("main-ui").style.display = "block";
            notify.textContent = `Joined room-ID: ${message.roomId}`;
            notify.style.display = "block";
            setTimeout(() => {
                notify.style.display = "none";
            }, 3000);
        } else if (message.type == "clientsList") {
            peerList = message.content || [];
            updatePeersList(peerList);
            console.log(peerList);
        } else if (message.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(message));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendWsMessage({
                type: "answer",
                sdp: answer.sdp,
                from: myId,
                to: message.from,
                roomId: message.roomId,
            });
        } else if (message.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(message));
        } else if (message.type === "ice-candidate") {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
    };

    ws.onclose = () => {
        console.log("WebSocket connection closed!", "warning");
        if (!isManuallyClosed) {
            scheduleReconnect();
        }
    };

    ws.onerror = (err) => {
        console.log(`WebSocket error: ${JSON.stringify(err)}`, "error");
    };
}

connectWebsocket();

function scheduleReconnect(delay = 2000) {
    reconnectTimeout = setTimeout(() => {
        connectWebsocket();
    }, delay);
}

function closeWebSocket() {
    isManuallyClosed = true;
    if (ws) ws.close();
    clearTimeout(reconnectTimeout);
}

function sendWsMessage(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.log("Error sending message to WebSocket server", "error");
    }
}

pc.onicecandidate = (event) => {
    if (event.candidate) {
        if (event.candidate.candidate.includes(".local")) {
            //             console.log("Skipping .local candidate", "info");
            return;
        }

        sendWsMessage({
            type: "ice-candidate",
            candidate: event.candidate,
            from: myId,
            to: targetId,
            roomId: ROOM_ID,
        });
        //         console.log(`Sent ICE candidate to peer ${targetId}`, "info");
    }
};

function attachDcHandler(channel) {
    let pendingBuffer = [];
    let receivedfileMetadata = null;
    let receivedBytes = 0;

    channel.onopen = () => {
        updateDcStatus(true);
        //         console.log("Data Channel is active");
    };

    channel.onmessage = (event) => {
        const data = event.data;

        if (typeof data === "string") {
            try {
                const msg = JSON.parse(data);

                if (msg.type === "fileMeta") {
                    receivedfileMetadata = {
                        fileName: msg.fileName,
                        fileType: msg.fileType,
                        fileSize: msg.fileSize,
                    };
                    pendingBuffer = new Uint8Array(msg.fileSize);
                }
            } catch (err) {
                logMessage("Peer: " + event.data);
            }
            return;
        }

        if (data instanceof ArrayBuffer) {
            if (!receivedfileMetadata || !pendingBuffer) {
                console.warn("Got file blob before metadata, buffering...");
                return;
            }

            const chunk = new Uint8Array(data);
            pendingBuffer.set(chunk, receivedBytes);
            receivedBytes += chunk.byteLength;
            if (fileProg) {
                const percent = Math.min(
                    100,
                    (receivedBytes / receivedfileMetadata.fileSize) * 100,
                );
                fileProg.textContent = `Receiving: ${percent.toFixed(1)}%`;
            }
            if (receivedBytes >= receivedfileMetadata.fileSize) {
                if (fileProg) {
                    fileProg.textContent = "finalizing file...";
                }
                setTimeout(() => {
                    processReceivedFile();
                }, 0);
            }
            return;
        }

        logMessage("Peer: " + event.data);
    };

    channel.onerror = (err) => {
        updateDcStatus(false);
        console.log("Data channel error: " + err, "warning");
    };

    function processReceivedFile() {
        const blob = new Blob([pendingBuffer], {
            type: receivedfileMetadata.fileType,
        });
        if (fileProg) {
            fileProg.textContent = "File received!";
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = receivedfileMetadata.fileName;

        const panel = document.getElementById("side-panel");
        if (panel) {
            panel.appendChild(a);
            logMessage(`File ready: ${receivedfileMetadata.fileName}`, "info");
        } else {
            document.body.appendChild(a);
            logMessage(
                `File ready: ${receivedfileMetadata.fileName} (added to body)`,
                "warning",
            );
        }
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        receivedfileMetadata = null;
        pendingBuffer = [];
        receivedBytes = 0;
    }
}

pc.ondatachannel = (event) => {
    //     console.log("Received data channel");
    dc = event.channel;
    dc.binaryType = "arraybuffer";
    attachDcHandler(dc);
};

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file.size > 1 * 1024 * 1024 * 1024) {
        notify.textContent = `Caution: Sending large files will use significant memory on the receiver's device.`;
        notify.style.display = "block";
        setTimeout(() => {
            notify.style.display = "none";
        }, 10_000);
    }
});

async function sendFiles() {
    const file = fileInput.files[0];

    const chunkSize = 64 * 1024;
    let offset = 0;

    if (!file) {
        logMessage("Please select a file!");
    }

    fileMetadata = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
    };
    const metadata = {
        type: "fileMeta",
        ...fileMetadata,
        from: myId,
        to: targetId,
    };
    dc.send(JSON.stringify(metadata));

    let progress = 0;
    while (offset < file.size) {
        const end = Math.min(offset + chunkSize, file.size);
        const chunk = file.slice(offset, end);
        const arrayBuf = await chunk.arrayBuffer();
        dc.send(arrayBuf);

        offset = end;

        const progress = (offset / file.size) * 100;
        fileProg.textContent =
            offset === file.size ? "File Sent!" : `Progress: ${progress.toFixed(1)}%`;
    }

    logMessage(`Sent file: ${file.name}`);
    fileMetadata = null;
}

async function makeCall() {
    try {
        if (!dc) {
            dc = pc.createDataChannel("data channel");
            dc.binaryType = "arraybuffer";
            attachDcHandler(dc);
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWsMessage({
            type: "offer",
            sdp: offer.sdp,
            from: myId,
            to: targetId,
            roomId: ROOM_ID,
        });
    } catch (err) {
        console.log(`Error creating connection: ${err}`, "error");
    }
}
