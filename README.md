# webrtc-p2p-share  
browser-to-browser files & chat – no installs, no uploads, no deps.

## why  
I wanted to understand WebRTC from the metal up. Also test limits for max. transfer speeds (still working).  
No wrappers, no black-box libraries: just the raw APIs, a WebSocket handshake, and as little code as possible.  
Built from scratch with vanilla JS + WebRTC + one tiny WS router.  
No frameworks, no build step, no tracking.

## what  
- instant text chat  
- file share 
- share a hash-link, done (`#a8f3k2z1`)  
- works on wifi, mobile hotspot, whatever NAT you’re behind (well, for the most part)
- even better if you plug in your own TURN server

## screenshots
<table>
  <td>
<img width="2440" height="1603" alt="Screenshot 2025-10-25 at 12-32-39 WebRTC Peer2Peer Connection" src="https://github.com/user-attachments/assets/018119b5-d26b-41cf-ad28-815098f4bc35" /></td>
  <td><img width="2438" height="1603" alt="Screenshot 2025-10-25 at 12-31-59 WebRTC Peer2Peer Connection" src="https://github.com/user-attachments/assets/41656b51-6f93-44c4-88d0-be0da3290249" /></td>
</table>
also yes, I love gruvbox.

## stack  
- client: plain ES modules, PWA-ready
- server: 80-line WS room router (Node)  
- network: dual-stack STUN + TURN (IPv4 / IPv6 / 443-TLS)

## run  
```bash
git clone https://github.com/Akhil373/webrtc-share.git
cd webrtc-share && pnpm i && pnpm start
```

## licence  
MIT – just use it
