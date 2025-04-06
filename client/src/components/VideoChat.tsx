import React, { useEffect, useRef } from "react";

const VideoChat = ({ roomId }: { roomId: string }) => {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const ws = useRef<WebSocket | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:3000");

    ws.current.onopen = () => {
      console.log("✅ WebSocket connected");
      ws.current?.send(JSON.stringify({ type: "join", roomId }));
      startMedia();
    };

    ws.current.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      console.log("📩 Message from server:", data);

      if (!pc.current) {
        console.log("🔧 Creating peer connection before handling message");
        createPeerConnection();
      }

      switch (data.type) {
        case "createOffer":
          console.log("📡 Received offer");
          await pc.current!.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: data.sdp }));
          const answer = await pc.current!.createAnswer();
          await pc.current!.setLocalDescription(answer);
          ws.current?.send(JSON.stringify({ type: "createAnswer", sdp: answer.sdp }));
          console.log("✅ Sent answer back");
          break;

        case "createAnswer":
          console.log("📡 Received answer");
          await pc.current!.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
          break;

        case "iceCandidate":
          console.log("❄️ Received ICE candidate");
          if (data.candidate) {
            try {
              await pc.current!.addIceCandidate(new RTCIceCandidate(data.candidate));
              console.log("✅ ICE candidate added");
            } catch (err) {
              console.error("🚫 Error adding ICE candidate", err);
            }
          }
          break;
      }
    };

    return () => {
      ws.current?.close();
      pc.current?.close();
      console.log("🛑 Cleaned up connections");
    };
  }, []);

  const startMedia = async () => {
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log("🎥 Local stream started");

      if (localVideo.current) {
        localVideo.current.srcObject = localStream.current;
      }

      createPeerConnection();

      localStream.current.getTracks().forEach((track) => {
        pc.current?.addTrack(track, localStream.current!);
        console.log("🎙️ Track added to connection:", track.kind);
      });

      const offer = await pc.current!.createOffer();
      await pc.current!.setLocalDescription(offer);
      console.log("📤 Created and set local offer");

      ws.current?.send(JSON.stringify({ type: "createOffer", sdp: offer.sdp }));
    } catch (err) {
      console.error("🚫 Error starting media:", err);

      // Allow peer connection to continue even without local media
      createPeerConnection();

      const offer = await pc.current!.createOffer();
      await pc.current!.setLocalDescription(offer);
      ws.current?.send(JSON.stringify({ type: "createOffer", sdp: offer.sdp }));
    }
  };

  const createPeerConnection = () => {
    console.log("🔧 Creating new RTCPeerConnection");

    pc.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" } // Public STUN server
      ]
    });

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("📤 Sending ICE candidate");
        ws.current?.send(JSON.stringify({ type: "iceCandidate", candidate: event.candidate }));
      }
    };

    pc.current.ontrack = (event) => {
      console.log("📺 Remote stream received:", event.streams);
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    pc.current.oniceconnectionstatechange = () => {
      console.log("📶 ICE state:", pc.current?.iceConnectionState);
    };
  };

  return (
    <div className="grid grid-cols-2 gap-4 mt-4">
      <div>
        <h2 className="text-lg font-semibold">You</h2>
        <video ref={localVideo} autoPlay playsInline muted className="w-full rounded border" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Peer</h2>
        <video ref={remoteVideo} autoPlay playsInline className="w-full rounded border" />
      </div>
    </div>
  );
};

export default VideoChat;
