"use strict";
const S={root:null,op:"enoden",date:"",daily:null};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const nsort=(a,b)=>String(a).localeCompare(String(b),"ja",{numeric:true});
function url(op,d){const [y,m]=d.split("-");return `./data/${op}/${y}/${m}/${d}.json`;}
function route(o){return [o.route_no,o.route_name].filter(Boolean).join(" ")||"路線不明";}
function draw(){
  if(!S.daily)return;
  const q=$("search").value.trim().toLowerCase();
  const e=Object.entries(S.daily.vehicles||{}).filter(([v])=>!q||v.toLowerCase().includes(q)).sort(([a],[b])=>nsort(a,b));
  $("summary").textContent=`${S.daily.operator_label} / ${S.daily.date} / ${S.daily.vehicle_count}台・${S.daily.operation_count}運行`;
  $("status").textContent=e.length?"":"該当車両なし";
  $("list").innerHTML=e.map(([v,ops],i)=>`<article class="vehicle ${i%2?"alt":""}">
    <div class="vh"><strong>${esc(v)}</strong><span>${ops.length}運行</span></div>
    ${ops.map(o=>`<div class="op"><div class="route">${esc(route(o))}</div>
    <div>${esc([o.origin_stop,o.departure_time].filter(Boolean).join(" ")||"始発不明")} → ${esc([o.destination_stop,o.arrival_time].filter(Boolean).join(" ")||"終着不明")}</div></div>`).join("")}
  </article>`).join("");
}
function tabs(){
  $("tabs").innerHTML="";
  for(const [id,x] of Object.entries(S.root.operators||{})){
    const b=document.createElement("button"); b.textContent=x.label; b.className=id===S.op?"active":"";
    b.onclick=async()=>{S.op=id;$("search").value="";tabs();dates();await load();}; $("tabs").appendChild(b);
  }
}
function dates(){
  const ds=S.root.operators?.[S.op]?.dates||[];
  $("date").innerHTML=ds.map(d=>`<option>${esc(d)}</option>`).join("");
  S.date=ds[0]||""; $("date").value=S.date;
}
async function load(){
  S.date=$("date").value||S.date;if(!S.date){$("status").textContent="履歴なし";return;}
  $("status").textContent="読み込み中..."; $("list").innerHTML="";
  try{const r=await fetch(url(S.op,S.date),{cache:"no-cache"});if(!r.ok)throw new Error(r.status);S.daily=await r.json();draw();}
  catch(e){console.error(e);$("status").textContent="読み込み失敗";}
}
(async()=>{
  try{const r=await fetch("./data/index.json",{cache:"no-cache"});S.root=await r.json();
    const ids=Object.keys(S.root.operators||{});if(!ids.includes(S.op))S.op=ids[0]||"";
    $("updated").textContent=S.root.generated_at?`最終更新 ${S.root.generated_at}`:"";
    tabs();dates();await load();
  }catch(e){$("status").textContent="先に日次エクスポートを実行してください";}
})();
$("date").onchange=load;$("search").oninput=draw;
