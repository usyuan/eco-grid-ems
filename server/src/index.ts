import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createEquipmentFleet, createRandomAlert, jitterEquipment, nextGridFrequency } from "./mockData.js";
import { taipowerRouter } from "./taipowerProxy.js";
import type { ClientToServerEvents, ServerToClientEvents } from "./types.js";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.use("/taipower", taipowerRouter);

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

const fleet = createEquipmentFleet();
let frequency = 60;

io.on("connection", (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);
  socket.emit("equipment:snapshot", fleet);

  socket.on("equipment:request_snapshot", () => {
    socket.emit("equipment:snapshot", fleet);
  });

  socket.on("disconnect", () => {
    console.log(`[socket] client disconnected: ${socket.id}`);
  });
});

setInterval(() => {
  frequency = nextGridFrequency(frequency);
  io.emit("grid:frequency_tick", { frequency, timestamp: Date.now() });
}, 1000);

setInterval(() => {
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
  console.log(`[server] EcoGrid mock Socket.io server listening on http://localhost:${PORT}`);
});
