const state = {
  user: null,
  discordConfigured: false,
  discordOAuthConfigured: false,
  discordRolesConfigured: false,
  csrfToken: null,
  permissions: {},
  supplierServices: [],
  boosterPrices: [],
  armorTypes: [],
  supplierRecords: [],
  supplierHistory: [],
  supplierSummary: [],
  boosterRecords: [],
  boosterSummary: [],
  editing: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const money = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const dateOnly = (value) => value ? new Date(value).toLocaleDateString() : "";

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 2600);
}

async function runAction(trigger, action) {
  const control = trigger?.submitter || trigger?.currentTarget || null;
  const wasDisabled = control?.disabled;
  try {
    if (control && "disabled" in control) control.disabled = true;
    await action();
    return true;
  } catch (error) {
    showToast(error.message);
    return false;
  } finally {
    if (control && "disabled" in control) control.disabled = Boolean(wasDisabled);
  }
}

async function api(path, options = {}) {
  const method = options.method || "GET";
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (method !== "GET" && state.csrfToken) headers["X-CSRF-Token"] = state.csrfToken;
  const response = await fetch(path, {
    ...options,
    headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Action failed.");
  return payload;
}

function currentRole() {
  return state.user?.role || "guest";
}

function isAdmin() {
  return currentRole() === "admin";
}

function canUseSupplier() {
  return Boolean(state.permissions.supplierRecords);
}

function canUseBooster() {
  return Boolean(state.permissions.boosterRecords);
}

function canEditSupplierStatus() {
  return Boolean(state.permissions.supplierStatus);
}

function canEditPrices() {
  return Boolean(state.permissions.priceSettings);
}

function canDeleteSupplierRows() {
  return Boolean(state.permissions.supplierDelete);
}

function canMarkSupplierPaid() {
  return Boolean(state.permissions.supplierPaid);
}

function canDeleteBoosterRows() {
  return Boolean(state.permissions.boosterDelete);
}

function canEditSupplierRows() {
  return canUseSupplier();
}

function fillSelect(select, rows, key) {
  select.innerHTML = rows.map((row) => `<option value="${escapeHtml(row[key])}">${escapeHtml(row[key])}</option>`).join("");
}

function optionList(rows, key, selected) {
  const values = rows.map((row) => String(row[key] ?? "")).filter(Boolean);
  const selectedValue = String(selected ?? "");
  if (selectedValue && !values.includes(selectedValue)) values.push(selectedValue);
  return values.map((value) => {
    return `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(value)}</option>`;
  }).join("");
}

function valueListOptions(values, selected) {
  const optionValues = values.map((value) => String(value ?? "")).filter(Boolean);
  const selectedValue = String(selected ?? "");
  if (selectedValue && !optionValues.includes(selectedValue)) optionValues.push(selectedValue);
  return optionValues.map((value) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateSession() {
  const label = state.user
    ? `${state.user.role === "admin" ? "Discord admin" : "Discord booster"}: ${state.user.username || "Signed in"}`
    : "Guest access";
  $("#sessionStatus").textContent = label;
  $("#logoutButton").classList.toggle("hidden", !state.user);
  $("#discordLogin").textContent = state.user ? "Signed in with Discord" : state.discordConfigured ? "Sign in with Discord" : "Discord setup needed";
  $("#discordLogin").classList.toggle("disabled", Boolean(state.user) || !state.discordConfigured);
  $("#discordLogin").setAttribute("aria-disabled", String(Boolean(state.user) || !state.discordConfigured));
  $("#discordLogin").tabIndex = state.user || !state.discordConfigured ? -1 : 0;
  $("#accessHint").textContent = accessHint();
  renderAccessDetails();
  applyAccessControls();
  ensureVisibleTab();
}

function accessHint() {
  if (!state.discordOAuthConfigured) return "Discord OAuth is not configured on the server.";
  if (!state.discordRolesConfigured) return "Discord server and role IDs are not configured on the server.";
  if (state.user?.role === "admin") return "Admin workspace active. You can manage sales, payouts, and rates.";
  if (state.user?.role === "booster") return "Booster workspace active. You can record runs and track your payout.";
  return "Sign in with a Discord admin or booster role.";
}

function setFormDisabled(formSelector, disabled) {
  $$(`${formSelector} input, ${formSelector} select, ${formSelector} button`).forEach((control) => {
    control.disabled = disabled;
  });
}

function applyAccessControls() {
  setFormDisabled("#supplierRecordForm", !canUseSupplier());
  setFormDisabled("#boosterRecordForm", !canUseBooster());
  setFormDisabled("#supplierPriceForm", !canEditPrices());
  setFormDisabled("#boosterPriceForm", !canEditPrices());
  $("#supplierAccessNote").textContent = canUseSupplier()
    ? "Admin workspace: record sales and verify rows before they count in totals."
    : "Locked to Discord admins.";
  $("#boosterAccessNote").textContent = canUseBooster()
    ? isAdmin()
      ? "Admin workspace: reviewing every booster payout row."
      : "Booster workspace: record your completed runs."
    : "Locked until you sign in with an allowed Discord role.";
  $("#pricesAccessNote").textContent = canEditPrices()
    ? "Admin workspace: rates become the default for new rows. Existing rows keep their saved rate."
    : "Locked to Discord admins.";
  $("#boosterScopeNote").textContent = isAdmin()
    ? "Showing unpaid payout totals for every booster."
    : "Showing only your own payout rows.";
  setSectionVisibility();
}

function renderAccessDetails() {
  const badge = $("#roleBadge");
  badge.className = `role-badge ${currentRole()}`;
  badge.textContent = state.user ? (isAdmin() ? "Admin" : "Booster") : "Guest";
  const items = [];
  if (canUseSupplier()) items.push("Sales ledger");
  if (canUseBooster()) items.push(isAdmin() ? "All booster payouts" : "My payout");
  if (canMarkSupplierPaid()) items.push("Supplier payments");
  if (canDeleteSupplierRows() || canDeleteBoosterRows()) items.push("Delete rows");
  if (canEditPrices()) items.push("Rate settings");
  if (!items.length) items.push("Sign in to continue");
  $("#permissionList").innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function setSectionVisibility() {
  const showAdminSections = isAdmin();
  $("[data-tab='supplier']").classList.toggle("hidden", !showAdminSections);
  $("[data-tab='supplierHistory']").classList.toggle("hidden", !showAdminSections);
  $("[data-tab='prices']").classList.toggle("hidden", !showAdminSections);
  $("#supplierTab").classList.toggle("hidden", !showAdminSections);
  $("#supplierHistoryTab").classList.toggle("hidden", !showAdminSections);
  $("#pricesTab").classList.toggle("hidden", !showAdminSections);
}

function ensureVisibleTab() {
  const activeTab = $(".tab.active");
  if (activeTab && !activeTab.classList.contains("hidden")) return;
  activateTab(isAdmin() ? "supplier" : "booster");
}

function activateTab(name) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `${name}Tab`));
}

function renderOptions() {
  fillSelect($("#supplierRecordForm select[name='serviceType']"), state.supplierServices, "type");
  fillSelect($("#boosterRecordForm select[name='level']"), state.boosterPrices, "level");
  $("#supplierRecordForm select[name='armorType']").innerHTML = state.armorTypes
    .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)
    .join("");
}

function renderSupplierRows() {
  $("#supplierCount").textContent = `${state.supplierRecords.length} unpaid`;
  $("#exportSupplierButton").disabled = !canUseSupplier() || !verifiedUnpaidSupplierRows().length;
  $("#markSupplierPaidButton").disabled = !canMarkSupplierPaid() || !verifiedUnpaidSupplierRows().length;
  if (!canUseSupplier()) {
    $("#supplierRows").innerHTML = `<tr><td colspan="11" class="empty-cell">Admin access is required to view sales records.</td></tr>`;
    renderSupplierHistory();
    return;
  }
  if (!state.supplierRecords.length) {
    $("#supplierRows").innerHTML = `<tr><td colspan="11" class="empty-cell">No sales have been recorded yet.</td></tr>`;
    renderSupplierHistory();
    return;
  }
  $("#supplierRows").innerHTML = state.supplierRecords.map((record, index) => `
    <tr ${isEditing("supplier", record.id) ? "class=\"editing-row\"" : ""}>
      <td>${index + 1}</td>
      <td>${editableSupplierCell(record, "date")}</td>
      <td>${editableSupplierCell(record, "buyerName")}</td>
      <td>${editableSupplierCell(record, "serviceType")}</td>
      <td>${editableSupplierCell(record, "quantity")}</td>
      <td>${editableSupplierCell(record, "rateAtRecord")}</td>
      <td>${editableSupplierCell(record, "armorType")}</td>
      <td>${statusControl("supplier", record.id, "correct", record.correct, record.correct ? "Verified" : "Review")}</td>
      <td>${money(record.totalCost)}</td>
      <td>${editableSupplierCell(record, "note")}</td>
      <td>${rowActions("supplier", record, canEditSupplierRows(), canDeleteSupplierRows())}</td>
    </tr>
  `).join("");
  $$("[data-supplier-toggle]").forEach((input) => {
    input.addEventListener("change", async () => {
      const checked = input.checked;
      const saved = await runAction({ currentTarget: input }, async () => {
        const field = input.dataset.field;
        await api(`/api/supplier-records/${input.dataset.supplierToggle}`, {
          method: "PATCH",
          body: JSON.stringify({ [field]: checked })
        });
        await loadSupplier();
      });
      if (!saved) input.checked = !checked;
    });
  });
  $$("[data-edit-supplier]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editing = { scope: "supplier", id: button.dataset.editSupplier };
      renderSupplierRows();
    });
  });
  $$("[data-save-supplier]").forEach((button) => {
    button.addEventListener("click", async () => {
      await runAction({ currentTarget: button }, async () => {
        const payload = await api(`/api/supplier-records/${button.dataset.saveSupplier}`, {
          method: "PATCH",
          body: JSON.stringify(readInlineEdit(button.closest("tr")))
        });
        state.supplierSummary = payload.summary;
        state.editing = null;
        await loadSupplier();
        showToast("Sales record updated.");
      });
    });
  });
  bindCancelEditButtons();
  $$("[data-remove-supplier]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Delete this sales record?")) return;
      await runAction({ currentTarget: button }, async () => {
        const payload = await api(`/api/supplier-records/${button.dataset.removeSupplier}`, { method: "DELETE" });
        state.supplierSummary = payload.summary;
        await loadSupplier();
        showToast("Sales record deleted.");
      });
    });
  });
  renderSupplierHistory();
}

function renderSummary() {
  const grandTotal = state.supplierSummary.reduce((sum, row) => sum + Number(row.totalCost || 0), 0);
  $("#supplierTotal").textContent = money(grandTotal);
  $("#summaryGrandTotal").textContent = money(grandTotal);
  $("#summaryRows").innerHTML = state.supplierSummary.map((row) => `
    <tr>
      <td>${escapeHtml(row.type)}</td>
      <td>${money(row.totalQty)}</td>
      <td>${money(row.price)}</td>
      <td>${money(row.totalCost)}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="empty-cell">No verified unpaid sales totals yet.</td></tr>`;
}

function renderSupplierHistory() {
  $("#supplierHistoryCount").textContent = `${state.supplierHistory.length} paid`;
  if (!canUseSupplier()) {
    $("#supplierHistoryRows").innerHTML = `<tr><td colspan="8" class="empty-cell">Admin access is required to view paid supplier history.</td></tr>`;
    return;
  }
  if (!state.supplierHistory.length) {
    $("#supplierHistoryRows").innerHTML = `<tr><td colspan="8" class="empty-cell">No supplier payments have been archived yet.</td></tr>`;
    return;
  }
  $("#supplierHistoryRows").innerHTML = state.supplierHistory.map((record) => `
    <tr>
      <td>${escapeHtml(dateOnly(record.paidAt))}</td>
      <td>${escapeHtml(dateOnly(record.date))}</td>
      <td>${escapeHtml(record.buyerName)}</td>
      <td>${escapeHtml(record.serviceType)}</td>
      <td>${money(record.quantity)}</td>
      <td>${money(record.rateAtRecord)}</td>
      <td>${money(record.totalCost)}</td>
      <td>${escapeHtml(record.paidByName || "Admin")}</td>
    </tr>
  `).join("");
}

function renderBoosterRows() {
  const openTotal = state.boosterRecords
    .filter((record) => !record.paid)
    .reduce((sum, record) => sum + Number(record.totalBalance || 0), 0);
  $("#boosterCount").textContent = `${state.boosterRecords.length} records`;
  $("#boosterOpenTotal").textContent = money(openTotal);
  renderBoosterSummary(openTotal);
  if (!canUseBooster()) {
    $("#boosterRows").innerHTML = `<tr><td colspan="9" class="empty-cell">Sign in with Discord to view payout rows.</td></tr>`;
    return;
  }
  if (!state.boosterRecords.length) {
    $("#boosterRows").innerHTML = `<tr><td colspan="9" class="empty-cell">No payout rows have been recorded yet.</td></tr>`;
    return;
  }
  $("#boosterRows").innerHTML = state.boosterRecords.map((record) => `
    <tr ${isEditing("booster", record.id) ? "class=\"editing-row\"" : ""}>
      <td>${editableBoosterCell(record, "createdAt")}</td>
      <td>${escapeHtml(record.boosterName)}</td>
      <td>${editableBoosterCell(record, "level")}</td>
      <td>${editableBoosterCell(record, "quantity")}</td>
      <td>${editableBoosterCell(record, "rateAtRecord")}</td>
      <td>${money(record.totalBalance)}</td>
      <td>
        ${isAdmin()
          ? `<input type="checkbox" data-booster-paid="${record.id}" ${record.paid ? "checked" : ""}>`
          : `<span class="pill ${record.paid ? "good" : "warn"}">${record.paid ? "Paid" : "Open"}</span>`}
      </td>
      <td>${editableBoosterCell(record, "note")}</td>
      <td>${rowActions("booster", record, canEditBoosterRecord(record), canDeleteBoosterRecord(record))}</td>
    </tr>
  `).join("");
  $$("[data-booster-paid]").forEach((input) => {
    input.addEventListener("change", async () => {
      const checked = input.checked;
      const saved = await runAction({ currentTarget: input }, async () => {
        await api(`/api/booster-records/${input.dataset.boosterPaid}`, {
          method: "PATCH",
          body: JSON.stringify({ paid: checked })
        });
        await loadBoosters();
      });
      if (!saved) input.checked = !checked;
    });
  });
  $$("[data-edit-booster]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editing = { scope: "booster", id: button.dataset.editBooster };
      renderBoosterRows();
    });
  });
  $$("[data-save-booster]").forEach((button) => {
    button.addEventListener("click", async () => {
      await runAction({ currentTarget: button }, async () => {
        await api(`/api/booster-records/${button.dataset.saveBooster}`, {
          method: "PATCH",
          body: JSON.stringify(readInlineEdit(button.closest("tr")))
        });
        state.editing = null;
        await loadBoosters();
        showToast("Payout row updated.");
      });
    });
  });
  bindCancelEditButtons();
  $$("[data-remove-booster]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Delete this payout row?")) return;
      await runAction({ currentTarget: button }, async () => {
        await api(`/api/booster-records/${button.dataset.removeBooster}`, { method: "DELETE" });
        await loadBoosters();
        showToast("Payout row deleted.");
      });
    });
  });
}

function renderBoosterSummary(openTotal) {
  if (!canUseBooster()) {
    $("#boosterSummaryRows").innerHTML = "";
    return;
  }
  if (!state.boosterSummary.length) {
    $("#boosterSummaryRows").innerHTML = `<p class="muted compact">No unpaid booster payout.</p>`;
    return;
  }
  $("#boosterSummaryRows").innerHTML = state.boosterSummary.map((row) => `
    <div class="balance-row">
      <span>${escapeHtml(row.boosterName)}</span>
      <strong>${money(row.openTotal)}</strong>
      <small>${money(row.openCount)} unpaid row${Number(row.openCount) === 1 ? "" : "s"}</small>
    </div>
  `).join("");
  $("#boosterOpenTotal").textContent = money(openTotal);
}

function canDeleteBoosterRecord(record) {
  return canDeleteBoosterRows() && (isAdmin() || record.discordId === state.user?.discordId);
}

function canEditBoosterRecord(record) {
  return canDeleteBoosterRecord(record);
}

function isEditing(scope, id) {
  return state.editing?.scope === scope && state.editing?.id === id;
}

function editInput(field, value, attrs = "") {
  return `<input class="table-edit" data-edit-field="${field}" value="${escapeHtml(value ?? "")}" ${attrs}>`;
}

function editSelect(field, options) {
  return `<select class="table-edit" data-edit-field="${field}">${options}</select>`;
}

function editableSupplierCell(record, field) {
  if (!isEditing("supplier", record.id)) {
    if (field === "date") return escapeHtml(dateOnly(record.date));
    if (field === "rateAtRecord") return money(record.rateAtRecord);
    return escapeHtml(record[field] ?? "");
  }
  if (field === "date") return editInput("date", record.date || "", 'type="date"');
  if (field === "serviceType") return editSelect("serviceType", optionList(state.supplierServices, "type", record.serviceType));
  if (field === "quantity") return editInput("quantity", record.quantity ?? 1, 'type="number" min="0" step="0.1"');
  if (field === "rateAtRecord") return editInput("rateAtRecord", record.rateAtRecord ?? 0, 'type="number" min="0" step="0.01"');
  if (field === "armorType") return editSelect("armorType", valueListOptions(state.armorTypes, record.armorType));
  return editInput(field, record[field] || "");
}

function editableBoosterCell(record, field) {
  if (!isEditing("booster", record.id)) {
    if (field === "createdAt") return escapeHtml(dateOnly(record.createdAt));
    if (field === "rateAtRecord") return money(record.rateAtRecord);
    return escapeHtml(record[field] ?? "");
  }
  if (field === "createdAt") return editInput("createdAt", String(record.createdAt || "").slice(0, 10), 'type="date"');
  if (field === "level") return editSelect("level", optionList(state.boosterPrices, "level", record.level));
  if (field === "quantity") return editInput("quantity", record.quantity ?? 1, 'type="number" min="1" step="1"');
  if (field === "rateAtRecord") {
    return isAdmin() ? editInput("rateAtRecord", record.rateAtRecord ?? 0, 'type="number" min="0" step="0.01"') : money(record.rateAtRecord);
  }
  return editInput(field, record[field] || "");
}

function readInlineEdit(row) {
  return Object.fromEntries(
    Array.from(row.querySelectorAll("[data-edit-field]")).map((field) => [field.dataset.editField, field.value])
  );
}

function bindCancelEditButtons() {
  $$("[data-cancel-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editing = null;
      renderSupplierRows();
      renderBoosterRows();
    });
  });
}

function renderPriceRows(target, rows, key) {
  $(target).innerHTML = rows.map((row) => `
    <div class="price-row">
      <input data-price-key="${key}" value="${escapeHtml(row[key])}" ${canEditPrices() ? "" : "disabled"}>
      <input data-price-value type="number" min="0" step="0.01" value="${escapeHtml(row.price)}" ${canEditPrices() ? "" : "disabled"}>
      <button type="button" data-remove-price ${canEditPrices() ? "" : "disabled"} aria-label="Delete rate row">Delete</button>
    </div>
  `).join("");
  $$(`${target} [data-remove-price]`).forEach((button) => {
    button.addEventListener("click", () => {
      button.closest(".price-row").remove();
    });
  });
}

function statusControl(scope, id, field, active, label) {
  if (scope === "supplier" && canEditSupplierStatus()) {
    return `<input type="checkbox" data-supplier-toggle="${id}" data-field="${field}" ${active ? "checked" : ""}>`;
  }
  return `<span class="pill ${active ? "good" : "warn"}">${escapeHtml(label)}</span>`;
}

function rowActions(scope, record, canEdit, canDelete) {
  if (isEditing(scope, record.id)) {
    const saveAttribute = scope === "supplier" ? "data-save-supplier" : "data-save-booster";
    return `
      <div class="row-actions">
        <button class="small-action" type="button" ${saveAttribute}="${record.id}">Save</button>
        <button class="ghost small-action" type="button" data-cancel-edit>Cancel</button>
      </div>
    `;
  }
  if (!canEdit && !canDelete) return `<span class="muted-action">No access</span>`;
  const editAttribute = scope === "supplier" ? "data-edit-supplier" : "data-edit-booster";
  const removeAttribute = scope === "supplier" ? "data-remove-supplier" : "data-remove-booster";
  return `
    <div class="row-actions">
      ${canEdit ? `<button class="ghost small-action" type="button" ${editAttribute}="${record.id}">Edit</button>` : ""}
      ${canDelete ? `<button class="danger small-action" type="button" ${removeAttribute}="${record.id}">Delete</button>` : ""}
    </div>
  `;
}

function verifiedUnpaidSupplierRows() {
  return state.supplierRecords.filter((record) => record.correct && !record.paid);
}

function supplierExportFilename() {
  return `supplier-verified-sales-${new Date().toISOString().slice(0, 10)}.png`;
}

function svgText(value, x, y, options = {}) {
  const size = options.size || 18;
  const weight = options.weight || 400;
  const color = options.color || "#17211c";
  const anchor = options.anchor ? ` text-anchor="${options.anchor}"` : "";
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" font-family="Arial, Helvetica, sans-serif"${anchor}>${escapeHtml(value)}</text>`;
}

function truncateText(value, maxLength) {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

async function exportSupplierPng() {
  const records = verifiedUnpaidSupplierRows();
  if (!records.length) return showToast("No verified unpaid sales to export.");

  const summary = state.supplierSummary;
  const grandTotal = summary.reduce((sum, row) => sum + Number(row.totalCost || 0), 0);
  const width = 1400;
  const rowHeight = 34;
  const summaryStart = 170 + records.length * rowHeight + 70;
  const height = summaryStart + 96 + Math.max(summary.length, 1) * rowHeight + 50;
  const recordColumns = [48, 150, 310, 500, 620, 730, 875, 1015];
  const summaryColumns = [48, 370, 540, 720];
  const nowLabel = new Date().toLocaleString();

  const recordRows = records.map((record, index) => {
    const y = 170 + index * rowHeight;
    const fill = index % 2 ? "#f1f6ef" : "#fffdf6";
    return `
      <rect x="32" y="${y - 24}" width="1336" height="${rowHeight}" fill="${fill}" />
      ${svgText(index + 1, recordColumns[0], y)}
      ${svgText(dateOnly(record.date), recordColumns[1], y)}
      ${svgText(truncateText(record.buyerName, 18), recordColumns[2], y)}
      ${svgText(truncateText(record.serviceType, 18), recordColumns[3], y)}
      ${svgText(money(record.quantity), recordColumns[4], y)}
      ${svgText(money(record.rateAtRecord), recordColumns[5], y)}
      ${svgText(truncateText(record.armorType, 16), recordColumns[6], y)}
      ${svgText(money(record.totalCost), recordColumns[7], y)}
    `;
  }).join("");

  const summaryRows = summary.map((row, index) => {
    const y = summaryStart + 96 + index * rowHeight;
    const fill = index % 2 ? "#f1f6ef" : "#fffdf6";
    return `
      <rect x="32" y="${y - 24}" width="760" height="${rowHeight}" fill="${fill}" />
      ${svgText(truncateText(row.type, 28), summaryColumns[0], y)}
      ${svgText(money(row.totalQty), summaryColumns[1], y)}
      ${svgText(money(row.price), summaryColumns[2], y)}
      ${svgText(money(row.totalCost), summaryColumns[3], y)}
    `;
  }).join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#f6f2e8" />
      <rect x="24" y="24" width="1352" height="${height - 48}" rx="8" fill="#fffdf6" stroke="#cfc8b8" />
      <rect x="24" y="24" width="1352" height="76" rx="8" fill="#2f6f55" />
      ${svgText("Verified Supplier Sales", 48, 72, { size: 30, weight: 800, color: "#ffffff" })}
      ${svgText(`Exported ${nowLabel}`, 1348, 72, { size: 16, color: "#ffffff", anchor: "end" })}
      ${svgText(`Rows: ${records.length}`, 48, 126, { size: 18, weight: 700 })}
      ${svgText(`Verified unpaid total: ${money(grandTotal)}`, 260, 126, { size: 18, weight: 700, color: "#214b3d" })}
      <rect x="32" y="136" width="1336" height="28" fill="#214b3d" />
      ${svgText("#", recordColumns[0], 156, { size: 14, weight: 800, color: "#ffffff" })}
      ${svgText("Date", recordColumns[1], 156, { size: 14, weight: 800, color: "#ffffff" })}
      ${svgText("Buyer", recordColumns[2], 156, { size: 14, weight: 800, color: "#ffffff" })}
      ${svgText("Service", recordColumns[3], 156, { size: 14, weight: 800, color: "#ffffff" })}
      ${svgText("Qty", recordColumns[4], 156, { size: 14, weight: 800, color: "#ffffff" })}
      ${svgText("Saved rate", recordColumns[5], 156, { size: 14, weight: 800, color: "#ffffff" })}
      ${svgText("Armor", recordColumns[6], 156, { size: 14, weight: 800, color: "#ffffff" })}
      ${svgText("Amount", recordColumns[7], 156, { size: 14, weight: 800, color: "#ffffff" })}
      ${recordRows}
      ${svgText("Summary", 48, summaryStart + 44, { size: 24, weight: 800 })}
      <rect x="32" y="${summaryStart + 62}" width="760" height="28" fill="#234d6f" />
      ${svgText("Service", summaryColumns[0], summaryStart + 82, { size: 14, weight: 800, color: "#ffffff" })}
      ${svgText("Total qty", summaryColumns[1], summaryStart + 82, { size: 14, weight: 800, color: "#ffffff" })}
      ${svgText("Rate", summaryColumns[2], summaryStart + 82, { size: 14, weight: 800, color: "#ffffff" })}
      ${svgText("Amount", summaryColumns[3], summaryStart + 82, { size: 14, weight: 800, color: "#ffffff" })}
      ${summaryRows}
      ${svgText(`Verified total: ${money(grandTotal)}`, 792, height - 54, { size: 22, weight: 800, color: "#214b3d", anchor: "end" })}
    </svg>
  `;

  const image = new Image();
  const encodedSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = encodedSvg;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(image, 0, 0);
  const link = document.createElement("a");
  link.download = supplierExportFilename();
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("Supplier report exported.");
}

function renderPrices() {
  renderPriceRows("#supplierPriceRows", state.supplierServices, "type");
  renderPriceRows("#boosterPriceRows", state.boosterPrices, "level");
  applyAccessControls();
}

async function loadConfig() {
  const config = await api("/api/config");
  Object.assign(state, config);
  updateSession();
  renderOptions();
  renderPrices();
}

async function loadSupplier() {
  if (!canUseSupplier()) {
    state.supplierRecords = [];
    state.supplierHistory = [];
    state.supplierSummary = [];
    if (isAdmin()) {
      renderSupplierRows();
      renderSupplierHistory();
      renderSummary();
    }
    return;
  }
  const payload = await api("/api/supplier-records");
  state.supplierRecords = payload.records;
  state.supplierHistory = payload.paidRecords || [];
  state.supplierSummary = payload.summary;
  renderSupplierRows();
  renderSupplierHistory();
  renderSummary();
}

async function loadBoosters() {
  if (!canUseBooster()) {
    state.boosterRecords = [];
    renderBoosterRows();
    return;
  }
  const payload = await api("/api/booster-records");
  state.boosterRecords = payload.records;
  state.boosterSummary = payload.summary || [];
  renderBoosterRows();
}

function readPriceForm(container, key) {
  return $$(`${container} .price-row`).map((row) => ({
    [key]: row.querySelector("[data-price-key]").value,
    price: Number(row.querySelector("[data-price-value]").value)
  }));
}

function bindEvents() {
  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.classList.contains("hidden")) return;
      activateTab(button.dataset.tab);
    });
  });

  $("#logoutButton").addEventListener("click", async (event) => {
    await runAction(event, async () => {
      await api("/api/logout", { method: "POST" });
      await refreshAll();
    });
  });

  $("#exportSupplierButton").addEventListener("click", async (event) => {
    await runAction(event, exportSupplierPng);
  });

  $("#markSupplierPaidButton").addEventListener("click", async (event) => {
    const rows = verifiedUnpaidSupplierRows();
    const total = rows.reduce((sum, record) => sum + Number(record.totalCost || 0), 0);
    if (!rows.length) return showToast("No verified unpaid sales to mark paid.");
    if (!window.confirm(`Mark ${rows.length} verified sales record${rows.length === 1 ? "" : "s"} paid for ${money(total)}? They will move to paid supplier history.`)) return;
    await runAction(event, async () => {
      const payload = await api("/api/supplier-records/mark-paid", { method: "POST" });
      state.supplierRecords = payload.records || [];
      state.supplierHistory = payload.paidRecords || [];
      state.supplierSummary = payload.summary || [];
      renderSupplierRows();
      renderSupplierHistory();
      renderSummary();
      showToast(`${payload.paidCount || rows.length} supplier records moved to paid history.`);
    });
  });

  $("#supplierRecordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAction(event, async () => {
      const form = new FormData(event.currentTarget);
      await api("/api/supplier-records", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries()))
      });
      event.currentTarget.reset();
      event.currentTarget.elements.date.value = new Date().toISOString().slice(0, 10);
      await loadSupplier();
      showToast("Sales record saved.");
    });
  });

  $("#boosterRecordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAction(event, async () => {
      const form = new FormData(event.currentTarget);
      await api("/api/booster-records", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries()))
      });
      event.currentTarget.reset();
      await loadBoosters();
      showToast("Run payout recorded.");
    });
  });

  $("[data-add-price='supplier']").addEventListener("click", () => {
    if (!canEditPrices()) return showToast("Discord admin role is required to edit rates.");
    $("#supplierPriceRows").insertAdjacentHTML("beforeend", `<div class="price-row"><input data-price-key="type" placeholder="Service type"><input data-price-value type="number" min="0" step="0.01" value="0"><button type="button" data-remove-price aria-label="Delete rate row">Delete</button></div>`);
    $("#supplierPriceRows [data-remove-price]:last-child")?.addEventListener("click", (event) => event.currentTarget.closest(".price-row").remove());
  });

  $("[data-add-price='booster']").addEventListener("click", () => {
    if (!canEditPrices()) return showToast("Discord admin role is required to edit rates.");
    $("#boosterPriceRows").insertAdjacentHTML("beforeend", `<div class="price-row"><input data-price-key="level" placeholder="Mythic+ key"><input data-price-value type="number" min="0" step="0.01" value="0"><button type="button" data-remove-price aria-label="Delete rate row">Delete</button></div>`);
    $("#boosterPriceRows [data-remove-price]:last-child")?.addEventListener("click", (event) => event.currentTarget.closest(".price-row").remove());
  });

  $("#supplierPriceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAction(event, async () => {
      const payload = await api("/api/prices/supplier", {
        method: "PUT",
        body: JSON.stringify({ rows: readPriceForm("#supplierPriceRows", "type") })
      });
      state.supplierServices = payload.supplierServices;
      state.supplierSummary = payload.summary;
      renderOptions();
      renderPrices();
      renderSummary();
      showToast("Supplier rates saved.");
    });
  });

  $("#boosterPriceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAction(event, async () => {
      const payload = await api("/api/prices/booster", {
        method: "PUT",
        body: JSON.stringify({ rows: readPriceForm("#boosterPriceRows", "level") })
      });
      state.boosterPrices = payload.boosterPrices;
      renderOptions();
      renderPrices();
      showToast("Booster rates saved.");
    });
  });
}

async function refreshAll() {
  await loadConfig();
  await Promise.all([loadSupplier(), loadBoosters()]);
}

window.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  $("#supplierRecordForm input[name='date']").value = new Date().toISOString().slice(0, 10);
  try {
    const authError = new URLSearchParams(window.location.search).get("authError");
    if (authError) {
      showToast(authError);
      window.history.replaceState({}, "", window.location.pathname);
    }
    await refreshAll();
  } catch (error) {
    showToast(error.message);
  }
});
