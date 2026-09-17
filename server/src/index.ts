import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { log } from "./logger.js";
import { createEquipmentFleet, createRandomAlert, jitterEquipment, nextGridFrequency } from "./mockData.js";
import { taipowerRouter } from "./taipowerProxy.js";
import type { ClientToServerEvents, ServerToClientEvents } from "./types.js";

// Cloud Run 以 $PORT 告知要監聽哪個埠（實際是 8080），不能寫死
const PORT = Number(process.env.PORT ?? 4000);

// 部署到 Cloud Run 後要同時放行 GitHub Pages 與本機，所以吃逗號分隔的清單。
// cors 與 socket.io 的 origin 選項都接受字串陣列。
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: CLIENT_ORIGINS }));
app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.use("/taipower", taipowerRouter);

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CLIENT_ORIGINS },
});

const fleet = createEquipmentFleet();
let frequency = 60;

io.on("connection", (socket) => {
  log.info("client connected", { socketId: socket.id, clients: io.engine.clientsCount });
  socket.emit("equipment:snapshot", fleet);

  socket.on("equipment:request_snapshot", () => {
    socket.emit("equipment:snapshot", fleet);
  });

  socket.on("disconnect", (reason) => {
    log.info("client disconnected", { socketId: socket.id, reason, clients: io.engine.clientsCount });
  });
});

// Cloud Run 在沒有連線時會把 CPU 節流到趨近於零，這兩個計時器會跟著停擺——
// 這是預期行為（沒人看的時候不該計費），不要為了「讓資料持續前進」去開 CPU always allocated。
const frequencyTimer = setInterval(() => {
  frequency = nextGridFrequency(frequency);
  io.emit("grid:frequency_tick", { frequency, timestamp: Date.now() });
}, 1000);

const fleetTimer = setInterval(() => {
  const updatesPerTick = Math.max(1, Math.round(fleet.length * 0.06));
  for (let i = 0; i < updatesPerTick; i++) {
    const target = fleet[Math.floor(Math.random() * fleet.length)];
    const patch = jitterEquipment(target);
    Object.assign(target, patch);
    io.emit("equipment:status_update", patch);

    if (patch.status === "critical" || patch.status === "warning") {
      const alert = createRandomAlert(target.id);
      if (patch.status === "critical" || Math.random() > 0.6) {
        io.emit("alert:broadcast", alert);
      }
    }
  }
}, 2500);

httpServer.listen(PORT, () => {
  log.info("EcoGrid mock Socket.io server listening", { port: PORT, allowedOrigins: CLIENT_ORIGINS });
});

// Cloud Run 收回 instance 前會送 SIGTERM，預設會等 10 秒才強制砍掉。
// 主動關掉計時器與連線，讓 instance 乾淨退場（並讓客戶端立刻收到斷線而不是等逾時）。
process.on("SIGTERM", () => {
  log.info("received SIGTERM, shutting down");
  clearInterval(frequencyTimer);
  clearInterval(fleetTimer);
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
});
