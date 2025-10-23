const wsStatusEl = document.getElementById("ws-status");
const myIdEl = document.getElementById("my-id");
const dcStatusEl = document.getElementById("dc-status");
const selectedPeerEl = document.getElementById("selected-peer");
const peersListEl = document.getElementById("peers-list");
const callBtn = document.getElementById("call-btn");
const messageLogEl = document.getElementById("message-log");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const fileInput = document.getElementById("fileShare");
const fileShareBtn = document.getElementById("send-file-btn");
const nameEl = document.getElementById("my-name");
const fileProg = document.getElementById("file-progress");

function logMessage(message, type = "info") {
    const now = new Date();
    const timeString = `[${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}]`;

    const logEntry = document.createElement("div");
    logEntry.className = `log-entry`;
    logEntry.innerHTML = `<span class="log-time">${timeString}</span> <span class="log-${type}">${message}</span>`;

    messageLogEl.appendChild(logEntry);
    messageLogEl.scrollTop = messageLogEl.scrollHeight;

    console.log(`${timeString} ${message}`);
}

function updatePeersList(peers) {
    peersListEl.innerHTML = "";
    const otherPeers = peers.filter((peer) => peer.id !== myId);

    if (otherPeers.length === 0) {
        peersListEl.className = "peers-list empty-state";
        const message = document.createElement("div");
        message.className = "message";
        message.textContent = "Searching for nearby devices...";
        peersListEl.appendChild(message);
        return;
    }

    peersListEl.className = "peers-list";

    peers.forEach((peer) => {
        if (peer.id !== myId) {
            const peerItem = document.createElement("button");
            peerItem.className = "peer-item";

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
    callBtn.disabled = false;

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

    console.log(`Selected peer: ${peer.name} (${peer.id})`, "info");
}

function updateWsStatus(connected) {
    wsStatusEl.textContent = connected ? "Connected" : "Disconnected";
    wsStatusEl.className = `status-value ${connected ? "connected" : "disconnected"}`;
}

function updateDcStatus(open) {
    dcStatusEl.textContent = open ? "Open" : "Closed";
    dcStatusEl.className = `status-value ${open ? "connected" : "disconnected"}`;

    messageInput.disabled = !open;
    sendBtn.disabled = !open;
}

function sendDataChannelMessage() {
    const message = messageInput.value.trim();
    if (!message || !dc || dc.readyState !== "open") return;
    dc.send(message);
    logMessage(`You: ${message}`, "info");
    messageInput.value = "";
}

callBtn.addEventListener("click", () => {
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
    console.log(`ICE connection state: ${pc.iceConnectionState}`, "info");

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
    console.log(`Connection state: ${pc.connectionState}`, "info");
};

let ws = null;
let reconnectTimeout = null;
let isManuallyClosed = false;

function connectWebsocket() {
    if (isManuallyClosed) return;

    ws = new WebSocket("wss://webrtc-share.onrender.com");

    ws.onopen = () => {
        updateWsStatus(true);
        console.log("WebSocket connected!", "info");

        const [osName, browser] = getUserDetails();
        const myName = `${browser}@${osName}`;
        nameEl.textContent = myName;
        sendMessage({
            type: "register",
            name: myName,
        });
    };

    ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        console.log(`Received: ${JSON.stringify(message)}`, "info");
        if (message.yourID) {
            myId = message.yourID;
            myIdEl.textContent = myId;
            console.log(`Registered with ID: ${myId}`, "info");
            return;
        }

        if (message.type == "clientsList") {
            peerList = message.content || [];
            updatePeersList(peerList);
            console.log(`Updated peer list with ${peerList.length} peers`, "info");
        } else if (message.from === myId) {
            console.log("Ignoring messages from myself.");
            return;
        } else if (message.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(message));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendMessage({
                type: "answer",
                sdp: answer.sdp,
                from: myId,
                to: message.from,
            });
            console.log(`Sent answer to peer ${message.from}`, "info");
        } else if (message.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(message));
            console.log(`Received and set answer from peer ${message.from}`, "info");
        } else if (message.type === "ice-candidate") {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
            console.log(`Added ICE candidate from peer ${message.from}`, "info");
        }
    };

    ws.onclose = () => {
        updateWsStatus(false);
        console.log("WebSocket connection closed!", "warning");
        if (!isManuallyClosed) {
            scheduleReconnect();
        }
    };

    ws.onerror = (err) => {
        console.log(`WebSocket error: ${JSON.stringify(err)}`, "error");
    };
}

function scheduleReconnect(delay = 2000) {
    console.log(`Reconnecting in ${delay}ms`);
    reconnectTimeout = setTimeout(() => {
        connectWebsocket();
    }, delay);
}

connectWebsocket();

function closeWebSocket() {
    isManuallyClosed = true;
    if (ws) ws.close();
    clearTimeout(reconnectTimeout);
}

function sendMessage(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        console.log(`Sent: ${JSON.stringify(message)}`, "info");
    } else {
        console.log("Error sending message to WebSocket server", "error");
    }
}

pc.onicecandidate = (event) => {
    if (event.candidate) {
        if (event.candidate.candidate.includes(".local")) {
            console.log("Skipping .local candidate", "info");
            return;
        }

        sendMessage({
            type: "ice-candidate",
            candidate: event.candidate,
            from: myId,
            to: targetId,
        });
        console.log(`Sent ICE candidate to peer ${targetId}`, "info");
    }
};

function attachDcHandler(channel) {
    let pendingBlob = [];
    let receivedfileMetadata = null;
    let receivedBytes = 0;

    channel.onopen = () => {
        updateDcStatus(true);
        console.log("Data Channel is active");
    };

    channel.onmessage = (event) => {
        const data = event.data;
        if (data instanceof Blob || data instanceof ArrayBuffer) {
            if (!receivedfileMetadata) {
                console.warn("Got file blob before metadata, buffering...");
                pendingBlob.push(data);
                return;
            }

            pendingBlob.push(data);
            receivedBytes += data.size || data.byteLength;
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

        try {
            const msg = JSON.parse(data);

            if (msg.type === "fileMeta") {
                receivedfileMetadata = {
                    fileName: msg.fileName,
                    fileType: msg.fileType,
                    fileSize: msg.fileSize,
                };
                console.log("Metadata received:", receivedfileMetadata);

                if (pendingBlob.length > 0) {
                    receivedBytes = pendingBlob.reduce(
                        (total, chunk) => total + (chunk.size || chunk.byteLength),
                        0,
                    );
                    if (receivedBytes >= receivedfileMetadata.fileSize) {
                        processReceivedFile();
                    }
                }
            }
        } catch (e) {
            // logMessage("Error parsing message" + e);
        }
        logMessage("Peer: " + event.data);
    };

    channel.onerror = (err) => {
        updateDcStatus(false);
        console.log("Data channel error: " + err, "warning");
    };

    function processReceivedFile() {
        const blob = new Blob(pendingBlob, {
            type: receivedfileMetadata.fileType,
        });
        const url = URL.createObjectURL(blob);
        if (fileProg) {
            fileProg.textContent = "File received!";
        }
        const a = document.createElement("a");
        a.href = url;
        a.download = receivedfileMetadata.fileName;
        a.textContent = `Download ${receivedfileMetadata.fileName}`;
        a.style.display = "block";
        a.style.margin = "10px 0";

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

        receivedfileMetadata = null;
        pendingBlob = [];
        receivedBytes = 0;
    }
}

pc.ondatachannel = (event) => {
    console.log("Received data channel");
    dc = event.channel;
    attachDcHandler(dc);
};

async function sendFiles() {
    const file = fileInput.files[0];

    const chunkSize = 64 * 1024;
    let offset = 0;
    const total_chunks = chunkSize / file.size;

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
            attachDcHandler(dc);
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendMessage({
            type: "offer",
            sdp: offer.sdp,
            from: myId,
            to: targetId,
        });
        console.log(`Sent offer to peer ${targetId}`, "info");
    } catch (err) {
        console.log(`Error creating connection: ${err}`, "error");
    }
}

console.log("WebRTC Peer Connection Tester initialized", "info");
