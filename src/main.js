const { refreshScreen } = require("./glucoseService.js");
const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

const envPath = path.join(app.getPath("userData"), ".env");

if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    dotenv.config({ path: envPath });
}

let win;
let tray;

app.isQuitting = false;



const createWindow = () => {
    const window = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
            contextIsolation: true,
        }
    });

    window.loadFile('index.html');

    window.on("close", (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            window.hide();
        }
    });

    //window.webContents.openDevTools();

    return window;
}

ipcMain.handle("refresh-screen", async (_event, options) => {
    const config = options || {};
    const data = await refreshScreen(config, process.env);
    return data;
});

app.on("window-all-closed", (e) => {
  e.preventDefault();
});

app.whenReady().then(() => {
    win = createWindow();

    tray = new Tray(path.join(__dirname, '../icon.png'));
    const trayMenu = Menu.buildFromTemplate([
        {
        label: "Show",
        click: () => {
            win.show();
            win.focus();
        }
        },
        {
        label: "Quit",
        click: () => {
            app.isQuitting = true;
            app.quit();
        }
        }
    ]);

    tray.setToolTip("Glucose Monitor");
    tray.setContextMenu(trayMenu);

    tray.on("double-click", () => {
        win.show();
    });

    app.on('before-quit', () => {
        app.isQuitting = true;
    });
});
