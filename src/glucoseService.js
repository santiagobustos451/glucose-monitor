const net = require('net');
const axios = require('axios');
const FormData = require('form-data');
const { renderImage } = require('./graphRenderer.js');

const DEFAULT_CONFIG = {
  bsLimits: { low: 60, high: 200 },
  spanHours: 6,
}

async function fetchData(spanHours = 6, envVariables) {
  const { API_URL, SESSION_COOKIE, USERID_COOKIE } = envVariables;
  const res = await axios.get(`${API_URL}?param=${buildParam(60 * 60 * spanHours)}`, {
    headers: { Cookie: `session=${SESSION_COOKIE}; userid=${USERID_COOKIE}`, 'Accept-Encoding': 'gzip, deflate, br' }
  });

  const chartData = res.data.data.chart.sg;

  return {chartData};
}

function preprocessChartData(rawData) {
  return rawData.map(point => ({
    timestamp: point[0] * 1000,
    value: mmolToMgdl(point[1]),
    rate: point[2],
  }));
}

function buildParam(timeAgo) {
  const now = Date.now()/1000;
  const cutoff = now - timeAgo;

  const payload = {
    ts: [cutoff, now],
    tz: -3,
  };
  const param = Buffer.from(JSON.stringify(payload)).toString('base64');

  return param;
}

function mmolToMgdl(mmol) {
  return Math.round(mmol * 18.01559);
}

/* async function sendImage(buffer) {
    const target = process.env.SMALLTV_URL;

    const form = new FormData();
    form.append('file', buffer, { filename: 'glucose.jpg', contentType: 'image/jpeg' });
    /* await axios.get(`${target}/delete?dir=/image//glucose.jpg`);

    await axios.post(`${target}/doUpload?dir=/image/`, form, { headers: form.getHeaders()});

    await axios.get(`${target}/set?img=/image//glucose.jpg`); 
    // Using fetch because ESP32 server gives bad headers

    await fetch(`${target}/delete?dir=/image//glucose.jpg`);
    await fetch(`${target}/doUpload?dir=/image/`, {
      method: 'POST',
      body: form,
    });
    await fetch(`${target}/set?img=/image//glucose.jpg`);


}*/

async function sendImage(buffer) {
  const url = new URL(process.env.SMALLTV_URL);

  const form = new FormData();
  form.append('file', buffer, {
    filename: 'glucose.jpg',
    contentType: 'image/jpeg',
  });

  const body = form.getBuffer();
  const headers = form.getHeaders({
    'Content-Length': body.length,
  });

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(url.port || 80, url.hostname);

    socket.on('connect', () => {
      socket.write(
        `POST /doUpload?dir=/image/ HTTP/1.1\r\n` +
        `Host: ${url.hostname}\r\n` +
        Object.entries(headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n') +
        `\r\n\r\n`
      );
      socket.write(body);
    });

    socket.on('data', () => {}); // ignore response
    socket.on('end', resolve);
    socket.on('error', reject);
  });
}

function mergeConfig(userConfig = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    bsLimits: { ...DEFAULT_CONFIG.bsLimits, ...userConfig.bsLimits },
    spanHours: userConfig.spanHours ?? DEFAULT_CONFIG.spanHours,
  };
}

async function refreshScreen(userConfig = {}, envVariables) {
    const config = mergeConfig(userConfig);
    const { bsLimits, spanHours } = config;
    const data = await fetchData(spanHours, envVariables);

    const image = await renderImage(preprocessChartData(data.chartData), {time: {shownSpanHours: spanHours}, range: {goodMin: bsLimits.low, goodMax: bsLimits.high}, generateMockData: false});

    await sendImage(image);

    return {
      ok: true,
      config,
      data: preprocessChartData(data.chartData),
    }
}

module.exports = { refreshScreen };

