import * as dom from "./dom.js";
import { getUserDetails, requestLock } from "./utils.js";
import { updatePeersList, updateWsStatus } from "./ui.js";
import {
    connectWebsocket,
    sendWsMessage,
    scheduleReconnect,
} from "./websocket.js";
import {
    initPeerConnection,
    attachDcHandler,
    sendDcMessage,
    sendFiles,
    makeCall,
} from "./webrtc.js";

let pc;
let dc;
let myId = null;
let targetId = null;
let peerList = [];
let fileMetadata = null;
let ws = null;
let isManuallyClosed = false;
let pendingRoom = null;

const isLAN = new URLSearchParams(location.search).get("mode") === "lan";
let ROOM_ID = new URLSearchParams(location.search).get("roomId");
const urlRoom = location.hash.slice(1);

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
function generateCode(len = 6) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    let code = "";
    for (let i = 0; i < len; i++) code += ALPHABET[bytes[i] % 26];
    return code;
}

function handleWsOpen() {
    updateWsStatus(true);
    const { browser, deviceType } = getUserDetails();
    const emoji =
        deviceType === "Mobile" ? "📱" : deviceType === "Tablet" ? "📱" : "💻";
    const myName = `${emoji} ${browser}`;
    dom.nameEl.textContent = myName;
    sendWsMessage(ws, {
        type: "register",
        name: myName,
    });

    if (ROOM_ID) {
        sendWsMessage(ws, { type: "join-room", roomId: ROOM_ID });
        pc = setupPeerConnection();
    }
    if (pendingRoom) {
        sendWsMessage(ws, { type: "join-room", roomId: pendingRoom });
        pendingRoom = null;
    }
}

async function handleWsMessage(event) {
    const message = JSON.parse(event.data);
    if (message.yourID) {
        myId = message.yourID;
        dom.myIdEl.forEach((element) => {
            element.textContent = myId;
        });
        return;
    }

    if (message.from === myId) return;
    switch (message.type) {
        case "joined":
            document.getElementById("join-room").classList.add("hidden");
            document.getElementById("main-ui").classList.remove("hidden");
            break;
        case "clientsList":
            peerList = message.content || [];
            updatePeersList(peerList, myId, handleSelectPeer);
            if (
                peerList.find((p) => p.id === myId) &&
                peerList.length === 1 &&
                !isLAN
            ) {
                dom.notify.textContent = `📌 Share this room to other device! ⤵️`;
                dom.notify.classList.remove("hidden");
            }
            break;
        case "offer":
            if (!pc) pc = setupPeerConnection();
            await pc.setRemoteDescription(new RTCSessionDescription(message));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendWsMessage(ws, {
                type: "answer",
                sdp: answer.sdp,
                from: myId,
                to: message.from,
                roomId: message.roomId,
            });
            break;
        case "answer":
            await pc.setRemoteDescription(new RTCSessionDescription(message));
            break;
        case "ice-candidate":
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
            break;
    }
}

function handleWsClose() {
    console.log("WebSocket connection closed!", "warning");
    if (!isManuallyClosed) {
        scheduleReconnect();
    }
}

function handleWsError(err) {
    console.error(`Websocket error: ${JSON.stringify(err)}`);
}

function startWebsocket() {
    if (isManuallyClosed) return;
    ws = connectWebsocket(
        {
            onOpen: handleWsOpen,
            onMessage: handleWsMessage,
            onClose: handleWsClose,
            onError: handleWsError,
        },
        isManuallyClosed,
    );
}

function handleIceCandidate(candidate) {
    sendWsMessage(ws, {
        type: "ice-candidate",
        candidate,
        from: myId,
        to: targetId,
        roomId: ROOM_ID,
    });
}

function handleDataChannel(dataChannel) {
    dc = dataChannel;
    attachDcHandler(dc);
}

function setupPeerConnection() {
    if (pc) {
        pc.close();
        dc = null;
    }
    const newPc = initPeerConnection(
        isLAN,
        handleIceCandidate,
        handleDataChannel,
    );
    return newPc;
}

function handleSelectPeer(peer) {
    targetId = peer.id;
    dom.selectedPeerEl.textContent = `${peer.name} (${peer.id})`;
    dom.connectBtn.disabled = false;

    const peerItems = dom.peersListEl.querySelectorAll(".peer-item");
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
}

// -- all event listenerss -----

dom.createBtn.addEventListener("click", () => {
    ROOM_ID = generateCode(6);
    location.hash = ROOM_ID;
    pc = setupPeerConnection();
    if (ws && ws.readyState === WebSocket.OPEN) {
        sendWsMessage(ws, { type: "join-room", roomId: ROOM_ID });
    }
});

dom.joinBtn.addEventListener("click", () => {
    const ROOM_CODE = dom.roomInput.value.trim();
    if (!ROOM_CODE || (ROOM_CODE.length !== 8 && ROOM_CODE !== "lan")) {
        alert("Enter a valid room code");
        return;
    }
    ROOM_ID = ROOM_CODE;
    location.hash = ROOM_ID;
    pc = setupPeerConnection();
    if (ws && ws.readyState === WebSocket.OPEN) {
        sendWsMessage(ws, { type: "join-room", roomId: ROOM_ID });
    } else {
        pendingRoom = ROOM_ID;
    }
});

dom.shareBtn.addEventListener("click", () => {
    dom.notify.classList.add("hidden");
    dom.shareModal.classList.remove("hidden");

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

dom.shareModal.addEventListener("click", (e) => {
    if (e.target === dom.shareModal) dom.shareModal.classList.add("hidden");
});

dom.copyUrlBtn.addEventListener("click", () => {
    navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
            dom.copyUrlBtn.textContent = "Copied!";
            dom.copyUrlBtn.classList.remove("bg-[#3c3836]");
            dom.copyUrlBtn.classList.add("bg-[#98971a]");

            setTimeout(() => {
                dom.copyUrlBtn.textContent = "Copy Room URL";
                dom.copyUrlBtn.classList.remove("bg-[#98971a]");
                dom.copyUrlBtn.classList.add("bg-[#3c3836]");
            }, 2000);
        })
        .catch((err) => {
            console.error("Failed to copy:", err);
            alert("Failed to copy URL");
        });
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !dom.shareModal.classList.contains("hidden")) {
        dom.shareModal.classList.add("hidden");
    }
});

dom.connectBtn.addEventListener("click", async () => {
    if (targetId) {
        if (!pc) pc = setupPeerConnection();
        const { offer, dc: newDc } = await makeCall(pc, handleDataChannel);
        dc = newDc;
        sendWsMessage(ws, {
            type: "offer",
            sdp: offer.sdp,
            from: myId,
            to: targetId,
            roomId: ROOM_ID,
        });
    }
});

dom.sendBtn.addEventListener("click", () => sendDcMessage(dc));

dom.messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendDcMessage(dc);
    }
});

dom.fileInput.addEventListener("change", (e) => {
    const files = e.target.files;
    const fileNames = Array.from(files)
        .map((f) => f.name)
        .join(", ");
    document.getElementById("file-input-label").textContent = files.length
        ? `📁 ${fileNames}`
        : "";
});

document.getElementById("fileShare").onchange = () => {
    document.getElementById("list-peers").classList.remove("hidden");
    document.getElementById("file-hint").classList.add("hidden");
};

dom.fileShareBtn.addEventListener("click", () => sendFiles(dc, fileMetadata));

document.getElementById("lan-btn").onclick = () => {
    location.href = "?mode=lan&roomId=lan";
};

dom.fileInput.addEventListener("change", () => {
    const file = dom.fileInput.files[0];
    if (file.size > 1 * 1024 * 1024 * 1024) {
        dom.notify.textContent = `Caution: Sending large files will use significant memory on the receiver's device.`;
        dom.notify.classList.remove("hidden");
        setTimeout(() => {
            dom.notify.classList.add("hidden");
        }, 10_000);
    }
});

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestLock();
});

// --- initial setup logic-
updateWsStatus(false);
startWebsocket();
if (isLAN) dom.shareBtn.classList.add("hidden");
if (urlRoom) {
    dom.roomInput.value = urlRoom;
    dom.joinBtn.click();
}
