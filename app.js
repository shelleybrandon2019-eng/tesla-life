(() => {
  const KEY = "tesla-lease-tracker-v1";
  const empty = { tasks: {}, fields: {}, notes: [], mileage: [] };
  let state = load();

  function load() {
    try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch { return { ...empty }; }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
    const status = document.querySelector("#saveStatus");
    if (status) {
      status.textContent = "Saved";
      clearTimeout(save.timer);
      save.timer = setTimeout(() => status.textContent = "Saved locally", 1200);
    }
  }
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
  const formatNumber = (n) => Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
  const formatDate = (value) => {
    if (!value) return "No date";
    return new Date(value + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const tasks = [...document.querySelectorAll("[data-task]")];
  tasks.forEach(box => {
    box.checked = Boolean(state.tasks[box.dataset.task]);
    box.addEventListener("change", () => {
      state.tasks[box.dataset.task] = box.checked;
      save();
      updateProgress();
    });
  });
  function updateProgress() {
    const done = tasks.filter(box => box.checked).length;
    const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    document.querySelector("#progressPercent").textContent = percent + "%";
    document.querySelector("#progressLabel").textContent = done + " of " + tasks.length + " complete";
    document.querySelector("#progressBar").style.width = percent + "%";
  }

  const fields = [...document.querySelectorAll("[data-save]")];
  fields.forEach(field => {
    field.value = state.fields[field.dataset.save] ?? "";
    field.addEventListener("input", () => {
      state.fields[field.dataset.save] = field.value;
      save();
      updateMileageSummary();
    });
  });
  function updateMileageSummary() {
    const allowance = Number(state.fields["mileage-allowance"]);
    const start = Number(state.fields["starting-odometer"]);
    const current = Number(state.fields["current-odometer"]);
    const months = Number(state.fields["lease-months"]);
    const validAllowance = allowance > 0;
    const validOdometer = Number.isFinite(start) && Number.isFinite(current) && current >= start;
    document.querySelector("#milesUsed").textContent = validOdometer ? formatNumber(current - start) : "—";
    document.querySelector("#milesRemaining").textContent = validAllowance && validOdometer ? formatNumber(Math.max(0, allowance - (current - start))) : "—";
    document.querySelector("#monthlyTarget").textContent = validAllowance && months > 0 ? formatNumber(allowance / months) : "—";
  }

  const toggleForm = (form, show) => {
    form.hidden = !show;
    if (show) form.querySelector("input, textarea, select")?.focus();
  };

  const mileageForm = document.querySelector("#mileageForm");
  document.querySelector("#addMileage").addEventListener("click", () => {
    document.querySelector("#mileageDate").value ||= new Date().toISOString().slice(0, 10);
    toggleForm(mileageForm, true);
  });
  document.querySelector("#cancelMileage").addEventListener("click", () => toggleForm(mileageForm, false));
  mileageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const odometer = Number(document.querySelector("#mileageOdometer").value);
    state.mileage.push({ id: crypto.randomUUID?.() || String(Date.now()), date: document.querySelector("#mileageDate").value, odometer });
    state.mileage.sort((a, b) => b.date.localeCompare(a.date));
    state.fields["current-odometer"] = String(Math.max(odometer, Number(state.fields["current-odometer"]) || 0));
    document.querySelector('[data-save="current-odometer"]').value = state.fields["current-odometer"];
    mileageForm.reset();
    toggleForm(mileageForm, false);
    save(); renderMileage(); updateMileageSummary();
  });
  function renderMileage() {
    const list = document.querySelector("#mileageList");
    document.querySelector("#mileageEmpty").hidden = state.mileage.length > 0;
    list.innerHTML = state.mileage.map(item => `<article class="record"><div><div class="record__meta">${esc(formatDate(item.date))}</div><p><strong>${esc(formatNumber(item.odometer))}</strong> miles</p></div><button type="button" data-delete-mileage="${esc(item.id)}">Delete</button></article>`).join("");
    list.querySelectorAll("[data-delete-mileage]").forEach(button => button.addEventListener("click", () => {
      state.mileage = state.mileage.filter(item => item.id !== button.dataset.deleteMileage);
      save(); renderMileage();
    }));
  }

  const noteForm = document.querySelector("#noteForm");
  document.querySelector("#addNote").addEventListener("click", () => {
    document.querySelector("#noteDate").value ||= new Date().toISOString().slice(0, 10);
    toggleForm(noteForm, true);
  });
  document.querySelector("#cancelNote").addEventListener("click", () => toggleForm(noteForm, false));
  noteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.notes.unshift({
      id: crypto.randomUUID?.() || String(Date.now()),
      date: document.querySelector("#noteDate").value,
      type: document.querySelector("#noteType").value,
      odometer: document.querySelector("#noteOdometer").value,
      text: document.querySelector("#noteText").value.trim()
    });
    noteForm.reset();
    toggleForm(noteForm, false);
    save(); renderNotes();
  });
  function renderNotes() {
    const list = document.querySelector("#noteList");
    document.querySelector("#noteEmpty").hidden = state.notes.length > 0;
    list.innerHTML = state.notes.map(note => {
      const odo = note.odometer ? " · " + formatNumber(Number(note.odometer)) + " mi" : "";
      return `<article class="record"><div><div class="record__meta">${esc(note.type)} · ${esc(formatDate(note.date))}${esc(odo)}</div><p>${esc(note.text)}</p></div><button type="button" data-delete-note="${esc(note.id)}">Delete</button></article>`;
    }).join("");
    list.querySelectorAll("[data-delete-note]").forEach(button => button.addEventListener("click", () => {
      state.notes = state.notes.filter(note => note.id !== button.dataset.deleteNote);
      save(); renderNotes();
    }));
  }

  document.querySelector("#exportData").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "tesla-lease-tracker-backup.json" });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  document.querySelector("#resetData").addEventListener("click", () => {
    if (!confirm("Reset every checkbox, lease detail, mileage check-in and note on this device?")) return;
    localStorage.removeItem(KEY);
    location.reload();
  });

  updateProgress();
  updateMileageSummary();
  renderMileage();
  renderNotes();
})();