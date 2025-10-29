import { wss } from "./ws-server.js";
import { nanoid } from "nanoid";

const rooms = new Map();

const classifyIp = (ip) => {
    if (!ip) return { isRealLAN: false, isCGNAT: false };
    if (ip.endsWith(".local")) {
        return { isRealLAN: true, isCGNAT: false };
    }

    if (ip.includes(":")) {
        const isRealLAN =
            ip.startsWith("fd") || ip.startsWith("fe80:") || ip === "::1";
        return { isRealLAN, isCGNAT: false };
    }

    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
        return { isRealLAN: false, isCGNAT: false };
    }

    const [a, b] = parts;

    const isCGNAT = a === 100 && b >= 64 && b <= 127;

    const isRealLAN =
        a === 10 ||
        (a === 192 && b === 168) ||
        (a === 172 && b >= 16 && b <= 31) ||
        ip === "127.0.0.1";

    return { isRealLAN, isCGNAT };
};

const broadcastClients = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    let list;

    if (roomId !== "lan") {
        list = Array.from(room)
            .filter((s) => s.name || s.readyState === 1)
            .map((s) => ({ id: s.id, name: s.name }));
    } else {
        list = Array.from(room)
            .filter((s) => {
                const ipInfo = classifyIp(s.ip);
                return ipInfo.isRealLAN && !ipInfo.isCGNAT;
            })
            .map((s) => ({ id: s.id, name: s.name }));
    }

    const msg = JSON.stringify({ type: "clientsList", content: list });

    room.forEach((s) => {
        if (s.readyState === 1) s.send(msg);
    });
};

function leaveRoom(ws) {
    if (!ws.roomId) return;

    const set = rooms.get(ws.roomId);
    if (set) {
        set.delete(ws);
        if (set.size === 0) rooms.delete(ws.roomId);
    }
    ws.roomId = null;
}

function fetchIP(msg) {
    if (
        !msg.candidate?.candidate ||
        typeof msg.candidate.candidate !== "string"
    ) {
        console.warn("Received invalid ICE candidate string:", msg.candidate);
        return null;
    }

    const candidateParts = msg.candidate.candidate.split(" ");
    if (candidateParts.length < 5) {
        console.warn("Malformed ICE candidate string:", msg.candidate.candidate);
        return null;
    }

    return candidateParts[4];
}

wss.on("connection", function connection(ws, req) {
    ws.id = nanoid(5);
    const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    ws.ip = rawIp.includes("::ffff:") ? rawIp.split(":").pop() : rawIp;

    console.log(ws.ip);
    classifyIp(ws.ip);

    ws.send(JSON.stringify({ yourID: ws.id }));

    ws.on("message", function message(data) {
        const msg = JSON.parse(data);

        msg.from = ws.id;

        switch (msg.type) {
            case "register":
                ws.name = msg.name;
                broadcastClients(ws.roomId);
                break;

            case "fileMeta":
            case "answer":
            case "offer":
                const room = rooms.get(ws.roomId);
                if (!room) return;
                room.forEach((client) => {
                    if (
                        client !== ws &&
                        client.readyState === 1 &&
                        (!msg.to || client.id === msg.to)
                    ) {
                        client.send(JSON.stringify(msg));
                    }
                });
                break;

            case "ice-candidate":
                const room1 = rooms.get(ws.roomId);
                if (!room1 || !msg) return;

                const candidateIp = fetchIP(msg);
                if (!candidateIp) return;

                if (ws.roomId === "lan" && !classifyIp(candidateIp).isRealLAN) return;

                room1.forEach((client) => {
                    if (
                        client !== ws &&
                        client.readyState === 1 &&
                        (!msg.to || client.id === msg.to)
                    ) {
                        client.send(JSON.stringify(msg));
                    }
                });
                break;

            case "join-room":
                leaveRoom(ws);
                const { roomId } = msg;
                if (!rooms.has(roomId)) rooms.set(roomId, new Set());

                rooms.get(roomId).add(ws);
                ws.roomId = roomId;
                ws.send(JSON.stringify({ type: "joined", roomId }));
                broadcastClients(roomId);
                break;

            case "leave-room":
                leaveRoom(ws);
                ws.send(JSON.stringify({ type: "left" }));
                break;

            default:
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) client.send(JSON.stringify(msg));
                });
                break;
        }
    });
    ws.on("error", console.error);
    ws.on("close", () => {
        const tempRoomId = ws.roomId;
        leaveRoom(ws);
        broadcastClients(tempRoomId);
    });
});
