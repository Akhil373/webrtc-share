# webrtc p2p share

A simple peer-to-peer file and message sharing app using WebRTC. Share stuff directly between devices without uploading to any server.

## What it does

- Send messages between devices in real-time
- Transfer files directly (P2P)
- No file size limits (well, depends on your connection)
- Works across different networks

## Tech Stack

- **WebRTC** - for peer-to-peer connections
- **WebSockets** - signaling server (connecting peers)
- **Node.js** - backend

## How it works

1. **Signaling Server** - WebSocket server helps peers discover each other and exchange SDP offers/answers
2. **ICE Candidates** - STUN servers help peers find their public IPs and negotiate NAT traversal
3. **Data Channels** - Once WebRTC connection establishes, everything flows P2P through RTCDataChannel
4. **No relays** - Direct peer-to-peer connection (STUN only, no TURN... yet)
