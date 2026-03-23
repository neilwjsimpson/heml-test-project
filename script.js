// Load TradingView ticker widgets for GOOGL and GOOG
function loadTickerWidget(containerId, symbol) {
  const container = document.querySelector(`#${containerId} .tradingview-widget-container__widget`);
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js";
  script.async = true;
  script.textContent = JSON.stringify({
    symbol: `NASDAQ:${symbol}`,
    width: "100%",
    isTransparent: true,
    colorTheme: "dark",
    locale: "en",
  });
  container.appendChild(script);
}

// Load TradingView advanced chart
function loadChart() {
  const container = document.querySelector("#chart-widget .tradingview-widget-container__widget");
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;
  script.textContent = JSON.stringify({
    autosize: true,
    symbol: "NASDAQ:GOOGL",
    interval: "D",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    backgroundColor: "#161b22",
    gridColor: "#21262d",
    allow_symbol_change: true,
    calendar: false,
    support_host: "https://www.tradingview.com",
    width: "100%",
    height: "450",
  });
  container.appendChild(script);
}

loadTickerWidget("widget-googl", "GOOGL");
loadTickerWidget("widget-goog", "GOOG");
loadChart();
