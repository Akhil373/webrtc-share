import { wss } from "./ws-server.js";
import { nanoid } from "nanoid";

const rooms = new Map();

const getBaseIp = (ip) => {
    if (!ip) return null;

    // IPv4
    if (ip.includes(".")) {
        const parts = ip.split(".");
        return parts.slice(0, 3).join(".");
    }

    // IPv6
    if (ip.includes(":")) {
        const parts = ip.split(":");
        return parts.slice(0, 4).join(":");
    }

    return ip;
};

const broadcastClients = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (roomId === "lan") {
        room.forEach((ws) => {
            if (ws.readyState !== 1) return;

            const myBaseIp = getBaseIp(ws.ip);

            const list = Array.from(room)
                .filter((s) => {
                    const sameIp = getBaseIp(s.ip) === myBaseIp;
                    const valid = s.name || s.readyState === 1;
                    return sameIp && valid;
                })
                .map((s) => ({ id: s.id, name: s.name }));

            const msg = JSON.stringify({ type: "clientsList", content: list });
            ws.send(msg);
        });
    } else {
        const list = Array.from(room)
            .filter((s) => s.name || s.readyState === 1)
            .map((s) => ({ id: s.id, name: s.name }));

        const msg = JSON.stringify({ type: "clientsList", content: list });

        room.forEach((s) => {
            if (s.readyState === 1) s.send(msg);
        });
    }
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

wss.on("connection", function connection(ws, req) {
    ws.id = nanoid(5);

    let rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (rawIp && typeof rawIp === "string" && rawIp.includes(",")) {
        rawIp = rawIp.split(",")[0].trim();
    }

    ws.ip = rawIp?.includes("::ffff:") ? rawIp.split(":").pop() : rawIp;

    console.log("Connected:", ws.id, ws.ip);

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
            case "ice-candidate":
                const room = rooms.get(ws.roomId);
                if (!room) return;

                if (ws.roomId === "lan") {
                    const myBaseIp = getBaseIp(ws.ip);

                    room.forEach((client) => {
                        if (client === ws || client.readyState !== 1) return;
                        if (msg.to && client.id !== msg.to) return;

                        const clientBaseIp = getBaseIp(client.ip);
                        if (myBaseIp === clientBaseIp) {
                            client.send(JSON.stringify(msg));
                        }
                    });
                } else {
                    room.forEach((client) => {
                        if (client === ws || client.readyState !== 1) return;
                        if (msg.to && client.id !== msg.to) return;

                        client.send(JSON.stringify(msg));
                    });
                }
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
                // Broadcast to all connected clients
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify(msg));
                    }
                });
                break;
        }
    });

    ws.on("error", console.error);

    ws.on("close", () => {
        const tempRoomId = ws.roomId;
        leaveRoom(ws);
        if (tempRoomId) broadcastClients(tempRoomId);
    });
});
