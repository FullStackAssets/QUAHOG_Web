import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clearAssetNotice, reportAssetNotice } from "./assetNotices";
import { createMeshoptLifecycle, MeshoptLifecycleError, type DecoderStatus } from "./meshoptLifecycle";

// three's decoder (decodeGltfBufferAsync, waits on WASM) is the one GLTFLoader
// in this repo's three version expects. drei's default path installs three-stdlib's
// copy instead, which has no decodeGltfBufferAsync. Callers attach this object
// and pass useMeshopt=false so drei does not overwrite it. This module is the
// main game's decoder; the Google 3D Tiles path does not import it.

type DecoderModule = {
  supported?: boolean;
  ready?: Promise<void>;
};

const decoder = MeshoptDecoder as DecoderModule;

const life = createMeshoptLifecycle(() => {
  if (decoder.supported === false || !decoder.ready) {
    return Promise.reject(new MeshoptLifecycleError("Meshopt decoder is unavailable in this runtime", "unsupported"));
  }
  return decoder.ready.then(() => decoder);
});

export function meshoptStatus(): DecoderStatus {
  return life.status();
}

export function meshoptError(): string | null {
  return life.error();
}

export function meshoptDecoder(): DecoderModule {
  return decoder;
}

export async function ensureMainGameMeshopt(): Promise<void> {
  try {
    await life.ensure();
    clearAssetNotice("meshopt-decoder");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportAssetNotice({
      key: "meshopt-decoder",
      level: "error",
      message: `Meshopt decoder ${life.status()}: ${message}. Compressed GLBs will use the placeholder character.`,
    });
  }
}

export function retryMainGameMeshopt(): Promise<void> {
  return life.retry().then(
    () => {
      clearAssetNotice("meshopt-decoder");
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      reportAssetNotice({
        key: "meshopt-decoder",
        level: "error",
        message: `Meshopt decoder ${life.status()}: ${message}. Compressed GLBs will use the placeholder character.`,
      });
    },
  );
}
