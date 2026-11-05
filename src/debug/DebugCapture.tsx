import { useFrame, useThree } from "@react-three/fiber";
import { consumeCaptureRequest, setCapturedFrame } from "./modelStatus";

// Lives inside the Canvas. The WebGL canvas only yields pixels synchronously
// during a frame (the game does not set preserveDrawingBuffer), so a DOM
// button cannot screenshot it directly — this helper captures on the next
// driven frame after the overlay requests one. Renders nothing.
export function DebugCapture() {
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    if (!consumeCaptureRequest()) return;
    try {
      setCapturedFrame(gl.domElement.toDataURL("image/png"));
    } catch {
      setCapturedFrame(null);
    }
  });
  return null;
}
