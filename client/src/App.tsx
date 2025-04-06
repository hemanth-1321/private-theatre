import React from "react";
import VideoPlayerWithSync from "./components/VideoPlayerSync "
import VideoChat from "./components/VideoChat";

const App = () => {
  const roomId = "room1"; 

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Movie Sync + Chat</h1>
      <VideoPlayerWithSync roomId={roomId} />
      <VideoChat roomId={roomId} />
    </div>
  );
};

export default App;
