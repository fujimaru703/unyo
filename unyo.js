"use strict";

const S={
  root:null,
  op:"enoden",
  date:"",
  daily:null,
  vehicleTimer:null
};

const $=id=>document.getElementById(id);

const esc=s=>String(s??"")
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;")
  .replaceAll('"',"&quot;");

const nsort=(a,b)=>
  String(a).localeCompare(String(b),"ja",{numeric:true});

function dailyUrl(op,d){
  const [y,m]=d.split("-");
  return `./data/${op}/${y}/${m}/${d}.json`;
}

function vehicleUrl(op,v){
  return `./data/${op}/vehicles/${encodeURIComponent(v)}.json`;
}

function route(o){
  return [o.route_no,o.route_name]
    .filter(Boolean)
    .join(" ") || "路線不明";
}

function operationHtml(o){
  return `
    <div class="op">
      <div class="route">${esc(route(o))}</div>
      <div>
        ${esc(
          [o.origin_stop,o.departure_time]
            .filter(Boolean)
            .join(" ") || "始発不明"
        )}
        →
        ${esc(
          [o.destination_stop,o.arrival_time]
            .filter(Boolean)
            .join(" ") || "終着不明"
        )}
      </div>
    </div>
  `;
}

/* -------------------------------------------------
   通常の日別表示
------------------------------------------------- */

function drawDaily(){
  if(!S.daily)return;

  const q=$("search").value.trim().toLowerCase();

  const entries=Object.entries(S.daily.vehicles||{})
    .filter(([v])=>
      !q || v.toLowerCase().includes(q)
    )
    .sort(([a],[b])=>nsort(a,b));

  $("summary").textContent=
    `${S.daily.operator_label} / ${S.daily.date} / `+
    `${S.daily.vehicle_count}台・${S.daily.operation_count}運行`;

  $("status").textContent=
    entries.length ? "" : "該当車両なし";

  $("list").innerHTML=
    entries.map(([v,ops],i)=>`
      <article class="vehicle ${i%2?"alt":""}">
        <div class="vh">
          <strong>${esc(v)}</strong>
          <span>${ops.length}運行</span>
        </div>

        ${ops.map(operationHtml).join("")}
      </article>
    `).join("");
}

/* -------------------------------------------------
   車番別の最近の運用
------------------------------------------------- */

function drawVehicleHistory(data){

  const days=[...(data.days||[])]
    .sort((a,b)=>
      String(b.date).localeCompare(String(a.date))
    );

  const total=days.reduce(
    (n,d)=>n+(d.operations?.length||0),
    0
  );

  $("summary").textContent=
    `${data.operator_label || ""} / `+
    `${data.vehicle_no}号車 / 最近の運用`;

  $("status").textContent=
    days.length ? "" : "運用履歴なし";

  $("list").innerHTML=
    days.map((day,i)=>{

      const ops=day.operations||[];

      return `
        <article class="vehicle ${i%2?"alt":""}">

          <div class="vh">
            <strong>${esc(day.date)}</strong>
            <span>${ops.length}運行</span>
          </div>

          ${ops.map(operationHtml).join("")}

        </article>
      `;
    }).join("");

  if(!days.length){
    $("summary").textContent=
      `${data.vehicle_no}号車 / 運用履歴なし`;
  }
}

/* -------------------------------------------------
   車番検索
------------------------------------------------- */

async function searchVehicle(){

  const q=$("search").value.trim();

  if(!q){
    drawDaily();
    return;
  }

  /*
    入力途中ではまず選択日の車番絞り込みを表示。
    完全な車番JSONが存在すれば、その後履歴表示へ切替。
  */
  drawDaily();

  try{

    const r=await fetch(
      vehicleUrl(S.op,q),
      {cache:"no-cache"}
    );

    if(r.status===404){
      return;
    }

    if(!r.ok){
      throw new Error(r.status);
    }

    /*
      fetch中に検索文字が変わった場合、
      古い結果を表示しない。
    */
    if($("search").value.trim()!==q){
      return;
    }

    const data=await r.json();

    drawVehicleHistory(data);

  }catch(e){
    console.error(
      "[vehicle history]",
      e
    );
  }
}

/* -------------------------------------------------
   事業者タブ
------------------------------------------------- */

function tabs(){

  $("tabs").innerHTML="";

  for(
    const [id,x]
    of Object.entries(S.root.operators||{})
  ){

    const b=document.createElement("button");

    b.textContent=x.label;
    b.className=id===S.op
      ? "active"
      : "";

    b.onclick=async()=>{

      S.op=id;

      $("search").value="";

      tabs();
      dates();

      await load();
    };

    $("tabs").appendChild(b);
  }
}

/* -------------------------------------------------
   日付
------------------------------------------------- */

function dates(){

  const ds=
    S.root.operators?.[S.op]?.dates || [];

  $("date").innerHTML=
    ds.map(
      d=>`<option>${esc(d)}</option>`
    ).join("");

  S.date=ds[0]||"";

  $("date").value=S.date;
}

/* -------------------------------------------------
   日別JSONロード
------------------------------------------------- */

async function load(){

  S.date=
    $("date").value || S.date;

  if(!S.date){
    $("status").textContent="履歴なし";
    return;
  }

  $("status").textContent=
    "読み込み中...";

  $("list").innerHTML="";

  try{

    const r=await fetch(
      dailyUrl(S.op,S.date),
      {cache:"no-cache"}
    );

    if(!r.ok){
      throw new Error(r.status);
    }

    S.daily=await r.json();

    /*
      車番検索中なら、その車両履歴を優先
    */
    if($("search").value.trim()){
      await searchVehicle();
    }else{
      drawDaily();
    }

  }catch(e){

    console.error(e);

    $("status").textContent=
      "読み込み失敗";
  }
}

/* -------------------------------------------------
   起動
------------------------------------------------- */

(async()=>{

  try{

    const r=await fetch(
      "./data/index.json",
      {cache:"no-cache"}
    );

    if(!r.ok){
      throw new Error(r.status);
    }

    S.root=await r.json();

    const ids=
      Object.keys(S.root.operators||{});

    if(!ids.includes(S.op)){
      S.op=ids[0]||"";
    }

    $("updated").textContent=
      S.root.generated_at
        ? `最終更新 ${S.root.generated_at}`
        : "";

    tabs();
    dates();

    await load();

  }catch(e){

    console.error(e);

    $("status").textContent=
      "先に日次エクスポートを実行してください";
  }

})();

/* -------------------------------------------------
   イベント
------------------------------------------------- */

$("date").onchange=load;

$("search").oninput=()=>{

  clearTimeout(S.vehicleTimer);

  /*
    入力中は日別一覧を即座に絞る
  */
  drawDaily();

  /*
    250ms止まったら車両履歴JSONを確認
  */
  S.vehicleTimer=setTimeout(
    searchVehicle,
    250
  );
};
