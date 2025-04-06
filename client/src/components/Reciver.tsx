import React, { useEffect, useRef, useState } from "react";

export const Receiver = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000");

    ws.onopen = () => {
      console.log("Connected to WebSocket server as Receiver");
      ws.send(JSON.stringify({ type: "receiver" }));
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

      const newPc = new RTCPeerConnection();

    newPc.ontrack = (event) => {
      console.log("Track received:", event);

      const video = videoRef.current;
      if (video) {
        let stream = video.srcObject as MediaStream;
        if (!stream) {
          stream = new MediaStream();
          video.srcObject = stream;
        }
        stream.addTrack(event.track);
      }
    };
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      stream.getTracks().forEach((track) => newPc.addTrack(track, stream));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "createOffer") {
        await newPc.setRemoteDescription(new RTCSessionDescription(message.sdp));
        const answer = await newPc.createAnswer();
        await newPc.setLocalDescription(answer);

        socket.send(JSON.stringify({ type: "createAnswer", sdp: answer }));
      } else if (message.type === "iceCandidate") {
        await newPc.addIceCandidate(new RTCIceCandidate(message.candidate));
      }
    };

    setPc(newPc);

    return () => {
      newPc.close();
    };
  }, [socket]);

  return (
    <div>
      <h2>Receiver Connected</h2>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "300px", border: "1px solid black" }}
      />  <video ref={localVideoRef} autoPlay muted style={{ width: "300px", border: "1px solid green" }} />
    </div>
  );
};
