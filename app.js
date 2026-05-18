// Ledger — pure JS expense tracker (localStorage)
const CATEGORIES = [
  { name: 'Food',          color: '#f59e0b' },
  { name: 'Transport',     color: '#38bdf8' },
  { name: 'Housing',       color: '#a78bfa' },
  { name: 'Entertainment', color: '#f472b6' },
  { name: 'Shopping',      color: '#34d399' },
  { name: 'Health',        color: '#fb7185' },
  { name: 'Bills',         color: '#22d3ee' },
  { name: 'Other',         color: '#94a3b8' },
];
const catColor = (n) => (CATEGORIES.find(c => c.name === n) || CATEGORIES[7]).color;

const STORE_KEY = 'ledger.expenses.v1';
const PREF_KEY  = 'ledger.prefs.v2';

const state = {
  expenses: load(STORE_KEY, []),
  prefs: load(PREF_KEY, { currency: 'INR', budget: 0 }),
  view: 'dashboard',
  filter: { q: '', cat: 'all' },
};

function load(k, fallback) {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.expenses));
  localStorage.setItem(PREF_KEY,  JSON.stringify(state.prefs));
}
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const fmt = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: state.prefs.currency }).format(n || 0);
const todayISO = () => new Date().toISOString().slice(0, 10);
const ymKey = (d) => d.slice(0, 7);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- NAV ---------- */
$$('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
function switchView(v) {
  state.view = v;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach(s => s.classList.add('hidden'));
  $(`#view-${v}`).classList.remove('hidden');
  $('#pageTitle').textContent = ({ dashboard: 'Overview', expenses: 'Expenses', settings: 'Settings' })[v];
  if (window.innerWidth <= 900) $('#sidebar').classList.remove('open');
  render();
}
$('#toggleSidebar').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

/* ---------- MODAL ---------- */
const modal = $('#modal');
function openModal(expense = null) {
  $('#editingId').value = expense?.id ?? '';
  $('#modalTitle').textContent = expense ? 'Edit expense' : 'New expense';
  $('#amount').value = expense?.amount ?? '';
  $('#date').value = expense?.date ?? todayISO();
  $('#description').value = expense?.description ?? '';
  $('#category').value = expense?.category ?? 'Food';
  modal.classList.remove('hidden');
  setTimeout(() => $('#amount').focus(), 50);
}
function closeModal() { modal.classList.add('hidden'); }
$('#openAdd').addEventListener('click', () => openModal());
$('#closeModal').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

$('#expenseForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('#editingId').value;
  const amount = parseFloat($('#amount').value);
  if (!(amount > 0)) return toast('Enter a valid amount');
  const obj = {
    id: id || uid(),
    amount,
    category: $('#category').value,
    description: $('#description').value.trim(),
    date: $('#date').value || todayISO(),
  };
  if (id) {
    const i = state.expenses.findIndex(x => x.id === id);
    state.expenses[i] = obj;
    toast('Updated');
  } else {
    state.expenses.unshift(obj);
    toast('Expense added');
  }
  save(); closeModal(); render();
});

/* ---------- CATEGORY SELECT ---------- */
function fillCategories() {
  const opts = CATEGORIES.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  $('#category').innerHTML = opts;
  $('#filterCat').innerHTML = `<option value="all">All categories</option>` + opts;
}

/* ---------- DASHBOARD ---------- */
function renderDashboard() {
  const now = new Date();
  const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmk = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`;

  const monthExp = state.expenses.filter(e => ymKey(e.date) === mk);
  const lastExp  = state.expenses.filter(e => ymKey(e.date) === lmk);
  const monthTotal = monthExp.reduce((s, e) => s + e.amount, 0);
  const lastTotal  = lastExp.reduce((s, e) => s + e.amount, 0);
  const delta = lastTotal === 0 ? 0 : ((monthTotal - lastTotal) / lastTotal) * 100;
  const avg = monthTotal / Math.max(now.getDate(), 1);

  $('#statMonth').textContent = fmt(monthTotal);
  $('#statMonthSub').textContent = now.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  $('#statDelta').textContent = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
  $('#statDelta').style.color = delta > 0 ? '#fca5a5' : delta < 0 ? '#86efac' : '';
  $('#statLast').textContent = `${fmt(lastTotal)} last month`;
  $('#statAvg').textContent = fmt(avg);

  /* bars */
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const total = state.expenses.filter(e => e.date === key).reduce((s, e) => s + e.amount, 0);
    days.push({ key, lbl: d.toLocaleDateString(undefined, { weekday: 'short' }), total });
  }
  const max = Math.max(1, ...days.map(d => d.total));
  $('#barsChart').innerHTML = days.map(d => `
    <div class="bar-col">
      <div class="bar-wrap"><div class="bar" style="height:${(d.total / max) * 100}%" title="${d.lbl}: ${fmt(d.total)}"></div></div>
      <span class="lbl">${d.lbl}</span>
    </div>
  `).join('');

  /* donut */
  const byCat = {};
  monthExp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const entries = Object.entries(byCat);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const r = 44, C = 2 * Math.PI * r;
  let offset = 0;
  const segs = entries.map(([name, v]) => {
    const frac = total ? v / total : 0;
    const len = frac * C;
    const seg = `<circle cx="60" cy="60" r="${r}" stroke="${catColor(name)}"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"/>`;
    offset += len; return seg;
  }).join('');
  const track = `<circle cx="60" cy="60" r="${r}" stroke="#25264f"/>`;
  $('#donutChart').innerHTML = track + segs;
  $('#donutTotal').textContent = fmt(total);

  $('#legend').innerHTML = entries
    .sort((a, b) => b[1] - a[1])
    .map(([n, v]) => `<li><span><span class="swatch" style="background:${catColor(n)}"></span>${n}</span><span class="muted">${fmt(v)}</span></li>`)
    .join('') || `<li class="muted xs">No expenses this month yet.</li>`;

  /* recent */
  $('#recentList').innerHTML = state.expenses.slice(0, 5).map(rowHTML).join('') ||
    `<div class="empty">No expenses yet. Click <strong>Add expense</strong> to get started.</div>`;
  bindRowActions($('#recentList'));
}

/* ---------- EXPENSES PAGE ---------- */
function renderExpenses() {
  const q = state.filter.q.toLowerCase();
  const cat = state.filter.cat;
  const list = state.expenses.filter(e => {
    const mq = !q || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
    const mc = cat === 'all' || e.category === cat;
    return mq && mc;
  });
  $('#expensesMeta').textContent = `${list.length} entries · ${fmt(list.reduce((s, e) => s + e.amount, 0))}`;
  $('#expensesList').innerHTML = list.map(rowHTML).join('') ||
    `<div class="empty">No expenses match your filters.</div>`;
  bindRowActions($('#expensesList'));
}

function rowHTML(e) {
  return `
    <div class="row-item" data-id="${e.id}">
      <div class="left">
        <span class="dot" style="background:${catColor(e.category)}"></span>
        <div>
          <div class="desc">${escapeHTML(e.description) || e.category}</div>
          <div class="meta">${e.category} · ${new Date(e.date).toLocaleDateString()}</div>
        </div>
      </div>
      <div class="row gap">
        <span class="amount">${fmt(e.amount)}</span>
        <button class="icon-btn" data-edit="${e.id}" title="Edit">✎</button>
        <button class="icon-btn" data-del="${e.id}" title="Delete">🗑</button>
      </div>
    </div>
  `;
}
function bindRowActions(scope) {
  scope.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openModal(state.expenses.find(x => x.id === b.dataset.edit))));
  scope.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      if (!confirm('Delete this expense?')) return;
      state.expenses = state.expenses.filter(x => x.id !== b.dataset.del);
      save(); render(); toast('Deleted');
    }));
}
function escapeHTML(s) { return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------- SETTINGS ---------- */
function renderSettings() {
  $('#budgetInput').value = state.prefs.budget || '';
  const now = new Date();
  const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const spent = state.expenses.filter(e => ymKey(e.date) === mk).reduce((s, e) => s + e.amount, 0);
  if (state.prefs.budget > 0) {
    const pct = Math.min(100, (spent / state.prefs.budget) * 100);
    $('#budgetState').textContent = `${fmt(spent)} of ${fmt(state.prefs.budget)} spent · ${pct.toFixed(0)}%`;
  } else {
    $('#budgetState').textContent = 'No budget set.';
  }
}
$('#saveBudget').addEventListener('click', () => {
  state.prefs.budget = Math.max(0, parseFloat($('#budgetInput').value) || 0);
  save(); render(); toast('Budget saved');
});
$('#clearBtn').addEventListener('click', () => {
  if (!confirm('Delete ALL expenses? This cannot be undone.')) return;
  state.expenses = []; save(); render(); toast('All data cleared');
});

/* ---------- FILTERS ---------- */
$('#search').addEventListener('input', (e) => { state.filter.q = e.target.value; renderExpenses(); });
$('#filterCat').addEventListener('change', (e) => { state.filter.cat = e.target.value; renderExpenses(); });
$('#currency').addEventListener('change', (e) => { state.prefs.currency = e.target.value; save(); render(); });

/* ---------- EXPORT ---------- */
function exportCSV() {
  const rows = [['Date', 'Category', 'Description', 'Amount']]
    .concat(state.expenses.map(e => [e.date, e.category, e.description.replace(/"/g, '""'), e.amount]));
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ledger-${todayISO()}.csv`; a.click();
  URL.revokeObjectURL(a.href);
}
$('#exportBtn').addEventListener('click', exportCSV);
$('#exportBtn2').addEventListener('click', exportCSV);

/* ---------- RENDER ---------- */
function render() {
  if (state.view === 'dashboard') renderDashboard();
  if (state.view === 'expenses')  renderExpenses();
  if (state.view === 'settings')  renderSettings();
}

/* ---------- INIT ---------- */
fillCategories();
$('#currency').value = state.prefs.currency;
// Seed sample data on first run
if (state.expenses.length === 0 && !localStorage.getItem('ledger.seeded')) {
  const sample = [
    { cat: 'Food', desc: 'Groceries', amt: 1240, daysAgo: 0 },
    { cat: 'Transport', desc: 'Auto rickshaw', amt: 180, daysAgo: 1 },
    { cat: 'Entertainment', desc: 'Movie night', amt: 450, daysAgo: 2 },
    { cat: 'Food', desc: 'Chai & snacks', amt: 120, daysAgo: 2 },
    { cat: 'Shopping', desc: 'Kurta', amt: 1499, daysAgo: 4 },
    { cat: 'Bills', desc: 'Mobile recharge', amt: 299, daysAgo: 6 },
    { cat: 'Housing', desc: 'Rent share', amt: 12000, daysAgo: 8 },
  ];
  sample.forEach(s => {
    const d = new Date(); d.setDate(d.getDate() - s.daysAgo);
    state.expenses.push({ id: uid(), amount: s.amt, category: s.cat, description: s.desc, date: d.toISOString().slice(0, 10) });
  });
  localStorage.setItem('ledger.seeded', '1');
  save();
}
render();
