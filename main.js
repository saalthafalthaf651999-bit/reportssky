/**
 * SKY MOBILES — Sales & Expense Dashboard
 * Data persisted in localStorage
 */

const STORAGE_KEY = "sky_mobiles_data_v1";
const UI_STATE_KEY = "sky_mobiles_ui_v1";
const STORAGE_META_KEY = "sky_mobiles_meta_v1";
const FRESH_HISTORY_FLAG = "sky_mobiles_fresh_history_v5";
const SESSION_KEY = "sky_mobiles_session";
const AUTH_KEY = "sky_mobiles_auth";

/** One-time wipe of demo/legacy history — real entries persist after this */
(function resetDemoHistoryOnce() {
  if (localStorage.getItem(FRESH_HISTORY_FLAG)) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_META_KEY);
  localStorage.setItem(FRESH_HISTORY_FLAG, "1");
})();
const DEMO_EMAIL = "admin@skymobiles.in";
const DEMO_PASS = "sky2026";
/** Auto-detect: /sky-mobiles for local server, "" for root deploy (Netlify/cPanel) */
const APP_BASE_PATH = (() => {
  const p = window.location.pathname.replace(/\/index\.html$/i, "");
  if (/\/sky-mobiles\/?$/i.test(p) || p.includes("/sky-mobiles/")) return "/sky-mobiles";
  return "";
})();

const state = {
  activeDate: todayKey(),
  calendarMonth: new Date(),
  data: loadData(),
  profile: loadProfile(),
  charts: {},
  saleCategoryFilter: "all",
  salePaymentFilter: "all",
  reportsPaymentFilter: "all",
  activeView: "dashboard",
  editingSaleId: null,
  branches: [],
  users: [],
  currentUser: null,
  dashboardBranchFilter: "all",
  reportsBranchFilter: "all",
};

const SALE_CATEGORIES = ["mobile", "accessories", "recharge", "others"];

const CARD_BANKS = [
  "HDFC",
  "ICICI",
  "SBI",
  "AXIS",
  "CANARA",
  "INDIAN BANK",
  "UNION BANK",
  "KOTAK",
  "PNB",
  "BANK OF BARODA",
  "IDBI",
  "YES BANK",
  "FEDERAL BANK",
  "INDUSIND",
  "BANK OF INDIA",
  "CENTRAL BANK",
  "IOB",
  "UCO BANK",
];

const CARD_TYPES = [
  { value: "visa", label: "Visa" },
  { value: "rupay", label: "RuPay" },
  { value: "mastercard", label: "MasterCard" },
];

function buildCardPaymentModuleHtml() {
  const banks = CARD_BANKS.map(
    (b) =>
      `<button type="button" class="bank-chip" data-bank="${escapeHtml(b)}">${escapeHtml(b)}</button>`
  ).join("");
  const types = CARD_TYPES.map(
    (t) =>
      `<button type="button" class="card-type-chip" data-card-type="${t.value}">${t.label}</button>`
  ).join("");

  const accordion = (mode) => `
    <div class="card-accordion" data-card-accordion="${mode}" hidden>
      <div class="card-step card-step-banks">
        <span class="card-step-label">Select bank</span>
        <div class="bank-select-grid">${banks}</div>
      </div>
      <div class="card-step card-step-types" hidden>
        <span class="card-step-label">Card type</span>
        <div class="card-type-select">${types}</div>
      </div>
      <div class="card-step card-step-amounts" hidden>
        <div class="card-amount-grid">
          <label class="field"><span>Swipe Amount</span><input type="number" class="card-swipe-amount" min="0" step="0.01" placeholder="0" /></label>
          <label class="field"><span>Final Amount</span><input type="number" class="card-final-amount" min="0" step="0.01" placeholder="0" /></label>
        </div>
      </div>
    </div>`;

  return `
    <div class="card-payment-module">
      <p class="card-module-label">Card payment</p>
      <div class="card-mode-select">
        <button type="button" class="card-mode-chip" data-card-mode="debit">Debit Card</button>
        <button type="button" class="card-mode-chip" data-card-mode="credit">Credit Card</button>
      </div>
      <div class="card-payment-columns">
        <div class="card-payment-main">
          ${accordion("debit")}
          ${accordion("credit")}
        </div>
        <div class="card-credit-column" data-credit-column hidden>
          <span class="card-credit-column-label">Credit payment</span>
          <label class="field card-charges-field card-credit-charges">
            <span>Swiping Charges <em class="opt">(Optional)</em></span>
            <input type="number" class="card-swiping-charges" min="0" step="0.01" placeholder="Enter charges ₹" />
          </label>
        </div>
      </div>
    </div>`;
}

function mountCardPaymentPanels() {
  document.querySelectorAll('[data-panel="card"]').forEach((wrap) => {
    const existing = wrap.querySelector(".card-payment-module");
    if (existing && !wrap.querySelector("[data-credit-column]")) {
      wrap.innerHTML = "";
    }
    if (!wrap.querySelector(".card-payment-module")) {
      wrap.innerHTML = buildCardPaymentModuleHtml();
    }
  });
  bindCardPaymentModules();
}

function getCardModule(form) {
  return form?.querySelector(".card-payment-module") || null;
}

function resetCardAccordion(accordion) {
  if (!accordion) return;
  accordion.querySelectorAll(".bank-chip, .card-type-chip").forEach((el) => el.classList.remove("is-active"));
  accordion.querySelector(".card-step-types")?.setAttribute("hidden", "");
  accordion.querySelector(".card-step-amounts")?.setAttribute("hidden", "");
  accordion.querySelectorAll(".card-swipe-amount, .card-final-amount, .card-swiping-charges").forEach((inp) => {
    inp.value = "";
  });
}

function openCardAccordion(module, mode) {
  module.querySelectorAll(".card-accordion").forEach((acc) => {
    const isTarget = acc.getAttribute("data-card-accordion") === mode;
    if (isTarget) acc.removeAttribute("hidden");
    else {
      acc.setAttribute("hidden", "");
      resetCardAccordion(acc);
    }
  });
  const creditCol = module.querySelector("[data-credit-column]");
  if (creditCol) {
    if (mode === "credit") creditCol.removeAttribute("hidden");
    else creditCol.setAttribute("hidden", "");
  }
  module.classList.toggle("is-credit-mode", mode === "credit");
  module.classList.toggle("is-debit-mode", mode === "debit");
  module.querySelectorAll(".card-mode-chip").forEach((chip) => {
    chip.classList.toggle("is-active", chip.getAttribute("data-card-mode") === mode);
  });
}

function readCardFieldsFromForm(form) {
  const module = getCardModule(form);
  if (!module) return {};
  const mode = module.querySelector(".card-mode-chip.is-active")?.getAttribute("data-card-mode");
  const accordion = mode ? module.querySelector(`[data-card-accordion="${mode}"]`) : null;
  if (!accordion) return { cardMode: mode || "" };
  const bank = accordion.querySelector(".bank-chip.is-active")?.getAttribute("data-bank") || "";
  const cardType = accordion.querySelector(".card-type-chip.is-active")?.getAttribute("data-card-type") || "";
  const swipeAmount = Number(accordion.querySelector(".card-swipe-amount")?.value) || 0;
  const finalAmount = Number(accordion.querySelector(".card-final-amount")?.value) || 0;
  const chargesRaw = module.querySelector(".card-swiping-charges")?.value;
  const swipingCharges =
    mode === "credit" && chargesRaw !== "" && chargesRaw != null ? Number(chargesRaw) || 0 : 0;
  return { cardMode: mode, cardBank: bank, cardType, swipeAmount, finalAmount, swipingCharges };
}

function fillCardFieldsInForm(form, sale) {
  const module = getCardModule(form);
  if (!module || sale.paymentMethod !== "card") return;
  const mode = sale.cardMode === "credit" ? "credit" : "debit";
  openCardAccordion(module, mode);
  const accordion = module.querySelector(`[data-card-accordion="${mode}"]`);
  if (!accordion) return;
  accordion.querySelectorAll(".bank-chip").forEach((chip) => {
    chip.classList.toggle("is-active", chip.getAttribute("data-bank") === sale.cardBank);
  });
  if (sale.cardBank) {
    accordion.querySelector(".card-step-types")?.removeAttribute("hidden");
    accordion.querySelectorAll(".card-type-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.getAttribute("data-card-type") === sale.cardType);
    });
  }
  if (sale.cardType) {
    accordion.querySelector(".card-step-amounts")?.removeAttribute("hidden");
    const swipe = accordion.querySelector(".card-swipe-amount");
    const final = accordion.querySelector(".card-final-amount");
    if (swipe) swipe.value = sale.swipeAmount != null ? String(sale.swipeAmount) : "";
    if (final) final.value = sale.finalAmount != null ? String(sale.finalAmount) : "";
  }
  const charges = module.querySelector(".card-swiping-charges");
  if (charges && mode === "credit") {
    charges.value = sale.swipingCharges ? String(sale.swipingCharges) : "";
  }
}

function resetCardFieldsInForm(form) {
  const module = getCardModule(form);
  if (!module) return;
  module.querySelectorAll(".card-mode-chip").forEach((c) => c.classList.remove("is-active"));
  module.querySelectorAll(".card-accordion").forEach((acc) => {
    acc.setAttribute("hidden", "");
    resetCardAccordion(acc);
  });
  module.querySelector("[data-credit-column]")?.setAttribute("hidden", "");
  module.classList.remove("is-credit-mode", "is-debit-mode");
  const charges = module.querySelector(".card-swiping-charges");
  if (charges) charges.value = "";
}

function bindCardPaymentModules() {
  document.querySelectorAll(".card-payment-module").forEach((module) => {
    if (module.dataset.bound) return;
    module.dataset.bound = "1";
    const form = module.closest("form");

    module.querySelectorAll(".card-mode-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const mode = chip.getAttribute("data-card-mode");
        openCardAccordion(module, mode);
      });
    });

    module.querySelectorAll(".card-accordion").forEach((accordion) => {
      accordion.querySelectorAll(".bank-chip").forEach((bankBtn) => {
        bankBtn.addEventListener("click", () => {
          accordion.querySelectorAll(".bank-chip").forEach((b) => b.classList.remove("is-active"));
          bankBtn.classList.add("is-active");
          accordion.querySelector(".card-step-types")?.removeAttribute("hidden");
          accordion.querySelector(".card-step-amounts")?.setAttribute("hidden", "");
          accordion.querySelectorAll(".card-type-chip").forEach((t) => t.classList.remove("is-active"));
          accordion.querySelectorAll(".card-swipe-amount, .card-final-amount, .card-swiping-charges").forEach((inp) => {
            inp.value = "";
          });
        });
      });

      accordion.querySelectorAll(".card-type-chip").forEach((typeBtn) => {
        typeBtn.addEventListener("click", () => {
          accordion.querySelectorAll(".card-type-chip").forEach((t) => t.classList.remove("is-active"));
          typeBtn.classList.add("is-active");
          accordion.querySelector(".card-step-amounts")?.removeAttribute("hidden");
        });
      });
    });

    module.querySelectorAll(".card-final-amount").forEach((inp) => {
      inp.addEventListener("input", () => {
        const scope = form?.getAttribute("data-form-scope") || "main";
        const ctx = getSaleFormContext(scope);
        if (getToggleValue(ctx?.paymentToggle, "cash") !== "card") return;
        const final = Number(inp.value) || 0;
        if (ctx?.price && final > 0) {
          const qty = Number(ctx.qty?.value) || 1;
          ctx.price.value = String(Math.round((final / qty) * 100) / 100);
        }
        if (scope === "main") updateSaleLinePreview("sale-price", "sale-qty", "sale-line-preview");
        else {
          const preview = form.querySelector(".sale-line-preview-alt");
          if (preview && ctx?.price && ctx?.qty) {
            preview.textContent = formatINR(calcLineTotal(ctx.price.value, ctx.qty.value));
          }
        }
      });
    });
  });
}

function getSaleLineTotal(s) {
  if (s.paymentMethod === "card") {
    return Number(s.finalAmount) || Number(s.swipeAmount) || 0;
  }
  return (Number(s.price) || 0) * (Number(s.qty) || 0);
}

function cardTypeLabel(type) {
  const t = CARD_TYPES.find((c) => c.value === type);
  return t ? t.label : type || "—";
}

function todayKey() {
  return formatDateKey(new Date());
}

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    localStorage.setItem(
      STORAGE_META_KEY,
      JSON.stringify({ savedAt: new Date().toISOString(), version: 1 })
    );
    saveUiState();
    if (!window.SkyCloudSync?.isApplyingRemote?.()) {
      window.SkyCloudSync?.pushDebounced?.();
    }
  } catch (err) {
    console.error("Save failed", err);
    showToast("Could not save data — storage may be full", "error");
  }
}

function loadUiState() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (!raw) return;
    const ui = JSON.parse(raw);
    if (ui.activeDate) state.activeDate = ui.activeDate;
    if (ui.saleCategoryFilter) state.saleCategoryFilter = ui.saleCategoryFilter;
    if (ui.salePaymentFilter) state.salePaymentFilter = ui.salePaymentFilter;
    if (ui.reportsPaymentFilter) state.reportsPaymentFilter = ui.reportsPaymentFilter;
    if (ui.activeView) state.activeView = ui.activeView;
    if (ui.calendarMonth) state.calendarMonth = new Date(ui.calendarMonth);
  } catch {
    /* ignore */
  }
}

function saveUiState() {
  try {
    localStorage.setItem(
      UI_STATE_KEY,
      JSON.stringify({
        activeDate: state.activeDate,
        saleCategoryFilter: state.saleCategoryFilter,
        salePaymentFilter: state.salePaymentFilter,
        reportsPaymentFilter: state.reportsPaymentFilter,
        activeView: state.activeView || "dashboard",
        calendarMonth: state.calendarMonth.toISOString(),
        editingSaleId: state.editingSaleId,
      })
    );
  } catch {
    /* ignore */
  }
}

function bindStorageSync() {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        state.data = JSON.parse(e.newValue);
        refreshAll();
        const reportsView = document.getElementById("view-reports");
        if (reportsView && !reportsView.hidden) renderReports();
      } catch {
        /* ignore */
      }
    }
    if (e.key === UI_STATE_KEY && e.newValue) {
      loadUiState();
      syncPaymentFilterChips();
      syncCategoryFilterChips();
      refreshAll();
    }
  });
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { email: DEMO_EMAIL, password: DEMO_PASS };
}

function saveAuth(email, password) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ email, password }));
}

function getLoginEmail() {
  return loadAuth().email || DEMO_EMAIL;
}

function checkPassword(pass) {
  return pass === loadAuth().password;
}

function loadProfile() {
  try {
    const raw = localStorage.getItem("sky_mobiles_profile");
    return raw
      ? JSON.parse(raw)
      : { name: "Admin", email: DEMO_EMAIL, shop: "SKY MOBILES" };
  } catch {
    return { name: "Admin", email: DEMO_EMAIL, shop: "SKY MOBILES" };
  }
}

function saveProfile() {
  localStorage.setItem("sky_mobiles_profile", JSON.stringify(state.profile));
}

function ensureDay(key) {
  if (!state.data[key]) {
    state.data[key] = { sales: [], expenses: [] };
  }
  return state.data[key];
}

function getDay(key = state.activeDate) {
  return ensureDay(key);
}

function calcDayTotals(day) {
  let items = 0;
  let revenue = 0;
  day.sales.forEach((s) => {
    const q = Number(s.qty) || 0;
    items += q;
    revenue += getSaleLineTotal(s);
  });
  let expenses = 0;
  day.expenses.forEach((e) => {
    expenses += Number(e.amount) || 0;
  });
  const profit = revenue - expenses;
  return { items, revenue, expenses, profit };
}

function formatINR(n) {
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

let lastHistoryDate = null;

function showToast(message, type = "success") {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

function migrateData() {
  Object.entries(state.data).forEach(([dateKey, day]) => {
    day.sales?.forEach((s) => {
      if (!s.product && !s.name) s.product = "General item";
      if (s.category === "healthy") s.category = "accessories";
      if (!s.category || !SALE_CATEGORIES.includes(s.category)) {
        s.category = inferSaleCategory(saleProductName(s));
      }
      if (!s.createdAt) {
        s.createdAt = new Date(`${dateKey}T12:00:00`).toISOString();
      }
      if (!s.branchId) s.branchId = "branch_main";
      if (!s.paymentMethod) s.paymentMethod = "cash";
      if (s.paymentMethod === "card") {
        if (!s.cardMode) s.cardMode = "debit";
        s.swipeAmount = Number(s.swipeAmount) || 0;
        s.finalAmount = Number(s.finalAmount) || getSaleLineTotal(s);
        if (s.cardMode !== "credit") s.swipingCharges = 0;
        else if (s.swipingCharges == null) s.swipingCharges = 0;
      } else {
        s.cardMode = "";
        s.cardBank = "";
        s.cardType = "";
        s.swipeAmount = 0;
        s.finalAmount = 0;
        s.swipingCharges = 0;
      }
      if (s.paymentMethod !== "upi") s.paymentAccount = "";
      if (s.paymentAccount == null) s.paymentAccount = "";
    });
    day.expenses?.forEach((ex) => {
      if (!ex.branchId) ex.branchId = "branch_main";
      if (!ex.paymentMethod) ex.paymentMethod = "cash";
      if (!ex.category || !SALE_CATEGORIES.includes(ex.category)) ex.category = "others";
    });
  });
}

function inferSaleCategory(productName) {
  const p = String(productName || "").toLowerCase();
  if (/recharge|prepaid|top.?up|jio|airtel|vi\b|bsnl/.test(p)) return "recharge";
  if (/accessories|case|cover|charger|cable|earbuds|headphone|watch band|screen guard|holder/.test(p))
    return "accessories";
  return "mobile";
}

function categoryLabel(cat) {
  const c = cat === "healthy" ? "accessories" : cat || "mobile";
  if (c === "accessories") return "Accessories";
  if (c === "recharge") return "Recharge";
  if (c === "others") return "Others";
  return "Mobile";
}

function salePaymentType(item) {
  if (item.paymentMethod === "card") return "card";
  if (item.paymentMethod === "upi") return "upi";
  return "cash";
}

function filterSalesList(sales, categoryFilter, paymentFilter) {
  let list = [...sales];
  if (categoryFilter && categoryFilter !== "all") {
    list = list.filter((s) => (s.category || "mobile") === categoryFilter);
  }
  if (paymentFilter && paymentFilter !== "all") {
    list = list.filter((s) => salePaymentType(s) === paymentFilter);
  }
  return list;
}

function calcPaymentBreakdown(sales) {
  const cash = { orders: 0, amount: 0 };
  const upi = { orders: 0, amount: 0 };
  const card = { orders: 0, amount: 0 };
  sales.forEach((s) => {
    const line = typeof getSaleLineTotal === "function" ? getSaleLineTotal(s) : (Number(s.price) || 0) * (Number(s.qty) || 0);
    const pay = salePaymentType(s);
    const bucket = pay === "upi" ? upi : pay === "card" ? card : cash;
    bucket.orders += 1;
    bucket.amount += line;
  });
  return { cash, upi, card };
}

function formatSaleDateTime(iso, dateKey) {
  const d = iso ? new Date(iso) : new Date((dateKey || todayKey()) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function animateCounterEl(el, target, { format = "number", duration = 520 } = {}) {
  if (!el) return;
  const start = Number(el.dataset.value) || 0;
  const end = Number(target) || 0;
  if (start === end) {
    el.textContent = format === "currency" ? formatINR(end) : String(Math.round(end));
    el.dataset.value = String(end);
    return;
  }
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = start + (end - start) * eased;
    el.textContent = format === "currency" ? formatINR(val) : String(Math.round(val));
    if (p < 1) requestAnimationFrame(tick);
    else {
      el.textContent = format === "currency" ? formatINR(end) : String(Math.round(end));
      el.dataset.value = String(end);
    }
  };
  requestAnimationFrame(tick);
}

function renderPaymentStats(containerId, sales, paymentFilter, categoryFilter = state.saleCategoryFilter) {
  const root = document.getElementById(containerId);
  if (!root) return;
  const { cash, upi, card } = calcPaymentBreakdown(sales);
  const filtered = filterSalesList(sales, categoryFilter, paymentFilter);
  const filteredBreakdown = calcPaymentBreakdown(filtered);

  animateCounterEl(root.querySelector('[data-counter="cash-orders"]'), cash.orders);
  animateCounterEl(root.querySelector('[data-counter="cash-amount"]'), cash.amount, { format: "currency" });
  animateCounterEl(root.querySelector('[data-counter="upi-orders"]'), upi.orders);
  animateCounterEl(root.querySelector('[data-counter="upi-amount"]'), upi.amount, { format: "currency" });
  animateCounterEl(root.querySelector('[data-counter="card-orders"]'), card.orders);
  animateCounterEl(root.querySelector('[data-counter="card-amount"]'), card.amount, { format: "currency" });
  const fOrders = filteredBreakdown.cash.orders + filteredBreakdown.upi.orders + filteredBreakdown.card.orders;
  const fAmount = filteredBreakdown.cash.amount + filteredBreakdown.upi.amount + filteredBreakdown.card.amount;
  animateCounterEl(root.querySelector('[data-counter="filtered-orders"]'), fOrders);
  animateCounterEl(root.querySelector('[data-counter="filtered-amount"]'), fAmount, { format: "currency" });
}

function syncPaymentFilterChips() {
  document.querySelectorAll(".payment-filter-bar").forEach((bar) => {
    const scope = bar.getAttribute("data-payment-scope");
    const active =
      scope === "reports" ? state.reportsPaymentFilter : state.salePaymentFilter;
    bar.querySelectorAll(".payment-chip[data-payment]").forEach((chip) => {
      chip.classList.toggle("is-active", chip.getAttribute("data-payment") === active);
    });
  });
}

function setSalePaymentFilter(filter) {
  state.salePaymentFilter = filter || "all";
  syncPaymentFilterChips();
  saveUiState();
  refreshSalesViews();
}

function setReportsPaymentFilter(filter) {
  state.reportsPaymentFilter = filter || "all";
  syncPaymentFilterChips();
  saveUiState();
  renderPaymentReports();
  if (typeof renderReports === "function" && document.getElementById("view-reports")?.classList.contains("is-visible")) {
    renderReports();
  }
}

function refreshSalesViews() {
  const day = getDay();
  renderPaymentStats("payment-stats-main", day.sales, state.salePaymentFilter);
  renderPaymentStats("payment-stats-alt", day.sales, state.salePaymentFilter);
  renderEntryList("sales-list", day.sales, "sale");
  renderEntryList("sales-list-alt", day.sales, "sale");
  updateSalesListChrome("sales-list", "sales-detail-head-main");
  updateSalesListChrome("sales-list-alt", "sales-detail-head-alt");
}

function updateSalesListChrome(listId, detailHeadId) {
  const ul = document.getElementById(listId);
  const detailHead = document.getElementById(detailHeadId);
  const card = ul?.closest(".card-sales, .card-full");
  const standardHead = card?.querySelector(".sales-table-head-standard");
  if (!ul) return;
  const onDailySales = listId === "sales-list-alt";
  const mode = onDailySales ? "all" : state.salePaymentFilter;
  ul.classList.toggle("is-payment-upi", mode === "upi");
  ul.classList.toggle("is-payment-cash", mode === "cash");
  ul.classList.toggle("is-payment-all", mode === "all" || onDailySales);
  ul.classList.toggle("show-payment-labels", onDailySales || mode === "all");
  if (detailHead) {
    detailHead.hidden = mode === "all" || onDailySales;
    const upiCol = detailHead.querySelector("span:nth-child(3)");
    if (upiCol) upiCol.textContent = mode === "cash" ? "Payment" : "UPI Account";
  }
  if (standardHead) standardHead.hidden = !onDailySales && (mode === "upi" || mode === "cash");
}

function normalizeSaleRecord(s) {
  return {
    id: s.id || uid(),
    product: saleProductName(s),
    price: Number(s.price) || 0,
    qty: Number(s.qty) || 1,
    category: SALE_CATEGORIES.includes(s.category)
      ? s.category
      : s.category === "healthy"
        ? "accessories"
        : inferSaleCategory(saleProductName(s)),
    paymentMethod:
      s.paymentMethod === "upi" ? "upi" : s.paymentMethod === "card" ? "card" : "cash",
    paymentAccount: s.paymentMethod === "upi" ? String(s.paymentAccount || "").trim() : "",
    cardMode: s.paymentMethod === "card" ? (s.cardMode === "credit" ? "credit" : "debit") : "",
    cardBank: s.paymentMethod === "card" ? String(s.cardBank || "").trim() : "",
    cardType: s.paymentMethod === "card" ? String(s.cardType || "").trim() : "",
    swipeAmount: s.paymentMethod === "card" ? Number(s.swipeAmount) || 0 : 0,
    finalAmount:
      s.paymentMethod === "card"
        ? Number(s.finalAmount) || Number(s.swipeAmount) || 0
        : 0,
    swipingCharges:
      s.paymentMethod === "card" && s.cardMode === "credit" ? Number(s.swipingCharges) || 0 : 0,
    branchId: s.branchId || "branch_main",
    createdAt: s.createdAt || new Date().toISOString(),
  };
}

function filterSalesByCategory(sales, filter) {
  return filterSalesList(sales, filter, "all");
}

function getToggleValue(group, fallback) {
  if (!group) return fallback;
  const active = group.querySelector(".toggle-btn.is-active");
  return active?.getAttribute("data-value") || fallback;
}

function setToggleValue(group, value) {
  if (!group) return;
  group.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-value") === value);
  });
}

function getSaleFormContext(scope) {
  const isMain = scope === "main";
  const form = document.getElementById(isMain ? "sale-form" : "sale-form-alt");
  if (!form) return null;
  if (isMain) {
    return {
      scope,
      form,
      product: document.getElementById("sale-product"),
      qty: document.getElementById("sale-qty"),
      price: document.getElementById("sale-price"),
      upiAccount: document.getElementById("sale-upi-account"),
      upiWrap: document.getElementById("upi-account-wrap"),
      cardWrap: document.getElementById("card-account-wrap"),
      categoryToggle: form.querySelector('[data-toggle="category"]'),
      paymentToggle: form.querySelector('[data-toggle="payment"]'),
      btnAdd: document.getElementById("btn-add-sale"),
      btnEdit: document.getElementById("btn-edit-sale"),
      btnCancel: document.getElementById("btn-cancel-edit"),
    };
  }
  return {
    scope,
    form,
    product: form.querySelector(".sale-product-alt"),
    qty: form.querySelector(".sale-qty-alt"),
    price: form.querySelector(".sale-price-alt"),
    upiAccount: form.querySelector(".sale-upi-account-alt"),
    upiWrap: form.querySelector(".upi-field-wrap-alt"),
    cardWrap: form.querySelector(".card-account-wrap-alt"),
    categoryToggle: form.querySelector('[data-toggle="category"]'),
    paymentToggle: form.querySelector('[data-toggle="payment"]'),
    btnAdd: form.querySelector(".btn-add-sale-alt"),
    btnEdit: form.querySelector(".btn-edit-sale-alt"),
    btnCancel: form.querySelector(".btn-cancel-edit-alt"),
  };
}

function readSaleForm(scope) {
  const ctx = getSaleFormContext(scope);
  if (!ctx) return null;
  const paymentMethod = getToggleValue(ctx.paymentToggle, "cash");
  const base = {
    product: String(ctx.product?.value || "").trim(),
    qty: Number(ctx.qty?.value) || 1,
    price: Number(ctx.price?.value),
    category: getToggleValue(ctx.categoryToggle, "mobile"),
    paymentMethod,
    paymentAccount: paymentMethod === "upi" ? String(ctx.upiAccount?.value || "").trim() : "",
  };
  if (paymentMethod === "card") {
    return { ...base, ...readCardFieldsFromForm(ctx.form) };
  }
  return base;
}

function fillSaleForm(sale, scope) {
  const ctx = getSaleFormContext(scope);
  if (!ctx || !sale) return;
  if (ctx.product) ctx.product.value = saleProductName(sale);
  if (ctx.qty) ctx.qty.value = String(sale.qty ?? 1);
  if (ctx.price) ctx.price.value = String(sale.price ?? "");
  if (ctx.upiAccount) ctx.upiAccount.value = sale.paymentAccount || "";
  setToggleValue(ctx.categoryToggle, sale.category || "mobile");
  const pay =
    sale.paymentMethod === "upi" ? "upi" : sale.paymentMethod === "card" ? "card" : "cash";
  setToggleValue(ctx.paymentToggle, pay);
  syncPaymentPanels(ctx);
  if (pay === "card") fillCardFieldsInForm(ctx.form, sale);
  else resetCardFieldsInForm(ctx.form);
  if (scope === "main") {
    updateSaleLinePreview("sale-price", "sale-qty", "sale-line-preview");
  } else {
    const preview = ctx.form.querySelector(".sale-line-preview-alt");
    if (preview && ctx.price && ctx.qty) {
      preview.textContent = formatINR(calcLineTotal(ctx.price.value, ctx.qty.value));
    }
  }
}

function resetSaleForm(scope) {
  const ctx = getSaleFormContext(scope);
  if (!ctx) return;
  ctx.form.reset();
  if (ctx.qty) ctx.qty.value = "1";
  setToggleValue(ctx.categoryToggle, "mobile");
  setToggleValue(ctx.paymentToggle, "cash");
  if (ctx.upiAccount) ctx.upiAccount.value = "";
  resetCardFieldsInForm(ctx.form);
  syncPaymentPanels(ctx);
  if (scope === "main") {
    updateSaleLinePreview("sale-price", "sale-qty", "sale-line-preview");
  } else {
    const preview = ctx.form.querySelector(".sale-line-preview-alt");
    if (preview) preview.textContent = formatINR(0);
  }
}

function syncUpiFieldVisibility(ctx) {
  syncPaymentPanels(ctx);
}

function syncPaymentPanels(ctx) {
  if (!ctx) return;
  const method = getToggleValue(ctx.paymentToggle, "cash");
  const isUpi = method === "upi";
  const isCard = method === "card";
  if (ctx.upiWrap) {
    ctx.upiWrap.hidden = !isUpi;
    ctx.upiWrap.classList.toggle("is-visible", isUpi);
  }
  if (ctx.cardWrap) {
    if (isCard) {
      ctx.cardWrap.removeAttribute("hidden");
      ctx.cardWrap.classList.add("is-visible");
      mountCardPaymentPanels();
    } else {
      ctx.cardWrap.setAttribute("hidden", "");
      ctx.cardWrap.classList.remove("is-visible");
      resetCardFieldsInForm(ctx.form);
    }
  }
}

function syncAllSaleFormsFromSale(sale) {
  fillSaleForm(sale, "main");
  fillSaleForm(sale, "alt");
}

function resetAllSaleForms() {
  resetSaleForm("main");
  resetSaleForm("alt");
}

function setEditingSale(id) {
  state.editingSaleId = id;
  document.querySelectorAll("#btn-cancel-edit, .btn-cancel-edit-alt").forEach((btn) => {
    btn.hidden = !id;
  });
  document.querySelectorAll("#btn-edit-sale, .btn-edit-sale-alt").forEach((btn) => {
    btn.classList.toggle("is-armed", Boolean(id));
  });
  document.querySelectorAll("#sales-list li, #sales-list-alt li").forEach((li) => {
    li.classList.toggle("is-editing", li.dataset.saleId === id);
  });
}

function cancelSaleEdit() {
  state.editingSaleId = null;
  resetAllSaleForms();
  setEditingSale(null);
}

function validateSalePayload(payload, { requireAccount = true } = {}) {
  if (!payload.product) {
    showToast("Enter a product name", "error");
    return false;
  }
  if (payload.price <= 0 || payload.qty < 1) {
    showToast("Enter valid quantity and price", "error");
    return false;
  }
  if (!payload.paymentMethod || !["cash", "upi", "card"].includes(payload.paymentMethod)) {
    showToast("Select payment method — Cash, UPI or Card", "error");
    return false;
  }
  if (payload.paymentMethod === "upi" && requireAccount && !payload.paymentAccount) {
    showToast("Enter payment account for UPI", "error");
    return false;
  }
  if (payload.paymentMethod === "card") {
    if (!payload.cardMode) {
      showToast("Select Debit or Credit Card", "error");
      return false;
    }
    if (!payload.cardBank) {
      showToast("Select a bank", "error");
      return false;
    }
    if (!payload.cardType) {
      showToast("Select card type (Visa / RuPay / MasterCard)", "error");
      return false;
    }
    if ((Number(payload.swipeAmount) || 0) <= 0 && (Number(payload.finalAmount) || 0) <= 0) {
      showToast("Enter Swipe Amount or Final Amount", "error");
      return false;
    }
  }
  return true;
}

function paymentDisplayHtml(item) {
  const method = salePaymentType(item);
  if (method === "upi") {
    const acct = String(item.paymentAccount || "").trim();
    const title = acct ? ` title="${escapeHtml(acct)}"` : "";
    return `<span class="payment-pill payment-upi payment-label-visible"${title}><em class="pay-type">UPI</em></span>`;
  }
  if (method === "card") {
    const mode = item.cardMode === "credit" ? "Credit" : "Debit";
    const tip = [
      mode,
      item.cardBank,
      cardTypeLabel(item.cardType),
      item.swipingCharges ? `Charges ${formatINR(item.swipingCharges)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return `<span class="payment-pill payment-card payment-label-visible" title="${escapeHtml(tip)}"><em class="pay-type">Card</em></span>`;
  }
  return `<span class="payment-pill payment-cash payment-label-visible"><em class="pay-type">Cash</em></span>`;
}

function saleCardDetailsText(item) {
  if (salePaymentType(item) !== "card") return "";
  const mode = item.cardMode === "credit" ? "Credit Card" : "Debit Card";
  let t = `${mode} · ${item.cardBank || "—"} · ${cardTypeLabel(item.cardType)}`;
  t += ` · Swipe ${formatINR(item.swipeAmount)} → Final ${formatINR(item.finalAmount || getSaleLineTotal(item))}`;
  if (item.cardMode === "credit" && Number(item.swipingCharges) > 0) {
    t += ` · Charges ${formatINR(item.swipingCharges)}`;
  }
  return t;
}

function syncCategoryFilterChips() {
  document.querySelectorAll(".filter-chip[data-category]").forEach((chip) => {
    chip.classList.toggle("is-active", chip.getAttribute("data-category") === state.saleCategoryFilter);
  });
}

function setSaleCategoryFilter(filter) {
  state.saleCategoryFilter = filter || "all";
  syncCategoryFilterChips();
  saveUiState();
  refreshSalesViews();
}

/* ——— Boot ——— */
document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("loader");
  setTimeout(() => {
    loader?.classList.add("is-hidden");
    initApp();
  }, 1400);
});

function initApp() {
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session === "ok") {
    showApp();
  } else {
    showLogin();
  }
  bindAuth();
  bindNavigation();
  bindForms();
  bindCalendar();
  bindHistoryPanel();
  bindMisc();
  bindSaleLinePreview();
  mountCardPaymentPanels();
  bindSaleFeatures();
  bindExpenseFeatures();
  bindStorageSync();
  if (window.SkyEnterprise) window.SkyEnterprise.init();
  loadUiState();
  migrateData();
  syncPaymentFilterChips();
  syncCategoryFilterChips();
  const fy = document.getElementById("footer-year");
  if (fy) fy.textContent = String(new Date().getFullYear());
  renderAppUrls();
  if (sessionStorage.getItem(SESSION_KEY) === "ok") {
    startCloudSync();
    refreshAll();
    if (state.activeView && state.activeView !== "dashboard") {
      switchView(state.activeView);
    }
  }
}

function startCloudSync() {
  const email = state.profile?.email || getLoginEmail();
  window.SkyCloudSync?.start?.(email);
}

window.skyBuildSyncPayload = function () {
  return {
    data: state.data,
    branches: state.branches,
    users: state.users,
    profile: state.profile,
    ui: {
      activeDate: state.activeDate,
      saleCategoryFilter: state.saleCategoryFilter,
      salePaymentFilter: state.salePaymentFilter,
      reportsPaymentFilter: state.reportsPaymentFilter,
      activeView: state.activeView,
      calendarMonth: state.calendarMonth.toISOString(),
      editingSaleId: state.editingSaleId,
    },
    clientSavedAt: new Date().toISOString(),
  };
};

window.skyApplySyncPayload = function (payload) {
  if (payload.data) state.data = payload.data;
  if (payload.branches?.length) {
    state.branches = payload.branches;
    localStorage.setItem("sky_branches_v1", JSON.stringify(state.branches));
  }
  if (payload.users?.length) {
    state.users = payload.users;
    localStorage.setItem("sky_users_v1", JSON.stringify(state.users));
  }
  if (payload.profile) {
    state.profile = { ...state.profile, ...payload.profile };
    saveProfile();
    applyProfileUI();
  }
  if (payload.ui) {
    if (payload.ui.activeDate) state.activeDate = payload.ui.activeDate;
    if (payload.ui.saleCategoryFilter) state.saleCategoryFilter = payload.ui.saleCategoryFilter;
    if (payload.ui.salePaymentFilter) state.salePaymentFilter = payload.ui.salePaymentFilter;
    if (payload.ui.reportsPaymentFilter) state.reportsPaymentFilter = payload.ui.reportsPaymentFilter;
    if (payload.ui.activeView) state.activeView = payload.ui.activeView;
    if (payload.ui.calendarMonth) state.calendarMonth = new Date(payload.ui.calendarMonth);
    if (payload.ui.editingSaleId != null) state.editingSaleId = payload.ui.editingSaleId;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    localStorage.setItem(
      STORAGE_META_KEY,
      JSON.stringify({ savedAt: payload.clientSavedAt || new Date().toISOString(), version: 1 })
    );
    saveUiState();
  } catch {
    /* ignore */
  }
  migrateData();
  syncPaymentFilterChips();
  syncCategoryFilterChips();
  refreshAll();
  const reportsView = document.getElementById("view-reports");
  if (reportsView && !reportsView.hidden) renderReports();
  if (state.activeView) switchView(state.activeView);
};

window.skyOnCloudSync = function (initial) {
  if (!initial) showToast("Synced from cloud");
};

function renderAppUrls() {
  const ul = document.getElementById("app-url-list");
  if (!ul) return;
  const origin = window.location.origin || "http://localhost:5173";
  const here = `${origin}${APP_BASE_PATH || ""}/`;
  const paths = [
    { label: "Current app URL", href: here },
    { label: "Local server", href: `http://localhost:5173/sky-mobiles/` },
  ];
  ul.innerHTML = paths
    .map(
      (p) =>
        `<li><strong>${p.label}:</strong> <a href="${p.href}" target="_blank" rel="noopener">${p.href}</a></li>`
    )
    .join("");
}

function showLogin() {
  document.getElementById("login-screen")?.removeAttribute("hidden");
  document.getElementById("app")?.setAttribute("hidden", "");
  const emailInput = document.getElementById("login-email");
  if (emailInput && !emailInput.value) emailInput.value = getLoginEmail();
}

function showApp() {
  document.getElementById("login-screen")?.setAttribute("hidden", "");
  document.getElementById("app")?.removeAttribute("hidden");
  applyProfileUI();
}

function bindAuth() {
  document.getElementById("login-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email")?.value.trim();
    const pass = document.getElementById("login-password")?.value;
    const err = document.getElementById("login-error");
    const auth = loadAuth();
    const enterpriseUser = window.SkyEnterprise?.authenticateUser?.(email, pass);
    if (enterpriseUser || (email === auth.email && pass === auth.password)) {
      if (err) err.hidden = true;
      if (window.SkyEnterprise?.onLoginSuccess) {
        window.SkyEnterprise.onLoginSuccess(email, pass);
      }
      sessionStorage.setItem(SESSION_KEY, "ok");
      showApp();
      startCloudSync();
      if (window.SkyEnterprise) window.SkyEnterprise.init();
      refreshAll();
      showToast("Welcome back!");
    } else {
      if (err) {
        err.textContent = `Invalid email or password. Try: ${getLoginEmail()} / (your password)`;
        err.hidden = false;
      }
    }
  });

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
    showToast("Signed out", "success");
  });
}

function bindNavigation() {
  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      switchView(view);
      closeSidebar();
    });
  });

  document.getElementById("profile-open")?.addEventListener("click", () => {
    switchView("settings");
  });

  document.getElementById("menu-toggle")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("is-open");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (backdrop) backdrop.hidden = !document.getElementById("sidebar")?.classList.contains("is-open");
  });

  document.getElementById("sidebar-backdrop")?.addEventListener("click", closeSidebar);
}

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("is-open");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (backdrop) backdrop.hidden = true;
}

const viewTitles = {
  dashboard: "Dashboard",
  sales: "Daily Sales",
  expenses: "Expenses",
  reports: "Reports",
  history: "History",
  settings: "Settings",
};

function switchView(view) {
  state.activeView = view;
  saveUiState();
  document.querySelectorAll(".nav-item[data-view]").forEach((n) => {
    n.classList.toggle("is-active", n.getAttribute("data-view") === view);
  });
  document.querySelectorAll(".view").forEach((v) => {
    const match = v.getAttribute("data-view") === view || v.id === `view-${view}`;
    v.classList.toggle("is-visible", match);
    v.hidden = !match;
  });
  const title = document.getElementById("page-title");
  if (title) title.textContent = viewTitles[view] || "Dashboard";
  if (view === "reports") renderReports();
  if (view === "history") mountHistoryCalendar();
  if (view === "sales" || view === "expenses" || view === "dashboard") refreshAll();
}

function bindForms() {
  document.getElementById("sale-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitAddSale("main");
  });

  document.getElementById("expense-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    addExpense(
      document.getElementById("expense-name")?.value,
      document.getElementById("expense-amount")?.value
    );
    e.target.reset();
  });

  document.getElementById("sale-form-alt")?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitAddSale("alt");
  });

  document.getElementById("expense-form-alt")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    addExpense(
      form.querySelector(".expense-name-alt")?.value,
      form.querySelector(".expense-amount-alt")?.value,
      readExpenseFormAlt()
    );
    form.reset();
    document.querySelector(".expense-card-bank-wrap")?.setAttribute("hidden", "");
  });

  document.getElementById("password-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const current = document.getElementById("pw-current")?.value || "";
    const next = document.getElementById("pw-new")?.value || "";
    const confirm = document.getElementById("pw-confirm")?.value || "";
    const msg = document.getElementById("password-msg");

    const showPwMsg = (text, ok) => {
      if (!msg) return;
      msg.textContent = text;
      msg.className = "form-msg " + (ok ? "success" : "error");
      msg.hidden = false;
    };

    if (!checkPassword(current)) {
      showPwMsg("Current password is incorrect.", false);
      return;
    }
    if (next.length < 6) {
      showPwMsg("New password must be at least 6 characters.", false);
      return;
    }
    if (next !== confirm) {
      showPwMsg("New passwords do not match.", false);
      return;
    }

    const auth = loadAuth();
    saveAuth(auth.email, next);
    e.target.reset();
    showPwMsg("Password updated successfully.", true);
    showToast("Password changed");
  });

  document.getElementById("profile-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    state.profile.name = document.getElementById("settings-name")?.value.trim() || "Admin";
    state.profile.shop = document.getElementById("settings-shop")?.value.trim() || "SKY MOBILES";
    const newEmail = document.getElementById("settings-email")?.value.trim() || DEMO_EMAIL;
    state.profile.email = newEmail;
    const auth = loadAuth();
    saveAuth(newEmail, auth.password);
    saveProfile();
    applyProfileUI();
    renderAppUrls();
    showToast("Profile saved");
  });

  document.getElementById("clear-data-btn")?.addEventListener("click", () => {
    if (confirm("Delete ALL sales and expense records? This cannot be undone.")) {
      state.data = {};
      saveData();
      refreshAll();
      showToast("All data reset");
    }
  });
}

function calcLineTotal(priceVal, qtyVal) {
  return (Number(priceVal) || 0) * (Number(qtyVal) || 0);
}

function bindSaleLinePreview() {
  const setups = [
    { price: "sale-price", qty: "sale-qty", out: "sale-line-preview" },
  ];
  const altForm = document.getElementById("sale-form-alt");
  if (altForm) {
    setups.push({
      priceEl: altForm.querySelector(".sale-price-alt"),
      qtyEl: altForm.querySelector(".sale-qty-alt"),
      outEl: altForm.querySelector(".sale-line-preview-alt"),
    });
  }

  setups.forEach((cfg) => {
    const priceEl = cfg.priceEl || document.getElementById(cfg.price);
    const qtyEl = cfg.qtyEl || document.getElementById(cfg.qty);
    const outEl = cfg.outEl || document.getElementById(cfg.out);
    if (!priceEl || !qtyEl || !outEl) return;

    const update = () => {
      outEl.textContent = formatINR(calcLineTotal(priceEl.value, qtyEl.value));
    };
    priceEl.addEventListener("input", update);
    qtyEl.addEventListener("input", update);
    update();
  });
}

function updateSaleLinePreview(priceId, qtyId, outId) {
  const priceEl = document.getElementById(priceId);
  const qtyEl = document.getElementById(qtyId);
  const outEl = document.getElementById(outId);
  if (outEl && priceEl && qtyEl) {
    outEl.textContent = formatINR(calcLineTotal(priceEl.value, qtyEl.value));
  }
}

function saleProductName(item) {
  const name = String(item.product || item.name || "").trim();
  return name || "Unnamed product";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function saleUpiDetailRowHtml(item, dateKey) {
  const price = Number(item.price);
  const qty = Number(item.qty);
  const line = getSaleLineTotal(item);
  const name = escapeHtml(saleProductName(item));
  const acct = escapeHtml(item.paymentAccount || "—");
  const when = escapeHtml(formatSaleDateTime(item.createdAt, dateKey));
  const details = escapeHtml(
    `Qty ${qty} × ${formatINR(price)} · ${categoryLabel(item.category)} · ${salePaymentType(item).toUpperCase()}`
  );
  return `
    <span class="pt-col-product" title="${name}">${name}</span>
    <span class="pt-col-amount">${formatINR(line)}</span>
    <span class="pt-col-upi" title="${acct}">${acct}</span>
    <span class="pt-col-time">${when}</span>
    <span class="pt-col-details">${details}</span>`;
}

function saleCashDetailRowHtml(item, dateKey) {
  const price = Number(item.price);
  const qty = Number(item.qty);
  const line = getSaleLineTotal(item);
  const name = escapeHtml(saleProductName(item));
  const when = escapeHtml(formatSaleDateTime(item.createdAt, dateKey));
  const details = escapeHtml(`Qty ${qty} × ${formatINR(price)} · ${categoryLabel(item.category)} · Cash`);
  return `
    <span class="pt-col-product" title="${name}">${name}</span>
    <span class="pt-col-amount">${formatINR(line)}</span>
    <span class="pt-col-upi muted-cell">—</span>
    <span class="pt-col-time">${when}</span>
    <span class="pt-col-details">${details}</span>`;
}

function saleCardDetailRowHtml(item, dateKey) {
  const line = getSaleLineTotal(item);
  const name = escapeHtml(saleProductName(item));
  const bank = escapeHtml(`${item.cardBank || "—"} · ${cardTypeLabel(item.cardType)}`);
  const when = escapeHtml(formatSaleDateTime(item.createdAt, dateKey));
  const details = escapeHtml(saleCardDetailsText(item));
  return `
    <span class="pt-col-product" title="${name}">${name}</span>
    <span class="pt-col-amount">${formatINR(line)}</span>
    <span class="pt-col-upi" title="${bank}">${bank}</span>
    <span class="pt-col-time">${when}</span>
    <span class="pt-col-details">${details}</span>`;
}

function saleRowHtml(item, options = {}) {
  const { withActions = false, withRemove = false, dateKey = state.activeDate, viewMode = "standard" } =
    typeof options === "boolean" ? { withActions: options, withRemove: options } : options;
  const showActions = withActions || withRemove;
  const price = Number(item.price);
  const qty = Number(item.qty);
  const line = getSaleLineTotal(item);
  const name = escapeHtml(saleProductName(item));
  const cat = escapeHtml(item.category === "healthy" ? "accessories" : item.category || "mobile");

  if (viewMode === "upi" && salePaymentType(item) === "upi") {
    const inner = saleUpiDetailRowHtml(item, dateKey);
    const actions = showActions
      ? `<span class="sale-row-actions sale-row-actions-detail">
          <button type="button" class="btn-row-edit" aria-label="Edit sale">✎</button>
          <button type="button" class="btn-row-remove" aria-label="Remove sale">×</button>
        </span>`
      : "";
    return `${inner}${actions}`;
  }

  if (viewMode === "cash" && salePaymentType(item) === "cash") {
    const inner = saleCashDetailRowHtml(item, dateKey);
    const actions = showActions
      ? `<span class="sale-row-actions sale-row-actions-detail">
          <button type="button" class="btn-row-edit" aria-label="Edit sale">✎</button>
          <button type="button" class="btn-row-remove" aria-label="Remove sale">×</button>
        </span>`
      : "";
    return `${inner}${actions}`;
  }

  let actions = "";
  if (showActions) {
    actions = `<span class="sale-row-actions">
      <button type="button" class="btn-row-edit" aria-label="Edit sale">✎</button>
      <button type="button" class="btn-row-remove" aria-label="Remove sale">×</button>
    </span>`;
  }
  return `
    <span class="sale-col-product" title="${name}"><span class="sale-cat-dot cat-${cat}" aria-hidden="true"></span>${name}</span>
    <span class="sale-col-qty">${qty}</span>
    <span class="sale-col-price">${formatINR(price)}</span>
    <span class="sale-col-payment">${paymentDisplayHtml(item)}</span>
    <span class="sale-col-total">${formatINR(line)}</span>
    ${actions}`;
}

function submitAddSale(scope) {
  if (state.editingSaleId) cancelSaleEdit();
  const payload = readSaleForm(scope);
  if (!payload || !validateSalePayload(payload)) return;
  addSale(payload);
  resetSaleForm(scope);
}

function submitEditSale(scope) {
  if (!state.editingSaleId) {
    showToast("Select a sale to edit (✎ on row)", "error");
    return;
  }
  const payload = readSaleForm(scope);
  if (!payload || !validateSalePayload(payload)) return;
  updateSale(state.editingSaleId, payload);
  cancelSaleEdit();
}

function getActiveBranchIdForNewRecord() {
  if (window.SkyEnterprise?.isStaff?.()) {
    return state.currentUser?.branchId || "branch_main";
  }
  if (state.dashboardBranchFilter && state.dashboardBranchFilter !== "all") {
    return state.dashboardBranchFilter;
  }
  return "branch_main";
}

function addSale(payload) {
  const record = normalizeSaleRecord({ id: uid(), ...payload, branchId: getActiveBranchIdForNewRecord() });
  if (record.paymentMethod === "card" && record.finalAmount > 0) {
    record.price = record.finalAmount / (record.qty || 1);
  }
  if (!record.product || record.price <= 0 || record.qty < 1) return;
  const day = getDay();
  day.sales.push(record);
  saveData();
  refreshAll();
  showToast("Sale added");
}

function updateSale(id, payload) {
  const day = getDay();
  const idx = day.sales.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const prev = day.sales[idx];
  const record = normalizeSaleRecord({ ...prev, ...payload, id, createdAt: prev.createdAt });
  if (record.paymentMethod === "card" && record.finalAmount > 0) {
    record.price = record.finalAmount / (record.qty || 1);
  }
  day.sales[idx] = record;
  saveData();
  refreshAll();
  showToast("Sale updated");
}

function loadSaleForEdit(id) {
  if (window.SkyPerms?.canEdit?.() === false) {
    showToast("You do not have permission to edit sales", "error");
    return;
  }
  const sale = getDay().sales.find((s) => s.id === id);
  if (!sale) return;
  state.editingSaleId = id;
  syncAllSaleFormsFromSale(sale);
  setEditingSale(id);
  showToast("Editing sale — update fields and click Edit Sale");
}

function bindSaleFeatures() {
  document.querySelectorAll(".category-filter-bar").forEach((bar) => {
    bar.querySelectorAll(".filter-chip[data-category]").forEach((chip) => {
      chip.addEventListener("click", () => {
        setSaleCategoryFilter(chip.getAttribute("data-category") || "all");
      });
    });
  });
  syncCategoryFilterChips();

  document.querySelectorAll(".toggle-group[data-toggle]").forEach((group) => {
    group.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        const form = group.closest("form");
        if (!form) return;
        const scope = form.getAttribute("data-form-scope") || "main";
        const ctx = getSaleFormContext(scope);
        syncPaymentPanels(ctx);
        const otherScope = scope === "main" ? "alt" : "main";
        const otherForm = getSaleFormContext(otherScope);
        if (group.dataset.toggle === "category" && otherForm?.categoryToggle) {
          setToggleValue(otherForm.categoryToggle, btn.getAttribute("data-value"));
        }
        if (group.dataset.toggle === "payment" && otherForm?.paymentToggle) {
          setToggleValue(otherForm.paymentToggle, btn.getAttribute("data-value"));
          syncPaymentPanels(otherForm);
        }
      });
    });
  });

  const wireScope = (scope) => {
    const ctx = getSaleFormContext(scope);
    if (!ctx) return;
    ctx.btnAdd?.addEventListener("click", () => submitAddSale(scope));
    ctx.btnEdit?.addEventListener("click", () => submitEditSale(scope));
    ctx.btnCancel?.addEventListener("click", () => cancelSaleEdit());
    ctx.form?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        if (state.editingSaleId) submitEditSale(scope);
        else submitAddSale(scope);
      }
    });
  };
  wireScope("main");
  wireScope("alt");

  document.querySelectorAll(".payment-filter-bar").forEach((bar) => {
    bar.querySelectorAll(".payment-chip[data-payment]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const filter = chip.getAttribute("data-payment") || "all";
        const scope = bar.getAttribute("data-payment-scope");
        if (scope === "reports") setReportsPaymentFilter(filter);
        else setSalePaymentFilter(filter);
      });
    });
  });
}

function collectMonthSales(year, month) {
  if (window.SkyEnterprise?.collectMonthSalesFiltered) {
    return window.SkyEnterprise.collectMonthSalesFiltered(year, month);
  }
  const rows = [];
  Object.keys(state.data).forEach((key) => {
    const d = new Date(key + "T12:00:00");
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    state.data[key].sales.forEach((s) => {
      rows.push({ ...s, dateKey: key });
    });
  });
  return rows;
}

function renderPaymentReports() {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  const monthSales = collectMonthSales(y, m);
  renderPaymentStats("payment-stats-reports", monthSales, state.reportsPaymentFilter, "all");

  const ul = document.getElementById("reports-payment-list");
  const head = document.getElementById("reports-payment-head");
  if (!ul) return;

  const filtered = filterSalesList(monthSales, "all", state.reportsPaymentFilter);
  const rowView =
    state.reportsPaymentFilter === "upi"
      ? "upi"
      : state.reportsPaymentFilter === "cash"
        ? "cash"
        : "standard";

  if (head) {
    head.hidden = false;
    head.classList.toggle("is-cash-mode", state.reportsPaymentFilter === "cash");
    head.classList.toggle("is-upi-mode", state.reportsPaymentFilter === "upi");
    const upiCol = head.querySelector("span:nth-child(3)");
    if (upiCol) upiCol.textContent = state.reportsPaymentFilter === "cash" ? "Payment" : "UPI Account";
  }

  ul.className = "payment-transactions-list sales-list-animated";
  ul.classList.toggle("is-payment-upi", state.reportsPaymentFilter === "upi");
  ul.classList.toggle("is-payment-cash", state.reportsPaymentFilter === "cash");
  ul.classList.add("is-filtering");
  ul.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("li");
    empty.className = "payment-empty";
    empty.textContent = "No sales for this payment filter yet.";
    ul.appendChild(empty);
  } else {
    filtered.forEach((item, index) => {
      const li = document.createElement("li");
      li.style.setProperty("--row-delay", `${index * 40}ms`);
      li.classList.add("sale-detail-row");
      if (rowView === "standard" && salePaymentType(item) === "card") {
        li.innerHTML = saleCardDetailRowHtml(item, item.dateKey);
      } else if (rowView === "standard") {
        li.innerHTML = saleRowHtml(item, { withActions: false, viewMode: "standard", dateKey: item.dateKey });
        li.classList.remove("sale-detail-row");
      } else {
        li.innerHTML = saleRowHtml(item, { withActions: false, viewMode: rowView, dateKey: item.dateKey });
      }
      ul.appendChild(li);
    });
  }

  requestAnimationFrame(() => ul.classList.remove("is-filtering"));
}

function normalizeExpenseRecord(e) {
  return {
    id: e.id || uid(),
    name: String(e.name || "").trim(),
    amount: Number(e.amount) || 0,
    paymentMethod: e.paymentMethod === "upi" ? "upi" : e.paymentMethod === "card" ? "card" : "cash",
    category: SALE_CATEGORIES.includes(e.category) ? e.category : "others",
    branchId: e.branchId || "branch_main",
    cardBank: e.cardBank || "",
    createdAt: e.createdAt || new Date().toISOString(),
  };
}

function addExpense(name, amountVal, extra = {}) {
  const amount = Number(amountVal);
  const label = String(name || "").trim();
  if (!label || !amount || amount < 0) return;
  const day = getDay();
  day.expenses.push(
    normalizeExpenseRecord({
      id: uid(),
      name: label,
      amount,
      branchId: getActiveBranchIdForNewRecord(),
      ...extra,
    })
  );
  saveData();
  refreshAll();
  showToast("Expense added");
}

function removeSale(id) {
  if (window.SkyPerms?.canDelete?.() === false) {
    showToast("You cannot delete records", "error");
    return;
  }
  const day = getDay();
  day.sales = day.sales.filter((s) => s.id !== id);
  saveData();
  refreshAll();
}

function removeExpense(id) {
  if (window.SkyPerms?.canDelete?.() === false) {
    showToast("You cannot delete records", "error");
    return;
  }
  const day = getDay();
  day.expenses = day.expenses.filter((e) => e.id !== id);
  saveData();
  refreshAll();
}

function expensePaymentLabel(item) {
  const pay = item.paymentMethod === "upi" ? "UPI" : item.paymentMethod === "card" ? "Card" : "Cash";
  if (item.paymentMethod === "card" && item.cardBank) return `${pay} · ${escapeHtml(item.cardBank)}`;
  return pay;
}

function expenseCategoryLabel(item) {
  const c = item.category || "others";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function expenseRowHtml(item, withRemove) {
  const name = escapeHtml(item.name);
  const btn = withRemove ? `<button type="button" aria-label="Remove">×</button>` : "";
  return `<span class="sale-col-product">${name}</span><span class="exp-col-meta">${expenseCategoryLabel(item)}</span><span class="exp-col-pay">${expensePaymentLabel(item)}</span><span class="exp-col-amount">${formatINR(item.amount)}</span>${btn}`;
}

function readExpenseFormAlt() {
  const payChip = document.querySelector(".expense-payment-alt.is-active");
  const paymentMethod = payChip?.getAttribute("data-payment") || "cash";
  const catChip = document.querySelector(".expense-category-alt.is-active");
  const category = catChip?.getAttribute("data-category") || "others";
  const cardBank = document.querySelector(".expense-card-bank-alt")?.value.trim() || "";
  return { paymentMethod, category, cardBank: paymentMethod === "card" ? cardBank : "" };
}

function bindExpenseFeatures() {
  document.querySelectorAll(".expense-payment-alt").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".expense-payment-alt").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      const isCard = chip.getAttribute("data-payment") === "card";
      document.querySelector(".expense-card-bank-wrap")?.toggleAttribute("hidden", !isCard);
    });
  });
  document.querySelectorAll(".expense-category-alt").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".expense-category-alt").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
    });
  });
}

function renderEntryList(containerId, items, type) {
  const ul = document.getElementById(containerId);
  if (!ul) return;
  const onDashboard =
    document.getElementById("view-dashboard")?.classList.contains("is-visible") &&
    !document.getElementById("view-dashboard")?.hidden;
  const viewOnly =
    (containerId === "sales-list" && onDashboard) ||
    containerId === "dashboard-sales-list" ||
    (containerId === "expenses-list" && onDashboard);
  const allowActions =
    !viewOnly &&
    (type !== "sale" || window.SkyPerms?.canEdit?.() !== false) &&
    window.SkyPerms?.canDelete?.() !== false;
  let listItems =
    type === "sale"
      ? filterSalesList(items, state.saleCategoryFilter, state.salePaymentFilter)
      : items;
  if (window.SkyEnterprise && state.currentUser?.role === "staff") {
    listItems = window.SkyEnterprise.filterByBranch(listItems, state.currentUser.branchId);
  }
  const onDailySalesList = containerId === "sales-list-alt";
  const payMode = state.salePaymentFilter;
  const rowView = onDailySalesList
    ? "standard"
    : payMode === "upi"
      ? "upi"
      : payMode === "cash"
        ? "cash"
        : "standard";
  ul.classList.add("is-filtering");
  ul.innerHTML = "";
  listItems.forEach((item, index) => {
    const li = document.createElement("li");
    li.style.setProperty("--row-delay", `${index * 45}ms`);
    if (type === "sale") {
      li.dataset.saleId = item.id;
      if (item.id === state.editingSaleId) li.classList.add("is-editing");
      if (rowView !== "standard") li.classList.add("sale-detail-row");
      li.innerHTML = saleRowHtml(item, {
        withActions: allowActions,
        viewMode: rowView,
        dateKey: state.activeDate,
      });
      if (allowActions) {
        li.querySelector(".btn-row-remove")?.addEventListener("click", () => {
          if (state.editingSaleId === item.id) cancelSaleEdit();
          removeSale(item.id);
        });
        li.querySelector(".btn-row-edit")?.addEventListener("click", () => loadSaleForEdit(item.id));
      }
    } else {
      li.innerHTML = expenseRowHtml(item, allowActions);
      if (allowActions) li.querySelector("button")?.addEventListener("click", () => removeExpense(item.id));
    }
    ul.appendChild(li);
  });
  requestAnimationFrame(() => {
    ul.classList.remove("is-filtering");
    setEditingSale(state.editingSaleId);
  });
}

function applyProfitStyles(profit) {
  const els = [
    document.getElementById("net-profit"),
    document.getElementById("stat-profit"),
  ];
  const card = document.getElementById("profit-card");
  const statCard = document.getElementById("stat-profit-card");
  const positive = profit >= 0;
  els.forEach((el) => {
    if (!el) return;
    el.textContent = formatINR(profit);
    el.classList.toggle("profit-positive", positive);
    el.classList.toggle("profit-negative", !positive);
  });
  card?.classList.toggle("positive", positive);
  card?.classList.toggle("negative", !positive);
  statCard?.classList.toggle("highlight-profit", positive);
}

function refreshAll() {
  const day = getDay();
  const { items, revenue, expenses, profit } = calcDayTotals(day);

  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set("total-items-sold", String(items));
  set("total-revenue", formatINR(revenue));
  set("total-items-sold-alt", String(items));
  set("total-revenue-alt", formatINR(revenue));
  set("total-expenses", formatINR(expenses));
  set("total-expenses-alt", formatINR(expenses));
  set("stat-revenue", formatINR(revenue));
  set("stat-items", String(items));
  const expenseCount = (day.expenses || []).length;
  set("stat-expenses-top", formatINR(expenses));
  set("stat-expense-items", String(expenseCount));
  set("dash-expense-amount", formatINR(expenses));
  set("dash-expense-qty", String(expenseCount));
  set("total-expense-count", String(expenseCount));
  set("profit-sales-ref", formatINR(revenue));
  set("profit-expenses-ref", formatINR(expenses));
  set("stat-profit", formatINR(profit));
  applyProfitStyles(profit);

  const heroTotal = document.getElementById("hero-net-total");
  if (heroTotal) {
    heroTotal.textContent = formatINR(profit);
    heroTotal.classList.toggle("profit-positive", profit >= 0);
    heroTotal.classList.toggle("profit-negative", profit < 0);
  }
  const heroSales = document.getElementById("hero-today-sales");
  if (heroSales) heroSales.textContent = formatINR(revenue);

  renderPaymentStats("payment-stats-main", day.sales, state.salePaymentFilter);
  renderPaymentStats("payment-stats-alt", day.sales, state.salePaymentFilter);
  renderEntryList("sales-list", day.sales, "sale");
  renderEntryList("expenses-list", day.expenses, "expense");
  renderEntryList("sales-list-alt", day.sales, "sale");
  renderEntryList("expenses-list-alt", day.expenses, "expense");
  updateSalesListChrome("sales-list", "sales-detail-head-main");
  updateSalesListChrome("sales-list-alt", "sales-detail-head-alt");

  const dateLabel = new Date(state.activeDate + "T12:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const pageDate = document.getElementById("page-date");
  if (pageDate) pageDate.textContent = dateLabel;
  document.querySelectorAll(".active-date-label").forEach((el) => {
    el.textContent = dateLabel;
  });
  const footerShop = document.getElementById("footer-shop");
  if (footerShop) footerShop.textContent = state.profile.shop || "SKY MOBILES";

  const dateInput = document.getElementById("global-date-search");
  if (dateInput && dateInput !== document.activeElement) {
    dateInput.value = state.activeDate;
  }

  renderCalendar("calendar-grid");
  updateCharts(revenue, expenses, profit);
}

function bindCalendar() {
  document.getElementById("prev-month")?.addEventListener("click", () => {
    state.calendarMonth = new Date(
      state.calendarMonth.getFullYear(),
      state.calendarMonth.getMonth() - 1,
      1
    );
    renderCalendar("calendar-grid");
  });
  document.getElementById("next-month")?.addEventListener("click", () => {
    state.calendarMonth = new Date(
      state.calendarMonth.getFullYear(),
      state.calendarMonth.getMonth() + 1,
      1
    );
    renderCalendar("calendar-grid");
  });
}

function renderCalendar(gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const y = state.calendarMonth.getFullYear();
  const m = state.calendarMonth.getMonth();
  const monthText = state.calendarMonth.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const label = document.getElementById("calendar-month-label");
  if (label) label.textContent = monthText;
  const histLabel = document.getElementById("hist-month-label");
  if (histLabel) histLabel.textContent = monthText;

  grid.innerHTML = "";
  const first = new Date(y, m, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayKey();

  for (let i = 0; i < startPad; i++) {
    const empty = document.createElement("button");
    empty.type = "button";
    empty.className = "cal-day is-empty";
    empty.disabled = true;
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-day";
    btn.textContent = String(d);

    const record = state.data[key];
    if (record) {
      const t = calcDayTotals(record);
      if (t.revenue || t.expenses) {
        btn.classList.add("has-data");
        if (t.profit < 0) btn.classList.add("is-loss");
        const mini = document.createElement("span");
        mini.className = "mini-profit";
        mini.textContent = t.profit >= 0 ? "+" + formatINR(t.profit) : formatINR(t.profit);
        btn.appendChild(mini);
      }
    }

    if (key === today) btn.classList.add("is-today");
    if (key === state.activeDate) btn.classList.add("is-selected");

    btn.addEventListener("click", () => {
      if (gridId === "calendar-grid") {
        state.activeDate = key;
        refreshAll();
      }
      openHistoryPanel(key);
    });

    grid.appendChild(btn);
  }
}

function mountHistoryCalendar() {
  const mount = document.getElementById("history-calendar-mount");
  if (!mount || mount.dataset.mounted) return;
  mount.innerHTML = `
    <div class="month-nav" style="margin-bottom:1rem">
      <button type="button" class="btn-icon-sm" id="hist-prev-month">‹</button>
      <span id="hist-month-label"></span>
      <button type="button" class="btn-icon-sm" id="hist-next-month">›</button>
    </div>
    <div class="calendar-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
    <div id="hist-calendar-grid" class="calendar-grid"></div>
  `;

  mount.dataset.mounted = "1";
  document.getElementById("hist-prev-month")?.addEventListener("click", () => {
    state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1);
    renderCalendar("hist-calendar-grid");
  });
  document.getElementById("hist-next-month")?.addEventListener("click", () => {
    state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1);
    renderCalendar("hist-calendar-grid");
  });
  renderCalendar("hist-calendar-grid");
}

function bindHistoryPanel() {
  document.getElementById("close-history")?.addEventListener("click", closeHistoryPanel);
  document.getElementById("history-backdrop")?.addEventListener("click", closeHistoryPanel);
}

function openHistoryPanel(dateKey) {
  lastHistoryDate = dateKey;
  const panel = document.getElementById("history-panel");
  const backdrop = document.getElementById("history-backdrop");
  const day = state.data[dateKey] || { sales: [], expenses: [] };
  const t = calcDayTotals(day);

  document.getElementById("history-panel-date").textContent = new Date(
    dateKey + "T12:00:00"
  ).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  document.getElementById("hist-qty").textContent = String(t.items);
  document.getElementById("hist-sales").textContent = formatINR(t.revenue);
  document.getElementById("hist-expenses").textContent = formatINR(t.expenses);
  const histProfit = document.getElementById("hist-profit");
  histProfit.textContent = formatINR(t.profit);
  histProfit.classList.toggle("profit-positive", t.profit >= 0);
  histProfit.classList.toggle("profit-negative", t.profit < 0);

  const salesUl = document.getElementById("hist-sales-list");
  const expUl = document.getElementById("hist-expenses-list");
  salesUl.innerHTML = "";
  expUl.innerHTML = "";

  day.sales.forEach((s) => {
    const li = document.createElement("li");
    li.innerHTML = saleRowHtml(s, false);
    salesUl.appendChild(li);
  });
  day.expenses.forEach((e) => {
    const li = document.createElement("li");
    li.innerHTML = expenseRowHtml(e, false);
    expUl.appendChild(li);
  });

  panel?.classList.add("is-open");
  panel?.setAttribute("aria-hidden", "false");
  backdrop?.classList.add("is-visible");
  backdrop?.removeAttribute("hidden");
}

function closeHistoryPanel() {
  document.getElementById("history-panel")?.classList.remove("is-open");
  document.getElementById("history-panel")?.setAttribute("aria-hidden", "true");
  const backdrop = document.getElementById("history-backdrop");
  backdrop?.classList.remove("is-visible");
  backdrop?.setAttribute("hidden", "");
}

function goToToday() {
  state.activeDate = todayKey();
  state.calendarMonth = new Date();
  refreshAll();
  showToast("Showing today");
}

function exportCSV() {
  const day = getDay();
  const rows = [
    [
      "Type",
      "Product/Name",
      "Category",
      "Quantity",
      "Price",
      "Payment",
      "Payment Account",
      "Card Mode",
      "Bank",
      "Card Type",
      "Swipe Amount",
      "Swiping Charges",
      "Final Amount",
      "Line Total",
      "Date",
    ],
  ];
  day.sales.forEach((s) => {
    const pay =
      s.paymentMethod === "upi" ? "UPI" : s.paymentMethod === "card" ? "Card" : "Cash";
    rows.push([
      "Sale",
      saleProductName(s),
      s.category || "mobile",
      s.qty,
      s.price,
      pay,
      s.paymentAccount || "",
      s.paymentMethod === "card" ? (s.cardMode === "credit" ? "Credit Card" : "Debit Card") : "",
      s.cardBank || "",
      s.paymentMethod === "card" ? cardTypeLabel(s.cardType) : "",
      s.paymentMethod === "card" ? s.swipeAmount : "",
      s.paymentMethod === "card" && s.cardMode === "credit" ? s.swipingCharges || "" : "",
      s.paymentMethod === "card" ? s.finalAmount : "",
      getSaleLineTotal(s),
      state.activeDate,
    ]);
  });
  day.expenses.forEach((e) => {
    rows.push(["Expense", e.name, "", "", e.amount, state.activeDate]);
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `SKY-MOBILES-${state.activeDate}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("CSV downloaded");
}

function exportJSON() {
  const payload = { exported: new Date().toISOString(), data: state.data, profile: state.profile };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sky-mobiles-backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Backup exported");
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (parsed.data) state.data = parsed.data;
      if (parsed.profile) {
        state.profile = parsed.profile;
        saveProfile();
      }
      saveData();
      migrateData();
      refreshAll();
      showToast("Backup imported");
    } catch {
      showToast("Invalid backup file", "error");
    }
  };
  reader.readAsText(file);
}

function bindMisc() {
  document.getElementById("global-date-search")?.addEventListener("change", (e) => {
    state.activeDate = e.target.value;
    refreshAll();
    openHistoryPanel(state.activeDate);
  });

  document.getElementById("go-today-btn")?.addEventListener("click", goToToday);
  document.getElementById("export-pdf-btn")?.addEventListener("click", exportPDF);
  document.getElementById("export-pdf-alt")?.addEventListener("click", exportPDF);
  document.getElementById("export-csv-btn")?.addEventListener("click", exportCSV);
  document.getElementById("export-csv-alt")?.addEventListener("click", exportCSV);
  document.getElementById("export-json-btn")?.addEventListener("click", exportJSON);
  document.getElementById("import-json-input")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importJSON(file);
    e.target.value = "";
  });

  document.getElementById("hist-load-day")?.addEventListener("click", () => {
    if (lastHistoryDate) {
      state.activeDate = lastHistoryDate;
      closeHistoryPanel();
      switchView("dashboard");
      refreshAll();
      showToast("Day loaded in dashboard");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeHistoryPanel();
  });
}

function applyProfileUI() {
  const initials = (state.profile.name || "A")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const set = (id, val, prop = "textContent") => {
    const el = document.getElementById(id);
    if (!el) return;
    if (prop === "value") el.value = val;
    else el[prop] = val;
  };
  set("avatar-initials", initials);
  set("profile-display-name", state.profile.name);
  set("settings-name", state.profile.name, "value");
  set("settings-shop", state.profile.shop, "value");
  set("settings-email", state.profile.email, "value");
}

function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: "#7da8c8", font: { family: "Outfit" } },
      },
    },
    scales: {
      x: {
        ticks: { color: "#7da8c8" },
        grid: { color: "rgba(0,212,255,0.08)" },
      },
      y: {
        ticks: { color: "#7da8c8" },
        grid: { color: "rgba(0,212,255,0.08)" },
      },
    },
  };
}

function updateCharts(revenue, expenses) {
  if (typeof Chart === "undefined") return;

  const dailyCtx = document.getElementById("daily-chart");
  if (dailyCtx) {
    state.charts.daily?.destroy();
    state.charts.daily = new Chart(dailyCtx, {
      type: "doughnut",
      data: {
        labels: ["Revenue", "Expenses"],
        datasets: [
          {
            data: [revenue, expenses],
            backgroundColor: ["rgba(0, 212, 255, 0.75)", "rgba(248, 113, 113, 0.65)"],
            borderColor: ["#00d4ff", "#f87171"],
            borderWidth: 2,
          },
        ],
      },
      options: {
        ...chartDefaults(),
        plugins: { ...chartDefaults().plugins, legend: { position: "bottom" } },
      },
    });
  }

  const monthlyCtx = document.getElementById("monthly-chart");
  if (monthlyCtx) {
    const { labels, salesData, profitData } = getMonthSeries();
    state.charts.monthly?.destroy();
    state.charts.monthly = new Chart(monthlyCtx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Sales (₹)",
            data: salesData,
            borderColor: "#00d4ff",
            backgroundColor: "rgba(0, 212, 255, 0.12)",
            fill: true,
            tension: 0.4,
          },
          {
            label: "Profit (₹)",
            data: profitData,
            borderColor: "#34d399",
            backgroundColor: "transparent",
            tension: 0.4,
          },
        ],
      },
      options: chartDefaults(),
    });
  }
}

function getMonthSeries() {
  const y = state.calendarMonth.getFullYear();
  const m = state.calendarMonth.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const labels = [];
  const salesData = [];
  const profitData = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    labels.push(String(d));
    const record = state.data[key];
    if (record) {
      const t = calcDayTotals(record);
      salesData.push(t.revenue);
      profitData.push(t.profit);
    } else {
      salesData.push(0);
      profitData.push(0);
    }
  }
  return { labels, salesData, profitData };
}

function renderReports() {
  const dl = document.getElementById("report-summary");
  if (!dl) return;

  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  let totalSales = 0;
  let totalExp = 0;
  let daysActive = 0;

  Object.keys(state.data).forEach((key) => {
    const d = new Date(key + "T12:00:00");
    if (d.getFullYear() === y && d.getMonth() === m) {
      const t = calcDayTotals(state.data[key]);
      if (t.revenue || t.expenses) daysActive++;
      totalSales += t.revenue;
      totalExp += t.expenses;
    }
  });

  let monthQty = 0;
  Object.keys(state.data).forEach((key) => {
    const d = new Date(key + "T12:00:00");
    if (d.getFullYear() === y && d.getMonth() === m) {
      monthQty += calcDayTotals(state.data[key]).items;
    }
  });

  const monthSales = collectMonthSales(y, m);
  const payMonth = calcPaymentBreakdown(monthSales);

  dl.innerHTML = `
    <dt>Total sales</dt><dd>${formatINR(totalSales)}</dd>
    <dt>Total quantity sold</dt><dd>${monthQty}</dd>
    <dt>Cash orders</dt><dd>${payMonth.cash.orders} · ${formatINR(payMonth.cash.amount)}</dd>
    <dt>UPI orders</dt><dd>${payMonth.upi.orders} · ${formatINR(payMonth.upi.amount)}</dd>
    <dt>Card orders</dt><dd>${payMonth.card.orders} · ${formatINR(payMonth.card.amount)}</dd>
    <dt>Month expenses</dt><dd>${formatINR(totalExp)}</dd>
    <dt>Net profit</dt><dd class="${totalSales - totalExp >= 0 ? "profit-positive" : "profit-negative"}">${formatINR(totalSales - totalExp)}</dd>
    <dt>Active days</dt><dd>${daysActive}</dd>
  `;

  renderTopProducts(y, m);
  renderPaymentReports();

  const ctx = document.getElementById("reports-chart");
  if (ctx && typeof Chart !== "undefined") {
    const { labels, salesData } = getMonthSeries();
    state.charts.reports?.destroy();
    state.charts.reports = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Daily sales",
            data: salesData,
            backgroundColor: "rgba(0, 212, 255, 0.55)",
            borderRadius: 6,
          },
        ],
      },
      options: chartDefaults(),
    });
  }
}

function renderTopProducts(year, month) {
  const ul = document.getElementById("top-products-list");
  if (!ul) return;
  const map = {};
  Object.keys(state.data).forEach((key) => {
    const d = new Date(key + "T12:00:00");
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    state.data[key].sales.forEach((s) => {
      const name = saleProductName(s);
      const rev = getSaleLineTotal(s);
      map[name] = (map[name] || 0) + rev;
    });
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  ul.innerHTML = "";
  if (!sorted.length) return;
  sorted.forEach(([name, rev]) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(name)}</span><strong>${formatINR(rev)}</strong>`;
    ul.appendChild(li);
  });
}

function exportPDF() {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    showToast("PDF library loading — try again", "error");
    return;
  }

  const day = getDay();
  const t = calcDayTotals(day);
  const doc = new jsPDF();
  const dateLabel = new Date(state.activeDate + "T12:00:00").toLocaleDateString("en-IN");

  doc.setFillColor(3, 7, 18);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(0, 212, 255);
  doc.setFontSize(22);
  const shop = state.profile.shop || "SKY MOBILES";
  doc.text(shop.toUpperCase(), 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(200, 220, 240);
  doc.text("Daily Sales & Expense Report", 14, 26);
  doc.text(dateLabel, 14, 33);

  doc.setTextColor(30, 40, 60);
  doc.setFontSize(12);
  let y = 52;
  doc.text(`Total Sales: ${formatINR(t.revenue)}`, 14, y);
  y += 10;
  doc.text(`Total Quantity: ${t.items}`, 14, y);
  y += 10;
  doc.text(`Total Expenses: ${formatINR(t.expenses)}`, 14, y);
  y += 10;
  doc.text(`Net Profit: ${formatINR(t.profit)}`, 14, y);
  y += 16;

  doc.setFontSize(11);
  doc.text("Sales", 14, y);
  y += 8;
  day.sales.forEach((s) => {
    doc.setFontSize(9);
    const line = formatINR(getSaleLineTotal(s));
    let pay = "Cash";
    if (s.paymentMethod === "upi") pay = `UPI${s.paymentAccount ? ` (${s.paymentAccount})` : ""}`;
    else if (s.paymentMethod === "card") {
      pay = `${s.cardMode === "credit" ? "Credit" : "Debit"} ${s.cardBank} ${cardTypeLabel(s.cardType)}`;
      if (s.swipingCharges) pay += ` chg ${formatINR(s.swipingCharges)}`;
    }
    doc.text(
      `  ${saleProductName(s)} [${s.category || "mobile"}] | Qty ${s.qty} × ${formatINR(s.price)} | ${pay} = ${line}`,
      14,
      y
    );
    y += 7;
  });
  y += 6;
  doc.setFontSize(11);
  doc.text("Expenses", 14, y);
  y += 8;
  day.expenses.forEach((e) => {
    doc.setFontSize(9);
    doc.text(`  ${e.name}: ${formatINR(e.amount)}`, 14, y);
    y += 7;
  });

  doc.save(`SKY-MOBILES-${state.activeDate}.pdf`);
  showToast("PDF downloaded");
}

