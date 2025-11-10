import { logMessage, updateDcStatus } from "./ui.js";
import { requestLock, releaseLock } from "./utils.js";
import * as dom from "./dom.js";

export const config = {
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

let dcBeat = null;
const DC_BEAT_MS = 10_000;
const DC_BEAT_MSG = JSON.stringify({ type: "dc-ping" });

export function initPeerConnection(isLAN, iceCallback, dcCallback) {
    const pc = new RTCPeerConnection(isLAN ? { iceServers: [] } : config);

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
            iceCallback(event.candidate);
        }
    };

    pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.binaryType = "arraybuffer";
        dcCallback(dc);
    };
    return pc;
}

export function attachDcHandler(channel) {
    let pendingBuffer = [];
    let receivedfileMetadata = null;
    let receivedBytes = 0;

    function startDcBeat() {
        stopDcBeat();
        if (!channel || channel.readyState !== "open") return;
        dcBeat = setInterval(() => {
            if (channel.readyState === "open") channel.send(DC_BEAT_MSG);
        }, DC_BEAT_MS);
    }

    function stopDcBeat() {
        clearInterval(dcBeat);
        dcBeat = null;
    }

    channel.onopen = () => {
        updateDcStatus(true);
        document.getElementById("list-peers").classList.remove("hidden");
        document.getElementById("file-hint").classList.add("hidden");
        startDcBeat();
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
            if (dom.fileProg) {
                const percent = Math.min(
                    100,
                    (receivedBytes / receivedfileMetadata.fileSize) * 100,
                );
                dom.fileProgDiv.classList.remove("hidden");
                dom.fileProg.textContent = `${percent.toFixed(1)}%`;
                dom.progFill.style.width = `${percent}%`;
            }
            if (receivedBytes >= receivedfileMetadata.fileSize) {
                if (dom.fileProg) {
                    dom.fileProg.textContent = "finalizing file...";
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
        if (dom.fileProg) {
            dom.fileProg.textContent = "File received!";
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

export function sendDcMessage(dc) {
    const message = dom.messageInput.value.trim();
    if (!message || !dc || dc.readyState !== "open") return;
    dc.send(message);
    logMessage(`You: ${message}`, "info");
    dom.messageInput.value = "";
    dom.messageInput.value = "";
}

export async function sendFiles(dc, fileMetadata) {
    let files = [];
    if (dom.fileInput.files.length > 1) {
        files = dom.fileInput.files;
    }
    files = null;
    const file = dom.fileInput.files[0];
    if (!file || !files) {
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

            dom.fileProgDiv.classList.remove("hidden");
            const progress = (offset / file.size) * 100;
            dom.progFill.style.width = `${progress}%`;
            dom.fileProg.textContent =
                offset === file.size ? "File Sent!" : `${progress.toFixed(1)}%`;
        }
        if (offset === file.size) logMessage(`Sent file: ${file.name}`);
    } finally {
        releaseLock();
        fileMetadata = null;
    }
}

export async function makeCall(pc, onDataChannel) {
    try {
        const dc = pc.createDataChannel("data channel");
        dc.binaryType = "arraybuffer";
        onDataChannel(dc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        return { offer, dc };
    } catch (err) {
        console.log(`Error creating connection: ${err}`, "error");
        return { offer: null, dc: null };
    }
}
