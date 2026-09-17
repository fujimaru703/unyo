"use strict";

const S = {
  root: null,
  op: "enoden",
  date: "",
  daily: null,
  vehicleTimer: null
};

const $ = id => document.getElementById(id);

const esc = s => String(s ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const nsort = (a, b) =>
  String(a).localeCompare(String(b), "ja", { numeric: true });

function dailyUrl(op, d) {
  const [y, m] = d.split("-");
  return `./data/${op}/${y}/${m}/${d}.json`;
}

function vehicleUrl(op, v) {
  return `./data/${op}/vehicles/${encodeURIComponent(v)}.json`;
}

function routeParts(o) {
  const no = String(o?.route_no ?? "").trim();
  const name = String(o?.route_name ?? "").trim();
  return {
    no: no || "―",
    name
  };
}

function fmtDate(d) {
  const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : d;
}

function tripTableHead() {
  return `
    <div class="op-head" aria-hidden="true">
      <div>系統</div>
      <div>起点・時刻</div>
      <div>終点・時刻</div>
    </div>
  `;
}

function operationHtml(o) {
  const r = routeParts(o);
  const depTime = o.departure_time || "--:--";
  const arrTime = o.arrival_time || "--:--";
  const origin = o.origin_stop || "始発不明";
  const dest = o.destination_stop || "終着不明";

  return `
    <div class="op-row">
      <div class="op-route">
        <span class="route-no">${esc(r.no)}</span>
        ${r.name ? `<span class="route-name">${esc(r.name)}</span>` : ""}
      </div>

      <div class="op-point">
        <span class="op-time">${esc(depTime)}</span>
        <span class="op-stop">${esc(origin)}</span>
      </div>

      <div class="op-point">
        <span class="op-time">${esc(arrTime)}</span>
        <span class="op-stop">${esc(dest)}</span>
      </div>
    </div>
  `;
}

function operationsTable(ops) {
  return `
    <div class="ops-table">
      ${tripTableHead()}
      ${ops.map(operationHtml).join("")}
    </div>
  `;
}

function drawDaily() {
  if (!S.daily) return;

  const q = $("search").value.trim().toLowerCase();

  const entries = Object.entries(S.daily.vehicles || {})
    .filter(([v]) => !q || v.toLowerCase().includes(q))
    .sort(([a], [b]) => nsort(a, b));

  const visibleOps = entries.reduce((n, [, ops]) => n + (ops?.length || 0), 0);

  $("summary").textContent =
    `${S.daily.operator_label || ""}　${fmtDate(S.daily.date)}　` +
    `${entries.length}台 / ${visibleOps}運行`;

  $("status").textContent = q ? `車番「${q}」で絞り込み中` : "";

  if (!entries.length) {
    $("list").innerHTML = `<div class="empty">該当する車両がありません</div>`;
    return;
  }

  $("list").innerHTML = entries.map(([v, ops]) => `
    <section class="vehicle">
      <div class="vh">
        <strong>${esc(v)}</strong>
        <span>${ops.length}運行</span>
      </div>
      ${operationsTable(ops || [])}
    </section>
  `).join("");
}

function drawVehicleHistory(data) {
  const days = [...(data.days || [])]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const total = days.reduce((n, d) => n + (d.operations?.length || 0), 0);

  $("summary").textContent =
    `${data.operator_label || ""}　${data.vehicle_no}号車　最近の運用`;

  $("status").textContent =
    `${days.length}日 / ${total}運行`;

  if (!days.length) {
    $("list").innerHTML = `<div class="empty">この車両の運用履歴はありません</div>`;
    return;
  }

  $("list").innerHTML = days.map(day => {
    const ops = day.operations || [];

    return `
      <section class="history-day">
        <div class="history-day__head">
          <div class="history-day__date">${esc(fmtDate(day.date))}</div>
          <div class="history-day__count">${ops.length}運行</div>
        </div>
        ${operationsTable(ops)}
      </section>
    `;
  }).join("");
}

async function searchVehicle() {
  const q = $("search").value.trim();

  if (!q) {
    drawDaily();
    return;
  }

  drawDaily();

  try {
    const r = await fetch(vehicleUrl(S.op, q), { cache: "no-cache" });

    if (r.status === 404) return;
    if (!r.ok) throw new Error(r.status);

    if ($("search").value.trim() !== q) return;

    const data = await r.json();
    drawVehicleHistory(data);
  } catch (e) {
    console.error("[vehicle history]", e);
  }
}

function tabs() {
  $("tabs").innerHTML = "";

  for (const [id, x] of Object.entries(S.root.operators || {})) {
    const b = document.createElement("button");
    b.textContent = x.label;
    b.className = id === S.op ? "active" : "";

    b.onclick = async () => {
      S.op = id;
      $("search").value = "";
      tabs();
      dates();
      await load();
    };

    $("tabs").appendChild(b);
  }
}

function dates() {
  const ds = S.root.operators?.[S.op]?.dates || [];

  $("date").innerHTML =
    ds.map(d => `<option value="${esc(d)}">${esc(fmtDate(d))}</option>`).join("");

  S.date = ds[0] || "";
  $("date").value = S.date;
}

async function load() {
  S.date = $("date").value || S.date;

  if (!S.date) {
    $("status").textContent = "履歴なし";
    $("list").innerHTML = "";
    return;
  }

  $("status").textContent = "読み込み中...";
  $("list").innerHTML = "";

  try {
    const r = await fetch(dailyUrl(S.op, S.date), { cache: "no-cache" });

    if (!r.ok) throw new Error(r.status);

    S.daily = await r.json();

    if ($("search").value.trim()) {
      await searchVehicle();
    } else {
      drawDaily();
    }
  } catch (e) {
    console.error(e);
    $("status").textContent = "読み込み失敗";
  }
}

(async () => {
  try {
    const r = await fetch("./data/index.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);

    S.root = await r.json();

    const ids = Object.keys(S.root.operators || {});
    if (!ids.includes(S.op)) S.op = ids[0] || "";

    $("updated").textContent =
      S.root.generated_at ? `最終更新 ${S.root.generated_at}` : "";

    tabs();
    dates();
    await load();
  } catch (e) {
    console.error(e);
    $("status").textContent = "データを読み込めませんでした";
  }
})();

$("date").onchange = load;

$("search").oninput = () => {
  clearTimeout(S.vehicleTimer);
  drawDaily();
  S.vehicleTimer = setTimeout(searchVehicle, 250);
};

$("clearSearch").onclick = () => {
  $("search").value = "";
  $("search").focus();
  drawDaily();
};
