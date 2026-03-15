const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }]

// Returns a channel-like object ({ on }) backed by a WebRTC data channel.
// Uses signalingChannel (Phoenix channel) only for the SDP/ICE handshake.
export function createRtcChannel(signalingChannel) {
  const handlers = {}
  let pc = null

  function emit(event, payload) {
    ;(handlers[event] || []).forEach(fn => fn(payload))
  }

  function initPC() {
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    const dc = pc.createDataChannel("gamepad")

    dc.onopen = () => {
      console.log("[RTC] data channel open")
      emit("pad_connected", {})
    }

    dc.onclose = () => {
      console.log("[RTC] data channel closed")
      emit("pad_disconnected", {})
    }

    dc.onmessage = ({ data }) => {
      const { event, payload } = JSON.parse(data)
      emit(event, payload)
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
    }
  }
}
