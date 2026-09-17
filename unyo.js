"use strict";

const S = {
  root: null,
  op: "enoden",
  date: "",
  daily: null,
  vehicleTimer: null,
  bragaIndex: null
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

function shortTime(value) {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);

  if (!m) return s;

  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

/* ============================================================
   Braga / TUB JSON を既存ページ形式へ変換
   ============================================================ */

function normalizeBragaOperation(r) {
  return {
    route_no:
      String(r?.line_id ?? "").trim(),

    route_name:
      String(r?.route_name ?? "").trim(),

    departure_time:
      shortTime(r?.departure_time),

    arrival_time:
      shortTime(r?.arrival_time),

    origin_stop:
      String(r?.origin ?? "").trim(),

    destination_stop:
      String(r?.destination ?? "").trim(),

    trip_id:
      String(r?.trip_id ?? "").trim(),

    detected_at:
      String(r?.detected_at ?? "").trim()
  };
}

function normalizeBragaDaily(data, fallbackDate = "") {
  const vehicles = {};

  for (const r of data?.records || []) {
    const vehicle =
      String(r?.vehicle ?? "").trim();

    if (!vehicle) continue;

    if (!vehicles[vehicle]) {
      vehicles[vehicle] = [];
    }

    vehicles[vehicle].push(
      normalizeBragaOperation(r)
    );
  }

  for (const ops of Object.values(vehicles)) {
    ops.sort((a, b) =>
      String(a.departure_time || "")
        .localeCompare(String(b.departure_time || ""))
    );
  }

  return {
    operator: "braga",
    operator_label: "Braga / TUB",
    date: data?.date || fallbackDate,
    vehicles
  };
}

function normalizeDaily(op, data, fallbackDate = "") {
  if (op === "braga") {
    return normalizeBragaDaily(data, fallbackDate);
  }

  return data;
}

/* ============================================================
   表示
   ============================================================ */

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

  const depTime =
    o.departure_time || "--:--";

  const arrTime =
    o.arrival_time || "--:--";

  const origin =
    o.origin_stop || "始発不明";

  const dest =
    o.destination_stop || "終着不明";

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

  const q =
    $("search")
      .value
      .trim()
      .toLowerCase();

  const entries =
    Object.entries(S.daily.vehicles || {})
      .filter(([v]) =>
        !q ||
        String(v)
          .toLowerCase()
          .includes(q)
      )
      .sort(([a], [b]) =>
        nsort(a, b)
      );

  const visibleOps =
    entries.reduce(
      (n, [, ops]) =>
        n + (ops?.length || 0),
      0
    );

  $("summary").textContent =
    `${S.daily.operator_label || ""}　${fmtDate(S.daily.date)}　` +
    `${entries.length}台 / ${visibleOps}運行`;

  $("status").textContent =
    q
      ? `車番「${q}」で絞り込み中`
      : "";

  if (!entries.length) {
    $("list").innerHTML =
      `<div class="empty">該当する車両がありません</div>`;
    return;
  }

  $("list").innerHTML =
    entries
      .map(([v, ops]) => `
        <section class="vehicle">
          <div class="vh">
            <strong>${esc(v)}</strong>
            <span>${ops.length}運行</span>
          </div>
          ${operationsTable(ops || [])}
        </section>
      `)
      .join("");
}

function drawVehicleHistory(data) {
  const days =
    [...(data.days || [])]
      .sort((a, b) =>
        String(b.date)
          .localeCompare(String(a.date))
      );

  const total =
    days.reduce(
      (n, d) =>
        n + (d.operations?.length || 0),
      0
    );

  $("summary").textContent =
    `${data.operator_label || ""}　${data.vehicle_no}号車　最近の運用`;

  $("status").textContent =
    `${days.length}日 / ${total}運行`;

  if (!days.length) {
    $("list").innerHTML =
      `<div class="empty">この車両の運用履歴はありません</div>`;
    return;
  }

  $("list").innerHTML =
    days
      .map(day => {
        const ops =
          day.operations || [];

        return `
          <section class="history-day">
            <div class="history-day__head">
              <div class="history-day__date">${esc(fmtDate(day.date))}</div>
              <div class="history-day__count">${ops.length}運行</div>
            </div>
            ${operationsTable(ops)}
          </section>
        `;
      })
      .join("");
}

/* ============================================================
   Braga 車両履歴
   vehicles/*.json が無いので日別JSONから検索
   ============================================================ */

async function fetchBragaVehicleDay(date, vehicle) {
  try {
    const r =
      await fetch(
        dailyUrl("braga", date),
        { cache: "no-cache" }
      );

    if (!r.ok) {
      return null;
    }

    const data =
      await r.json();

    const operations =
      (data.records || [])
        .filter(r =>
          String(r?.vehicle ?? "").trim()
          ===
          vehicle
        )
        .map(normalizeBragaOperation)
        .sort((a, b) =>
          String(a.departure_time || "")
            .localeCompare(String(b.departure_time || ""))
        );

    if (!operations.length) {
      return null;
    }

    return {
      date,
      operations
    };

  } catch (e) {
    console.warn(
      "[Braga vehicle day]",
      date,
      e
    );

    return null;
  }
}

async function searchBragaVehicle(vehicle) {
  const dates =
    S.root?.operators?.braga?.dates || [];

  $("status").textContent =
    `Braga ${vehicle}号車の履歴を検索中...`;

  const days = [];

  // 一度に大量リクエストを送らない
  const chunkSize = 8;

  for (
    let i = 0;
    i < dates.length;
    i += chunkSize
  ) {
    if (
      S.op !== "braga" ||
      $("search").value.trim() !== vehicle
    ) {
      return;
    }

    const chunk =
      dates.slice(
        i,
        i + chunkSize
      );

    const result =
      await Promise.all(
        chunk.map(date =>
          fetchBragaVehicleDay(
            date,
            vehicle
          )
        )
      );

    days.push(
      ...result.filter(Boolean)
    );
  }

  if (
    S.op !== "braga" ||
    $("search").value.trim() !== vehicle
  ) {
    return;
  }

  drawVehicleHistory({
    operator_label:
      "Braga / TUB",

    vehicle_no:
      vehicle,

    days
  });
}

/* ============================================================
   車番検索
   ============================================================ */

async function searchVehicle() {
  const q =
    $("search")
      .value
      .trim();

  if (!q) {
    drawDaily();
    return;
  }

  drawDaily();

  if (S.op === "braga") {
    await searchBragaVehicle(q);
    return;
  }

  try {
    const r =
      await fetch(
        vehicleUrl(S.op, q),
        { cache: "no-cache" }
      );

    if (r.status === 404) {
      return;
    }

    if (!r.ok) {
      throw new Error(r.status);
    }

    if (
      $("search").value.trim() !== q
    ) {
      return;
    }

    const data =
      await r.json();

    drawVehicleHistory(data);

  } catch (e) {
    console.error(
      "[vehicle history]",
      e
    );
  }
}

/* ============================================================
   事業者・日付
   ============================================================ */

function tabs() {
  $("tabs").innerHTML = "";

  for (
    const [id, x]
    of Object.entries(
      S.root.operators || {}
    )
  ) {
    const b =
      document.createElement(
        "button"
      );

    b.textContent =
      x.label;

    b.className =
      id === S.op
        ? "active"
        : "";

    b.onclick =
      async () => {
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
  const ds =
    [...(
      S.root
        .operators?.[S.op]
        ?.dates || []
    )]
      .sort((a, b) =>
        String(b)
          .localeCompare(String(a))
      );

  $("date").innerHTML =
    ds
      .map(d =>
        `<option value="${esc(d)}">${esc(fmtDate(d))}</option>`
      )
      .join("");

  S.date =
    ds[0] || "";

  $("date").value =
    S.date;
}

/* ============================================================
   日別読込
   ============================================================ */

async function load() {
  S.date =
    $("date").value ||
    S.date;

  if (!S.date) {
    $("status").textContent =
      "履歴なし";

    $("list").innerHTML =
      "";

    return;
  }

  $("status").textContent =
    "読み込み中...";

  $("list").innerHTML =
    "";

  try {
    const r =
      await fetch(
        dailyUrl(
          S.op,
          S.date
        ),
        {
          cache:
            "no-cache"
        }
      );

    if (!r.ok) {
      throw new Error(
        r.status
      );
    }

    const raw =
      await r.json();

    S.daily =
      normalizeDaily(
        S.op,
        raw,
        S.date
      );

    if (
      $("search")
        .value
        .trim()
    ) {
      await searchVehicle();

    } else {
      drawDaily();
    }

  } catch (e) {
    console.error(e);

    $("status").textContent =
      "読み込み失敗";
  }
}

/* ============================================================
   Braga index.json を既存 data/index.json に合流
   ============================================================ */

async function loadBragaIndex() {
  try {
    const r =
      await fetch(
        "./data/braga/index.json",
        {
          cache:
            "no-cache"
        }
      );

    if (!r.ok) {
      // BragaがまだGitHubへ公開されていない時は
      // ページ全体を壊さない
      return;
    }

    const data =
      await r.json();

    const dates =
      Array.isArray(data?.dates)
        ? data.dates
            .map(String)
            .filter(d =>
              /^\d{4}-\d{2}-\d{2}$/
                .test(d)
            )
            .sort((a, b) =>
              b.localeCompare(a)
            )
        : [];

    S.bragaIndex =
      data;

    if (!S.root.operators) {
      S.root.operators = {};
    }

    S.root.operators.braga = {
      label:
        "Braga / TUB",

      dates
    };

  } catch (e) {
    console.warn(
      "[Braga index]",
      e
    );
  }
}

/* ============================================================
   起動
   ============================================================ */

(async () => {
  try {
    const r =
      await fetch(
        "./data/index.json",
        {
          cache:
            "no-cache"
        }
      );

    if (!r.ok) {
      throw new Error(
        r.status
      );
    }

    S.root =
      await r.json();

    // Bragaのindexが存在すれば自動追加
    await loadBragaIndex();

    const ids =
      Object.keys(
        S.root.operators || {}
      );

    if (!ids.includes(S.op)) {
      S.op =
        ids[0] || "";
    }

    $("updated").textContent =
      S.root.generated_at
        ? `最終更新 ${S.root.generated_at}`
        : "";

    tabs();
    dates();
    await load();

  } catch (e) {
    console.error(e);

    $("status").textContent =
      "データを読み込めませんでした";
  }
})();

$("date").onchange =
  load;

$("search").oninput =
  () => {
    clearTimeout(
      S.vehicleTimer
    );

    drawDaily();

    S.vehicleTimer =
      setTimeout(
        searchVehicle,
        250
      );
  };

$("clearSearch").onclick =
  () => {
    $("search").value =
      "";

    $("search").focus();

    drawDaily();
  };
