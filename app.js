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


  const PHOTO_DB = "tesla-lease-photos-v1";
  const photoTaskIds = new Set([
    "delivery-four-sides","delivery-body","delivery-wheel-photos","delivery-tire-photos",
    "delivery-odometer","interior-photos","cargo-photos","folder-identity",
    "folder-wheel-tire","folder-defects","week-photograph","care-wheel-photo",
    "return-photo-again","final-four-sides","final-wheels","final-glass",
    "final-interior","final-odo-battery","final-location"
  ]);
  let activePhotoTask = null;
  let photoUrls = [];

  function openPhotoDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(PHOTO_DB, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("photos", { keyPath: "id" });
        store.createIndex("task", "task");
        store.createIndex("created", "created");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function photoStore(mode, action) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("photos", mode);
      const request = action(tx.objectStore("photos"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  }
  const getPhotos = () => photoStore("readonly", store => store.getAll());
  const putPhoto = photo => photoStore("readwrite", store => store.put(photo));
  const removePhoto = id => photoStore("readwrite", store => store.delete(id));

  function taskText(taskId) {
    return document.querySelector('[data-task="' + taskId + '"]')?.nextElementSibling?.textContent || "Tesla photo";
  }
  function installPhotoButtons() {
    photoTaskIds.forEach(taskId => {
      const box = document.querySelector('[data-task="' + taskId + '"]');
      if (!box) return;
      const row = box.closest("label");
      row.classList.add("has-photo");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "photo-add";
      button.dataset.photoTask = taskId;
      button.textContent = "+ Photo";
      button.setAttribute("aria-label", "Add photo for " + taskText(taskId));
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        activePhotoTask = taskId;
        document.querySelector("#photoInput").click();
      });
      row.append(button);
    });
  }
  document.querySelector("#photoInput").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file || !activePhotoTask) return;
    try {
      await putPhoto({
        id: crypto.randomUUID?.() || String(Date.now()),
        task: activePhotoTask,
        name: file.name || "tesla-photo.jpg",
        type: file.type || "image/jpeg",
        created: new Date().toISOString(),
        blob: file
      });
      document.querySelector('[data-task="' + activePhotoTask + '"]').checked = true;
      state.tasks[activePhotoTask] = true;
      save();
      updateProgress();
      await renderPhotos();
      document.querySelector("#photos").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      alert("This photo could not be saved. Try downloading it directly to your phone instead.");
    } finally {
      event.target.value = "";
      activePhotoTask = null;
    }
  });
  async function renderPhotos() {
    photoUrls.forEach(URL.revokeObjectURL);
    photoUrls = [];
    let photos = [];
    try { photos = await getPhotos(); } catch { return; }
    photos.sort((a, b) => b.created.localeCompare(a.created));
    document.querySelector("#photoCount").textContent = photos.length + (photos.length === 1 ? " photo" : " photos");
    document.querySelector("#photoEmpty").hidden = photos.length > 0;
    const counts = photos.reduce((all, photo) => ((all[photo.task] = (all[photo.task] || 0) + 1), all), {});
    document.querySelectorAll("[data-photo-task]").forEach(button => {
      const count = counts[button.dataset.photoTask] || 0;
      button.textContent = count ? "+ Photo · " + count : "+ Photo";
      button.classList.toggle("has-items", count > 0);
    });
    const gallery = document.querySelector("#photoGallery");
    gallery.innerHTML = "";
    photos.forEach(photo => {
      const url = URL.createObjectURL(photo.blob);
      photoUrls.push(url);
      const card = document.createElement("article");
      card.className = "photo-card";
      card.innerHTML = '<img alt="' + esc(taskText(photo.task)) + '"><div class="photo-card__body"><div class="photo-card__task">' + esc(taskText(photo.task)) + '</div><div class="photo-card__date">' + esc(new Date(photo.created).toLocaleString()) + '</div><div class="photo-card__actions"><a download="' + esc(photo.name) + '">Download</a><button type="button">Remove</button></div></div>';
      card.querySelector("img").src = url;
      card.querySelector("a").href = url;
      card.querySelector("button").addEventListener("click", async () => {
        if (!confirm("Remove this photo from this device?")) return;
        await removePhoto(photo.id);
        renderPhotos();
      });
      gallery.append(card);
    });
  }
  installPhotoButtons();
  renderPhotos();

  document.querySelector("#exportData").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "tesla-lease-tracker-backup.json" });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  document.querySelector("#resetData").addEventListener("click", () => {
    if (!confirm("Reset every checkbox, lease detail, mileage check-in and note? Photos will stay in the Photo Vault unless removed there.")) return;
    localStorage.removeItem(KEY);
    location.reload();
  });

  updateProgress();
  updateMileageSummary();
  renderMileage();
  renderNotes();
})();