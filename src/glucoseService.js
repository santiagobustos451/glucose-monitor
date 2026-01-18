import 'dotenv/config';
import axios from 'axios';
import FormData from 'form-data';
import { renderImage } from '../graphRenderer.js';

const DEFAULT_CONFIG = {
  bsLimits: { low: 60, high: 240 },
  spanHours: 6,
}

async function fetchData(spanHours = 6) {
  const { API_URL, SESSION_COOKIE, USERID_COOKIE } = process.env;
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

async function sendImage(buffer) {
    const target = process.env.SMALLTV_URL;

    const form = new FormData();
    form.append('file', buffer, { filename: 'glucose.jpg', contentType: 'image/jpeg' });
    await axios.get(`${target}/delete?dir=/image//glucose.jpg`);

    await axios.post(`${target}/doUpload?dir=/image/`, form, { headers: form.getHeaders(), maxBodyLength: Infinity,
    maxContentLength: Infinity, insecureHTTPParser: true});

    await axios.get(`${target}/set?img=/image//glucose.jpg`);


}

function mergeConfig(userConfig = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    bsLimits: { ...DEFAULT_CONFIG.bsLimits, ...userConfig.bsLimits },
    spanHours: userConfig.spanHours ?? DEFAULT_CONFIG.spanHours,
  };
}

async function refreshScreen(userConfig = {}) {
    const config = mergeConfig(userConfig);
    const { bsLimits, spanHours } = config;
    const data = await fetchData(spanHours);

    const image = await renderImage(preprocessChartData(data.chartData), {time: {shownSpanHours: spanHours}, range: {goodMin: bsLimits.low, goodMax: bsLimits.high}, generateMockData: false});

    await sendImage(image);

    return {
      ok: true,
      config,
      data: data.chartData,
    }
}

export { refreshScreen };

