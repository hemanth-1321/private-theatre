// server.ts (Express + WebSocket + WebRTC Signaling)
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { initPolling } from "./controllers/s3poller";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.get("/status", (req, res) => {
  res.send("Video Processor is running");
});

let clients: { [roomId: string]: WebSocket[] } = {};

let roomSockets: {
  [roomId: string]: {
    sender: WebSocket | null;
    receiver: WebSocket | null;
  };
} = {};

wss.on("connection", (ws) => {
  console.log("WebSocket client connected.");
  ws.on("error", console.error);

  let roomId = "";

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "join") {
        roomId = data.roomId;
        clients[roomId] = clients[roomId] || [];
        clients[roomId].push(ws);

        console.log(
          `Client joined room '${roomId}'. Total clients: ${clients[roomId].length}`
        );
      }

      // Media sync events
      if (["play", "pause", "seek"].includes(data.type)) {
        console.log(
          `Broadcasting '${data.type}' in room '${roomId}'` +
            (data.time !== undefined ? ` at ${data.time}` : "")
        );
        clients[roomId]?.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      }

      // WebRTC signaling
      if (data.type === "sender") {
        roomSockets[roomId] = roomSockets[roomId] || {
          sender: null,
          receiver: null,
        };
        roomSockets[roomId].sender = ws;
        console.log(`Sender registered for room '${roomId}'.`);
      } else if (data.type === "receiver") {
        roomSockets[roomId] = roomSockets[roomId] || {
          sender: null,
          receiver: null,
        };
        roomSockets[roomId].receiver = ws;
        console.log(`Receiver registered for room '${roomId}'.`);
      } else if (data.type === "createOffer") {
        if (ws !== roomSockets[roomId]?.sender) return;
        roomSockets[roomId]?.receiver?.send(
          JSON.stringify({ type: "createOffer", sdp: data.sdp })
        );
      } else if (data.type === "createAnswer") {
        if (ws !== roomSockets[roomId]?.receiver) return;
        roomSockets[roomId]?.sender?.send(
          JSON.stringify({ type: "createAnswer", sdp: data.sdp })
        );
      } else if (data.type === "iceCandidate") {
        const room = roomSockets[roomId];
        if (ws === room?.sender) {
          room?.receiver?.send(
            JSON.stringify({ type: "iceCandidate", candidate: data.candidate })
          );
        } else if (ws === room?.receiver) {
          room?.sender?.send(
            JSON.stringify({ type: "iceCandidate", candidate: data.candidate })
          );
        }
      }
    } catch (error) {
      console.error("Invalid WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    if (roomId) {
      clients[roomId] = (clients[roomId] || []).filter((c) => c !== ws);

      if (roomSockets[roomId]) {
        if (ws === roomSockets[roomId].sender)
          roomSockets[roomId].sender = null;
        if (ws === roomSockets[roomId].receiver)
          roomSockets[roomId].receiver = null;

        if (!roomSockets[roomId].sender && !roomSockets[roomId].receiver) {
          delete roomSockets[roomId];
          console.log(`Room '${roomId}' signaling sockets cleaned up.`);
        }
      }

      if (clients[roomId].length === 0) {
        delete clients[roomId];
        console.log(`Room '${roomId}' removed.`);
      } else {
        console.log(
          `Client left room '${roomId}'. Remaining: ${clients[roomId].length}`
        );
      }
    } else {
      console.log("Client disconnected (not in a room).");
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  initPolling();
});
