const myIdEl = document.querySelectorAll(".my-id");
const selectedPeerEl = document.getElementById("selected-peer");
const peersListEl = document.getElementById("peers-list");
const connectBtn = document.getElementById("call-btn");
const messageLogEl = document.getElementById("message-log");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const fileInput = document.getElementById("fileShare");
const fileShareBtn = document.getElementById("send-file-btn");
const nameEl = document.getElementById("my-name");
const fileProg = document.getElementById("progress-text");
const progFill = document.getElementById("progress-fill");
const notify = document.getElementById("notify");
const createBtn = document.getElementById("create-btn");
const joinBtn = document.getElementById("join-btn");
const roomInput = document.getElementById("roomCode");
const shareBtn = document.getElementById("share-btn");
const shareModal = document.getElementById("share-modal");
const copyUrlBtn = document.getElementById("copy-url-btn");
console.log(progFill);

const isLAN = new URLSearchParams(location.search).get("mode") === "lan";
if (isLAN) shareBtn.classList.add("hidden");

let ROOM_ID = new URLSearchParams(location.search).get("roomId");
let pendingRoom = null;

const urlRoom = location.hash.slice(1);

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
        notify.classList.remove("hidden");
    } else {
        notify.classList.add("hidden");
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
    location.hash = ROOM_ID;
    initPeerConnection();
    if (ws && ws.readyState === WebSocket.OPEN) {
        sendWsMessage({ type: "join-room", roomId: ROOM_ID });
    }
});

joinBtn.addEventListener("click", () => {
    const ROOM_CODE = roomInput.value.trim();
    if (!ROOM_CODE || (ROOM_CODE.length !== 8 && ROOM_CODE !== "lan")) {
        alert("Enter a valid room code");
        return;
    }
    ROOM_ID = ROOM_CODE;
    location.hash = ROOM_ID;
    initPeerConnection();
    if (ws && ws.readyState === WebSocket.OPEN) {
        sendWsMessage({ type: "join-room", roomId: ROOM_ID });
    } else {
        pendingRoom = ROOM_ID;
    }
});

shareBtn.addEventListener("click", () => {
    notify.classList.add("hidden");
    shareModal.classList.remove("hidden");

    const qrContainer = document.getElementById("qr-code");
    qrContainer.innerHTML = "";

    const roomURL = window.location.href;
    new QRCode(qrContainer, {
        text: roomURL,
        width: 192,
        height: 192,
        colorDark: "#ebdbb2",
        colorLight: "#3c3836",
    });

    document.getElementById("room-id").textContent = ROOM_ID;
});

shareModal.addEventListener("click", (e) => {
    if (e.target === shareModal) shareModal.classList.add("hidden");
});

copyUrlBtn.addEventListener("click", () => {
    navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
            copyUrlBtn.textContent = "Copied!";
            copyUrlBtn.classList.remove("bg-[#3c3836]");
            copyUrlBtn.classList.add("bg-[#98971a]");

            setTimeout(() => {
                copyUrlBtn.textContent = "Copy Room URL";
                copyUrlBtn.classList.remove("bg-[#98971a]");
                copyUrlBtn.classList.add("bg-[#3c3836]");
            }, 2000);
        })
        .catch((err) => {
            console.error("Failed to copy:", err);
            alert("Failed to copy URL");
        });
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !shareModal.classList.contains("hidden")) {
        shareModal.classList.add("hidden");
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

document.getElementById("lan-btn").onclick = () => {
    location.href = "?mode=lan&roomId=lan";
};

// const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const config = {
    iceServers: [
        {
            urls: "stun:stun.relay.metered.ca:80",
        },
        {
            urls: "stun:stun.l.google.com:19302",
        },
        {
            urls: "turn:asia.relay.metered.ca:80",
            username: "6d55c503e6d8ff2c6dc1a46e",
            credential: "RXwdhSgX6CHTW4hp",
        },
        {
            urls: "turns:asia.relay.metered.ca:443?transport=tcp",
            username: "6d55c503e6d8ff2c6dc1a46e",
            credential: "RXwdhSgX6CHTW4hp",
        },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: "all",
};

let pc;
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
    const platform = navigator.platform || "";
    const userAgentData = navigator.userAgentData;

    let OSName = "Unknown OS";
    let browserName = "Unknown Browser";
    let deviceType = "Desktop";

    const isMobile =
        /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            userAgent,
        );
    const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent);

    if (isTablet) deviceType = "Tablet";
    else if (isMobile) deviceType = "Mobile";

    if (userAgent.indexOf("Windows NT 10.0") !== -1) OSName = "Windows 10/11";
    else if (userAgent.indexOf("Windows NT 6.3") !== -1) OSName = "Windows 8.1";
    else if (userAgent.indexOf("Windows NT 6.2") !== -1) OSName = "Windows 8";
    else if (userAgent.indexOf("Windows NT 6.1") !== -1) OSName = "Windows 7";
    else if (userAgent.indexOf("Win") !== -1) OSName = "Windows";
    else if (userAgent.indexOf("Mac OS X") !== -1) {
        const macVersion = userAgent.match(/Mac OS X (\d+[._]\d+)/);
        OSName = macVersion ? `macOS ${macVersion[1].replace("_", ".")}` : "macOS";
    } else if (userAgent.indexOf("Android") !== -1) {
        const androidVersion = userAgent.match(/Android (\d+(\.\d+)?)/);
        OSName = androidVersion ? `Android ${androidVersion[1]}` : "Android";
    } else if (/iPad|iPhone|iPod/.test(userAgent)) {
        const iOSVersion = userAgent.match(/OS (\d+_\d+)/);
        OSName = iOSVersion ? `iOS ${iOSVersion[1].replace("_", ".")}` : "iOS";
    } else if (userAgent.indexOf("CrOS") !== -1) OSName = "ChromeOS";
    else if (userAgent.indexOf("Linux") !== -1 || userAgent.indexOf("X11") !== -1)
        OSName = "Linux";

    if (userAgent.indexOf("Edg") !== -1) browserName = "Edge";
    else if (userAgent.indexOf("OPR") !== -1 || userAgent.indexOf("Opera") !== -1)
        browserName = "Opera";
    else if (userAgent.indexOf("Chrome") !== -1) browserName = "Chrome";
    else if (userAgent.indexOf("Safari") !== -1) browserName = "Safari";
    else if (userAgent.indexOf("Firefox") !== -1) browserName = "Firefox";
    else if (
        userAgent.indexOf("MSIE") !== -1 ||
        userAgent.indexOf("Trident") !== -1
    )
        browserName = "IE";

    const deviceName = `${OSName} ${deviceType} (${browserName})`;

    return {
        os: OSName,
        browser: browserName,
        deviceType: deviceType,
        deviceName: deviceName,
        userAgent: userAgent,
    };
}

function initPeerConnection() {
    if (pc) {
        pc.close();
        pc = null;
        dc = null;
    }
    const isLAN = new URLSearchParams(location.search).get("mode") === "lan";
    pc = new RTCPeerConnection(isLAN ? { iceServers: [] } : config);

    pc.oniceconnectionstatechange = () => {
        if (
            pc.iceConnectionState === "failed" ||
            pc.iceConnectionState === "disconnected"
        ) {
            logMessage(
                "Connection failed. Try refreshing and reconnecting.",
                "error",
            );
        } else if (pc.iceConnectionState === "connected") {
            logMessage("Peer-to-peer connection established!", "info");
        }
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendWsMessage({
                type: "ice-candidate",
                candidate: event.candidate,
                from: myId,
                to: targetId,
                roomId: ROOM_ID,
            });
        }
    };

    pc.ondatachannel = (event) => {
        dc = event.channel;
        dc.binaryType = "arraybuffer";
        attachDcHandler(dc);
    };
}

updateWsStatus(false);

function connectWebsocket() {
    if (isManuallyClosed) return;

    ws = new WebSocket("wss://webrtc-share.onrender.com");

    ws.onopen = () => {
        updateWsStatus(true);

        const { os, browser, deviceType } = getUserDetails();
        const emoji =
            deviceType === "Mobile" ? "📱" : deviceType === "Tablet" ? "📱" : "💻";
        const myName = `${emoji} ${browser}`;
        nameEl.textContent = myName;
        sendWsMessage({
            type: "register",
            name: myName,
        });
        if (ROOM_ID) {
            sendWsMessage({ type: "join-room", roomId: ROOM_ID });
            initPeerConnection();
        }
        if (pendingRoom) {
            sendWsMessage({ type: "join-room", roomId: pendingRoom });
            pendingRoom = null;
        }
    };

    ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        if (message.yourID) {
            myId = message.yourID;
            myIdEl.forEach((element) => {
                element.textContent = myId;
            });
            return;
        }

        if (message.from === myId) return;
        else if (message.type === "joined") {
            document.getElementById("join-room").classList.add("hidden");
            document.getElementById("main-ui").classList.remove("hidden");
        } else if (message.type == "clientsList") {
            peerList = message.content || [];
            updatePeersList(peerList);
            if (
                peerList.find((p) => p.id === myId) &&
                peerList.length === 1 &&
                !isLAN
            ) {
                notify.textContent = `📌 Share this room to other device! ⤵️`;
                notify.classList.remove("hidden");
            }

            // console.log(peerList);
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

let dcBeat = null;
const DC_BEAT_MS = 10_000;
const DC_BEAT_MSG = JSON.stringify({ type: "dc-ping" });

function startDcBeat() {
    stopDcBeat();
    if (!dc || dc.readyState !== "open") return;
    dcBeat = setInterval(() => {
        if (dc.readyState === "open") dc.send(DC_BEAT_MSG);
    }, DC_BEAT_MS);
}

function stopDcBeat() {
    clearInterval(dcBeat);
    dcBeat = null;
}

function attachDcHandler(channel) {
    let pendingBuffer = [];
    let receivedfileMetadata = null;
    let receivedBytes = 0;

    channel.onopen = () => {
        updateDcStatus(true);
        startDcBeat();
        //         console.log("Data Channel is active");
    };

    channel.onmessage = (event) => {
        const data = event.data;

        if (typeof data === "string") {
            try {
                const msg = JSON.parse(data);

                if (msg.type === "fileMeta") {
                    requestLock();
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
                progFill.style.width = `${percent}%`;
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
        stopDcBeat();
    };

    function processReceivedFile() {
        const blob = new Blob([pendingBuffer], {
            type: receivedfileMetadata.fileType,
        });
        pendingBuffer = null;
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
        receivedBytes = 0;
        releaseLock();
    }

    channel.onclose = () => {
        updateDcStatus(false);
        stopDcBeat();
    };
}

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file.size > 1 * 1024 * 1024 * 1024) {
        notify.textContent = `Caution: Sending large files will use significant memory on the receiver's device.`;
        notify.classList.remove("hidden");
        setTimeout(() => {
            notify.classList.add("hidden");
        }, 10_000);
    }
});

let wakeLock = null;

async function requestLock() {
    if (!("wakeLock" in navigator)) {
        console.warn("Wake lock is not supported.");
        return;
    }
    try {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => console.log("wakeLock lost."));
    } catch (err) {
        console.error("wake lock failed: ", err);
    }
}

function releaseLock() {
    wakeLock?.release().then(() => (wakeLock = null));
}

document.addEventListener("visibilitychange", () => {
    if (!wakeLock && document.visibilityState === "visible") requestLock();
});

async function sendFiles() {
    const file = fileInput.files[0];
    if (!file) {
        logMessage("Please select a file!");
        return;
    }
    await requestLock();
    const CHUNK_SIZE = 64 * 1024;
    const HIGH_WATER_MARK = 1024 * 1024;
    const LOW_WATER_MARK = 256 * 1024;
    dc.bufferedAmountLowThreshold = LOW_WATER_MARK;
    let offset = 0;

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

    try {
        while (offset < file.size) {
            const end = Math.min(offset + CHUNK_SIZE, file.size);
            const chunk = file.slice(offset, end);
            const arrayBuf = await chunk.arrayBuffer();

            if (dc.bufferedAmount > HIGH_WATER_MARK) {
                await new Promise((resolve, reject) => {
                    const onLow = () => resolve();
                    const onClose = () => reject(new Error("DataChannel closed"));
                    dc.addEventListener("bufferedamountlow", onLow, { once: true });
                    dc.addEventListener("close", onClose, { once: true });
                });
            }

            dc.send(arrayBuf);
            offset = end;

            const progress = (offset / file.size) * 100;
            progFill.style.width = `${progress}%`;
            fileProg.textContent =
                offset === file.size
                    ? "File Sent!"
                    : `Progress: ${progress.toFixed(1)}%`;
        }
        if (offset === file.size) logMessage(`Sent file: ${file.name}`);
    } finally {
        releaseLock();
        fileMetadata = null;
    }
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

if (urlRoom) {
    roomInput.value = urlRoom;
    joinBtn.click();
}
