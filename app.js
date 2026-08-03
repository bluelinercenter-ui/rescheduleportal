const SERVICES = [
  { key: "registration", label: "Registration" },
  { key: "reinstatement", label: "Reinstatement" },
  { key: "score-review", label: "Score Review" },
  { key: "score-recovery", label: "Score Recovery" },
  { key: "account-management", label: "Account Management" },
  { key: "account-update", label: "Account Update" },
  { key: "status-update", label: "Status Update" },
  { key: "exam-news", label: "Exam News" },
  { key: "reschedule", label: "Reschedule" },
  { key: "cancelled-score", label: "Cancelled Score" },
  { key: "section-review", label: "Section Review" },
  { key: "contact-info", label: "Contact Info" }
];

const EXAMS = [
  { key: "IELTS", label: "IELTS" },
  { key: "TOEFL", label: "TOEFL" },
  { key: "GRE", label: "GRE" },
  { key: "GMAT", label: "GMAT" },
  { key: "OIETC", label: "OIETC" },
  { key: "DUOLINGO", label: "DUOLINGO" }
];

const PRICE_USD = 69;
const SESSION_KEY = "rsw_session_v1";
const REQUESTS_KEY = "rsw_requests_v1";
const CART_KEY = "rsw_cart_v1";

function $(sel, root = document) {
  return root.querySelector(sel);
}

function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getConfig() {
  const cfg = window.APP_CONFIG;
  if (!cfg || typeof cfg !== "object") return null;
  if (typeof cfg.AUTH_EMAIL !== "string" || typeof cfg.AUTH_PASSWORD !== "string") return null;
  return cfg;
}

function setSession(email) {
  const session = { email, exp: Date.now() + 8 * 60 * 60 * 1000 };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  const session = safeJsonParse(raw);
  if (!session || typeof session !== "object") return null;
  if (typeof session.exp !== "number" || Date.now() > session.exp) return null;
  if (typeof session.email !== "string") return null;
  return session;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function requireAuth() {
  const session = getSession();
  if (session) return session;
  const next = encodeURIComponent(location.pathname.split("/").pop() || "dashboard.html");
  location.href = `index.html?next=${next}`;
  return null;
}

function formatId(prefix = "REQ") {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rnd = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${rnd}`;
}

function getRequests() {
  const raw = localStorage.getItem(REQUESTS_KEY);
  const list = safeJsonParse(raw);
  return Array.isArray(list) ? list : [];
}

function saveRequests(list) {
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
}

function updateRequest(id, patch) {
  const list = getRequests();
  const idx = list.findIndex((r) => r && r.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
  saveRequests(list);
  return list[idx];
}

function setCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function getCart() {
  const raw = localStorage.getItem(CART_KEY);
  const cart = safeJsonParse(raw);
  if (!cart || typeof cart !== "object") return null;
  return cart;
}

function qs() {
  return new URLSearchParams(location.search);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0";
  return `$${n}`;
}

function formatWhen(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  return s;
}

async function fileToDataUrl(file, maxBytes) {
  if (!file) return null;
  if (file.size > maxBytes) {
    return { name: file.name, type: file.type || "application/octet-stream", size: file.size, skipped: true };
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(binary);
  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    dataUrl: `data:${file.type || "application/octet-stream"};base64,${base64}`
  };
}

function mountLogout() {
  const el = $("#logoutBtn");
  if (!el) return;
  el.addEventListener("click", () => {
    clearSession();
    location.href = "index.html";
  });
}

function mountNav(activeKey) {
  const nav = $("#serviceNav");
  if (!nav) return;
  nav.innerHTML = SERVICES.map((s) => {
    const cls = s.key === activeKey ? "active" : "";
    return `<a class="${cls}" href="exam.html?service=${encodeURIComponent(s.key)}"><span>${s.label}</span><span class="meta">Select</span></a>`;
  }).join("");
}

function mountExamTabs(activeExamKey, onSelect) {
  const root = $("#examTabs");
  if (!root) return;
  root.innerHTML = EXAMS.map((e) => {
    const cls = e.key === activeExamKey ? "tab active" : "tab";
    return `<button type="button" class="${cls}" data-exam="${e.key}">${e.label}</button>`;
  }).join("");
  root.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-exam]");
    if (!btn) return;
    onSelect(btn.getAttribute("data-exam"));
  });
}

function mountExamPage() {
  const session = requireAuth();
  if (!session) return;

  mountLogout();
  const who = $("#sessionChip");
  if (who) who.textContent = session.email;

  const serviceKey = qs().get("service") || SERVICES[0].key;
  mountNav(serviceKey);

  const serviceTitle = $("#serviceTitle");
  if (serviceTitle) serviceTitle.textContent = serviceLabel(serviceKey);

  const examKey = qs().get("exam") || "";
  const goToForm = (nextExam) => {
    location.href = `request.html?service=${encodeURIComponent(serviceKey)}&exam=${encodeURIComponent(nextExam)}`;
  };

  mountExamTabs(examKey, goToForm);
}

function serviceLabel(key) {
  return SERVICES.find((s) => s.key === key)?.label || key;
}

function examLabel(key) {
  return EXAMS.find((e) => e.key === key)?.label || key;
}

function mountLogin() {
  const form = $("#loginForm");
  if (!form) return;

  const next = qs().get("next") || "dashboard.html";
  const err = $("#loginError");
  const cfg = getConfig();
  if (!cfg) {
    if (err) {
      err.textContent = "Missing config.js. Create config.js and set AUTH_EMAIL and AUTH_PASSWORD.";
    }
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!cfg) return;
    if (err) err.textContent = "";

    const email = String($("#email").value || "").trim().toLowerCase();
    const password = String($("#password").value || "");

    if (email === cfg.AUTH_EMAIL.trim().toLowerCase() && password === cfg.AUTH_PASSWORD) {
      setSession(email);
      location.href = next;
      return;
    }
    if (err) err.textContent = "Invalid email or password.";
  });
}

function mountDashboard() {
  const session = requireAuth();
  if (!session) return;

  mountLogout();
  mountNav(null);

  const who = $("#sessionChip");
  if (who) who.textContent = session.email;
}

function mountRequest() {
  const session = requireAuth();
  if (!session) return;

  mountLogout();
  const who = $("#sessionChip");
  if (who) who.textContent = session.email;

  const serviceKey = qs().get("service") || SERVICES[0].key;
  const examKey = qs().get("exam") || "";
  if (!examKey) {
    location.href = `exam.html?service=${encodeURIComponent(serviceKey)}`;
    return;
  }

  mountNav(serviceKey);

  const serviceTitle = $("#serviceTitle");
  if (serviceTitle) serviceTitle.textContent = serviceLabel(serviceKey);

  const examTitle = $("#examTitle");
  if (examTitle) examTitle.textContent = examLabel(examKey);

  const changeExamLink = $("#changeExamLink");
  if (changeExamLink) changeExamLink.setAttribute("href", `exam.html?service=${encodeURIComponent(serviceKey)}&exam=${encodeURIComponent(examKey)}`);

  const form = $("#infoForm");
  const err = $("#formError");
  if (!form) return;

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (err) err.textContent = "";

    const get = (id) => String($(`#${id}`)?.value || "").trim();
    const required = [
      { id: "accountUsername", label: "Account Username/Mail address" },
      { id: "firstName", label: "First Name" },
      { id: "lastName", label: "Last Name" }
    ];

    const missing = required.filter((f) => !get(f.id));
    if (missing.length) {
      if (err) err.textContent = `Please fill: ${missing.map((m) => m.label).join(", ")}.`;
      return;
    }

    const passportFile = $("#passportFile")?.files?.[0] || null;
    const nidFile = $("#nidFile")?.files?.[0] || null;
    const additionalFiles = $("#additionalDocs")?.files ? Array.from($("#additionalDocs").files) : [];

    const maxBytes = 5 * 1024 * 1024;
    const allowed = new Set(["image/jpeg", "image/png", "application/pdf"]);
    const isAllowed = (f) => !f || allowed.has(f.type);

    if (!isAllowed(passportFile) || !isAllowed(nidFile) || additionalFiles.some((f) => !isAllowed(f))) {
      if (err) err.textContent = "Only JPG, PNG, or PDF files are allowed.";
      return;
    }

    const id = formatId("REQ");
    const nowIso = new Date().toISOString();
    const request = {
      id,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: "submitted",
      service: serviceKey,
      exam: examKey,
      priceUsd: PRICE_USD,
      form: {
        accountId: get("accountId"),
        accountUsername: get("accountUsername"),
        accountPassword: get("accountPassword"),
        mailAddress: get("mailAddress"),
        mailPassword: get("mailPassword"),
        firstName: get("firstName"),
        lastName: get("lastName"),
        dateOfBirth: get("dateOfBirth"),
        appointmentNumber: get("appointmentNumber"),
        orderNumber: get("orderNumber"),
        testDateTime: get("testDateTime"),
        nationalIdCardNumber: get("nationalIdCardNumber"),
        passportNumber: get("passportNumber")
      },
      documents: {
        passport: await fileToDataUrl(passportFile, maxBytes),
        nationalId: await fileToDataUrl(nidFile, maxBytes),
        additional: await Promise.all(additionalFiles.map((f) => fileToDataUrl(f, maxBytes)))
      }
    };

    const list = getRequests();
    list.unshift(request);
    saveRequests(list);
    setCart({ requestId: id });
    location.href = "cart.html";
  });
}

function mountCart() {
  const session = requireAuth();
  if (!session) return;

  mountLogout();

  const who = $("#sessionChip");
  if (who) who.textContent = session.email;

  const cart = getCart();
  const requestId = cart?.requestId || null;
  const request = requestId ? getRequests().find((r) => r && r.id === requestId) : null;

  const details = $("#cartDetails");
  if (details) {
    if (!request) {
      details.innerHTML = `<div class="hint">Your cart is empty.</div>`;
    } else {
      const when = formatWhen(request.form?.testDateTime) || formatWhen(request.createdAt);
      details.innerHTML = `
        <div class="cart-item">
          <div class="cart-icon"></div>
          <div class="cart-item-main">
            <div class="cart-item-title">${examLabel(request.exam)} | ${serviceLabel(request.service)}</div>
            <div class="cart-item-meta">${when}</div>
            <div class="cart-item-meta">Request ID: <span class="mono">${request.id}</span></div>
          </div>
          <div class="cart-item-price">
            <div class="cart-item-price-top">${formatUsd(PRICE_USD)}.00 USD</div>
            <div class="cart-item-price-sub">+ ${formatUsd(0)}.00 Fee</div>
          </div>
        </div>
      `;
    }
  }

  const price = $("#cartPrice");
  if (price) price.textContent = formatUsd(PRICE_USD);
  const subtotal = $("#cartSubtotal");
  if (subtotal) subtotal.textContent = `${formatUsd(PRICE_USD)}.00 USD`;
  const tax = $("#cartTax");
  if (tax) tax.textContent = `${formatUsd(0)}.00 USD`;

  const clearBtn = $("#clearCart");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      localStorage.removeItem(CART_KEY);
      location.href = "dashboard.html";
    });
  }

  const addAnother = $("#addAnotherTest");
  if (addAnother) {
    addAnother.addEventListener("click", () => {
      location.href = "dashboard.html";
    });
  }

  const proceed = $("#proceedPayment");
  if (proceed) {
    proceed.addEventListener("click", () => {
      if (!requestId) return;
      location.href = "secure-checkout.html";
    });
  }
}

function mountSecureCheckout() {
  const session = requireAuth();
  if (!session) return;

  mountLogout();

  const who = $("#sessionChip");
  if (who) who.textContent = session.email;

  const cart = getCart();
  const requestId = cart?.requestId || null;
  const request = requestId ? getRequests().find((r) => r && r.id === requestId) : null;
  const err = $("#paymentError");

  const payBtn = $("#payNow");
  if (!payBtn) return;

  const payTotal = $("#payTotal");
  if (payTotal) payTotal.textContent = formatUsd(PRICE_USD);
  const paySubtotal = $("#paySubtotal");
  if (paySubtotal) paySubtotal.textContent = `${formatUsd(PRICE_USD)}.00 USD`;
  const payTax = $("#payTax");
  if (payTax) payTax.textContent = `${formatUsd(0)}.00 USD`;

  const sum = $("#paymentOrderSummary");
  if (sum) {
    if (!request) {
      sum.innerHTML = `<div class="hint">No items.</div>`;
    } else {
      const when = formatWhen(request.form?.testDateTime) || formatWhen(request.createdAt);
      sum.innerHTML = `
        <div class="order-line">
          <div class="order-title">${examLabel(request.exam)} | ${serviceLabel(request.service)}</div>
          <div class="order-meta">${when}</div>
          <div class="order-meta">Qty: 1</div>
        </div>
      `;
    }
  }

  const methodInputs = $all('input[name="payMethod"]');
  const cardForm = $("#cardForm");
  const applyMethodUi = () => {
    const method = methodInputs.find((i) => i.checked)?.value || "card";
    if (cardForm) cardForm.style.display = method === "card" ? "grid" : "none";
    if (err) err.textContent = "";
  };
  methodInputs.forEach((i) => i.addEventListener("change", applyMethodUi));
  applyMethodUi();

  payBtn.textContent = `Pay ${formatUsd(PRICE_USD)}`;
  payBtn.addEventListener("click", () => {
    if (!request) {
      if (err) err.textContent = "Cart is empty.";
      return;
    }

    const method = methodInputs.find((i) => i.checked)?.value || "card";
    if (method === "card") {
      const cardType = String($("#cardType")?.value || "").trim();
      const cardNumber = String($("#cardNumber")?.value || "").replace(/\s+/g, "");
      const cardExpiry = String($("#cardExpiry")?.value || "").trim();
      const cardCvv = String($("#cardCvv")?.value || "").trim();
      const cardName = String($("#cardName")?.value || "").trim();

      const okNum = /^\d{12,19}$/.test(cardNumber);
      const okExp = /^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry);
      const okCvv = /^\d{3,4}$/.test(cardCvv);
      const okName = cardName.length >= 2;

      if (!cardType || !okNum || !okExp || !okCvv || !okName) {
        if (err) err.textContent = "Please fill valid credit card information.";
        return;
      }
    }

    updateRequest(request.id, { status: "paid" });
    location.href = `success.html?order=${encodeURIComponent(request.id)}`;
  });
}

function mountPayment() {
  mountSecureCheckout();
}

function mountSuccess() {
  const session = requireAuth();
  if (!session) return;

  mountLogout();
  mountNav(null);

  const who = $("#sessionChip");
  if (who) who.textContent = session.email;

  const order = qs().get("order") || "";
  const request = order ? getRequests().find((r) => r && r.id === order) : null;

  const idEl = $("#successId");
  if (idEl) idEl.textContent = order || "-";
  const stEl = $("#successStatus");
  if (stEl) stEl.textContent = request?.status || "unknown";

  const dl = $("#downloadOrder");
  if (dl) dl.remove();
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.getAttribute("data-page");
  if (page === "login") mountLogin();
  if (page === "dashboard") mountDashboard();
  if (page === "exam") mountExamPage();
  if (page === "request") mountRequest();
  if (page === "cart") mountCart();
  if (page === "payment") mountPayment();
  if (page === "secure-checkout") mountSecureCheckout();
  if (page === "success") mountSuccess();
});
