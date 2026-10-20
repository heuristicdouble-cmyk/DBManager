"use strict";
const KEY = "flexdb.v1",
  SIDE_KEY = "flexdb.sidebar";
const app = document.getElementById("app");
let databases = load(),
  currentId = null,
  query = "",
  sortField = null,
  sortDirection = 1,
  sidebarOpen = localStorage.getItem(SIDE_KEY) !== "closed";
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(data)) return [];
    for (const db of data) {
      db.fields ??= [];
      db.rows ??= [];
      for (const f of db.fields) f.type ??= "text";
    }
    return data;
  } catch {
    return [];
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(databases));
    return true;
  } catch (e) {
    alert("保存できませんでした。保存容量・ブラウザ設定を確認してください。");
    return false;
  }
}
function mutate(fn) {
  const backup = JSON.stringify(databases);
  fn();
  if (!save()) {
    databases = JSON.parse(backup);
    return false;
  }
  return true;
}
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "value") n.value = v;
    else if (k === "checked") n.checked = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children.flat())
    if (c != null)
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
const iconBtn = (symbol, label, fn, classes = "") =>
  el(
    "button",
    {
      type: "button",
      class: `btn icon-action ${classes}`,
      title: label,
      "aria-label": label,
      onclick: fn,
    },
    el("span", { "aria-hidden": "true", text: symbol }),
  );
const btn = (label, fn, classes = "") =>
  el("button", {
    type: "button",
    class: `btn ${classes}`,
    onclick: fn,
    text: label,
  });
const heading = (title, subtitle) =>
  el(
    "div",
    {},
    el("h2", { text: title }),
    el("p", { class: "muted", text: subtitle }),
  );
function home() {
  currentId = null;
  query = "";
  app.replaceChildren(
    el(
      "div",
      { class: "topline" },
      heading("データベース一覧", `${databases.length} 個のデータベース`),
      btn("＋ データベースを作成する", createScreen, "primary"),
    ),
  );
  if (!databases.length) {
    app.append(
      el("div", {
        class: "empty",
        text: "データベースがありません。新しく作成してください。",
      }),
    );
    return;
  }
  const cards = el("div", { class: "cards" });
  for (const db of databases) {
    cards.append(
      el(
        "div",
        {
          class: "card",
          role: "button",
          tabindex: "0",
          onclick: () => openDb(db.id),
          onkeydown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openDb(db.id);
            }
          },
        },
        el("span", { class: "arrow", text: "↗" }),
        el("h3", { text: db.name }),
        el("p", {
          text: `${db.fields.length} 項目 ・ ${db.rows.length} 件のデータ`,
        }),
        el("span", { class: "meta", text: "クリックして開く" }),
      ),
    );
  }
  app.append(cards);
}
const types = [
  ["text", "テキスト"],
  ["number", "数値"],
  ["date", "日付"],
  ["textarea", "長文"],
];
function typeSelect(type = "text") {
  const s = el("select");
  for (const [v, label] of types)
    s.append(el("option", { value: v, text: label }));
  s.value = type;
  return s;
}
function fieldEditor(container, initial = [], options = {}) {
  const rows = el("div", { class: "fields-list" });
  const add = (field = {}) => {
    const name = el("input", {
        value: field.label || "",
        placeholder: "項目名（空欄は無視）",
        "aria-label": "項目名",
      }),
      type = typeSelect(field.type || "text");
    const line = el(
      "div",
      { class: "field-row" },
      name,
      type,
      btn("削除", () => line.remove(), "danger small"),
    );
    line.dataset.id = field.id || "";
    rows.append(line);
  };
  for (const f of initial) add(f);
  container.append(
    rows,
    btn("＋ 項目を追加", () => add(), "subtle"),
  );
  return () => {
    const fields = [...rows.children]
      .map((r) => ({
        id: r.dataset.id || uid(),
        label: r.querySelector("input").value.trim(),
        type: r.querySelector("select").value,
      }))
      .filter((f) => f.label);
    if (new Set(fields.map((f) => f.label)).size !== fields.length) {
      alert("項目名が重複しています。");
      return null;
    }
    return fields;
  };
}
function createScreen() {
  const name = el("input", { placeholder: "例：試験機器管理" }),
    panel = el(
      "div",
      { class: "panel" },
      heading("データベースを作成", "項目名が空の行は無視します。"),
    );
  panel.append(
    el(
      "div",
      { class: "field" },
      el("label", { text: "データベース名" }),
      name,
    ),
    el("label", { class: "field-label", text: "見出し項目と種類" }),
  );
  const fieldsHost = el("div");
  panel.append(fieldsHost);
  const getFields = fieldEditor(fieldsHost, [
    { label: "管理番号" },
    { label: "名称" },
  ]);
  panel.append(
    el(
      "div",
      { class: "actions" },
      btn(
        "データベースを作成",
        () => {
          const dbName = name.value.trim(),
            fields = getFields();
          if (!fields) return;
          if (!dbName) {
            alert("データベース名を入力してください。");
            return;
          }
          if (!fields.length) {
            alert("少なくとも1つの見出し項目が必要です。");
            return;
          }
          const db = { id: uid(), name: dbName, fields, rows: [] };
          if (mutate(() => databases.push(db))) openDb(db.id);
        },
        "primary",
      ),
      btn("キャンセル", home),
    ),
  );
  app.replaceChildren(btn("← 一覧に戻る", home, "back"), panel);
}
function openDb(id) {
  currentId = id;
  query = "";
  sortField = null;
  sortDirection = 1;
  renderDb();
}
function sidebar() {
  const aside = el(
    "aside",
    { class: "sidebar" },
    el(
      "div",
      { class: "side-title" },
      el("strong", { text: "データベース" }),
      btn("×", () => toggleSidebar(), "icon-btn"),
    ),
  );
  aside.append(btn("⌂ すべて表示", home, "side-link"));
  for (const db of databases)
    aside.append(
      btn(
        db.name,
        () => openDb(db.id),
        `side-link ${db.id === currentId ? "selected" : ""}`,
      ),
    );
  aside.append(btn("＋ 新規作成", createScreen, "side-link"));
  return aside;
}
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  try {
    localStorage.setItem(SIDE_KEY, sidebarOpen ? "open" : "closed");
  } catch {}
  renderDb();
}
function dbLayout(content) {
  const layout = el("div", {
    class: `db-layout ${sidebarOpen ? "" : "collapsed"}`,
  });
  if (sidebarOpen) layout.append(sidebar());
  const main = el(
    "section",
    { class: "db-content" },
    btn(
      sidebarOpen ? "☰ メニューを閉じる" : "☰ メニューを開く",
      toggleSidebar,
      "toggle-side",
    ),
    content,
  );
  layout.append(main);
  app.replaceChildren(layout);
}
function displayValue(value) {
  return String(value ?? "");
}
function compareCells(a, b, type) {
  const x = displayValue(a),
    y = displayValue(b);
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  if (type === "number") {
    const nx = Number(x),
      ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny;
  }
  return x.localeCompare(y, "ja", { numeric: true, sensitivity: "base" });
}
function download(name, content, mime) {
  const blob = new Blob(["\ufeff", content], { type: mime }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, "_");
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csvEscape(v) {
  const s = displayValue(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCsv(db) {
  const lines = [
    db.fields.map((f) => csvEscape(f.label)).join(","),
    ...db.rows.map((r) =>
      db.fields.map((f) => csvEscape(r.values?.[f.id])).join(","),
    ),
  ];
  download(db.name + ".csv", lines.join("\r\n"), "text/csv;charset=utf-8");
}
function exportJson(db) {
  download(
    db.name + ".json",
    JSON.stringify({ format: "FlexDB", version: 1, database: db }, null, 2),
    "application/json;charset=utf-8",
  );
}
function parseCsv(text) {
  text = text.replace(/^\ufeff/, "");
  const result = [];
  let record = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') {
      if (cell !== "") throw Error("CSVの引用符の位置が不正です");
      quoted = true;
    } else if (ch === ",") {
      record.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(cell);
      result.push(record);
      record = [];
      cell = "";
    } else cell += ch;
  }
  if (quoted) throw Error("CSVの引用符が閉じられていません");
  if (cell !== "" || record.length) {
    record.push(cell);
    result.push(record);
  }
  return result;
}
function importFile(db, kind) {
  const input = el("input", {
    type: "file",
    accept: kind === "csv" ? ".csv,text/csv" : ".json,application/json",
  });
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const content = (await file.text()).replace(/^\ufeff/, "");
      let additions = [];
      if (kind === "csv") {
        const records = parseCsv(content);
        if (records.length < 1) throw Error("CSVに見出し行がありません");
        const headers = records.shift();
        if (new Set(headers).size !== headers.length)
          throw Error("CSVの見出しが重複しています");
        const indices = db.fields.map((f) => headers.indexOf(f.label));
        if (indices.every((i) => i < 0))
          throw Error("一致する見出し項目がありません");
        additions = records
          .filter((r) => r.some((v) => v !== ""))
          .map((r) => ({
            id: uid(),
            values: Object.fromEntries(
              db.fields.map((f, i) => [
                f.id,
                indices[i] < 0 ? "" : displayValue(r[indices[i]]),
              ]),
            ),
          }));
      } else {
        const data = JSON.parse(content),
          source = data?.database ?? data;
        if (
          !source ||
          !Array.isArray(source.fields) ||
          !Array.isArray(source.rows)
        )
          throw Error("FlexDBのJSON形式ではありません");
        const labels = source.fields.map((f) => f.label);
        if (new Set(labels).size !== labels.length)
          throw Error("JSONの項目名が重複しています");
        if (
          source.fields.some(
            (f) => typeof f.id !== "string" || typeof f.label !== "string",
          ) ||
          source.rows.some(
            (r) => !r || typeof r.values !== "object" || r.values === null,
          )
        )
          throw Error("JSONデータが不正です");
        const map = db.fields.map(
          (f) => source.fields.find((sf) => sf.label === f.label)?.id,
        );
        if (map.every((id) => !id))
          throw Error("一致する見出し項目がありません");
        additions = source.rows.map((r) => ({
          id: uid(),
          values: Object.fromEntries(
            db.fields.map((f, i) => [
              f.id,
              map[i] ? displayValue(r.values[map[i]]) : "",
            ]),
          ),
        }));
      }
      if (!additions.length) {
        alert("取り込むレコードがありません");
        return;
      }
      if (
        !confirm(
          `${additions.length}件のレコードを「${db.name}」に追加します。既存データは保持されます。続けますか？`,
        )
      )
        return;
      if (mutate(() => db.rows.push(...additions))) renderDb();
    } catch (e) {
      alert("取込失敗: " + e.message);
    }
  });
  input.click();
}

function renderDb() {
  const db = databases.find((d) => d.id === currentId);
  if (!db) return home();
  const search = el("input", {
      class: "search",
      placeholder: "すべての項目から検索",
      value: query,
      "aria-label": "データ検索",
    }),
    count = el("span", { class: "counter" }),
    wrap = el("div", { class: "table-wrap" });
  function drawRows() {
    const q = query.toLocaleLowerCase(),
      found = db.rows.filter((r) =>
        db.fields.some((f) =>
          displayValue(r.values?.[f.id]).toLocaleLowerCase().includes(q),
        ),
      );
    if (sortField) {
      const field = db.fields.find((f) => f.id === sortField);
      if (field)
        found.sort(
          (a, b) =>
            compareCells(
              a.values?.[field.id],
              b.values?.[field.id],
              field.type,
            ) * sortDirection,
        );
    }
    count.textContent = `${found.length} / ${db.rows.length} 件`;
    const table = el("table", { class: "data-table" }),
      head = el("tr");
    head.append(el("th", { class: "action-col", text: "操作" }));
    const colgroup = el("colgroup");
    colgroup.append(el("col", { class: "action-width" }));
    for (const f of db.fields) {
      const maxLen = Math.max(
        f.label.length,
        ...db.rows.map((r) => displayValue(r.values?.[f.id]).length),
      );
      const col = el("col");
      col.style.width = `${Math.min(155, Math.max(66, maxLen * 6.3 + 20))}px`;
      colgroup.append(col);
      head.append(
        el(
          "th",
          {},
          el(
            "button",
            {
              class: "sort-head",
              type: "button",
              title: `${f.label}で並べ替え`,
              onclick: () => {
                if (sortField === f.id)
                  sortDirection = sortDirection === 1 ? -1 : 1;
                else {
                  sortField = f.id;
                  sortDirection = 1;
                }
                drawRows();
              },
            },
            f.label,
            sortField === f.id ? (sortDirection === 1 ? " ▲" : " ▼") : " ↕",
          ),
        ),
      );
    }
    table.append(colgroup, el("thead", {}, head));
    const body = el("tbody");
    for (const row of found) {
      const line = el("tr"),
        actions = el(
          "td",
          { class: "action-col" },
          el(
            "div",
            { class: "row-actions" },
            iconBtn("✎", "データを編集", () => recordScreen(db, row)),
            iconBtn(
              "🗑",
              "データを削除",
              () => {
                if (!confirm("このデータを削除しますか？")) return;
                if (mutate(() => db.rows.splice(db.rows.indexOf(row), 1)))
                  renderDb();
              },
              "danger",
            ),
          ),
        );
      line.append(actions);
      for (const f of db.fields) {
        const val = displayValue(row.values?.[f.id]);
        line.append(el("td", { text: val, title: val }));
      }
      body.append(line);
    }
    table.append(body);
    wrap.replaceChildren(table);
    if (!found.length)
      wrap.append(
        el("div", {
          class: "empty",
          text: query
            ? "検索結果がありません。"
            : "データがありません。新規登録してください。",
        }),
      );
  }
  search.addEventListener("input", () => {
    query = search.value;
    drawRows();
  });
  const content = el(
    "div",
    {},
    btn("← データベース一覧", home, "back"),
    el(
      "div",
      { class: "topline" },
      heading(db.name, `${db.fields.length} 項目のデータベース`),
      el(
        "div",
        { class: "actions" },
        btn("＋ データ登録", () => recordScreen(db), "primary"),
        btn("項目を設定", () => schemaScreen(db, () => renderDb()), ""),
        btn("CSV出力", () => exportCsv(db), "small"),
        btn("CSV取込", () => importFile(db, "csv"), "small"),
        btn("JSON出力", () => exportJson(db), "small"),
        btn("JSON取込", () => importFile(db, "json"), "small"),
        btn(
          "DB削除",
          () => {
            if (!confirm(`「${db.name}」とすべてのデータを削除しますか？`))
              return;
            if (mutate(() => databases.splice(databases.indexOf(db), 1)))
              home();
          },
          "danger",
        ),
      ),
    ),
    el("div", { class: "toolbar" }, search, count),
    wrap,
  );
  dbLayout(content);
  drawRows();
}
function schemaScreen(db, back) {
  const host = el("div"),
    panel = el(
      "div",
      { class: "panel" },
      heading(
        "見出し項目を編集",
        `${db.name} — 既存データを保持したまま変更できます。`,
      ),
      el("p", {
        class: "notice",
        text: "項目の削除は、その列の保存済みデータも削除します。種類変更は既存値を自動変換しません。",
      }),
      host,
    );
  const getFields = fieldEditor(host, db.fields);
  panel.append(
    el(
      "div",
      { class: "actions" },
      btn(
        "項目設定を保存",
        () => {
          const fields = getFields();
          if (!fields) return;
          if (!fields.length) {
            alert("最低1項目が必要です。");
            return;
          }
          const removed = db.fields.filter(
            (f) => !fields.some((n) => n.id === f.id),
          );
          if (
            removed.length &&
            !confirm(
              `削除する項目（${removed.map((f) => f.label).join("、")}）の既存データも削除されます。続けますか？`,
            )
          )
            return;
          const ok = mutate(() => {
            db.fields = fields;
            for (const row of db.rows) {
              for (const f of removed) delete row.values[f.id];
            }
          });
          if (ok) back();
        },
        "primary",
      ),
      btn("キャンセル", back),
    ),
  );
  dbLayout(el("div", {}, btn("← 戻る", back, "back"), panel));
}
function recordScreen(db, row = null) {
  const inputs = new Map(),
    panel = el(
      "div",
      { class: "panel" },
      heading(row ? "データを編集" : "データを登録", db.name),
      el(
        "div",
        { class: "actions top-actions" },
        btn(
          "⚙ 見出し項目・種類を編集",
          () => schemaScreen(db, () => recordScreen(db, row)),
          "subtle",
        ),
      ),
    );
  for (const f of db.fields) {
    const v = displayValue(row?.values?.[f.id]);
    const input =
      f.type === "textarea"
        ? el("textarea", { rows: "3", placeholder: `${f.label}を入力` }, v)
        : el("input", {
            type:
              f.type === "number"
                ? "number"
                : f.type === "date"
                  ? "date"
                  : "text",
            value: v,
            placeholder: `${f.label}を入力`,
          });
    inputs.set(f.id, input);
    panel.append(
      el(
        "div",
        { class: "field" },
        el("label", {
          text: `${f.label} (${types.find((t) => t[0] === f.type)?.[1] || "テキスト"})`,
        }),
        input,
      ),
    );
  }
  panel.append(
    el(
      "div",
      { class: "actions" },
      btn(
        row ? "変更を保存" : "登録する",
        () => {
          const values = {};
          for (const [id, input] of inputs) values[id] = input.value;
          if (
            mutate(() => {
              if (row) row.values = { ...row.values, ...values };
              else db.rows.push({ id: uid(), values });
            })
          )
            renderDb();
        },
        "primary",
      ),
      btn("キャンセル", renderDb),
    ),
  );
  dbLayout(el("div", {}, btn("← データ一覧に戻る", renderDb, "back"), panel));
}
home();
