export function sendWsMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.log("Error sending message to WebSocket server", "error");
    }
}

export function connectWebsocket(handlers, isManuallyClosed) {
    const { onOpen, onMessage, onClose, onError } = handlers;
    if (isManuallyClosed) return;

    const ws = new WebSocket("wss://webrtc-share.onrender.com");

    ws.onopen = onOpen;
    ws.onmessage = onMessage;
    ws.onclose = onClose;
    ws.onerror = onError;

    return ws;
}

export function scheduleReconnect(connectFn, delay = 2000) {
    return setTimeout(connectFn, delay);
}

export function closeWebSocket(ws, reconnectTimeout) {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }
    if (ws) ws.close();
}
