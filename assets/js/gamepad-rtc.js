const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }]
const CHUNK_SIZE = 64 * 1024 // 64 KB — safely under all browsers' maxMessageSize

function chunkSend(dc, message) {
  if (message.length <= CHUNK_SIZE) { dc.send(message); return }
  const id = Date.now().toString(36)
  const total = Math.ceil(message.length / CHUNK_SIZE)
  for (let i = 0; i < total; i++)
    dc.send(JSON.stringify({ _c: 1, id, i, n: total, d: message.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) }))
}

// Returns a channel-like object ({ on, send }) backed by a WebRTC data channel.
// Uses signalingChannel (Phoenix channel) only for the SDP/ICE handshake.
export function createRtcChannel(signalingChannel) {
  const handlers = {}
  const chunks = {}  // id → { n, parts[] } for reassembling inbound chunked messages
  let pc = null
  let dc = null

  function emit(event, payload) {
    ;(handlers[event] || []).forEach(fn => fn(payload))
  }

  function initPC() {
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    dc = pc.createDataChannel("gamepad")

    dc.onopen = () => {
      console.log("[RTC] data channel open")
      emit("pad_connected", {})
    }

    dc.onclose = () => {
      console.log("[RTC] data channel closed")
      emit("pad_disconnected", {})
    }

    dc.onmessage = ({ data }) => {
      const msg = JSON.parse(data)
      if (msg._c) {
        // Reassemble chunked message
        if (!chunks[msg.id]) chunks[msg.id] = { n: msg.n, parts: [] }
        chunks[msg.id].parts[msg.i] = msg.d
        if (chunks[msg.id].parts.filter(x => x !== undefined).length === msg.n) {
          const full = JSON.parse(chunks[msg.id].parts.join(""))
          delete chunks[msg.id]
          emit(full.event, full.payload)
        }
      } else {
        emit(msg.event, msg.payload)
      }
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) signalingChannel.push("rtc_ice", { candidate: candidate.toJSON() })
    }

    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) {
        emit("pad_disconnected", {})
      }
    }
  }

  signalingChannel.on("pad_connected", async () => {
    console.log("[RTC] pad joined, initiating offer")
    initPC()
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    signalingChannel.push("rtc_offer", { sdp: offer.sdp, type: offer.type })
  })

  signalingChannel.on("rtc_answer", async ({ sdp, type }) => {
    console.log("[RTC] received answer")
    await pc.setRemoteDescription({ sdp, type })
  })

  signalingChannel.on("rtc_ice", async ({ candidate }) => {
    if (pc) await pc.addIceCandidate(candidate)
  })

  signalingChannel.on("pad_disconnected", () => {
    console.log("[RTC] pad disconnected")
    emit("pad_disconnected", {})
    if (pc) { pc.close(); pc = null }
  })

  return {
    on(event, handler) {
      if (!handlers[event]) handlers[event] = []
      handlers[event].push(handler)
    },
    send(event, payload) {
      if (dc && dc.readyState === "open")
        chunkSend(dc, JSON.stringify({ event, payload }))
    }
  }
}
