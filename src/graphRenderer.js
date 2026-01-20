const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

const DEFAULT_CONFIG = {
  size: {
    width: 240,
    height: 240,
    headerHeight: 90,
  },
  margin: {
    top: 5,
    right: 5,
    bottom: 15,
    left: 25,
  },
  padding: {
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
  },
  range: {
    min: 40,
    max: 400,
    goodMin: 70,
    goodMax: 200,
  },
  time: {
    shownSpanHours: 3,
    dataIntervalMinutes: 1,
  },
  style: {
    background: "black",
    graphArea: "rgba(255, 255, 255, 0.1)",
    goodRange: "rgba(0, 255, 0, 0.2)",
    grid: "rgba(255, 255, 255, 0.2)",
    line: "white",
    font: "10px sans-serif",
    textColor: "white",
  },
  generateMockData: false,
};

GlobalFonts.registerFromPath(`${__dirname}/../resources/AppleColorEmoji.ttf`, 'Emoji');

const rateChars = ['⇒','⇗', '⇑','⇑⇑', '⇘',  '⇓', '⇓⇓', '⇒', '⇒'];
const rateColors = ['green', 'yellow', 'orange', 'red', 'yellow', 'orange', 'red', 'green', 'green'];

function mergeConfig(userConfig = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    size: { ...DEFAULT_CONFIG.size, ...userConfig.size },
    margin: { ...DEFAULT_CONFIG.margin, ...userConfig.margin },
    padding: { ...DEFAULT_CONFIG.padding, ...userConfig.padding },
    range: { ...DEFAULT_CONFIG.range, ...userConfig.range },
    time: { ...DEFAULT_CONFIG.time, ...userConfig.time },
    style: { ...DEFAULT_CONFIG.style, ...userConfig.style },
  };
}

function generateMockDataPoints(config, totalSpanHours = 12, missingRate = 0.9) {
  const points = [];
  const intervalMs = config.time.dataIntervalMinutes * 60 * 1000;
  const totalPoints = Math.floor(
    (totalSpanHours * 60) / config.time.dataIntervalMinutes
  );
  const start = Date.now() - totalSpanHours * 3600 * 1000;

  for (let i = 0; i < totalPoints; i++) {
    if (Math.random() < missingRate) continue;

    const timestamp = start + i * intervalMs;
    let value = 150;

    if (points.length) {
      value =
        points[points.length - 1].value +
        (Math.random() * 20 - 10);
    }

    let rate = Math.ceil(Math.random() * 8);

    value = Math.max(config.range.min, Math.min(config.range.max, value));
    points.push({ timestamp, value, rate });
  }

  return points;
}

function renderHeader(ctx, header, config, dataPoints, now = Date.now()) {
  if (!dataPoints.length) return;

  const last = dataPoints[dataPoints.length - 1];

  // Render last value
  ctx.fillStyle = last.value > config.range.goodMax ? "red" :
                  last.value < config.range.goodMin ? "purple" : "green";
  ctx.font = "60px sans-serif Emoji";
  ctx.textAlign = "left";

  const text = `${rateChars[last.rate]}${last.value.toFixed(0)}`;
  ctx.fillText(
    text,
    header.x,
    header.y + 60
  );

  // Render unit label
  const valueWidth = ctx.measureText(text).width;
  ctx.fillStyle = "white";
  ctx.font = "12px sans-serif Emoji";
  ctx.fillText(
    "mg/dL 🍆",
    header.x + valueWidth + config.padding.left,
    header.y + 60
  );

  // Render time ago
  const minutesAgo = Math.floor((now - last.timestamp) / 60000);
  ctx.fillStyle = minutesAgo > 5 ? "orange" : "cyan";
  ctx.fillText(
    `🕒 ${minutesAgo}'​`,
    header.x + valueWidth + config.padding.left,
    header.y + 32,
  );


}

function renderGraph(ctx, graph, plot, config, dataPoints, now = Date.now()) {
  ctx.fillStyle = config.style.graphArea;
  ctx.fillRect(graph.x, graph.y, graph.width, graph.height);

  // Draw span box
  const fontsize = 16;
  ctx.font = `${fontsize}px sans-serif Emoji`;
  const text = `${config.time.shownSpanHours}h`;

  const spanPadding = 3;
  const spanBoxWidth = ctx.measureText(text).width + 10;
  const spanBoxHeight = fontsize + spanPadding * 2;

  const spanBoxX = graph.x + graph.width - spanBoxWidth - spanPadding;
  const spanBoxY = graph.y + spanPadding;

  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(spanBoxX, spanBoxY, spanBoxWidth, spanBoxHeight, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    text,
    spanBoxX + spanBoxWidth / 2,
    spanBoxY + spanBoxHeight / 2
  );

  // Draw good range

  const rangeSpan = config.range.max - config.range.min;

  const goodTop =
    plot.y +
    ((config.range.max - config.range.goodMax) / rangeSpan) *
      plot.height;

  const goodHeight =
    ((config.range.goodMax - config.range.goodMin) / rangeSpan) *
    plot.height;

  ctx.fillStyle = config.style.goodRange;
  ctx.fillRect(graph.x, goodTop, graph.width, goodHeight);

  ctx.strokeStyle = config.style.grid;
  ctx.fillStyle = config.style.textColor;
  ctx.font = config.style.font;
  ctx.textAlign = "right";

  // Horizontal grid lines and labels

  const rows = 6;

  for (let i = 0; i <= rows; i++) {
    const y = plot.y + (i * plot.height) / rows;
    const value =
      config.range.max - (i * rangeSpan) / rows;

    ctx.beginPath();
    ctx.moveTo(graph.x, y);
    ctx.lineTo(graph.x + graph.width, y);
    ctx.stroke();

    ctx.fillText(value.toFixed(0), graph.x - 5, y + 3);
  }

  // Plot data line

  const spanMs = config.time.shownSpanHours * 3600 * 1000;
  const oldest = now - spanMs;

  const visible = dataPoints
    .filter(p => p.timestamp >= oldest)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (visible.length < 2) return;

  ctx.strokeStyle = config.style.line;
  ctx.lineWidth = 1;
  ctx.beginPath();

  visible.forEach((p, i) => {
    const t = Math.min(Math.max(p.timestamp, oldest), now);
    const x = plot.x + ((t - oldest) / spanMs) * plot.width;
    const y =
      plot.y +
      plot.height -
      ((p.value - config.range.min) / rangeSpan) * plot.height;

    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });

  ctx.stroke();

  const last = visible[visible.length - 1];
  const lastY =
    plot.y +
    plot.height -
    ((last.value - config.range.min) / rangeSpan) * plot.height;

  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = config.style.grid;
  ctx.beginPath();
  ctx.moveTo(plot.x, lastY);
  ctx.lineTo(plot.x + plot.width, lastY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw arrow at the end of the line

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(graph.x, lastY);
  ctx.lineTo(graph.x - 4, lastY - 2);
  ctx.lineTo(graph.x - 4, lastY + 2);
  ctx.closePath();
  ctx.fill();

  // Draw arrow pointing downwards at the last point location
  const lastX =
    plot.x +
    ((last.timestamp - oldest) / spanMs) * plot.width;

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(lastX, lastY - 5);
  ctx.lineTo(lastX - 3, lastY - 10);
  ctx.lineTo(lastX + 3, lastY - 10);
  ctx.closePath();
  ctx.fill();
  
}

function renderImage(dataPoints = [], userConfig = {}) {
  const config = mergeConfig(userConfig);
  const now = Date.now();

  if (config.generateMockData) {
    dataPoints = generateMockDataPoints(config);
  }

  const canvas = createCanvas(config.size.width, config.size.height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = config.style.background;
  ctx.fillRect(0, 0, config.size.width, config.size.height);

  const content = {
    x: config.margin.left,
    y: config.margin.top,
    width:
      config.size.width -
      config.margin.left -
      config.margin.right,
    height:
      config.size.height -
      config.margin.top -
      config.margin.bottom,
  };

  const header = {
    x: content.x,
    y: content.y,
    width: content.width,
    height: config.size.headerHeight,
  };

  const graph = {
    x: content.x,
    y: content.y + header.height,
    width: content.width,
    height: content.height - header.height,
  };

  const plot = {
    x: graph.x + config.padding.left,
    y: graph.y + config.padding.top,
    width:
      graph.width -
      config.padding.left -
      config.padding.right -
      40,
    height:
      graph.height -
      config.padding.top -
      config.padding.bottom,
  };

  renderHeader(ctx, header, config, dataPoints, now);
  renderGraph(ctx, graph, plot, config, dataPoints, now);

  return canvas.toBuffer("image/jpeg");
}

module.exports = { renderImage, DEFAULT_CONFIG };
