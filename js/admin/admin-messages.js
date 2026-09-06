/**
 * Apex Innovators — admin-messages.js (admin/messages.html)
 * Admin inbox: filterable list, full message view, status updates
 * (NEW / READ / REPLIED), mailto reply shortcut.
 */

import { apiFetch, errorMessage } from "../api.js";
import { guardAdmin } from "../auth.js";
import {
  icon, esc, humanize, statusBadge, formatDateTime,
  injectAdminShell, openDialog, toast, renderPagination, pageInfo,
} from "../components.js";

const SIZE = 15;
const state = { page: 0, status: "" };
const cache = new Map();

const tbody = document.getElementById("table-body");
const pagerEl = document.getElementById("table-pager");
const infoEl = document.getElementById("list-info");
const viewModal = document.getElementById("message-view-modal");
const viewBody = document.getElementById("message-view-body");

function rowSkeleton() {
  return `<tr><td colspan="6" style="padding:1rem;"><div class="sk-list">
    <div class="sk sk-row w100"></div><div class="sk sk-row w100"></div><div class="sk sk-row w100"></div>
  </div></td></tr>`;
}

function render(items) {
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No messages${state.status ? " with the selected status" : ""}. New contact-form submissions land here.</td></tr>`;
    return;
  }
  items.forEach((m) => cache.set(String(m.id), m));
  tbody.innerHTML = items.map((m) => `
    <tr>
      <td><span class="cell-stack"><span class="cell-main">${esc(m.name || "—")}</span><span class="cell-sub">${esc(m.email || "")}</span></span></td>
      <td>${m.subject ? esc(m.subject) : "—"}</td>
      <td><span class="message-clip" title="${esc(m.message || "")}">${esc(m.message || "")}</span></td>
      <td>${statusBadge(m.status)}</td>
      <td class="hide-md">${m.createdAt ? formatDateTime(m.createdAt) : "—"}</td>
      <td><button class="btn btn-sm btn-outline" type="button" data-view data-id="${m.id}">${icon("eye")} View</button></td>
    </tr>`).join("");
}

async function load() {
  if (!tbody) return;
  tbody.innerHTML = rowSkeleton();
  if (pagerEl) pagerEl.innerHTML = "";
  try {
    const data = await apiFetch("/admin/messages", {
      auth: true,
      params: { page: state.page, size: SIZE, status: state.status || undefined },
    });
    const items = (data && data.content) || [];
    if (infoEl) infoEl.textContent = pageInfo(data);
    render(items);
    if (pagerEl) renderPagination(pagerEl, data, (p) => { state.page = p; load(); });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="state state-error" style="border:none;">
      <span class="state-icon">${icon("alert")}</span>
      <h3 class="state-title">Could not load messages</h3>
      <p class="state-text">${esc(errorMessage(err, "An error occurred while loading messages."))}</p>
      <button class="btn btn-outline btn-sm" type="button" id="retry">${icon("arrow-right")} Retry</button>
    </div></td></tr>`;
    const retry = tbody.querySelector("#retry");
    if (retry) retry.addEventListener("click", load);
  }
}

function openView(m) {
  if (!viewModal) return;
  viewBody.innerHTML = `
    <div class="post-author" style="margin-bottom:1rem;">
      <span class="avatar avatar-round">${esc((m.name || "?").charAt(0).toUpperCase())}</span>
      <span class="who"><b>${esc(m.name || "—")}</b>
        <span class="muted faint" style="font-size:0.78rem;">${m.createdAt ? formatDateTime(m.createdAt) : ""}</span></span>
    </div>
    <div class="detail-blocks">
      <div class="detail-block"><h4>Contact</h4>
        <div class="kv">
          <dt>Email</dt><dd>${m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : "—"}</dd>
          <dt>Status</dt><dd>${statusBadge(m.status)}</dd>
        </div>
      </div>
      <div class="detail-block"><h4>Subject</h4><p><strong>${esc(m.subject || "(no subject)")}</strong></p></div>
      <div class="detail-block"><h4>Message</h4><p>${esc(m.message || "")}</p></div>
    </div>
    <div style="height:1px;background:var(--border);margin:1.1rem 0;"></div>
    <div class="detail-block">
      <h4>Actions</h4>
      <div class="row-actions" style="margin-top:0.6rem;" data-msg-actions>
        ${m.email ? `<a class="btn btn-sm btn-primary" href="mailto:${esc(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject || "Your message to Apex Innovators"}`)}">${icon("send")} Reply by email</a>` : ""}
        ${m.status !== "READ" ? `<button class="btn btn-sm btn-outline" type="button" data-msg-status="READ" data-id="${m.id}">Mark as read</button>` : ""}
        ${m.status !== "REPLIED" ? `<button class="btn btn-sm btn-success-soft" type="button" data-msg-status="REPLIED" data-id="${m.id}">${icon("check")} Mark replied</button>` : ""}
        ${m.status !== "NEW" ? `<button class="btn btn-sm btn-outline" type="button" data-msg-status="NEW" data-id="${m.id}">Reopen</button>` : ""}
      </div>
    </div>`;
  openDialog(viewModal);
}

async function applyStatus(id, status) {
  try {
    await apiFetch(`/admin/messages/${id}`, { method: "PATCH", body: { status }, auth: true });
    toast(`Message marked ${humanize(status).toLowerCase()}`, "success");
    if (viewModal && viewModal.open) viewModal.close();
    load();
  } catch (err) {
    toast(errorMessage(err, "Could not update the message."), "error");
  }
}

function wireEvents() {
  const statusSel = document.getElementById("filter-status");
  if (statusSel) {
    statusSel.addEventListener("change", () => { state.status = statusSel.value; state.page = 0; load(); });
  }

  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-view]");
      if (btn) {
        const m = cache.get(String(btn.dataset.id));
        if (m) openView(m);
      }
    });
  }

  if (viewBody) {
    viewBody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-msg-status]");
      if (btn) applyStatus(btn.dataset.id, btn.dataset.msgStatus);
    });
  }
}

async function boot() {
  const user = await guardAdmin();
  if (!user) return;
  injectAdminShell("messages", user);
  wireEvents();
  load();
}

boot();
