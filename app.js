const SERVICES = [
  { key: "registration-offers", label: "Registration Offers", locked: true },
  { key: "account-update", label: "Account Update", locked: true },
  {
    key: "score-reinstatement",
    label: "Score Reinstatement",
    locked: false,
    subs: [
      { key: "cancelled-score-recovery", label: "Cancelled Score Recovery", price: 180 },
      { key: "delayed-score-release", label: "Delayed Score Release", price: 80 }
    ]
  },
  {
    key: "test-reschedule",
    label: "Test Reschedule",
    locked: false,
    subs: [
      { key: "standard-reschedule", label: "Standard Test Reschedule", price: 69 }
    ]
  }
];

const PAGE_LOAD_STARTED_AT = Date.now();
const MIN_LOAD_DISPLAY_MS = 650;

const EXAMS = [
  { key: "TOEFL", label: "TOEFL" },
  { key: "GRE", label: "GRE" },
  { key: "GMAT", label: "GMAT" },
  { key: "DUOLINGO", label: "DUOLINGO" }
];

const PRICE_USD = 69;
const SESSION_KEY = "rsw_session_v1";
const REQUESTS_KEY = "rsw_requests_v1";
const CART_KEY = "rsw_cart_v1";
const LOCK_MESSAGE = "Get permission from agent side";

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
  const handlers = () => {
    clearSession();
    location.href = "index.html";
  };
  const topBtn = $("#logoutBtn");
  if (topBtn) topBtn.addEventListener("click", handlers);
  const sideBtn = $("#sidebarLogoutBtn");
  if (sideBtn) sideBtn.addEventListener("click", handlers);
}

function emailInitials(email) {
  const s = String(email || "").trim().toLowerCase();
  if (!s) return "U";
  const at = s.indexOf("@");
  const name = at > 0 ? s.slice(0, at) : s;
  const parts = name.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return name.charAt(0).toUpperCase() || "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function mountPortalShell({ pageTitle, breadcrumbPage, activeNav = null }) {
  const session = getSession();
  const email = session?.email || "user@agent.com";
  const who = $("#sessionChip");
  if (who) who.innerHTML = `<span class="dot"></span><span>${email}</span>`;
  const br = $("#breadcrumb");
  if (br && breadcrumbPage) {
    br.innerHTML = `Dashboard <span style="opacity:.4">/</span> <strong>${breadcrumbPage}</strong>`;
  }
  const tt = $("#pageTitle");
  if (tt && pageTitle) tt.textContent = pageTitle;

  const sidebarUserAvatar = $("#sidebarUserAvatar");
  if (sidebarUserAvatar) sidebarUserAvatar.textContent = emailInitials(email);
  const sidebarUserEmail = $("#sidebarUserEmail");
  if (sidebarUserEmail) sidebarUserEmail.textContent = email;
  const sidebarUserName = $("#sidebarUserName");
  if (sidebarUserName) {
    const localPart = email.split("@")[0] || "Agent";
    const nice = localPart.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    sidebarUserName.textContent = nice;
  }

  const sNav = $("#sidebarNav");
  if (sNav) {
    const items = [
      { page: "dashboard.html", label: "Dashboard", ico: "▦" },
      { page: "exam.html?service=score-reinstatement", label: "New Request", ico: "＋" },
      { page: "cart.html", label: "My Cart", ico: "🛒" }
    ];
    sNav.innerHTML = items.map((it) => {
      const pageName = location.pathname.split("/").pop() || "";
      const itName = it.page.split("?")[0];
      const active = pageName === itName ? "active" : "";
      return `<a class="sidebar-link ${active}" href="${it.page}"><span class="ico">${it.ico}</span><span>${it.label}</span></a>`;
    }).join("");
  }
}

function mountServiceSidebar(activeKey) {
  const nav = $("#serviceNav");
  if (!nav) return;
  const serviceRows = SERVICES.map((s) => {
    const cls = s.key === activeKey ? "active" : "";
    const locked = s.locked ? "locked" : "";
    const lockIcon = s.locked ? `<span class="ico" style="opacity:.85">🔒</span>` : `<span class="ico" style="opacity:.85">✨</span>`;
    const metaText = s.locked ? `<span class="lock-tag">Locked</span>` : `<span class="meta" style="font-size:10.5px;opacity:.85">Select →</span>`;
    return `<a class="sidebar-link ${cls} ${locked}" data-service="${s.key}" href="exam.html?service=${encodeURIComponent(s.key)}">${lockIcon}<span style="flex:1;min-width:0">${s.label}</span>${metaText}</a>`;
  }).join("");
  const heading = `<div class="sidebar-heading">Services</div>`;
  nav.innerHTML = heading + `<div class="sidebar-menu">${serviceRows}</div>`;
  nav.querySelectorAll("a[data-service]").forEach((a) => {
    a.addEventListener("click", (ev) => {
      const key = a.getAttribute("data-service");
      const svc = SERVICES.find((s) => s.key === key);
      if (svc && svc.locked) {
        ev.preventDefault();
        alert(LOCK_MESSAGE);
      }
    });
  });
}

function mountNav(activeKey) {
  const nav = $("#serviceNav");
  if (!nav) return;
  const heading = `<div class="sidebar-heading">Services</div>`;
  const rows = SERVICES.map((s) => {
    const cls = s.key === activeKey ? "active" : "";
    const locked = s.locked ? "locked" : "";
    const lockIcon = s.locked ? `<span class="ico" style="opacity:.85">🔒</span>` : `<span class="ico" style="opacity:.85">✨</span>`;
    const metaText = s.locked ? `<span class="lock-tag">Locked</span>` : `<span class="meta" style="font-size:10.5px;opacity:.85">Select →</span>`;
    return `<a class="sidebar-link ${cls} ${locked}" data-service="${s.key}" href="exam.html?service=${encodeURIComponent(s.key)}">${lockIcon}<span style="flex:1;min-width:0">${s.label}</span>${metaText}</a>`;
  }).join("");
  nav.innerHTML = heading + `<div class="sidebar-menu">${rows}</div>`;
  nav.querySelectorAll("a[data-service]").forEach((a) => {
    a.addEventListener("click", (ev) => {
      const key = a.getAttribute("data-service");
      const svc = SERVICES.find((s) => s.key === key);
      if (svc && svc.locked) {
        ev.preventDefault();
        alert(LOCK_MESSAGE);
      }
    });
  });
}

function getSubService(serviceKey, subKey) {
  const svc = SERVICES.find((s) => s.key === serviceKey);
  if (!svc || !Array.isArray(svc.subs)) return null;
  return svc.subs.find((sub) => sub.key === subKey) || null;
}

function subServiceLabel(serviceKey, subKey) {
  const sub = getSubService(serviceKey, subKey);
  return sub ? sub.label : "";
}

function resolvePrice(serviceKey, subKey) {
  const sub = getSubService(serviceKey, subKey);
  if (sub && typeof sub.price === "number") return sub.price;
  return PRICE_USD;
}

function fullServiceLabel(serviceKey, subKey) {
  const base = serviceLabel(serviceKey);
  const sub = subServiceLabel(serviceKey, subKey);
  return sub ? `${base} · ${sub}` : base;
}

function mountExamTabs(activeExamKey, onSelect) {
  const root = $("#examTabs");
  if (!root) return;
  root.className = "exam-grid";
  root.innerHTML = `<div class="section-loader" aria-hidden="true">
    <div class="spin-sm"></div>
    <div class="sl-text">Loading exams</div>
    <div class="sk-line"></div>
    <div class="sk-line sm"></div>
  </div>`;
  const logoMap = {
    TOEFL: { logo: "toefllogo.png", sub: "iBT / Essentials" },
    GRE: { logo: "grelogo.jpg", sub: "General / Subject" },
    GMAT: { logo: "gmatlogo.jpg", sub: "Focus Edition" },
    DUOLINGO: { logo: "detlogo.png", sub: "English Test" }
  };
  const render = () => {
    root.innerHTML = EXAMS.map((e) => {
      const cls = e.key === activeExamKey ? "exam-card active" : "exam-card";
      const info = logoMap[e.key] || { logo: "", sub: "Exam" };
      const iconHtml = info.logo
        ? `<img src="${info.logo}" alt="${e.label}" onerror="this.parentElement.innerHTML='<span style=\\'font-size:24px;font-weight:900;\\'>${e.key.charAt(0)}</span>'" />`
        : `<span style="font-size:24px;font-weight:900">${e.key.charAt(0)}</span>`;
      return `<button type="button" class="${cls}" data-exam="${e.key}" style="border:${e.key === activeExamKey ? 'none' : ''}">
      <div class="exam-icon">${iconHtml}</div>
      <div class="exam-label">${e.label}</div>
      <div class="exam-sub">${info.sub}</div>
    </button>`;
    }).join("");
  };
  setTimeout(() => {
    render();
    root.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-exam]");
      if (!btn) return;
      onSelect(btn.getAttribute("data-exam"));
    });
  }, 700);
}

function mountSubServiceTabs(serviceKey, examKey, activeSubKey) {
  const svc = SERVICES.find((s) => s.key === serviceKey);
  const section = $("#subServiceSection");
  const tabsRoot = $("#subServiceTabs");
  if (!section || !tabsRoot) return;

  if (!svc || !Array.isArray(svc.subs) || svc.subs.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "";
  section.classList.add("accent");
  const titleEl = $("#subServiceTitle");
  if (titleEl) titleEl.textContent = `${svc.label} Options`;

  tabsRoot.className = "pricing-grid";
  tabsRoot.innerHTML = `<div class="section-loader" aria-hidden="true" style="min-height:220px">
    <div class="spin-sm"></div>
    <div class="sl-text">Loading service options</div>
    <div class="sk-line"></div>
    <div class="sk-line sm"></div>
  </div>`;
  const subMeta = {
    "cancelled-score-recovery": {
      icon: "🔄",
      badge: "Premium",
      desc: "Recover scores that were previously cancelled by ETS/GRE/GMAT."
    },
    "delayed-score-release": {
      icon: "⏱",
      badge: "Standard",
      desc: "Expedite score release that is on hold or taking longer than usual."
    },
    "standard-reschedule": {
      icon: "📅",
      badge: "",
      desc: "Reschedule your test to a new date or location hassle-free."
    }
  };
  const render = () => {
    tabsRoot.innerHTML = svc.subs.map((sub) => {
      const cls = sub.key === activeSubKey ? "price-card active" : "price-card";
      const meta = subMeta[sub.key] || { icon: "📌", badge: "Option", desc: "" };
      const price = typeof sub.price === "number" ? sub.price : 0;
      const badgeHtml = meta.badge ? `<span class="pc-badge">${meta.badge}</span>` : "";
      return `<button type="button" class="${cls}" data-sub="${sub.key}" style="border:${sub.key === activeSubKey ? 'none' : ''};text-align:left;width:100%">
      <div class="pc-top">
        <div class="pc-icon">${meta.icon}</div>
        ${badgeHtml}
      </div>
      <div class="pc-name">${sub.label}</div>
      <div class="pc-desc">${meta.desc}</div>
      <div class="pc-price-row">
        <div class="pc-price">
          <span class="pc-currency">$</span>
          <span class="pc-amount">${price}</span>
          <span class="pc-currency" style="font-size:13px;margin-left:2px">USD</span>
        </div>
        <span class="pc-cta">Select →</span>
      </div>
    </button>`;
    }).join("");

    tabsRoot.querySelectorAll("button[data-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const subKey = btn.getAttribute("data-sub");
        if (!subKey || !examKey) return;
        location.href = `request.html?service=${encodeURIComponent(serviceKey)}&exam=${encodeURIComponent(examKey)}&sub=${encodeURIComponent(subKey)}`;
      });
    });
  };
  setTimeout(render, 600);
}

function mountExamPage() {
  const session = requireAuth();
  if (!session) return;

  mountLogout();
  mountPortalShell({ breadcrumbPage: "Service Selection" });

  const serviceKey = qs().get("service") || SERVICES[0].key;
  const svc = SERVICES.find((s) => s.key === serviceKey) || SERVICES[0];

  if (svc.locked) {
    const svcFirstUnlocked = SERVICES.find((s) => !s.locked) || SERVICES[0];
    mountServiceSidebar(svcFirstUnlocked.key);
    const serviceTitle = $("#serviceTitle");
    if (serviceTitle) serviceTitle.textContent = serviceLabel(svcFirstUnlocked.key);
  } else {
    mountServiceSidebar(serviceKey);
    const serviceTitle = $("#serviceTitle");
    if (serviceTitle) serviceTitle.textContent = serviceLabel(serviceKey);
  }

  const effectiveService = SERVICES.find((s) => s.key === serviceKey && !s.locked) || SERVICES.find((s) => !s.locked) || SERVICES[0];
  const effectiveKey = effectiveService.key;

  const examKey = qs().get("exam") || "";
  const subKey = qs().get("sub") || "";

  const goToFormOrShowSubs = (nextExam) => {
    const url = new URL(location.href);
    url.searchParams.set("service", effectiveKey);
    url.searchParams.set("exam", nextExam);
    if (subKey) url.searchParams.set("sub", subKey);
    history.replaceState(null, "", url.search);

    const cur = SERVICES.find((s) => s.key === effectiveKey);
    if (cur && Array.isArray(cur.subs) && cur.subs.length > 0) {
      mountSubServiceTabs(effectiveKey, nextExam, subKey);
    } else {
      location.href = `request.html?service=${encodeURIComponent(effectiveKey)}&exam=${encodeURIComponent(nextExam)}`;
    }
  };

  mountExamTabs(examKey, goToFormOrShowSubs);

  if (examKey) {
    mountSubServiceTabs(effectiveKey, examKey, subKey);
    const st = $("#serviceSubtitle");
    if (st) st.textContent = `Exam selected: ${examLabel(examKey)}. Choose a service option below to proceed.`;
  } else {
    const st = $("#serviceSubtitle");
    if (st) st.textContent = "Select an exam type first to see available service options.";
  }
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
  mountPortalShell({ breadcrumbPage: "Overview" });
  mountServiceSidebar(null);

  const list = getRequests();
  const total = list.length;
  const paid = list.filter((r) => r.status === "paid").length;
  const submitted = list.filter((r) => r.status === "submitted").length;
  const last7 = list.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    return Date.now() - t <= 7 * 24 * 3600 * 1000;
  }).length;

  const map = { totalCount: total, paidCount: paid, submittedCount: submitted, recentCount: last7 };
  Object.keys(map).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(map[id]);
  });

  const tbl = $("#requestsTable");
  if (tbl) {
    if (list.length === 0) {
      tbl.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--muted);font-weight:600">No requests yet. Create a new request to get started.</td></tr>`;
    } else {
      tbl.innerHTML = list.slice(0, 6).map((r) => {
        const price = typeof r.priceUsd === "number" ? formatUsd(r.priceUsd) : "-";
        const statusClass = r.status === "paid" ? "success" : r.status === "submitted" ? "warning" : "brand";
        const statusText = String(r.status || "unknown").charAt(0).toUpperCase() + String(r.status || "").slice(1);
        return `<tr>
          <td style="font-weight:700;font-family:ui-monospace,monospace;font-size:12.5px">${r.id}</td>
          <td style="font-weight:600">${examLabel(r.exam)} · ${fullServiceLabel(r.service, r.sub || "")}</td>
          <td><span class="badge ${statusClass}">${statusText}</span></td>
          <td style="text-align:right;font-weight:800">${price}</td>
        </tr>`;
      }).join("");
    }
  }
}

function mountRequest() {
  const session = requireAuth();
  if (!session) return;

  mountLogout();
  mountPortalShell({ breadcrumbPage: "Information Form" });

  const serviceKey = qs().get("service") || SERVICES[0].key;
  const examKey = qs().get("exam") || "";
  const subKey = qs().get("sub") || "";
  if (!examKey) {
    location.href = `exam.html?service=${encodeURIComponent(serviceKey)}`;
    return;
  }

  const svc = SERVICES.find((s) => s.key === serviceKey);
  if (svc && svc.locked) {
    alert(LOCK_MESSAGE);
    location.href = "exam.html";
    return;
  }

  mountServiceSidebar(serviceKey);

  const serviceTitle = $("#serviceTitle");
  if (serviceTitle) serviceTitle.textContent = fullServiceLabel(serviceKey, subKey);

  const examTitle = $("#examTitle");
  if (examTitle) examTitle.textContent = examLabel(examKey);

  const subChip = $("#subChip");
  const subTitle = $("#subTitle");
  if (subChip && subTitle && subKey) {
    const lbl = subServiceLabel(serviceKey, subKey);
    if (lbl) {
      subTitle.textContent = lbl;
      subChip.style.display = "";
    }
  }

  const priceChip = $("#priceChip");
  const resolvedPrice = resolvePrice(serviceKey, subKey);
  if (priceChip) priceChip.textContent = `${formatUsd(resolvedPrice)}.00 USD`;

  const changeExamLink = $("#changeExamLink");
  if (changeExamLink) {
    let href = `exam.html?service=${encodeURIComponent(serviceKey)}&exam=${encodeURIComponent(examKey)}`;
    if (subKey) href += `&sub=${encodeURIComponent(subKey)}`;
    changeExamLink.setAttribute("href", href);
  }

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
    const priceVal = resolvePrice(serviceKey, subKey);
    const request = {
      id,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: "submitted",
      service: serviceKey,
      sub: subKey || null,
      exam: examKey,
      priceUsd: priceVal,
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
  mountPortalShell({ breadcrumbPage: "My Cart" });
  mountServiceSidebar(null);

  const cart = getCart();
  const requestId = cart?.requestId || null;
  const request = requestId ? getRequests().find((r) => r && r.id === requestId) : null;
  const priceVal = request && typeof request.priceUsd === "number" ? request.priceUsd : PRICE_USD;

  const details = $("#cartDetails");
  if (details) {
    if (!request) {
      details.innerHTML = `<div class="hint">Your cart is empty.</div>`;
    } else {
      const when = formatWhen(request.form?.testDateTime) || formatWhen(request.createdAt);
      const svcLbl = fullServiceLabel(request.service, request.sub || "");
      details.innerHTML = `
        <div class="cart-item">
          <div class="cart-icon"></div>
          <div class="cart-item-main">
            <div class="cart-item-title">${examLabel(request.exam)} | ${svcLbl}</div>
            <div class="cart-item-meta">${when}</div>
            <div class="cart-item-meta">Request ID: <span class="mono">${request.id}</span></div>
          </div>
          <div class="cart-item-price">
            <div class="cart-item-price-top">${formatUsd(priceVal)}.00 USD</div>
            <div class="cart-item-price-sub">+ ${formatUsd(0)}.00 Fee</div>
          </div>
        </div>
      `;
    }
  }

  const price = $("#cartPrice");
  if (price) price.textContent = formatUsd(priceVal);
  const subtotal = $("#cartSubtotal");
  if (subtotal) subtotal.textContent = `${formatUsd(priceVal)}.00 USD`;
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

function formatCardNumber(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 19);
  const groups = [];
  for (let i = 0; i < digits.length; i += 4) {
    groups.push(digits.slice(i, i + 4));
  }
  return groups.join(" ");
}

function formatCardExpiry(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + "/" + digits.slice(2);
}

function formatCardCvv(raw) {
  return String(raw || "").replace(/\D/g, "").slice(0, 4);
}

function mountCardFieldFormatters() {
  const cardNum = $("#cardNumber");
  if (cardNum) {
    cardNum.addEventListener("input", () => {
      const pos = cardNum.selectionStart;
      const oldLen = cardNum.value.length;
      cardNum.value = formatCardNumber(cardNum.value);
      const newLen = cardNum.value.length;
      const diff = newLen - oldLen;
      try { cardNum.setSelectionRange(pos + diff, pos + diff); } catch (_) {}
    });
  }

  const cardExp = $("#cardExpiry");
  if (cardExp) {
    cardExp.addEventListener("input", () => {
      const pos = cardExp.selectionStart;
      const oldLen = cardExp.value.length;
      cardExp.value = formatCardExpiry(cardExp.value);
      const newLen = cardExp.value.length;
      const diff = newLen - oldLen;
      try { cardExp.setSelectionRange(pos + diff, pos + diff); } catch (_) {}
    });
  }

  const cardCvv = $("#cardCvv");
  if (cardCvv) {
    cardCvv.addEventListener("input", () => {
      const pos = cardCvv.selectionStart;
      const oldLen = cardCvv.value.length;
      cardCvv.value = formatCardCvv(cardCvv.value);
      const newLen = cardCvv.value.length;
      const diff = newLen - oldLen;
      try { cardCvv.setSelectionRange(pos + diff, pos + diff); } catch (_) {}
    });
  }
}

function mountSecureCheckout() {
  const session = requireAuth();
  if (!session) return;

  mountLogout();
  mountPortalShell({ breadcrumbPage: "Secure Checkout" });

  const cart = getCart();
  const requestId = cart?.requestId || null;
  const request = requestId ? getRequests().find((r) => r && r.id === requestId) : null;
  const priceVal = request && typeof request.priceUsd === "number" ? request.priceUsd : PRICE_USD;
  const err = $("#paymentError");

  const payBtn = $("#payNow");
  if (!payBtn) return;

  const payTotal = $("#payTotal");
  if (payTotal) payTotal.textContent = formatUsd(priceVal);
  const paySubtotal = $("#paySubtotal");
  if (paySubtotal) paySubtotal.textContent = `${formatUsd(priceVal)}.00 USD`;
  const payTax = $("#payTax");
  if (payTax) payTax.textContent = `${formatUsd(0)}.00 USD`;

  const sum = $("#paymentOrderSummary");
  if (sum) {
    if (!request) {
      sum.innerHTML = `<div class="hint">No items.</div>`;
    } else {
      const when = formatWhen(request.form?.testDateTime) || formatWhen(request.createdAt);
      const svcLbl = fullServiceLabel(request.service, request.sub || "");
      sum.innerHTML = `
        <div class="order-line">
          <div class="order-title">${examLabel(request.exam)} | ${svcLbl}</div>
          <div class="order-meta">${when}</div>
          <div class="order-meta">Qty: 1</div>
        </div>
      `;
    }
  }

  const cardForm = $("#cardForm");
  if (cardForm) cardForm.style.display = "grid";

  mountCardFieldFormatters();

  payBtn.textContent = `Pay Now`;
  payBtn.addEventListener("click", () => {
    if (!request) {
      if (err) err.textContent = "Cart is empty.";
      return;
    }

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

    updateRequest(request.id, { status: "paid" });
    try {
      sessionStorage.setItem("pendingOrder", JSON.stringify({
        id: request.id,
        exam: examLabel(request.exam),
        service: fullServiceLabel(request.service, request.sub || ""),
        total: typeof request.priceUsd === "number" ? `${formatUsd(request.priceUsd)}.00 USD` : "$0.00 USD"
      }));
    } catch (_) {}
    payBtn.disabled = true;
    const loader = $("#checkoutLoader");
    if (loader) loader.classList.add("show");
    setTimeout(() => {
      location.href = `authentication.html`;
    }, 1400);
  });
}

function mountPayment() {
  mountSecureCheckout();
}

function mountSuccess() {
  const session = requireAuth();
  if (!session) return;

  mountLogout();
  mountPortalShell({ breadcrumbPage: "Payment Successful" });
  mountServiceSidebar(null);
  mountNav();

  const order = qs().get("order") || "";
  const request = order ? getRequests().find((r) => r && r.id === order) : null;

  const idEl = $("#successId");
  if (idEl) idEl.textContent = order || "-";
  const stEl = $("#successStatus");
  if (stEl) {
    const s = (request?.status || "unknown").toLowerCase();
    stEl.textContent = s === "paid" ? "Paid" : (s.charAt(0).toUpperCase() + s.slice(1));
    if (s === "paid") {
      stEl.classList.add("pill","pill-green");
    }
  }
  const scExam = $("#successExam");
  if (scExam && request) {
    scExam.textContent = examLabel(request.exam);
  }
  const scService = $("#successService");
  if (scService && request) {
    scService.textContent = fullServiceLabel(request.service, request.sub || "");
  }
  const scAmount = $("#successAmount");
  if (scAmount && request && typeof request.priceUsd === "number") {
    scAmount.textContent = `${formatUsd(request.priceUsd)}.00 USD`;
  }

  const dl = $("#downloadOrder");
  if (dl) dl.remove();
}

function revealPageContent() {
  const portalContent = document.querySelector(".portal-content");
  const legacyMain = document.querySelector(".container .card main.main");
  const target = portalContent || legacyMain;
  if (!target || !target.classList.contains("is-loading")) return;

  const elapsed = Date.now() - PAGE_LOAD_STARTED_AT;
  const waitFor = Math.max(0, MIN_LOAD_DISPLAY_MS - elapsed);
  setTimeout(() => {
    target.classList.remove("is-loading");
    setTimeout(() => {
      const loader = target.querySelector(".page-loader");
      if (loader) loader.remove();
    }, 400);
  }, waitFor);
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
  revealPageContent();
});
