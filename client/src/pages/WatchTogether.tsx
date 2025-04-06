import VideoPlayerSync from "../components/VideoPlayerSync ";
import { Sender } from "../components/Sender";
import { Receiver } from "../components/Reciver";

export const WatchTogether = ({ role }: { role: "sender" | "receiver" }) => {
  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ textAlign: "center" }}>🎥 Watch Together Room</h1>
      <VideoPlayerSync />

      <div style={{ marginTop: 40 }}>
        {role === "sender" ? <Sender /> : <Receiver />}
      </div>
    </div>
  );
};
