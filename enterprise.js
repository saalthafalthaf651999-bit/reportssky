/**
 * SKY MOBILES — Enterprise: branches, roles, dashboard view-only, enhanced reports
 */
(function () {
  const BRANCHES_KEY = "sky_branches_v1";
  const USERS_KEY = "sky_users_v1";
  const SESSION_USER_KEY = "sky_session_user";

  const EXPENSE_CATEGORIES = ["mobile", "accessories", "recharge", "others"];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function loadBranches() {
    try {
      const raw = localStorage.getItem(BRANCHES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveBranches() {
    localStorage.setItem(BRANCHES_KEY, JSON.stringify(state.branches));
  }

  function loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveUsers() {
    localStorage.setItem(USERS_KEY, JSON.stringify(state.users));
  }

  function loadSessionUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSessionUser(user) {
    if (user) sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_USER_KEY);
  }

  function seedEnterpriseDefaults() {
    if (!state.branches.length) {
      state.branches = [
        { id: "branch_main", name: "Main Branch", createdAt: new Date().toISOString() },
      ];
      saveBranches();
    }
    if (!state.users.length) {
      const auth = typeof loadAuth === "function" ? loadAuth() : { email: "admin@skymobiles.in", password: "sky2026" };
      state.users = [
        {
          id: "user_admin",
          name: "Admin",
          email: auth.email || "admin@skymobiles.in",
          password: auth.password || "sky2026",
          role: "admin",
          branchId: null,
        },
      ];
      saveUsers();
    }
  }

  function isAdmin() {
    return state.currentUser?.role === "admin";
  }

  function isStaff() {
    return state.currentUser?.role === "staff";
  }

  function canAccessSettings() {
    return isAdmin();
  }

  function canDeleteRecords() {
    return isAdmin();
  }

  function canEditSales() {
    return isAdmin();
  }

  function getUserBranchId() {
    if (isAdmin()) return state.dashboardBranchFilter || "all";
    return state.currentUser?.branchId || state.branches[0]?.id || "branch_main";
  }

  function getRecordBranchId(record) {
    return record.branchId || "branch_main";
  }

  function filterByBranch(records, branchFilter) {
    if (!branchFilter || branchFilter === "all") return records;
    return records.filter((r) => getRecordBranchId(r) === branchFilter);
  }

  function getDaySalesFiltered(dateKey) {
    const day = state.data[dateKey] || { sales: [], expenses: [] };
    let sales = [...(day.sales || [])];
    if (!isAdmin()) {
      sales = filterByBranch(sales, state.currentUser.branchId);
    } else if (state.dashboardBranchFilter && state.dashboardBranchFilter !== "all") {
      sales = filterByBranch(sales, state.dashboardBranchFilter);
    }
    return sales;
  }

  function getDayExpensesFiltered(dateKey) {
    const day = state.data[dateKey] || { sales: [], expenses: [] };
    let expenses = [...(day.expenses || [])];
    if (!isAdmin()) {
      expenses = filterByBranch(expenses, state.currentUser.branchId);
    } else if (state.dashboardBranchFilter && state.dashboardBranchFilter !== "all") {
      expenses = filterByBranch(expenses, state.dashboardBranchFilter);
    }
    return expenses;
  }

  function calcPaymentSummary(sales) {
    const cash = { orders: 0, amount: 0 };
    const upi = { orders: 0, amount: 0 };
    const card = { orders: 0, amount: 0 };
    const cardBanks = {};
    const categories = { mobile: 0, accessories: 0, recharge: 0, others: 0 };

    sales.forEach((s) => {
      const line = typeof getSaleLineTotal === "function" ? getSaleLineTotal(s) : 0;
      const pay = typeof salePaymentType === "function" ? salePaymentType(s) : "cash";
      const cat = s.category || "mobile";
      if (categories[cat] != null) categories[cat] += line;
      else categories.others = (categories.others || 0) + line;

      if (pay === "upi") {
        upi.orders += 1;
        upi.amount += line;
      } else if (pay === "card") {
        card.orders += 1;
        card.amount += line;
        const bank = s.cardBank || "Card";
        if (!cardBanks[bank]) cardBanks[bank] = { orders: 0, amount: 0 };
        cardBanks[bank].orders += 1;
        cardBanks[bank].amount += line;
      } else {
        cash.orders += 1;
        cash.amount += line;
      }
    });

    return { cash, upi, card, cardBanks, categories };
  }

  function renderDashboard() {
    const sales = getDaySalesFiltered(state.activeDate);
    const expenses = getDayExpensesFiltered(state.activeDate);
    let revenue = 0;
    let items = 0;
    sales.forEach((s) => {
      items += Number(s.qty) || 0;
      revenue += typeof getSaleLineTotal === "function" ? getSaleLineTotal(s) : 0;
    });
    let expTotal = 0;
    expenses.forEach((e) => {
      expTotal += Number(e.amount) || 0;
    });

    const statRev = document.getElementById("stat-revenue");
    if (statRev) statRev.textContent = typeof formatINR === "function" ? formatINR(revenue) : "₹0";

    const statItems = document.getElementById("stat-items");
    const statExpTop = document.getElementById("stat-expenses-top");
    const statExpQty = document.getElementById("stat-expense-items");
    const dashExpAmt = document.getElementById("dash-expense-amount");
    const dashExpQty = document.getElementById("dash-expense-qty");
    const statProfit = document.getElementById("stat-profit");
    if (statItems) statItems.textContent = String(items);
    if (statExpTop) statExpTop.textContent = typeof formatINR === "function" ? formatINR(expTotal) : "₹0";
    if (statExpQty) statExpQty.textContent = String(expenses.length);
    if (dashExpAmt) dashExpAmt.textContent = typeof formatINR === "function" ? formatINR(expTotal) : "₹0";
    if (dashExpQty) dashExpQty.textContent = String(expenses.length);
    const profit = revenue - expTotal;
    if (statProfit) {
      statProfit.textContent = typeof formatINR === "function" ? formatINR(profit) : "₹0";
      statProfit.classList.toggle("profit-positive", profit >= 0);
      statProfit.classList.toggle("profit-negative", profit < 0);
    }
    const heroTotal = document.getElementById("hero-net-total");
    if (heroTotal) {
      heroTotal.textContent = typeof formatINR === "function" ? formatINR(profit) : "₹0";
      heroTotal.classList.toggle("profit-positive", profit >= 0);
      heroTotal.classList.toggle("profit-negative", profit < 0);
    }
    const heroSales = document.getElementById("hero-today-sales");
    if (heroSales) heroSales.textContent = typeof formatINR === "function" ? formatINR(revenue) : "₹0";

    const branchCount = document.getElementById("stat-branch-count");
    if (branchCount) branchCount.textContent = String(state.branches.length);

    const pay = calcPaymentSummary(sales);
    const payRoot = document.getElementById("dash-payment-summary");
    if (payRoot) {
      payRoot.innerHTML = `
        <div class="dash-pay-grid">
          <div class="dash-pay-card stat-cash"><span>Cash</span><strong>${typeof formatINR === "function" ? formatINR(pay.cash.amount) : pay.cash.amount}</strong><em>${pay.cash.orders} orders</em></div>
          <div class="dash-pay-card stat-upi"><span>UPI</span><strong>${typeof formatINR === "function" ? formatINR(pay.upi.amount) : pay.upi.amount}</strong><em>${pay.upi.orders} orders</em></div>
          <div class="dash-pay-card stat-card"><span>Card</span><strong>${typeof formatINR === "function" ? formatINR(pay.card.amount) : pay.card.amount}</strong><em>${pay.card.orders} orders</em></div>
        </div>`;
    }

    const catRoot = document.getElementById("dash-category-summary");
    if (catRoot) {
      catRoot.innerHTML = `
        <div class="dash-cat-grid">
          <div><span>Mobile</span><strong>${typeof formatINR === "function" ? formatINR(pay.categories.mobile) : 0}</strong></div>
          <div><span>Accessories</span><strong>${typeof formatINR === "function" ? formatINR(pay.categories.accessories) : 0}</strong></div>
          <div><span>Recharge</span><strong>${typeof formatINR === "function" ? formatINR(pay.categories.recharge) : 0}</strong></div>
          <div><span>Others</span><strong>${typeof formatINR === "function" ? formatINR(pay.categories.others || 0) : 0}</strong></div>
        </div>`;
    }

    const ul = document.getElementById("dashboard-sales-list") || document.getElementById("sales-list");
    if (ul) {
      ul.classList.add("view-only-list");
      ul.innerHTML = "";
      if (!sales.length) {
        const li = document.createElement("li");
        li.className = "payment-empty";
        li.textContent = "No sales today.";
        ul.appendChild(li);
      } else {
        sales.forEach((item, i) => {
          const li = document.createElement("li");
          li.style.setProperty("--row-delay", `${i * 40}ms`);
          li.innerHTML =
            typeof saleRowHtml === "function"
              ? saleRowHtml(item, { withActions: false, viewMode: "standard", dateKey: state.activeDate })
              : "";
          ul.appendChild(li);
        });
      }
    }

    renderBranchAnalytics();
  }

  function renderBranchAnalytics() {
    const root = document.getElementById("branch-analytics-row");
    if (!root || !isAdmin()) return;

    const dateKey = state.activeDate;
    let combinedSales = 0;
    let combinedExp = 0;

    root.innerHTML = state.branches
      .map((b) => {
        const day = state.data[dateKey] || { sales: [], expenses: [] };
        const bSales = (day.sales || []).filter((s) => getRecordBranchId(s) === b.id);
        const bExp = (day.expenses || []).filter((e) => getRecordBranchId(e) === b.id);
        let rev = 0;
        bSales.forEach((s) => {
          rev += typeof getSaleLineTotal === "function" ? getSaleLineTotal(s) : 0;
        });
        let exp = 0;
        bExp.forEach((e) => {
          exp += Number(e.amount) || 0;
        });
        combinedSales += rev;
        combinedExp += exp;
        const profit = rev - exp;
        return `
          <button type="button" class="branch-analytics-card glass-inset" data-branch-id="${b.id}">
            <span class="branch-name">${typeof escapeHtml === "function" ? escapeHtml(b.name) : b.name}</span>
            <strong>${typeof formatINR === "function" ? formatINR(rev) : rev}</strong>
            <span class="branch-meta">Sales · Exp ${typeof formatINR === "function" ? formatINR(exp) : exp}</span>
            <span class="branch-profit ${profit >= 0 ? "profit-positive" : "profit-negative"}">${typeof formatINR === "function" ? formatINR(profit) : profit}</span>
          </button>`;
      })
      .join("");

    const combined = document.getElementById("branch-combined-total");
    if (combined) {
      combined.innerHTML = `
        <div><span>Combined sales</span><strong>${typeof formatINR === "function" ? formatINR(combinedSales) : combinedSales}</strong></div>
        <div><span>Combined expenses</span><strong>${typeof formatINR === "function" ? formatINR(combinedExp) : combinedExp}</strong></div>
        <div><span>Grand profit</span><strong class="${combinedSales - combinedExp >= 0 ? "profit-positive" : "profit-negative"}">${typeof formatINR === "function" ? formatINR(combinedSales - combinedExp) : 0}</strong></div>`;
    }

    root.querySelectorAll("[data-branch-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.dashboardBranchFilter = btn.getAttribute("data-branch-id");
        openBranchDetail(btn.getAttribute("data-branch-id"));
        renderDashboard();
      });
    });
  }

  function openBranchDetail(branchId) {
    const card = document.getElementById("branch-detail-card");
    const body = document.getElementById("branch-detail-body");
    if (!card || !body) return;
    const branch = state.branches.find((b) => b.id === branchId);
    if (!branch) return;
    const day = state.data[state.activeDate] || { sales: [], expenses: [] };
    const sales = filterByBranch(day.sales || [], branchId);
    const expenses = filterByBranch(day.expenses || [], branchId);
    const pay = calcPaymentSummary(sales);
    let rev = 0;
    sales.forEach((s) => {
      rev += typeof getSaleLineTotal === "function" ? getSaleLineTotal(s) : 0;
    });
    let exp = 0;
    expenses.forEach((e) => {
      exp += Number(e.amount) || 0;
    });
    body.innerHTML = `
      <h4>${typeof escapeHtml === "function" ? escapeHtml(branch.name) : branch.name}</h4>
      <p class="muted">Today · ${sales.length} sales · ${expenses.length} expenses</p>
      <div class="dash-pay-grid">
        <div class="dash-pay-card"><span>Cash</span><strong>${typeof formatINR === "function" ? formatINR(pay.cash.amount) : 0}</strong></div>
        <div class="dash-pay-card"><span>UPI</span><strong>${typeof formatINR === "function" ? formatINR(pay.upi.amount) : 0}</strong></div>
        <div class="dash-pay-card"><span>Card</span><strong>${typeof formatINR === "function" ? formatINR(pay.card.amount) : 0}</strong></div>
      </div>
      <p><strong>Total sales:</strong> ${typeof formatINR === "function" ? formatINR(rev) : rev}</p>
      <p><strong>Total expenses:</strong> ${typeof formatINR === "function" ? formatINR(exp) : exp}</p>
      <p><strong>Profit:</strong> ${typeof formatINR === "function" ? formatINR(rev - exp) : 0}</p>`;
    card.hidden = false;
  }

  function calcExpensePaymentSummary(expenses) {
    const cash = { orders: 0, amount: 0 };
    const upi = { orders: 0, amount: 0 };
    const card = { orders: 0, amount: 0 };
    const categories = { mobile: 0, accessories: 0, recharge: 0, others: 0 };
    expenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      const pay = e.paymentMethod === "upi" ? "upi" : e.paymentMethod === "card" ? "card" : "cash";
      const cat = e.category || "others";
      if (categories[cat] != null) categories[cat] += amt;
      else categories.others = (categories.others || 0) + amt;
      if (pay === "upi") {
        upi.orders += 1;
        upi.amount += amt;
      } else if (pay === "card") {
        card.orders += 1;
        card.amount += amt;
      } else {
        cash.orders += 1;
        cash.amount += amt;
      }
    });
    return { cash, upi, card, categories };
  }

  function renderExpenseGrandSummary() {
    const box = document.getElementById("expense-grand-summary");
    if (!box) return;
    let expenses = getDayExpensesFiltered(state.activeDate);
    const pay = calcExpensePaymentSummary(expenses);
    const grand = pay.cash.amount + pay.upi.amount + pay.card.amount;
    box.innerHTML = `
      <div class="grand-summary-grid">
        <div><span>Total Cash</span><strong>${typeof formatINR === "function" ? formatINR(pay.cash.amount) : 0}</strong></div>
        <div><span>Total UPI</span><strong>${typeof formatINR === "function" ? formatINR(pay.upi.amount) : 0}</strong></div>
        <div><span>Total Card</span><strong>${typeof formatINR === "function" ? formatINR(pay.card.amount) : 0}</strong></div>
        <div class="grand-total"><span>Grand Total</span><strong>${typeof formatINR === "function" ? formatINR(grand) : 0}</strong></div>
      </div>`;
  }

  function renderSalesGrandSummary() {
    const box = document.getElementById("sales-grand-summary");
    if (!box) return;
    const day = getDay();
    let sales = day.sales || [];
    if (!isAdmin()) sales = filterByBranch(sales, state.currentUser.branchId);
    sales = typeof filterSalesList === "function"
      ? filterSalesList(sales, state.saleCategoryFilter, state.salePaymentFilter)
      : sales;
    const pay = calcPaymentSummary(sales);
    const grand = pay.cash.amount + pay.upi.amount + pay.card.amount;
    box.innerHTML = `
      <div class="grand-summary-grid">
        <div><span>Total Cash</span><strong>${typeof formatINR === "function" ? formatINR(pay.cash.amount) : 0}</strong></div>
        <div><span>Total UPI</span><strong>${typeof formatINR === "function" ? formatINR(pay.upi.amount) : 0}</strong></div>
        <div><span>Total Card</span><strong>${typeof formatINR === "function" ? formatINR(pay.card.amount) : 0}</strong></div>
        <div class="grand-total"><span>Grand Total</span><strong>${typeof formatINR === "function" ? formatINR(grand) : 0}</strong></div>
      </div>`;
  }

  function renderCardBankBreakdown(containerId, sales) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const cardSales = sales.filter((s) => typeof salePaymentType === "function" && salePaymentType(s) === "card");
    if (!cardSales.length) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const banks = {};
    cardSales.forEach((s) => {
      const bank = s.cardBank || "Unknown";
      if (!banks[bank]) banks[bank] = { orders: 0, amount: 0 };
      banks[bank].orders += 1;
      banks[bank].amount += typeof getSaleLineTotal === "function" ? getSaleLineTotal(s) : 0;
    });
    el.innerHTML = `<span class="filter-label">Card breakdown</span>
      <div class="card-bank-breakdown">${Object.entries(banks)
        .map(
          ([name, v]) =>
            `<div class="card-bank-pill"><span>${typeof escapeHtml === "function" ? escapeHtml(name) : name} Card</span><strong>${typeof formatINR === "function" ? formatINR(v.amount) : v.amount}</strong><em>${v.orders}</em></div>`
        )
        .join("")}</div>`;
  }

  function renderReportsBranchFilter() {
    const sel = document.getElementById("reports-branch-filter");
    if (!sel || !isAdmin()) return;
    const cur = state.reportsBranchFilter || "all";
    sel.innerHTML =
      `<option value="all">All branches</option>` +
      state.branches
        .map((b) => `<option value="${b.id}"${b.id === cur ? " selected" : ""}>${typeof escapeHtml === "function" ? escapeHtml(b.name) : b.name}</option>`)
        .join("");
  }

  function collectMonthSalesFiltered(year, month) {
    const rows = [];
    Object.keys(state.data).forEach((key) => {
      const d = new Date(key + "T12:00:00");
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      (state.data[key].sales || []).forEach((s) => {
        rows.push({ ...s, dateKey: key });
      });
    });
    if (!isAdmin()) return filterByBranch(rows, state.currentUser.branchId);
    if (state.reportsBranchFilter && state.reportsBranchFilter !== "all") {
      return filterByBranch(rows, state.reportsBranchFilter);
    }
    return rows;
  }

  function renderReportsTotals() {
    const el = document.getElementById("reports-overall-totals");
    if (!el) return;
    const y = new Date().getFullYear();
    const m = new Date().getMonth();
    const sales = collectMonthSalesFiltered(y, m);
    const pay = calcPaymentSummary(sales);
    const grand = pay.cash.amount + pay.upi.amount + pay.card.amount;
    const bankLines = Object.entries(pay.cardBanks)
      .map(
        ([name, v]) =>
          `<div><span>${typeof escapeHtml === "function" ? escapeHtml(name) : name} Card</span><strong>${typeof formatINR === "function" ? formatINR(v.amount) : v.amount}</strong></div>`
      )
      .join("");
    el.innerHTML = `
      <div class="grand-summary-grid">
        <div><span>Cash (month)</span><strong>${typeof formatINR === "function" ? formatINR(pay.cash.amount) : 0}</strong></div>
        <div><span>UPI (month)</span><strong>${typeof formatINR === "function" ? formatINR(pay.upi.amount) : 0}</strong></div>
        <div><span>Card (month)</span><strong>${typeof formatINR === "function" ? formatINR(pay.card.amount) : 0}</strong></div>
        <div class="grand-total"><span>Grand Total</span><strong>${typeof formatINR === "function" ? formatINR(grand) : 0}</strong></div>
      </div>
      ${bankLines ? `<div class="card-bank-breakdown reports-banks">${bankLines}</div>` : ""}`;
  }

  function renderUserManagement() {
    const list = document.getElementById("users-list");
    if (!list || !isAdmin()) return;
    list.innerHTML = "";
    state.users.forEach((u) => {
      const li = document.createElement("li");
      const branch = state.branches.find((b) => b.id === u.branchId);
      li.innerHTML = `<span><strong>${typeof escapeHtml === "function" ? escapeHtml(u.name) : u.name}</strong> · ${u.email} · ${u.role}${branch ? ` · ${escapeHtml(branch.name)}` : ""}</span>`;
      if (u.id !== "user_admin") {
        li.innerHTML += `<button type="button" class="btn-row-remove btn-remove-user" data-user-id="${u.id}" aria-label="Remove user">×</button>`;
      }
      list.appendChild(li);
    });
    list.querySelectorAll(".btn-remove-user").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-user-id");
        state.users = state.users.filter((u) => u.id !== id);
        saveUsers();
        renderUserManagement();
        if (typeof showToast === "function") showToast("User removed");
      });
    });
  }

  function renderBranchManagement() {
    const list = document.getElementById("branches-list");
    if (!list || !isAdmin()) return;
    list.innerHTML = "";
    state.branches.forEach((b) => {
      const li = document.createElement("li");
      li.innerHTML = `<span><strong>${typeof escapeHtml === "function" ? escapeHtml(b.name) : b.name}</strong></span>
        <button type="button" class="btn-row-remove btn-remove-branch" data-branch-id="${b.id}" aria-label="Remove branch">×</button>`;
      list.appendChild(li);
    });
    list.querySelectorAll(".btn-remove-branch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-branch-id");
        if (id === "branch_main") {
          if (typeof showToast === "function") showToast("Cannot remove main branch", "error");
          return;
        }
        state.branches = state.branches.filter((b) => b.id !== id);
        saveBranches();
        renderBranchManagement();
        renderBranchAnalytics();
        if (typeof showToast === "function") showToast("Branch removed");
      });
    });
  }

  function applyRoleUI() {
    document.body.classList.toggle("role-admin", isAdmin());
    document.body.classList.toggle("role-staff", isStaff());
    document.querySelectorAll(".admin-only").forEach((el) => {
      el.hidden = !isAdmin();
    });
    const settingsNav = document.querySelector('.nav-item[data-view="settings"]');
    if (settingsNav && isStaff()) settingsNav.hidden = true;
  }

  function authenticateUser(email, pass) {
    const user = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === pass);
    if (user) return user;
    const auth = typeof loadAuth === "function" ? loadAuth() : null;
    if (auth && email === auth.email && pass === auth.password) {
      return state.users.find((u) => u.role === "admin") || state.users[0];
    }
    return null;
  }

  function bindEnterpriseForms() {
    document.getElementById("branch-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("new-branch-name")?.value.trim();
      if (!name) return;
      state.branches.push({ id: uid(), name, createdAt: new Date().toISOString() });
      saveBranches();
      e.target.reset();
      renderBranchManagement();
      renderBranchAnalytics();
      if (typeof showToast === "function") showToast("Branch created");
    });

    document.getElementById("user-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("new-user-name")?.value.trim();
      const email = document.getElementById("new-user-email")?.value.trim();
      const password = document.getElementById("new-user-password")?.value;
      const role = document.getElementById("new-user-role")?.value || "staff";
      const branchId = document.getElementById("new-user-branch")?.value || null;
      if (!name || !email || !password) return;
      if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        if (typeof showToast === "function") showToast("Email already exists", "error");
        return;
      }
      state.users.push({
        id: uid(),
        name,
        email,
        password,
        role,
        branchId: role === "staff" ? branchId : null,
      });
      saveUsers();
      e.target.reset();
      renderUserManagement();
      populateUserBranchSelect();
      if (typeof showToast === "function") showToast("User created");
    });

    document.getElementById("reports-branch-filter")?.addEventListener("change", (e) => {
      state.reportsBranchFilter = e.target.value;
      if (typeof saveUiState === "function") saveUiState();
      if (typeof renderReports === "function") renderReports();
      renderReportsTotals();
    });

    document.getElementById("close-branch-detail")?.addEventListener("click", () => {
      const card = document.getElementById("branch-detail-card");
      if (card) card.hidden = true;
      state.dashboardBranchFilter = "all";
      renderDashboard();
    });
  }

  function populateUserBranchSelect() {
    const sel = document.getElementById("new-user-branch");
    if (!sel) return;
    sel.innerHTML = state.branches
      .map((b) => `<option value="${b.id}">${typeof escapeHtml === "function" ? escapeHtml(b.name) : b.name}</option>`)
      .join("");
  }

  let hooksPatched = false;

  function patchAppHooks() {
    if (hooksPatched) return;
    hooksPatched = true;
    if (typeof refreshAll === "function") {
      const origRefresh = refreshAll;
      window.refreshAll = function () {
        origRefresh();
        renderDashboard();
        renderSalesGrandSummary();
        renderExpenseGrandSummary();
        const day = typeof getDay === "function" ? getDay() : { sales: [] };
        let sales = day.sales || [];
        if (!isAdmin()) sales = filterByBranch(sales, state.currentUser?.branchId);
        renderCardBankBreakdown("card-bank-breakdown-alt", sales);
        const y = new Date().getFullYear();
        const m = new Date().getMonth();
        const monthSales = collectMonthSalesFiltered(y, m);
        if (state.reportsPaymentFilter === "card") {
          renderCardBankBreakdown("reports-card-banks", monthSales);
        }
      };
    }

    if (typeof renderReports === "function") {
      const origReports = renderReports;
      window.renderReports = function () {
        renderReportsBranchFilter();
        origReports();
        renderReportsTotals();
        const y = new Date().getFullYear();
        const m = new Date().getMonth();
        const monthSales = collectMonthSalesFiltered(y, m);
        if (state.reportsPaymentFilter === "card") {
          renderCardBankBreakdown("reports-card-banks", monthSales);
        } else {
          const el = document.getElementById("reports-card-banks");
          if (el) el.hidden = true;
        }
      };
    }
  }

  function init() {
    state.branches = loadBranches();
    state.users = loadUsers();
    state.currentUser = loadSessionUser();
    state.dashboardBranchFilter = state.dashboardBranchFilter || "all";
    state.reportsBranchFilter = state.reportsBranchFilter || "all";
    seedEnterpriseDefaults();

    if (!state.currentUser && sessionStorage.getItem("sky_mobiles_session") === "ok") {
      state.currentUser = state.users.find((u) => u.role === "admin") || state.users[0];
      saveSessionUser(state.currentUser);
    }

    applyRoleUI();
    populateUserBranchSelect();
    renderUserManagement();
    renderBranchManagement();
    bindEnterpriseForms();
    patchAppHooks();

    document.querySelectorAll(".payment-filter-bar[data-payment-scope='main']")?.forEach((bar) => {
      if (!bar.querySelector('[data-payment="card"]')) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "payment-chip";
        btn.dataset.payment = "card";
        btn.textContent = "Card";
        bar.appendChild(btn);
      }
    });

    fixMotionTagsInDom();
  }

  function fixMotionTagsInDom() {
    document.querySelectorAll("[data-fix-motion]").forEach((el) => {
      const div = document.createElement("div");
      div.className = el.className;
      div.innerHTML = el.innerHTML;
      Array.from(el.attributes).forEach((a) => {
        if (a.name !== "class") div.setAttribute(a.name, a.value);
      });
      el.replaceWith(div);
    });
  }

  function onLoginSuccess(email, pass) {
    const user = authenticateUser(email, pass);
    if (!user) return false;
    state.currentUser = user;
    saveSessionUser(user);
    applyRoleUI();
    return true;
  }

  window.SkyEnterprise = {
    init,
    onLoginSuccess,
    authenticateUser,
    isAdmin,
    isStaff,
    canDeleteRecords,
    canEditSales,
    canAccessSettings,
    getUserBranchId,
    getRecordBranchId,
    filterByBranch,
    collectMonthSalesFiltered,
    renderDashboard,
    renderSalesGrandSummary,
    renderExpenseGrandSummary,
    renderCardBankBreakdown,
    EXPENSE_CATEGORIES,
  };

  window.SkyPerms = {
    viewOnlyList: (containerId) =>
      containerId === "dashboard-sales-list" || containerId === "expenses-list" && document.body.classList.contains("on-dashboard"),
    canDelete: canDeleteRecords,
    canEdit: canEditSales,
  };
})();
