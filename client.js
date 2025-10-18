// DOM Elements
const wsStatusEl = document.getElementById("ws-status");
const myIdEl = document.getElementById("my-id");
const dcStatusEl = document.getElementById("dc-status");
const selectedPeerEl = document.getElementById("selected-peer");
const peersListEl = document.getElementById("peers-list");
const refreshBtn = document.getElementById("refresh-btn");
const callBtn = document.getElementById("call-btn");
const messageLogEl = document.getElementById("message-log");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const fileInput = document.getElementById("fileShare");
const fileShareBtn = document.getElementById("send-file-btn");

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
    // console.log("update peer called!");
    // peers.forEach((peer) => {
    //     console.log(peer + " ");
    // });

    if (peers.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "peer-item empty";
        emptyItem.textContent = "No peers available";
        peersListEl.appendChild(emptyItem);
        return;
    }

    peers.forEach((peer) => {
        if (peer.id !== myId) {
            const peerItem = document.createElement("li");
            peerItem.className = "peer-item";

            const peerInfo = document.createElement("div");
            peerInfo.innerHTML = `<div class="peer-name">${peer.name || "Unknown"}</div><div class="peer-id">ID: ${peer.id}</div>`;

            const selectBtn = document.createElement("button");
            selectBtn.className = "select-btn";
            selectBtn.textContent = "Select";
            selectBtn.onclick = () => selectPeer(peer);

            peerItem.appendChild(peerInfo);
            peerItem.appendChild(selectBtn);
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

refreshBtn.addEventListener("click", () => {
    console.log("Refreshing peer list...", "info");
});

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

fileShareBtn.addEventListener("click", sendFiles);

// const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const config = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
            urls: [
                "turn:staticauth.openrelay.metered.ca:80?transport=udp",
                "turn:staticauth.openrelay.metered.ca:443?transport=udp",
                "turn:staticauth.openrelay.metered.ca:443?transport=tcp",
            ],
            username: "openrelayproject",
            credential: "openrelayprojectsecret",
        },
    ],
};
const pc = new RTCPeerConnection(config);
let dc;
let myId = null;
let targetId = null;
let peerList = [];
let fileMetadata = null;

const ws = new WebSocket("wss://webrtc-share.onrender.com");

ws.onopen = () => {
    updateWsStatus(true);
    console.log("WebSocket connected!", "info");

    const myName = prompt("Enter your name", "Guest");
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

    if (message.type === "fileMeta") {
        fileMetadata = {
            fileName: message.fileName,
            fileType: message.fileType,
            fileSize: message.fileSize,
        };
        console.log("Metadata stored: " + fileMetadata);
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
};

ws.onerror = (err) => {
    console.log(`WebSocket error: ${err}`, "error");
};

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
    let receivedChunks = [];
    let expectedChunks = 0;
    let currentFile = null;

    channel.onopen = () => {
        updateDcStatus(true);
        console.log("Data Channel is active");
    };

    channel.onmessage = (event) => {
        if (event.data && event.data.constructor.name === "Blob") {
            if (!fileMetadata) {
                console.warn("Got file blob without metadata");
                return;
            }
            const blob = event.data;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileMetadata.fileName;
            a.textContent = `Download ${fileMetadata.fileName}`;

            const panel = document.getElementById("side-panel");
            if (panel) {
                panel.appendChild(a);
            } else {
                document.body.appendChild(a);
            }

            fileMetadata = null;
            return;
        }
        logMessage("Peer: " + event.data);
    };

    channel.onerror = (err) => {
        updateDcStatus(false);
        console.log("Data channel error: " + err, "warning");
    };
}

pc.ondatachannel = (event) => {
    console.log("Received data channel");
    dc = event.channel;
    attachDcHandler(dc);
};

async function sendFiles() {
    const file = fileInput.files[0];

    const chunkSize = 16 * 1024;
    let offset = 0;

    if (!file) {
        logMessage("Please select a file!");
    }

    fileMetadata = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
    };
    sendMessage({
        type: "fileMeta",
        ...fileMetadata,
        from: myId,
        to: targetId,
    });

    // while (offset <= file.size) {
    //     const end = Math.min(offset + chunkSize, file.size);
    //     const chunk = file.slice(offset, end);
    //     const arrayBuf = await chunk.arrayBuffer();
    //     dc.send(arrayBuf);
    //     offset += arrayBuf.byteLength;
    // }
    const arrayBuf = await file.arrayBuffer();
    dc.send(arrayBuf);

    logMessage(`Sent file: ${file.name}`);
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

// Initialize UI
console.log("WebRTC Peer Connection Tester initialized", "info");
