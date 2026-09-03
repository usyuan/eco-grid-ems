import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { useAlertStore } from "@/store/useAlertStore";
import { useEMSStore } from "@/store/useEMSStore";

/** 掛載一次即可：把 Socket.io 事件接進 Zustand store。 */
export function useSocketBridge() {
  useEffect(() => {
    const { setConnected, pushFrequencyTick, setEquipmentSnapshot, patchEquipment } =
      useEMSStore.getState();
    const { addAlert } = useAlertStore.getState();

    const onConnect = () => {
      setConnected(true);
      socket.emit("equipment:request_snapshot");
    };
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("equipment:snapshot", setEquipmentSnapshot);
    socket.on("equipment:status_update", patchEquipment);
    socket.on("grid:frequency_tick", pushFrequencyTick);
    socket.on("alert:broadcast", addAlert);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("equipment:snapshot", setEquipmentSnapshot);
      socket.off("equipment:status_update", patchEquipment);
      socket.off("grid:frequency_tick", pushFrequencyTick);
      socket.off("alert:broadcast", addAlert);
    };
  }, []);
}
