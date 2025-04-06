import React, { useRef, useEffect, useState } from "react";

const VideoPlayerWithSync = ({ roomId }: { roomId: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ws = useRef<WebSocket | null>(null);
  const [isPaused, setPaused] = useState(true);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:3000"); // Change if hosted
    ws.current.onopen = () => {
      ws.current?.send(JSON.stringify({ type: "join", roomId }));
    };

    ws.current.onmessage = (msg) => {
      const data = JSON.parse(msg.data);

      if (data.type === "play") {
        videoRef.current?.play();
        setPaused(false);
      }
      if (data.type === "pause") {
        videoRef.current?.pause();
        setPaused(true);
      }
      if (data.type === "seek") {
        if (videoRef.current) {
          videoRef.current.currentTime = data.time;
        }
      }
    };

    return () => ws.current?.close();
  }, [roomId]);

  const sendAction = (type: "play" | "pause" | "seek", time?: number) => {
    ws.current?.send(JSON.stringify({ type, roomId, time }));
  };

  return (
    <div className="flex flex-col items-center">
      <video
        ref={videoRef}
        src="/videos/movie.m308" // <-- Your transcoded video path
        controls
        onPlay={() => sendAction("play")}
        onPause={() => sendAction("pause")}
        onSeeked={() => {
          sendAction("seek", videoRef.current?.currentTime);
        }}
        className="w-full max-w-4xl rounded shadow-lg"
      />
    </div>
  );
};

export default VideoPlayerWithSync;
