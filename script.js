// === Configuration ===
const BATCH_SIZE = 60;
const MAX_COMPARE = 4;
const TOP_COMPANIES = [
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","BRK.B","LLY","AVGO","TSLA",
  "JPM","WMT","V","UNH","MA","JNJ","XOM","COST","HD","PG"
];
const SECTOR_COLORS = {"Communication Services":"#f97316","Consumer Discretionary":"#eab308","Consumer Staples":"#22c55e","Energy":"#ef4444","Financials":"#3b82f6","Health Care":"#ec4899","Industrials":"#8b5cf6","Information Technology":"#06b6d4","Materials":"#f59e0b","Real Estate":"#14b8a6","Utilities":"#64748b"};
const PORTFOLIO_COLORS = ["#58a6ff","#a371f7","#3fb950","#f97316","#ec4899","#eab308","#06b6d4","#ef4444","#14b8a6","#8b5cf6","#f59e0b","#64748b","#22c55e","#3b82f6","#d29922"];
var spinnerCSS=document.createElement("style");spinnerCSS.textContent=".widget-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:200px;color:var(--text-dim);gap:.75rem;font-size:.85rem}.spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}";document.head.appendChild(spinnerCSS);

// === State ===
var SP500=[],SP500Map=new Map(),currentSort="default",currentSymbol=null,activeTab="chart",loadedTabs={},filteredList=[],renderedCount=0;
var watchlist=JSON.parse(localStorage.getItem("sp500-watchlist")||"[]");
var compareList=[];
var portfolio=JSON.parse(localStorage.getItem("sp500_portfolio")||"{}");
var notes=JSON.parse(localStorage.getItem("sp500_notes")||"{}");
var lastFocusedBeforeShortcuts=null;
var $=function(id){return document.getElementById(id);};
function getCompany(symbol){return SP500Map.get(symbol)||null;}
function formatMcap(b){return !b?"":b>=1000?"$"+(b/1000).toFixed(1)+"T":"$"+b+"B";}
function debounce(fn,ms){var t;return function(){var a=arguments;clearTimeout(t);t=setTimeout(function(){fn.apply(null,a);},ms);};}
function highlightText(text,query){if(!query)return text;var esc=query.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");return text.replace(new RegExp("("+esc+")","gi"),"<mark>$1</mark>");}
function animateCounter(el,target){var start=performance.now();!function step(now){var p=Math.min((now-start)/800,1);el.textContent=Math.round((1-Math.pow(1-p,3))*target);if(p<1)requestAnimationFrame(step);}(start);}

// === Theme ===
function getTheme(){return document.documentElement.getAttribute("data-theme")||"dark";}
function initTheme(){var s=localStorage.getItem("sp500-theme")||"dark";document.documentElement.setAttribute("data-theme",s);updateThemeButton();}
function toggleTheme(){var n=getTheme()==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",n);localStorage.setItem("sp500-theme",n);updateThemeButton();initIndexTicker();}
function updateThemeButton(){$("themeToggle").innerHTML=getTheme()==="dark"?'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>':'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';}

// === Init ===
async function init(){
  initTheme();
  try{var res=await fetch("data/sp500.json");SP500=await res.json();SP500Map=new Map(SP500.map(function(c){return [c.symbol,c];}));}catch(e){console.error("Failed:",e);var lo=$("loadingOverlay");if(lo)lo.innerHTML='<div class="loading-content"><p style="color:#ef4444">Failed to load data.</p></div>';return;}
  var lo=$("loadingOverlay");if(lo){lo.classList.add("hidden");setTimeout(function(){lo.remove();},300);}
  updateMarketStatus();setInterval(updateMarketStatus,60000);initIndexTicker();populateSectors();populateSubIndustries();renderSectorHeatmap();renderSectorDonut();
  renderMarketMovers();renderWatchlist();renderPortfolio();renderTopCompanies();renderMarketNews();buildPickerStrip();filterAndRender();setupEventListeners();initLazyLoad();initScrollTop();loadTradingViewLib();handleHash();setTimeout(loadMiniCharts,2000);
}

// === Market Status ===
function updateMarketStatus(){var now=new Date(),et=new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"})),day=et.getDay(),mins=et.getHours()*60+et.getMinutes(),s,l,d;
  if(day===0||day===6){s="closed";l="Closed";d="Opens Monday 9:30 AM ET";}
  else if(mins>=570&&mins<960){var left=960-mins;s="open";l="Open";d="Closes in "+Math.floor(left/60)+"h "+(left%60)+"m";}
  else if(mins>=240&&mins<570){var left2=570-mins;s="pre";l="Pre-Market";d="Opens in "+Math.floor(left2/60)+"h "+(left2%60)+"m";}
  else if(mins>=960&&mins<1200){s="after";l="After Hours";d="Extended trading";}
  else{s="closed";l="Closed";d="Opens 9:30 AM ET";}
  $("marketStatus").className="market-status status-"+s;$("marketStatus").innerHTML='<span class="status-dot"></span><span class="status-text">'+l+'</span><span class="status-detail">'+d+'</span>';}

// === TradingView ===
function createEmbedWidget(container,src,config){container.innerHTML="";var w=document.createElement("div");w.className="tradingview-widget-container";var inner=document.createElement("div");inner.className="tradingview-widget-container__widget";w.appendChild(inner);var script=document.createElement("script");script.type="text/javascript";script.src=src;script.async=true;script.textContent=JSON.stringify(config);w.appendChild(script);container.appendChild(w);}
function loadTradingViewLib(){var s=document.createElement("script");s.src="https://s3.tradingview.com/tv.js";s.async=true;document.head.appendChild(s);}
function initIndexTicker(){createEmbedWidget($("indexTickerBar"),"https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js",{symbols:[{proName:"FOREXCOM:SPXUSD",title:"S&P 500"},{proName:"FOREXCOM:DJI",title:"Dow Jones"},{proName:"FOREXCOM:NSXUSD",title:"Nasdaq 100"},{proName:"AMEX:VIX",title:"VIX"}],showSymbolLogo:true,colorTheme:getTheme(),isTransparent:true,displayMode:"adaptive",locale:"en"});}
function renderMarketMovers(){var el=$("marketMovers");if(!el)return;createEmbedWidget(el,"https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js",{colorTheme:getTheme(),dateRange:"12M",exchange:"US",showChart:true,locale:"en",isTransparent:true,showSymbolLogo:true,width:"100%",height:420});}
function renderMarketNews(){var el=$("marketNews");if(!el)return;createEmbedWidget(el,"https://s3.tradingview.com/external-embedding/embed-widget-timeline.js",{feedMode:"market",market:"stock",colorTheme:getTheme(),isTransparent:true,displayMode:"regular",width:"100%",height:360,locale:"en"});}

// === Sector Heatmap ===
function renderSectorHeatmap(){var container=$("sectorHeatmap"),total=SP500.length,counts={};SP500.forEach(function(c){counts[c.sector]=(counts[c.sector]||0)+1;});var data=Object.entries(counts).sort(function(a,b){return b[1]-a[1];});
  container.innerHTML=data.map(function(d){var color=SECTOR_COLORS[d[0]]||"#6b7280",pct=(d[1]/total*100).toFixed(1);return '<div class="heatmap-cell" style="flex:'+d[1]+' 0 110px;background:'+color+'18;border-left:3px solid '+color+'" data-sector="'+d[0]+'" title="'+d[0]+': '+d[1]+' ('+pct+'%)"><span class="heatmap-name">'+d[0]+'</span><span class="heatmap-count">'+d[1]+'</span></div>';}).join("");
  container.addEventListener("click",function(e){var cell=e.target.closest(".heatmap-cell");if(!cell)return;$("sectorFilter").value=cell.dataset.sector;populateSubIndustries();filterAndRender();document.querySelector(".controls").scrollIntoView({behavior:"smooth"});});}

// === Sector Donut (animated counter) ===
function renderSectorDonut(){var container=$("sectorDonut"),total=SP500.length,counts={};SP500.forEach(function(c){counts[c.sector]=(counts[c.sector]||0)+1;});var data=Object.entries(counts).sort(function(a,b){return b[1]-a[1];});
  var size=200,cx=100,cy=100,r=80,ir=52,angle=-Math.PI/2;
  var arcs=data.map(function(d){var color=SECTOR_COLORS[d[0]]||"#6b7280",sweep=(d[1]/total)*Math.PI*2,x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle),x2=cx+r*Math.cos(angle+sweep),y2=cy+r*Math.sin(angle+sweep),ix1=cx+ir*Math.cos(angle+sweep),iy1=cy+ir*Math.sin(angle+sweep),ix2=cx+ir*Math.cos(angle),iy2=cy+ir*Math.sin(angle),large=sweep>Math.PI?1:0,path="M"+x1+","+y1+" A"+r+","+r+" 0 "+large+" 1 "+x2+","+y2+" L"+ix1+","+iy1+" A"+ir+","+ir+" 0 "+large+" 0 "+ix2+","+iy2+"Z";angle+=sweep;return '<path d="'+path+'" fill="'+color+'" opacity="0.75"><title>'+d[0]+': '+d[1]+' ('+(d[1]/total*100).toFixed(1)+'%)</title></path>';}).join("");
  var legend=data.map(function(d){return '<div class="legend-row"><span class="legend-dot" style="background:'+(SECTOR_COLORS[d[0]]||"#6b7280")+'"></span><span class="legend-name">'+d[0]+'</span><span class="legend-val">'+d[1]+'</span></div>';}).join("");
  container.innerHTML='<div class="donut-row"><svg viewBox="0 0 '+size+' '+size+'" class="donut-svg">'+arcs+'<text x="'+cx+'" y="'+(cy-6)+'" text-anchor="middle" fill="var(--text-primary)" font-size="22" font-weight="700" id="donutCount">0</text><text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" fill="var(--text-muted)" font-size="10">companies</text></svg><div class="donut-legend">'+legend+'</div></div>';
  var el=document.getElementById("donutCount");if(el)animateCounter(el,total);}

// === Filters ===
function populateSectors(){var sectors=Array.from(new Set(SP500.map(function(c){return c.sector;}))).sort(),sel=$("sectorFilter");sectors.forEach(function(s){var o=document.createElement("option");o.value=s;o.textContent=s;sel.appendChild(o);});}
function populateSubIndustries(){var el=$("subIndustryFilter");if(!el)return;var sector=$("sectorFilter").value,prev=el.value;el.innerHTML='<option value="">All Sub-Industries</option>';var subs=Array.from(new Set(SP500.filter(function(c){return !sector||c.sector===sector;}).map(function(c){return c.subIndustry;}))).sort();subs.forEach(function(s){var o=document.createElement("option");o.value=s;o.textContent=s;el.appendChild(o);});if(subs.includes(prev))el.value=prev;}
function toggleScreener(){var panel=$("screenerPanel"),btn=$("toggleScreener");if(!panel||!btn)return;var isOpen=panel.classList.toggle("open");btn.innerHTML=isOpen?"Advanced Filters &#9652;":"Advanced Filters &#9662;";}
function resetScreener(){if($("mcapMin"))$("mcapMin").value="";if($("mcapMax"))$("mcapMax").value="";if($("subIndustryFilter"))$("subIndustryFilter").value="";filterAndRender();}

// === Watchlist ===
function toggleWatchlist(symbol){var i=watchlist.indexOf(symbol);if(i>-1)watchlist.splice(i,1);else watchlist.push(symbol);localStorage.setItem("sp500-watchlist",JSON.stringify(watchlist));renderWatchlist();renderPortfolio();refreshStarStates();}
function renderWatchlist(){var section=$("watchlistSection"),grid=$("watchlistGrid"),count=$("watchlistCount");section.style.display="";
  if(!watchlist.length){count.textContent="";grid.innerHTML='<div class="watchlist-empty"><p>Star companies to build your watchlist</p><p class="empty-hint">Click the \u2606 icon on any company card</p></div>';return;}
  count.textContent="("+watchlist.length+")";grid.innerHTML=watchlist.map(function(symbol){var c=getCompany(symbol);if(!c)return "";var color=SECTOR_COLORS[c.sector]||"#58a6ff",inCmp=compareList.includes(c.symbol),hasNote=!!notes[c.symbol];
    return '<div class="company-card" data-symbol="'+c.symbol+'" draggable="true" style="border-left:3px solid '+color+'">'+(hasNote?'<div class="note-indicator"></div>':'')+'<div class="card-top-row"><h3>'+c.symbol+'</h3><div class="card-actions"><button class="compare-add-btn'+(inCmp?" in-compare":"")+'" data-compare="'+c.symbol+'">'+(inCmp?"&#10003;":"+")+
    '</button><button class="star-btn active" data-star="'+c.symbol+'">&#9733;</button></div></div><div class="company-name">'+c.name+'</div><div class="company-info"><div class="company-sector">'+c.sector+'</div>'+(c.marketCapBillions?'<div class="company-mcap">'+formatMcap(c.marketCapBillions)+'</div>':'')+'</div></div>';}).join("");}
function refreshStarStates(){document.querySelectorAll("[data-star]").forEach(function(btn){btn.classList.toggle("active",watchlist.includes(btn.dataset.star));});if(currentSymbol){var ds=$("dashStarBtn"),a=watchlist.includes(currentSymbol);ds.classList.toggle("active",a);ds.innerHTML=a?"&#9733;":"&#9734;";}}

// === Drag-and-Drop Watchlist ===
function setupWatchlistDragDrop(){var grid=$("watchlistGrid"),dragSrc=null;if(!grid||grid._dndBound)return;grid._dndBound=true;
  grid.addEventListener("dragstart",function(e){var card=e.target.closest(".company-card");if(!card)return;dragSrc=card;card.classList.add("dragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",card.dataset.symbol);});
  grid.addEventListener("dragend",function(e){var card=e.target.closest(".company-card");if(card)card.classList.remove("dragging");grid.querySelectorAll(".drag-over").forEach(function(el){el.classList.remove("drag-over");});dragSrc=null;});
  grid.addEventListener("dragover",function(e){e.preventDefault();e.dataTransfer.dropEffect="move";});
  grid.addEventListener("dragenter",function(e){var card=e.target.closest(".company-card");if(card&&card!==dragSrc){grid.querySelectorAll(".drag-over").forEach(function(el){el.classList.remove("drag-over");});card.classList.add("drag-over");}});
  grid.addEventListener("dragleave",function(e){var card=e.target.closest(".company-card");if(card&&!card.contains(e.relatedTarget))card.classList.remove("drag-over");});
  grid.addEventListener("drop",function(e){e.preventDefault();var target=e.target.closest(".company-card");if(!target||!dragSrc||target===dragSrc)return;var from=watchlist.indexOf(dragSrc.dataset.symbol),to=watchlist.indexOf(target.dataset.symbol);if(from<0||to<0)return;watchlist.splice(from,1);watchlist.splice(to,0,dragSrc.dataset.symbol);localStorage.setItem("sp500-watchlist",JSON.stringify(watchlist));renderWatchlist();renderPortfolio();});}

// === Comparison ===
function addToCompare(s){if(compareList.includes(s)||compareList.length>=MAX_COMPARE)return;compareList.push(s);updateCompareBar();refreshCompareButtons();}
function removeFromCompare(s){compareList=compareList.filter(function(x){return x!==s;});updateCompareBar();refreshCompareButtons();}
function refreshCompareButtons(){document.querySelectorAll("[data-compare]").forEach(function(btn){var a=compareList.includes(btn.dataset.compare);btn.classList.toggle("in-compare",a);btn.innerHTML=a?"&#10003;":"+";});if(currentSymbol){var dc=$("dashCompareBtn"),ic=compareList.includes(currentSymbol);dc.classList.toggle("in-compare",ic);dc.textContent=ic?"In Compare":"+ Compare";}}
function updateCompareBar(){var bar=$("compareBar");if(!compareList.length){bar.classList.remove("active");return;}bar.classList.add("active");$("compareChips").innerHTML=compareList.map(function(s){return '<span class="compare-chip">'+s+'<button class="chip-x" data-removecmp="'+s+'">&times;</button></span>';}).join("");$("compareGoBtn").disabled=compareList.length<2;}
function openComparison(){if(compareList.length<2)return;$("compareSubtitle").textContent=compareList.join(" vs ");createEmbedWidget($("compareChartArea"),"https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js",{symbols:compareList.map(function(s){return [s.replace(".","-"),s+"|1D"];}),chartOnly:false,width:"100%",height:500,locale:"en",colorTheme:getTheme(),autosize:true,showVolume:false,scalePosition:"right",scaleMode:"Percentage",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",dateRanges:["1d|1","1m|30","3m|60","12m|1D","60m|1W","all|1M"]});$("compareOverlay").classList.add("active");document.body.style.overflow="hidden";}
function closeComparison(){$("compareOverlay").classList.remove("active");$("compareChartArea").innerHTML="";if(!$("dashboardOverlay").classList.contains("active"))document.body.style.overflow="";}

// === Portfolio Tracker ===
function renderPortfolio(){var section=$("portfolioSection");if(!section)return;if(!watchlist.length){section.style.display="none";return;}section.style.display="";
  var listEl=$("portfolioList");listEl.innerHTML=watchlist.map(function(symbol){var c=getCompany(symbol);if(!c)return "";var amt=portfolio[symbol]||"";return '<div class="portfolio-item"><span class="portfolio-item-symbol">'+c.symbol+'</span><span class="portfolio-item-name">'+c.name+'</span><input type="number" class="portfolio-input" data-symbol="'+c.symbol+'" value="'+amt+'" placeholder="$0" min="0" step="100"></div>';}).join("");
  listEl.querySelectorAll(".portfolio-input").forEach(function(input){input.addEventListener("input",debounce(function(){var val=parseFloat(input.value)||0;if(val>0)portfolio[input.dataset.symbol]=val;else delete portfolio[input.dataset.symbol];localStorage.setItem("sp500_portfolio",JSON.stringify(portfolio));updatePortfolioSummary();},300));});updatePortfolioSummary();}
function updatePortfolioSummary(){var summaryEl=$("portfolioSummary");if(!summaryEl)return;var entries=watchlist.filter(function(s){return portfolio[s]>0;}).map(function(s){return {symbol:s,amount:portfolio[s]};});var total=entries.reduce(function(sum,e){return sum+e.amount;},0);
  if(total===0){summaryEl.innerHTML='<div class="portfolio-total-label">Total Invested</div><div class="portfolio-total-value">$0</div><p style="font-size:0.8rem;color:var(--text-dim);text-align:center">Enter amounts to see allocation</p>';return;}
  var cx=70,cy=70,r=60,ir=38,a=-Math.PI/2,paths="",legend="";entries.forEach(function(entry,i){var frac=entry.amount/total,sweep=frac*2*Math.PI,color=PORTFOLIO_COLORS[i%PORTFOLIO_COLORS.length],pct=(frac*100).toFixed(1),large=sweep>Math.PI?1:0;var x1=cx+r*Math.cos(a),y1=cy+r*Math.sin(a),x2=cx+r*Math.cos(a+sweep),y2=cy+r*Math.sin(a+sweep),ix1=cx+ir*Math.cos(a+sweep),iy1=cy+ir*Math.sin(a+sweep),ix2=cx+ir*Math.cos(a),iy2=cy+ir*Math.sin(a);
    paths+='<path d="M'+x1+','+y1+' A'+r+','+r+' 0 '+large+' 1 '+x2+','+y2+' L'+ix1+','+iy1+' A'+ir+','+ir+' 0 '+large+' 0 '+ix2+','+iy2+'Z" fill="'+color+'" opacity="0.85"><title>'+entry.symbol+': $'+entry.amount.toLocaleString()+' ('+pct+'%)</title></path>';
    legend+='<div class="portfolio-legend-row"><span class="portfolio-legend-dot" style="background:'+color+'"></span><span class="portfolio-legend-symbol">'+entry.symbol+'</span><span class="portfolio-legend-pct">'+pct+'%</span></div>';a+=sweep;});
  summaryEl.innerHTML='<div class="portfolio-total-label">Total Invested</div><div class="portfolio-total-value">$'+total.toLocaleString()+'</div><svg viewBox="0 0 140 140" class="portfolio-donut-svg">'+paths+'</svg><div class="portfolio-legend">'+legend+'</div>';}
function clearPortfolio(){portfolio={};localStorage.setItem("sp500_portfolio",JSON.stringify(portfolio));renderPortfolio();}

// === Sort & Filter ===
function sortCompanies(list){var s=list.slice();switch(currentSort){case "symbol-asc":return s.sort(function(a,b){return a.symbol.localeCompare(b.symbol);});case "symbol-desc":return s.sort(function(a,b){return b.symbol.localeCompare(a.symbol);});case "name-asc":return s.sort(function(a,b){return a.name.localeCompare(b.name);});case "name-desc":return s.sort(function(a,b){return b.name.localeCompare(a.name);});case "sector":return s.sort(function(a,b){return a.sector.localeCompare(b.sector)||a.symbol.localeCompare(b.symbol);});case "mcap-desc":return s.sort(function(a,b){return (b.marketCapBillions||0)-(a.marketCapBillions||0);});case "mcap-asc":return s.sort(function(a,b){return (a.marketCapBillions||0)-(b.marketCapBillions||0);});default:return s;}}
function filterAndRender(){var query=$("searchInput").value.toLowerCase().trim(),sector=$("sectorFilter").value,subInd=$("subIndustryFilter")?$("subIndustryFilter").value:"",mcMin=$("mcapMin")?parseFloat($("mcapMin").value):NaN,mcMax=$("mcapMax")?parseFloat($("mcapMax").value):NaN;
  var filtered=SP500.filter(function(c){return (!query||c.symbol.toLowerCase().includes(query)||c.name.toLowerCase().includes(query))&&(!sector||c.sector===sector)&&(!subInd||c.subIndustry===subInd)&&(isNaN(mcMin)||(c.marketCapBillions||0)>=mcMin)&&(isNaN(mcMax)||(c.marketCapBillions||0)<=mcMax);});
  filtered=sortCompanies(filtered);renderCompanies(filtered);}
function clearAllFilters(){$("searchInput").value="";$("sectorFilter").value="";currentSort="default";$("sortSelect").value="default";if($("subIndustryFilter"))$("subIndustryFilter").value="";if($("mcapMin"))$("mcapMin").value="";if($("mcapMax"))$("mcapMax").value="";filterAndRender();}
function renderCompanies(list){var grid=$("companiesGrid"),countEl=$("resultsCount");filteredList=list;renderedCount=0;grid.innerHTML="";if(!list.length){grid.innerHTML='<div class="no-results">No companies match your search.<br><button class="clear-filters-btn" onclick="clearAllFilters()">Clear all filters</button></div>';countEl.textContent="0 of "+SP500.length+" companies";$("lazySentinel").style.display="none";return;}countEl.textContent="Showing "+list.length+" of "+SP500.length+" companies";renderBatch();}

// === Lazy Load (search highlight + sector borders + notes) ===
function renderBatch(){var grid=$("companiesGrid"),end=Math.min(renderedCount+BATCH_SIZE,filteredList.length),frag=document.createDocumentFragment(),query=$("searchInput").value.toLowerCase().trim();
  for(var i=renderedCount;i<end;i++){var c=filteredList[i],starred=watchlist.includes(c.symbol),inCmp=compareList.includes(c.symbol),color=SECTOR_COLORS[c.sector]||"#58a6ff",hasNote=!!notes[c.symbol],symHtml=highlightText(c.symbol,query),nameHtml=highlightText(c.name,query);
    var card=document.createElement("div");card.className="company-card";card.dataset.symbol=c.symbol;card.style.borderLeft="3px solid "+color;card.setAttribute("role","button");card.setAttribute("tabindex","0");
    card.innerHTML=(hasNote?'<div class="note-indicator"></div>':'')+'<div class="card-top-row"><h3>'+symHtml+'</h3><div class="card-actions"><button class="compare-add-btn'+(inCmp?" in-compare":"")+'" data-compare="'+c.symbol+'">'+(inCmp?"&#10003;":"+")+
      '</button><button class="star-btn'+(starred?" active":"")+'" data-star="'+c.symbol+'">&#9733;</button></div></div><div class="company-name">'+nameHtml+'</div><div class="company-info"><div class="company-sector">'+c.sector+'</div><div class="company-sub-industry">'+c.subIndustry+'</div>'+(c.marketCapBillions?'<div class="company-mcap">'+formatMcap(c.marketCapBillions)+'</div>':'')+'</div>';frag.appendChild(card);}
  grid.appendChild(frag);renderedCount=end;$("lazySentinel").style.display=renderedCount>=filteredList.length?"none":"";}
function initLazyLoad(){new IntersectionObserver(function(entries){if(entries[0].isIntersecting&&renderedCount<filteredList.length)renderBatch();},{rootMargin:"300px"}).observe($("lazySentinel"));}

// === Top Companies (mini charts) ===
function renderTopCompanies(){var container=$("topCompanies");TOP_COMPANIES.forEach(function(symbol){var company=getCompany(symbol);if(!company)return;var card=document.createElement("div");card.className="top-card";card.dataset.symbol=company.symbol;card.setAttribute("role","button");card.setAttribute("tabindex","0");
  card.innerHTML='<div class="top-card-header"><div class="top-symbol">'+company.symbol+'</div><div class="top-name">'+company.name+'</div>'+(company.marketCapBillions?'<div class="top-mcap">'+formatMcap(company.marketCapBillions)+'</div>':'')+'</div><div class="top-card-chart" data-symbol="'+company.symbol+'"></div>';
  card.addEventListener("click",function(){openDashboard(company.symbol);});card.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();openDashboard(company.symbol);}});container.appendChild(card);});}
function loadMiniCharts(){var charts=document.querySelectorAll(".top-card-chart[data-symbol]"),observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting&&!entry.target.dataset.loaded){entry.target.dataset.loaded="true";createEmbedWidget(entry.target,"https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js",{symbol:entry.target.dataset.symbol.replace(".","-"),width:"100%",height:"100%",locale:"en",dateRange:"1M",colorTheme:getTheme(),isTransparent:true,autosize:true,largeChartUrl:""});observer.unobserve(entry.target);}});},{rootMargin:"100px"});charts.forEach(function(c){observer.observe(c);});}
function buildPickerStrip(){var strip=$("pickerStrip");strip.innerHTML=TOP_COMPANIES.map(function(symbol){var c=getCompany(symbol);if(!c)return "";return '<div class="picker-chip" data-symbol="'+c.symbol+'" role="button" tabindex="0"><div class="picker-chip-symbol">'+c.symbol+'</div><div class="picker-chip-name">'+c.name+'</div></div>';}).join("");strip.addEventListener("click",function(e){var chip=e.target.closest(".picker-chip");if(chip)openDashboard(chip.dataset.symbol);});strip.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){var chip=e.target.closest(".picker-chip");if(chip){e.preventDefault();openDashboard(chip.dataset.symbol);}}});}

// === Notes ===
function toggleNoteEditor(){var el=$("dashNote");if(!el)return;var vis=el.style.display!=="none";el.style.display=vis?"none":"";if(!vis&&currentSymbol){$("dashNoteText").value=notes[currentSymbol]||"";$("dashNoteText").focus();}if($("dashNoteDelete"))$("dashNoteDelete").style.display=notes[currentSymbol]?"":"none";updateNoteBtn();}
function saveNote(){if(!currentSymbol)return;var text=$("dashNoteText").value.trim();if(text)notes[currentSymbol]=text;else delete notes[currentSymbol];localStorage.setItem("sp500_notes",JSON.stringify(notes));$("dashNote").style.display="none";updateNoteBtn();}
function deleteNote(){if(!currentSymbol)return;delete notes[currentSymbol];localStorage.setItem("sp500_notes",JSON.stringify(notes));$("dashNoteText").value="";$("dashNote").style.display="none";updateNoteBtn();}
function updateNoteBtn(){var btn=$("dashNoteBtn");if(!btn||!currentSymbol)return;var has=!!notes[currentSymbol];btn.classList.toggle("has-note",has);btn.textContent=has?"Edit Note":"Note";}

// === Dashboard Tabs (lazy load) ===
function switchDashTab(name){if(name===activeTab)return;activeTab=name;var tabs=$("dashTabs");if(!tabs)return;tabs.querySelectorAll(".dash-tab").forEach(function(t){t.classList.toggle("active",t.dataset.tab===name);});var map={chart:"tabChart",technicals:"tabTechnicals",fundamentals:"tabFundamentals",news:"tabNews"};Object.keys(map).forEach(function(k){var p=$(map[k]);if(p)p.classList.toggle("active",k===name);});loadTabContent(name);}
function loadTabContent(tab){if(loadedTabs[tab]||!currentSymbol)return;loadedTabs[tab]=true;var tvSymbol=currentSymbol.replace(".","-"),theme=getTheme();
  switch(tab){case "chart":var chartEl=$("dashChart");if(!chartEl)break;chartEl.innerHTML="";var widgetHost=document.createElement("div");widgetHost.id="tradingview-widget-main";widgetHost.style.height="100%";widgetHost.style.width="100%";chartEl.appendChild(widgetHost);if(typeof TradingView!=="undefined"&&TradingView.widget){new TradingView.widget({autosize:true,symbol:tvSymbol,interval:"D",timezone:"Etc/UTC",theme:theme,style:"1",locale:"en",toolbar_bg:theme==="dark"?"#161b22":"#f6f8fa",enable_publishing:false,hide_top_toolbar:false,hide_legend:false,save_image:true,container_id:"tradingview-widget-main",allow_symbol_change:true,details:true,hotlist:true,calendar:true,show_popup_button:true,popup_width:"1000",popup_height:"650",withdateranges:true,range:"6M",hide_side_toolbar:false,studies:["STD;Bollinger_Bands","STD;MACD","STD;RSI"],support_host:"https://www.tradingview.com"});}break;
    case "technicals":createEmbedWidget($("dashTechnical"),"https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js",{interval:"1D",width:"100%",isTransparent:true,height:400,symbol:tvSymbol,showIntervalTabs:true,displayMode:"single",locale:"en",colorTheme:theme});break;
    case "fundamentals":createEmbedWidget($("dashFinancials"),"https://s3.tradingview.com/external-embedding/embed-widget-financials.js",{colorTheme:theme,isTransparent:true,displayMode:"regular",width:"100%",height:400,symbol:tvSymbol,locale:"en"});break;
    case "news":createEmbedWidget($("dashTimeline"),"https://s3.tradingview.com/external-embedding/embed-widget-timeline.js",{feedMode:"symbol",symbol:tvSymbol,colorTheme:theme,isTransparent:true,displayMode:"regular",width:"100%",height:350,locale:"en"});break;}}

// === Dashboard ===
function openDashboard(symbol){var company=getCompany(symbol);if(!company)return;currentSymbol=symbol;activeTab="chart";loadedTabs={};
  $("dashSymbol").textContent=company.symbol;$("dashName").textContent=company.name;$("dashSector").textContent=company.sector;$("dashIndustry").textContent=company.subIndustry;var mcapEl=$("dashMcap");if(mcapEl)mcapEl.textContent=company.marketCapBillions?formatMcap(company.marketCapBillions):"";
  document.querySelectorAll(".dash-tab").forEach(function(t){t.classList.toggle("active",t.dataset.tab==="chart");});document.querySelectorAll(".tab-pane").forEach(function(p){p.classList.toggle("active",p.id==="tabChart");});
  $("dashChart").innerHTML="";$("dashTechnical").innerHTML="";$("dashFinancials").innerHTML="";$("dashTimeline").innerHTML="";
  var tvSymbol=company.symbol.replace(".","-");createEmbedWidget($("dashSymbolInfo"),"https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js",{symbol:tvSymbol,width:"100%",locale:"en",colorTheme:getTheme(),isTransparent:true});loadTabContent("chart");
  var starred=watchlist.includes(symbol),ds=$("dashStarBtn");ds.innerHTML=starred?"&#9733;":"&#9734;";ds.classList.toggle("active",starred);var dc=$("dashCompareBtn"),ic=compareList.includes(symbol);dc.classList.toggle("in-compare",ic);dc.textContent=ic?"In Compare":"+ Compare";
  updateNoteBtn();$("dashNote").style.display="none";$("pickerStrip").querySelectorAll(".picker-chip").forEach(function(chip){chip.classList.toggle("active",chip.dataset.symbol===symbol);});
  var ov=$("dashboardOverlay");ov.classList.add("active");document.body.style.overflow="hidden";$("dashClose").focus();setupFocusTrap(ov);history.replaceState(null,"","#"+symbol);}
function closeDashboard(){var ov=$("dashboardOverlay");ov.classList.remove("active");document.body.style.overflow="";$("dashChart").innerHTML="";$("dashSymbolInfo").innerHTML="";$("dashTechnical").innerHTML="";$("dashFinancials").innerHTML="";$("dashTimeline").innerHTML="";if(ov._trapHandler){ov.removeEventListener("keydown",ov._trapHandler);ov._trapHandler=null;}currentSymbol=null;loadedTabs={};history.replaceState(null,"",window.location.pathname+window.location.search);}
function navigateDashboard(dir){if(!currentSymbol)return;var list=filteredList.length?filteredList:SP500,idx=list.findIndex(function(c){return c.symbol===currentSymbol;});if(idx<0)return;openDashboard(list[(idx+dir+list.length)%list.length].symbol);}

// === Focus Trap ===
function setupFocusTrap(modal){if(modal._trapHandler)modal.removeEventListener("keydown",modal._trapHandler);modal._trapHandler=function(e){if(e.key!=="Tab")return;var f=modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');if(!f.length)return;if(e.shiftKey){if(document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus();}}else{if(document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus();}}};modal.addEventListener("keydown",modal._trapHandler);}
function setAppAriaHidden(hidden){var header=document.querySelector("header"),main=document.querySelector("main"),footer=document.querySelector("footer");[header,main,footer].forEach(function(el){if(!el)return;if(hidden)el.setAttribute("aria-hidden","true");else el.removeAttribute("aria-hidden");});}
function toggleShortcuts(forceOpen){var ov=$("shortcutsOverlay");if(!ov)return;var shouldOpen=typeof forceOpen==="boolean"?forceOpen:!ov.classList.contains("active");
  if(shouldOpen){lastFocusedBeforeShortcuts=document.activeElement;ov.classList.add("active");ov.setAttribute("aria-hidden","false");setAppAriaHidden(true);setupFocusTrap(ov);var closeBtn=$("shortcutsClose");if(closeBtn)closeBtn.focus();return;}
  ov.classList.remove("active");ov.setAttribute("aria-hidden","true");if(ov._trapHandler){ov.removeEventListener("keydown",ov._trapHandler);ov._trapHandler=null;}setAppAriaHidden(false);if(lastFocusedBeforeShortcuts&&typeof lastFocusedBeforeShortcuts.focus==="function")lastFocusedBeforeShortcuts.focus();lastFocusedBeforeShortcuts=null;}
function initScrollTop(){var btn=$("scrollTopBtn");window.addEventListener("scroll",function(){btn.classList.toggle("visible",window.scrollY>500);});btn.addEventListener("click",function(){window.scrollTo({top:0,behavior:"smooth"});});}
function handleHash(){var hash=window.location.hash.slice(1).toUpperCase();if(!hash)return;var company=getCompany(hash);if(!company)return;var tryOpen=function(){if(typeof TradingView!=="undefined")openDashboard(company.symbol);else setTimeout(tryOpen,200);};tryOpen();}
function exportCsv(){var list=filteredList.length?filteredList:SP500;var csv="Symbol,Name,Sector,Sub-Industry,Market Cap ($B)\n"+list.map(function(c){return '"'+c.symbol+'","'+c.name+'","'+c.sector+'","'+c.subIndustry+'",'+(c.marketCapBillions||"");}).join("\n");var blob=new Blob([csv],{type:"text/csv"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="sp500_companies.csv";a.click();URL.revokeObjectURL(a.href);}
function getGridColumns(){return getComputedStyle($("companiesGrid")).gridTemplateColumns.split(" ").length;}

// === Event Listeners ===
function setupEventListeners(){
  $("searchInput").addEventListener("input",debounce(filterAndRender,200));
  $("sectorFilter").addEventListener("change",function(){populateSubIndustries();filterAndRender();});
  $("sortSelect").addEventListener("change",function(e){currentSort=e.target.value;filterAndRender();});
  if($("toggleScreener"))$("toggleScreener").addEventListener("click",toggleScreener);
  if($("mcapMin"))$("mcapMin").addEventListener("input",debounce(filterAndRender,300));
  if($("mcapMax"))$("mcapMax").addEventListener("input",debounce(filterAndRender,300));
  if($("subIndustryFilter"))$("subIndustryFilter").addEventListener("change",filterAndRender);
  if($("resetScreener"))$("resetScreener").addEventListener("click",resetScreener);
  $("themeToggle").addEventListener("click",toggleTheme);$("exportCsv").addEventListener("click",exportCsv);
  $("dashClose").addEventListener("click",closeDashboard);$("dashboardOverlay").addEventListener("click",function(e){if(e.target===$("dashboardOverlay"))closeDashboard();});
  $("dashStarBtn").addEventListener("click",function(){if(currentSymbol)toggleWatchlist(currentSymbol);});
  $("dashCompareBtn").addEventListener("click",function(){if(!currentSymbol)return;if(compareList.includes(currentSymbol))removeFromCompare(currentSymbol);else addToCompare(currentSymbol);});
  if($("dashTabs"))$("dashTabs").addEventListener("click",function(e){var tab=e.target.closest(".dash-tab");if(tab)switchDashTab(tab.dataset.tab);});
  if($("dashNoteBtn"))$("dashNoteBtn").addEventListener("click",toggleNoteEditor);
  if($("dashNoteSave"))$("dashNoteSave").addEventListener("click",saveNote);
  if($("dashNoteCancel"))$("dashNoteCancel").addEventListener("click",function(){$("dashNote").style.display="none";});
  if($("dashNoteDelete"))$("dashNoteDelete").addEventListener("click",deleteNote);
  if($("portfolioClearBtn"))$("portfolioClearBtn").addEventListener("click",clearPortfolio);
  setupWatchlistDragDrop();
  if($("dashPortfolioBtn"))$("dashPortfolioBtn").addEventListener("click",function(){if(!currentSymbol||watchlist.includes(currentSymbol))return;toggleWatchlist(currentSymbol);setTimeout(function(){var ps=$("portfolioSection");if(ps)ps.scrollIntoView({behavior:"smooth"});},100);});
  if($("shortcutsBtn"))$("shortcutsBtn").addEventListener("click",toggleShortcuts);
  if($("shortcutsClose"))$("shortcutsClose").addEventListener("click",toggleShortcuts);
  if($("shortcutsOverlay"))$("shortcutsOverlay").addEventListener("click",function(e){if(e.target===$("shortcutsOverlay"))toggleShortcuts();});
  $("compareGoBtn").addEventListener("click",openComparison);$("compareClearBtn").addEventListener("click",function(){compareList=[];updateCompareBar();refreshCompareButtons();});
  $("compareChips").addEventListener("click",function(e){var btn=e.target.closest("[data-removecmp]");if(btn)removeFromCompare(btn.dataset.removecmp);});
  $("compareCloseBtn").addEventListener("click",closeComparison);$("compareOverlay").addEventListener("click",function(e){if(e.target===$("compareOverlay"))closeComparison();});
  document.addEventListener("click",function(e){var starBtn=e.target.closest("[data-star]");if(starBtn){e.stopPropagation();toggleWatchlist(starBtn.dataset.star);return;}var cmpBtn=e.target.closest("[data-compare]");if(cmpBtn){e.stopPropagation();var s=cmpBtn.dataset.compare;if(compareList.includes(s))removeFromCompare(s);else addToCompare(s);return;}var card=e.target.closest(".company-card");if(card&&card.dataset.symbol)openDashboard(card.dataset.symbol);});
  $("companiesGrid").addEventListener("keydown",function(e){var card=e.target.closest(".company-card");if(!card)return;if(e.key==="Enter"||e.key===" "){if(!e.target.closest("[data-star]")&&!e.target.closest("[data-compare]")){e.preventDefault();openDashboard(card.dataset.symbol);}return;}
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)){e.preventDefault();var cards=Array.from($("companiesGrid").querySelectorAll(".company-card")),idx=cards.indexOf(card);if(idx<0)return;var cols=getGridColumns(),next;switch(e.key){case "ArrowRight":next=idx+1;break;case "ArrowLeft":next=idx-1;break;case "ArrowDown":next=idx+cols;break;case "ArrowUp":next=idx-cols;break;}if(next>=0&&next<cards.length)cards[next].focus();}});
  document.addEventListener("keydown",function(e){var tag=document.activeElement?document.activeElement.tagName:"",isInput=tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT",dashOpen=$("dashboardOverlay").classList.contains("active"),compareOpen=$("compareOverlay").classList.contains("active"),shortcutsOpen=$("shortcutsOverlay")&&$("shortcutsOverlay").classList.contains("active");
    if(e.key==="Escape"){if(shortcutsOpen){toggleShortcuts();return;}if(isInput&&document.activeElement===$("searchInput")){$("searchInput").value="";$("searchInput").blur();filterAndRender();return;}if(compareOpen){closeComparison();return;}if(dashOpen){closeDashboard();return;}return;}
    if(e.key==="?"&&!isInput){e.preventDefault();toggleShortcuts();return;}if(isInput)return;if(e.key==="/"){e.preventDefault();$("searchInput").focus();return;}
    if(dashOpen){if(e.key==="ArrowLeft"){navigateDashboard(-1);return;}if(e.key==="ArrowRight"){navigateDashboard(1);return;}if(e.key==="s"||e.key==="S"){if(currentSymbol)toggleWatchlist(currentSymbol);return;}if(e.key==="c"||e.key==="C"){if(currentSymbol){if(compareList.includes(currentSymbol))removeFromCompare(currentSymbol);else addToCompare(currentSymbol);}return;}var tabMap={"1":"chart","2":"technicals","3":"fundamentals","4":"news"};if(tabMap[e.key]){switchDashTab(tabMap[e.key]);return;}}
    if(e.key==="t"||e.key==="T"){toggleTheme();return;}if(e.key==="w"||e.key==="W"){var ws=$("watchlistSection");if(ws&&ws.style.display!=="none")ws.scrollIntoView({behavior:"smooth"});}});
  window.addEventListener("hashchange",function(){var hash=window.location.hash.slice(1).toUpperCase();if(hash){var c=getCompany(hash);if(c&&currentSymbol!==c.symbol)openDashboard(c.symbol);}else if(currentSymbol)closeDashboard();});
}
init();
