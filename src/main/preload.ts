import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("deskSweep", {
  onStart: (cb: (data: unknown) => void) => ipcRenderer.on("start", (_e, data) => cb(data)),
  sweep: (id: number): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("sweep", id),
  finish: () => ipcRenderer.send("finish")
});
