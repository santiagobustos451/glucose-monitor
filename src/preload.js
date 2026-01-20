const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload script loaded");

contextBridge.exposeInMainWorld("api", {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    refreshScreen: (options) => ipcRenderer.invoke("refresh-screen", options)
});