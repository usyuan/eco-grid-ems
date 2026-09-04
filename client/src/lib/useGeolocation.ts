import { useEffect, useState } from "react";

interface GeolocationState {
  status: "idle" | "loading" | "success" | "error" | "unsupported";
  coords: { latitude: number; longitude: number } | null;
  error: string | null;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ status: "idle", coords: null, error: null });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "unsupported", coords: null, error: "瀏覽器不支援定位" });
      return;
    }
    setState((s) => ({ ...s, status: "loading" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          status: "success",
          coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          error: null,
        });
      },
      (err) => {
        setState({ status: "error", coords: null, error: err.message });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }, []);

  return state;
}
