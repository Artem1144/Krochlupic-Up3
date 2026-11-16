/* Krochlupic Up! — Wandering Trader event */
(function(){
  "use strict";
  var KEY="ku_wandering_trader_v1";
  var PERIOD=6*60*60*1000;
  var DEALS=[
    {id:"crystal",icon:"💎",title:"Кристалл",give:"coins",cost:50000,take:"crystals",amount:1,desc:"50 000 монет → 1 кристалл"},
    {id:"shard",icon:"🌑",title:"Кровавый осколок",give:"crystals",cost:20,take:"shards",amount:1,desc:"20 кристаллов → 1 осколок"},
    {id:"coins",icon:"🪙",title:"Мешочек монет",give:"shards",cost:1,take:"coins",amount:25000,desc:"1 осколок → 25 000 монет"}
  ];
  var state;
  try{state=JSON.parse(localStorage.getItem(KEY)||"null");}catch(e){state=null;}
  if(!state||typeof state!=="object"){
    state={nextAt:Date.now()+PERIOD,visit:0,arrived:false,used:[],seen:false};
    persist();
  }
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
  function amount(key){var n=window[key];return typeof n==="number"&&isFinite(n)?n:0;}
  function fmt(n){try{return Math.floor(n).toLocaleString("ru-RU");}catch(e){return String(Math.floor(n));}}
  function spend(key,n){if(amount(key)<n)return false;window[key]=amount(key)-n;return true;}
  function add(key,n){window[key]=amount(key)+n;}
  function ensureUI(){
    if(document.getElementById("ku-trader-launch"))return;
    var anchor=document.getElementById("counter")||document.body;
    var btn=document.createElement("button");
    btn.id="ku-trader-launch";btn.type="button";btn.className="ku-trader-launch";
    btn.innerHTML='<span>🧳</span><span>Странствующий торговец</span><b id="ku-trader-state">⏳</b>';
    btn.addEventListener("click",function(){if(state.arrived)openModal();else toast("Торговец ещё в пути. Прибудет через "+remaining());});
    anchor.insertAdjacentElement("afterend",btn);
    var modal=document.createElement("div");modal.id="ku-trader-modal";modal.className="ku-trader-overlay ku-hidden";
    modal.innerHTML='<section class="ku-trader-panel" role="dialog" aria-modal="true" aria-labelledby="ku-trader-title"><button type="button" class="ku-trader-close" id="ku-trader-close" aria-label="Закрыть">✕</button><div class="ku-trader-portrait">🧙‍♂️</div><div class="ku-trader-kicker">РЕДКИЙ ГОСТЬ • КАЖДЫЕ 6 ЧАСОВ</div><h2 id="ku-trader-title">Странствующий торговец</h2><p class="ku-trader-intro">«У меня найдётся кое-что ценное. Обмен честный — выбирай с умом»</p><div class="ku-trader-wallet" id="ku-trader-wallet"></div><div class="ku-trader-deals" id="ku-trader-deals"></div><p class="ku-trader-foot" id="ku-trader-foot">Каждую сделку можно совершить один раз за визит.</p></section>';
    document.body.appendChild(modal);
    modal.addEventListener("click",function(e){if(e.target===modal)closeModal();});
    document.getElementById("ku-trader-close").addEventListener("click",closeModal);
  }
  function toast(msg){
    var old=document.getElementById("ku-trader-toast");if(old)old.remove();
    var el=document.createElement("div");el.id="ku-trader-toast";el.className="ku-trader-toast";el.textContent=msg;document.body.appendChild(el);
    setTimeout(function(){el.classList.add("ku-toast-out");setTimeout(function(){el.remove();},350);},3200);
  }
  function remaining(){
    var ms=Math.max(0,state.nextAt-Date.now()),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);
    return h+"ч "+m+"м "+s+"с";
  }
  function openModal(){
    ensureUI();if(!state.arrived)return;
    document.getElementById("ku-trader-modal").classList.remove("ku-hidden");
    renderDeals();
  }
  function closeModal(){var m=document.getElementById("ku-trader-modal");if(m)m.classList.add("ku-hidden");}
  function renderDeals(){
    var wallet=document.getElementById("ku-trader-wallet");
    wallet.innerHTML="🪙 "+fmt(amount("coins"))+"　💎 "+fmt(amount("crystals"))+"　🌑 "+fmt(amount("shards"));
    var box=document.getElementById("ku-trader-deals");box.innerHTML="";
    DEALS.forEach(function(d){
      var used=state.used.indexOf(d.id)!==-1,can=amount(d.give)>=d.cost;
      var card=document.createElement("article");card.className="ku-trader-deal"+(used?" is-used":"");
      var title=document.createElement("h3");title.textContent=d.icon+" "+d.title;
      var desc=document.createElement("p");desc.textContent=d.desc;
      var btn=document.createElement("button");btn.type="button";btn.className="ku-trader-trade";
      btn.textContent=used?"✓ Уже обменяно":(can?"Обменять":"Недостаточно ресурсов");
      btn.disabled=used||!can;
      btn.addEventListener("click",function(){trade(d);});
      card.append(title,desc,btn);box.appendChild(card);
    });
    document.getElementById("ku-trader-foot").textContent="Сделки доступны один раз за визит. Следующий торговец прибудет через "+remaining()+".";
  }
  function trade(d){
    if(!state.arrived||state.used.indexOf(d.id)!==-1)return;
    if(!spend(d.give,d.cost)){renderDeals();return;}
    add(d.take,d.amount);state.used.push(d.id);persist();
    if(typeof window.saveGame==="function")window.saveGame();
    if(typeof window.updateUI==="function")window.updateUI();
    renderDeals();toast("Обмен завершён: "+d.desc);
  }
  function arrive(){
    state.arrived=true;state.used=[];state.visit=(state.visit||0)+1;state.nextAt=Date.now()+PERIOD;persist();
    ensureUI();var b=document.getElementById("ku-trader-state");if(b)b.textContent="🎁 Прибыл!";
    toast("🧳 Странствующий торговец прибыл! Загляни к нему за обменом.");
    openModal();
  }
  function tick(){
    ensureUI();
    var badge=document.getElementById("ku-trader-state");
    if(!state.arrived&&Date.now()>=state.nextAt)arrive();
    if(badge)badge.textContent=state.arrived?"🎁 Прибыл!":"⏳ "+remaining();
    var modal=document.getElementById("ku-trader-modal");
    if(modal&&!modal.classList.contains("ku-hidden")&&state.arrived)renderWalletOnly();
  }
  function renderWalletOnly(){
    var w=document.getElementById("ku-trader-wallet");if(w)w.textContent="🪙 "+fmt(amount("coins"))+"　💎 "+fmt(amount("crystals"))+"　🌑 "+fmt(amount("shards"));
  }
  function init(){ensureUI();tick();setInterval(tick,1000);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
