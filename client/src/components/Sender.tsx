import React, { useEffect, useRef, useState } from "react";

export const Sender = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000");

    ws.onopen = () => {
      console.log("Connected to WebSocket server as Sender");
      ws.send(JSON.stringify({ type: "sender" }));
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const startStreamVideo = async () => {
    if (!socket) return;

    const newPc = new RTCPeerConnection();

    newPc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send(JSON.stringify({ type: "iceCandidate", candidate: event.candidate }));
      }
    };

    newPc.ontrack = (event) => {
      const remoteStream = remoteVideoRef.current?.srcObject as MediaStream || new MediaStream();
      console.log("recived remote",remoteStream)
      remoteStream.addTrack(event.track);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      stream.getTracks().forEach((track) => newPc.addTrack(track, stream));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      newPc.onnegotiationneeded = async () => {
        const offer = await newPc.createOffer();
        await newPc.setLocalDescription(offer);

        socket.send(JSON.stringify({ type: "createOffer", sdp: offer }));
      };

      socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "createAnswer") {
          await newPc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } else if (data.type === "iceCandidate") {
          await newPc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      };

      setPc(newPc);
    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  };

  useEffect(() => {
    return () => {
      if (pc) pc.close();
    };
  }, [pc]);

  return (
    <div>
      <h2>Sender Connected</h2>
      <button onClick={startStreamVideo}>Start Video</button>
      <div>
        <video ref={localVideoRef} autoPlay muted style={{ width: "300px", border: "1px solid green" }} />
        <video ref={remoteVideoRef} autoPlay style={{ width: "300px", border: "1px solid blue" }} />
      </div>
    </div>
  );
};
