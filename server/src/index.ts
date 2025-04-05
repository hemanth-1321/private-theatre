import dotenv from "dotenv";

dotenv.config();
import express from "express";
import { initPolling } from "./controllers/s3poller";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/status", (req, res) => {
  res.send("Video Processor is running");
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  initPolling();
});
