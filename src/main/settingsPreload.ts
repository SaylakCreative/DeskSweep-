import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("settingsApi", {
  get: () => ipcRenderer.invoke("settings:get"),
  save: (config: unknown) => ipcRenderer.invoke("settings:save", config),
  pickFolder: (): Promise<string | undefined> => ipcRenderer.invoke("settings:pickFolder"),
  openDestination: (dir: string) => ipcRenderer.invoke("settings:openDestination", dir),
  setTheme: (theme: string) => ipcRenderer.send("settings:theme", theme),
  run: (dry: boolean) => ipcRenderer.send("settings:run", dry),
  undo: (): Promise<string> => ipcRenderer.invoke("settings:undo")
});
