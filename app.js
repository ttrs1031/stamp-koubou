const transparentColor = document.querySelector("#transparentColor");
const transparentEnabled = document.querySelector("#transparentEnabled");
const autoColorBtn = document.querySelector("#autoColorBtn");
const setName = document.querySelector("#setName");
const hexColor = document.querySelector("#hexColor");
const tolerance = document.querySelector("#tolerance");
const toleranceValue = document.querySelector("#toleranceValue");
const livePreview = document.querySelector("#livePreview");
const convertBtn = document.querySelector("#convertBtn");
const downloadAllPngBtn = document.querySelector("#downloadAllPngBtn");
const downloadSelectedPngBtn = document.querySelector("#downloadSelectedPngBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const downloadSelectedBtn = document.querySelector("#downloadSelectedBtn");
const resetBtn = document.querySelector("#resetBtn");
const selectAllBtn = document.querySelector("#selectAllBtn");
const clearSelectionBtn = document.querySelector("#clearSelectionBtn");
const previewList = document.querySelector("#previewList");
const countBadge = document.querySelector("#countBadge");
const statusText = document.querySelector("#status");
const checkPanel = document.querySelector("#checkPanel");
const checkList = document.querySelector("#checkList");
const helpOpenBtn = document.querySelector("#helpOpenBtn");
const helpCloseBtn = document.querySelector("#helpCloseBtn");
const helpModal = document.querySelector("#helpModal");
const modeCards = [...document.querySelectorAll(".mode-card")];
const fileInputs = [...document.querySelectorAll("[data-file-input]")];
const uploadGroups = [...document.querySelectorAll(".upload-group")];

const outputSizes = {
  stamp: { label: "スタンプ画像", width: 370, height: 320, filenamePrefix: "", zipName: "stamp-set.zip" },
  main: { label: "メイン画像", width: 240, height: 240, fixedName: "main.png" },
  tab: { label: "トークルームタブ画像", width: 96, height: 74, fixedName: "tab.png" },
  emoji: { label: "絵文字画像", width: 180, height: 180, filenamePrefix: "", filenameDigits: 3, trimTransparent: true, padding: 10, zipName: "emoji-set.zip" }
};

const packageModes = {
  stamp: {
    label: "スタンプセット",
    groups: ["stamp", "main", "tab"],
    multiGroups: ["stamp"],
    zipName: "line-stamp-application.zip",
    selectedZipName: "selected-line-stamp-application.zip"
  },
  emoji: {
    label: "絵文字セット",
    groups: ["emoji", "tab"],
    multiGroups: ["emoji"],
    zipName: "line-emoji-application.zip",
    selectedZipName: "selected-line-emoji-application.zip"
  }
};

let packageMode = "stamp";
let sourceFiles = {
  stamp: [],
  main: [],
  tab: [],
  emoji: []
};
let convertedFiles = [];
let selectedFileNames = new Set();
let autoConvertTimer = 0;
let isConverting = false;
let sourceEntryId = 0;

for (const card of modeCards) {
  card.addEventListener("click", () => {
    packageMode = card.dataset.packageMode;
    syncMode();
    resetConverted();
    scheduleAutoConvert();
  });
}

for (const input of fileInputs) {
  input.addEventListener("change", async () => {
    const group = input.dataset.fileInput;
    const files = [...input.files].filter((file) => file.type.startsWith("image/"));
    await addSourceFiles(group, files);
    input.value = "";
  });
}

for (const zone of document.querySelectorAll(".drop-zone")) {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("is-dragging");
  });
  zone.addEventListener("dragleave", () => {
    zone.classList.remove("is-dragging");
  });
  zone.addEventListener("drop", async (event) => {
    event.preventDefault();
    zone.classList.remove("is-dragging");
    const input = zone.querySelector("[data-file-input]");
    const group = input.dataset.fileInput;
    const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
    await addSourceFiles(group, files);
  });
}

for (const button of document.querySelectorAll("[data-autofill]")) {
  button.addEventListener("click", () => {
    const target = button.dataset.autofill;
    const sourceGroup = packageMode === "emoji" ? "emoji" : "stamp";
    if (sourceFiles[sourceGroup].length === 0) {
      setStatus("先に元になる画像を追加してください。", true);
      return;
    }
    sourceFiles[target] = [createSourceEntry(sourceFiles[sourceGroup][0].file)];
    autoDetectEntryColor(sourceFiles[target][0]).then(() => {
      renderSourceList(target);
      scheduleAutoConvert();
    });
    renderSourceList(target);
    resetConverted();
    updateConvertButton();
    updateUtilityButtons();
    setStatus(`${outputSizes[target].label}を1枚目から自動作成する設定にしました。`);
    scheduleAutoConvert();
  });
}

transparentEnabled.addEventListener("change", () => {
  handleProcessingSettingChanged();
});

autoColorBtn.addEventListener("click", async () => {
  await autoPickBackgroundColor();
});

setName.addEventListener("input", () => {
  if (convertedFiles.length > 0) {
    renderChecks();
  }
});

transparentColor.addEventListener("input", () => {
  hexColor.value = transparentColor.value;
  handleProcessingSettingChanged();
});

hexColor.addEventListener("input", () => {
  const value = normalizeHex(hexColor.value);
  if (value) {
    transparentColor.value = value;
    handleProcessingSettingChanged();
  }
});

tolerance.addEventListener("input", () => {
  toleranceValue.value = tolerance.value;
  handleProcessingSettingChanged();
});

livePreview.addEventListener("change", () => {
  scheduleAutoConvert();
});

resetBtn.addEventListener("click", () => {
  resetWorkspace();
});

convertBtn.addEventListener("click", async () => {
  await runConversion();
});

downloadBtn.addEventListener("click", () => {
  if (convertedFiles.length === 0) {
    return;
  }
  downloadBlob(createZip(toZipEntries(convertedFiles)), getPackageZipName(false));
});

downloadSelectedBtn.addEventListener("click", () => {
  const selectedFiles = getSelectedConvertedFiles();
  if (selectedFiles.length === 0) {
    setStatus("保存する画像を選択してください。", true);
    return;
  }
  downloadBlob(createZip(toZipEntries(selectedFiles)), getPackageZipName(true));
});

downloadAllPngBtn.addEventListener("click", () => {
  downloadPngFiles(convertedFiles);
});

downloadSelectedPngBtn.addEventListener("click", () => {
  const selectedFiles = getSelectedConvertedFiles();
  if (selectedFiles.length === 0) {
    setStatus("保存する画像を選択してください。", true);
    return;
  }
  downloadPngFiles(selectedFiles);
});

selectAllBtn.addEventListener("click", () => {
  selectedFileNames = new Set(convertedFiles.map((file) => file.name));
  syncSelectionCheckboxes();
  updateDownloadButtons();
});

clearSelectionBtn.addEventListener("click", () => {
  selectedFileNames = new Set();
  syncSelectionCheckboxes();
  updateDownloadButtons();
});

helpOpenBtn.addEventListener("click", () => {
  openHelpModal();
});

helpCloseBtn.addEventListener("click", () => {
  closeHelpModal();
});

helpModal.addEventListener("click", (event) => {
  if (event.target === helpModal) {
    closeHelpModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpModal.hidden) {
    closeHelpModal();
  }
});

syncMode();
updateConvertButton();
updateUtilityButtons();
registerServiceWorker();

function openHelpModal() {
  helpModal.hidden = false;
  document.body.classList.add("is-help-open");
  helpCloseBtn.focus();
}

function closeHelpModal() {
  helpModal.hidden = true;
  document.body.classList.remove("is-help-open");
  helpOpenBtn.focus();
}

async function addSourceFiles(group, files) {
  if (files.length === 0) {
    return;
  }

  const isMultiGroup = packageModes[packageMode].multiGroups.includes(group);
  const entries = files.map((file) => createSourceEntry(file));
  sourceFiles[group] = isMultiGroup ? [...sourceFiles[group], ...entries] : entries.slice(0, 1);
  renderSourceList(group);
  resetConverted();
  updateConvertButton();
  updateUtilityButtons();
  setStatus(getReadinessMessage());

  await Promise.all(entries.map((entry) => autoDetectEntryColor(entry)));
  renderSourceList(group);
  scheduleAutoConvert();
}

function createSourceEntry(file) {
  return {
    id: `source-${sourceEntryId += 1}`,
    file,
    settings: {
      transparent: transparentEnabled.checked,
      color: normalizeHex(transparentColor.value) || "#ffffff",
      colorMode: "auto"
    }
  };
}

function syncMode() {
  for (const card of modeCards) {
    const isActive = card.dataset.packageMode === packageMode;
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-pressed", String(isActive));
  }

  const activeGroups = packageModes[packageMode].groups;
  for (const group of uploadGroups) {
    group.hidden = !activeGroups.includes(group.dataset.group);
  }

  for (const key of Object.keys(sourceFiles)) {
    renderSourceList(key);
  }
  updateConvertButton();
  updateUtilityButtons();
  setStatus(getReadinessMessage());
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const isLocalFile = window.location.protocol === "file:";
  if (isLocalFile) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

async function runConversion(isAuto = false) {
  if (!isReadyToConvert()) {
    setStatus(getReadinessMessage(), true);
    return;
  }
  if (isConverting) {
    return;
  }

  isConverting = true;
  setStatus(isAuto ? "自動プレビューを更新中です..." : "一括変換中です...");
  setActionButtonsDisabled(true);

  try {
    convertedFiles = [];
    selectedFileNames = new Set();
    clearPreview();

    const color = hexToRgb(transparentColor.value);
    const activeGroups = packageModes[packageMode].groups;

    for (const group of activeGroups) {
      const size = outputSizes[group];
      const entries = sourceFiles[group];
      for (let index = 0; index < entries.length; index += 1) {
        const result = await convertImage(entries[index], index, size, color, Number(tolerance.value), group);
        convertedFiles.push(result);
        addPreview(result, entries[index].file.name, size);
      }
    }

    selectedFileNames = new Set(convertedFiles.map((file) => file.name));
    syncSelectionCheckboxes();
    updateDownloadButtons();
    updateUtilityButtons();
    renderChecks();
    setStatus(`変換完了: ${convertedFiles.length}枚の画像を変換しました。申請用ZIPを保存できます。`, false, true);
  } catch (error) {
    console.error(error);
    setStatus("変換に失敗しました。別の画像で試してください。", true);
  } finally {
    isConverting = false;
    updateConvertButton();
  }
}

function renderSourceList(group) {
  const list = document.querySelector(`[data-source-list="${group}"]`);
  if (!list) {
    return;
  }

  list.innerHTML = "";
  sourceFiles[group].forEach((entry, index) => {
    const file = entry.file;
    const settings = entry.settings;
    const url = URL.createObjectURL(file);
    const plannedName = getOutputFilename(group, index, outputSizes[group]);
    const item = document.createElement("article");
    item.className = "source-chip";
    item.innerHTML = `
      <img class="source-image" src="${url}" alt="${escapeHtml(file.name)}">
      <div class="source-body">
        <p class="filename">${escapeHtml(file.name)}</p>
        <p class="meta">出力予定: ${escapeHtml(plannedName)}</p>
        <p class="meta source-meta">元画像 / ${(file.size / 1024).toFixed(1)} KB</p>
        <div class="per-image-settings">
          <label class="mini-toggle">
            <input class="per-transparent" type="checkbox" ${settings.transparent ? "checked" : ""}>
            <span>透明化する</span>
          </label>
          <div class="per-color-row">
            <span class="color-chip" style="background:${escapeHtml(settings.color)}"></span>
            <input class="per-color" type="color" value="${escapeHtml(settings.color)}" ${settings.transparent ? "" : "disabled"}>
            <input class="per-hex" type="text" value="${escapeHtml(settings.color)}" inputmode="text" aria-label="画像ごとの背景色" ${settings.transparent ? "" : "disabled"}>
          </div>
          <button class="auto-entry-color-btn" type="button" ${settings.transparent ? "" : "disabled"}>背景色を自動判定</button>
        </div>
      </div>
      <button class="remove-source-btn" type="button">削除</button>
    `;

    const image = item.querySelector(".source-image");
    const colorChip = item.querySelector(".color-chip");
    const transparentInput = item.querySelector(".per-transparent");
    const colorInput = item.querySelector(".per-color");
    const hexInput = item.querySelector(".per-hex");
    const autoEntryColorBtn = item.querySelector(".auto-entry-color-btn");
    const syncEntryColorControls = () => {
      colorInput.value = settings.color;
      hexInput.value = settings.color;
      colorChip.style.background = settings.color;
      colorInput.disabled = !settings.transparent;
      hexInput.disabled = !settings.transparent;
      autoEntryColorBtn.disabled = !settings.transparent;
    };

    image.addEventListener("load", () => {
      item.querySelector(".source-meta").textContent =
        `元画像 ${image.naturalWidth}×${image.naturalHeight}px / ${(file.size / 1024).toFixed(1)} KB`;
    });
    image.addEventListener("click", (event) => {
      pickColorFromImage(image, event, entry, syncEntryColorControls);
    });
    transparentInput.addEventListener("change", () => {
      settings.transparent = transparentInput.checked;
      syncEntryColorControls();
      handleProcessingSettingChanged(`${file.name} の透明化設定を変更しました。`);
    });
    colorInput.addEventListener("input", () => {
      settings.color = colorInput.value;
      settings.colorMode = "manual";
      syncEntryColorControls();
      handleProcessingSettingChanged(`${file.name} の背景色を変更しました。`);
    });
    hexInput.addEventListener("input", () => {
      const value = normalizeHex(hexInput.value);
      if (!value) {
        return;
      }
      settings.color = value;
      settings.colorMode = "manual";
      syncEntryColorControls();
      handleProcessingSettingChanged(`${file.name} の背景色を変更しました。`);
    });
    autoEntryColorBtn.addEventListener("click", async () => {
      await autoDetectEntryColor(entry);
      syncEntryColorControls();
      handleProcessingSettingChanged(`${file.name} の背景色を自動判定しました: ${settings.color}`);
    });
    item.querySelector(".remove-source-btn").addEventListener("click", () => {
      removeSourceFile(group, index);
    });

    list.append(item);
  });
}

function removeSourceFile(group, index) {
  sourceFiles[group].splice(index, 1);
  renderSourceList(group);
  resetConverted();
  updateConvertButton();
  updateUtilityButtons();
  setStatus(getReadinessMessage());
}

function addPreview(result, originalName, size) {
  const item = document.createElement("article");
  item.className = "item";
  item.innerHTML = `
    <label class="select-item">
      <input class="select-checkbox" type="checkbox" value="${escapeHtml(result.name)}" checked>
      <span>保存する</span>
    </label>
    <div class="checker"><img src="${result.url}" alt="${escapeHtml(result.name)}"></div>
    <div class="info">
      <p class="filename">${escapeHtml(result.name)}</p>
      <p class="meta">${escapeHtml(originalName)} ${result.originalWidth}×${result.originalHeight}px → ${size.label} ${result.width}×${result.height}px</p>
      <div class="check-pills">${renderCheckPills(result.checks)}</div>
      <button class="single-download-btn" type="button">保存</button>
    </div>
  `;

  const checkbox = item.querySelector(".select-checkbox");
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedFileNames.add(result.name);
    } else {
      selectedFileNames.delete(result.name);
    }
    updateDownloadButtons();
  });
  item.querySelector(".single-download-btn").addEventListener("click", async () => {
    await saveSinglePng(result);
  });
  previewList.append(item);
}

function resetConverted() {
  convertedFiles = [];
  selectedFileNames = new Set();
  clearPreview();
  hideChecks();
  updateDownloadButtons();
  updateUtilityButtons();
}

function clearPreview() {
  previewList.innerHTML = `<p class="empty">必要な画像を追加して「一括変換する」を押すと、変換後のPNGが表示されます。</p>`;
}

function setStatus(message, isError = false, isSuccess = false) {
  statusText.textContent = message;
  statusText.classList.toggle("error", isError);
  statusText.classList.toggle("is-success", !isError && isSuccess);
}

function scheduleAutoConvert() {
  if (!livePreview.checked || !isReadyToConvert()) {
    return;
  }
  window.clearTimeout(autoConvertTimer);
  autoConvertTimer = window.setTimeout(() => {
    runConversion(true);
  }, 450);
}

function handleProcessingSettingChanged(message = "変換設定を変更しました。もう一度「一括変換する」を押してください。") {
  if (livePreview.checked && isReadyToConvert()) {
    scheduleAutoConvert();
    setStatus(message);
    return;
  }

  if (convertedFiles.length > 0) {
    resetConverted();
    setStatus(message);
  } else {
    setStatus(message);
  }
}

function isReadyToConvert() {
  return packageModes[packageMode].groups.every((group) => sourceFiles[group].length > 0);
}

function getReadinessMessage() {
  const missing = packageModes[packageMode].groups
    .filter((group) => sourceFiles[group].length === 0)
    .map((group) => outputSizes[group].label);
  if (missing.length === 0) {
    return "必要な画像が揃いました。「一括変換する」を押してください。";
  }
  return `未追加: ${missing.join("、")}`;
}

function updateConvertButton() {
  convertBtn.disabled = !isReadyToConvert() || isConverting;
}

function updateUtilityButtons() {
  const hasSources = getSourceCount() > 0;
  autoColorBtn.disabled = !hasSources;
  resetBtn.disabled = !hasSources && convertedFiles.length === 0;
}

function setActionButtonsDisabled(disabled) {
  downloadAllPngBtn.disabled = disabled;
  downloadSelectedPngBtn.disabled = disabled;
  downloadBtn.disabled = disabled;
  downloadSelectedBtn.disabled = disabled;
  selectAllBtn.disabled = disabled;
  clearSelectionBtn.disabled = disabled;
}

function updateDownloadButtons() {
  const hasConvertedFiles = convertedFiles.length > 0;
  const selectedCount = selectedFileNames.size;
  downloadAllPngBtn.disabled = !hasConvertedFiles;
  downloadSelectedPngBtn.disabled = selectedCount === 0;
  downloadBtn.disabled = !hasConvertedFiles;
  downloadSelectedBtn.disabled = selectedCount === 0;
  selectAllBtn.disabled = !hasConvertedFiles || selectedCount === convertedFiles.length;
  clearSelectionBtn.disabled = !hasConvertedFiles || selectedCount === 0;
  countBadge.textContent = hasConvertedFiles
    ? `${convertedFiles.length}枚 / 選択${selectedCount}枚`
    : `${getSourceCount()}枚`;
}

function getSourceCount() {
  return packageModes[packageMode].groups.reduce((sum, group) => sum + sourceFiles[group].length, 0);
}

function getFirstActiveSourceFile() {
  for (const group of packageModes[packageMode].groups) {
    if (sourceFiles[group].length > 0) {
      return sourceFiles[group][0].file;
    }
  }
  return null;
}

async function autoPickBackgroundColor() {
  const file = getFirstActiveSourceFile();
  if (!file) {
    setStatus("背景色を自動選択する画像がありません。", true);
    return;
  }

  try {
    const image = await loadImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    const maxX = Math.max(0, canvas.width - 1);
    const maxY = Math.max(0, canvas.height - 1);
    const samples = [
      context.getImageData(0, 0, 1, 1).data,
      context.getImageData(maxX, 0, 1, 1).data,
      context.getImageData(0, maxY, 1, 1).data,
      context.getImageData(maxX, maxY, 1, 1).data
    ].map(([red, green, blue]) => ({ red, green, blue }));

    const average = samples.reduce((sum, color) => ({
      red: sum.red + color.red,
      green: sum.green + color.green,
      blue: sum.blue + color.blue
    }), { red: 0, green: 0, blue: 0 });

    const hex = rgbToHex(
      Math.round(average.red / samples.length),
      Math.round(average.green / samples.length),
      Math.round(average.blue / samples.length)
    );

    transparentColor.value = hex;
    hexColor.value = hex;
    handleProcessingSettingChanged(`背景色を四隅から自動選択しました: ${hex}`);
  } catch (error) {
    console.error(error);
    setStatus("背景色の自動選択に失敗しました。別の画像で試してください。", true);
  }
}

function resetWorkspace() {
  const hasWork = getSourceCount() > 0 || convertedFiles.length > 0;
  if (!hasWork) {
    return;
  }

  const ok = window.confirm("選択中の画像と変換結果をすべて削除します。よろしいですか？");
  if (!ok) {
    return;
  }

  sourceFiles = {
    stamp: [],
    main: [],
    tab: [],
    emoji: []
  };
  sourceEntryId = 0;
  for (const input of fileInputs) {
    input.value = "";
  }
  for (const key of Object.keys(sourceFiles)) {
    renderSourceList(key);
  }
  resetConverted();
  updateConvertButton();
  updateUtilityButtons();
  setStatus(getReadinessMessage());
}

function syncSelectionCheckboxes() {
  for (const checkbox of previewList.querySelectorAll(".select-checkbox")) {
    checkbox.checked = selectedFileNames.has(checkbox.value);
  }
}

function getSelectedConvertedFiles() {
  return convertedFiles.filter((file) => selectedFileNames.has(file.name));
}

function toZipEntries(files) {
  return files.map((file) => ({
    name: file.name,
    bytes: file.bytes
  }));
}

function renderCheckPills(checks) {
  return checks.map((check) => (
    `<span class="check-pill ${check.ok ? "is-ok" : "is-ng"}">${check.ok ? "OK" : "要確認"} ${escapeHtml(check.label)}</span>`
  )).join("");
}

function renderChecks() {
  if (convertedFiles.length === 0) {
    hideChecks();
    return;
  }

  const allChecks = convertedFiles.flatMap((file) => file.checks);
  const okCount = allChecks.filter((check) => check.ok).length;
  const zipSize = createZip(toZipEntries(convertedFiles)).size;
  const zipSizeOk = zipSize <= 20 * 1024 * 1024;
  checkPanel.hidden = false;
  checkList.innerHTML = `
    <li><span>セット種別</span><strong>${packageModes[packageMode].label}</strong></li>
    <li><span>変換枚数</span><strong>${convertedFiles.length}枚</strong></li>
    <li><span>チェック結果</span><strong>${okCount}/${allChecks.length} OK</strong></li>
    <li><span>ZIPサイズ</span><strong>${zipSizeOk ? "OK" : "要確認"} ${(zipSize / 1024 / 1024).toFixed(2)} MB / 20 MB以下</strong></li>
    <li><span>ZIP名</span><strong>${escapeHtml(getPackageZipName(false))}</strong></li>
  `;
}

function getPackageZipName(isSelected) {
  const baseName = sanitizeFilename(setName.value);
  if (!baseName) {
    return isSelected ? packageModes[packageMode].selectedZipName : packageModes[packageMode].zipName;
  }

  const suffix = packageMode === "emoji" ? "emoji" : "stamp";
  const prefix = isSelected ? "selected-" : "";
  return `${prefix}${baseName}_${suffix}.zip`;
}

function sanitizeFilename(value) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function hideChecks() {
  checkPanel.hidden = true;
  checkList.innerHTML = "";
}

function pickColorFromImage(image, event, entry = null, onChange = null) {
  if (!image.naturalWidth || !image.naturalHeight) {
    return;
  }

  const rect = image.getBoundingClientRect();
  const renderedRatio = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * renderedRatio;
  const renderedHeight = image.naturalHeight * renderedRatio;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  const x = Math.floor((event.clientX - rect.left - offsetX) / renderedRatio);
  const y = Math.floor((event.clientY - rect.top - offsetY) / renderedRatio);

  if (x < 0 || y < 0 || x >= image.naturalWidth || y >= image.naturalHeight) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
  const hex = rgbToHex(red, green, blue);

  if (entry) {
    entry.settings.color = hex;
    entry.settings.colorMode = "manual";
    if (onChange) {
      onChange();
    }
    handleProcessingSettingChanged(`${entry.file.name} の背景色を ${hex} に設定しました。`);
    return;
  }

  transparentColor.value = hex;
  hexColor.value = hex;
  setStatus(`背景色を ${hex} に設定しました。`);
  scheduleAutoConvert();
}

function downloadPngFiles(files) {
  files.forEach((file, index) => {
    window.setTimeout(() => {
      downloadPngFile(file);
    }, index * 120);
  });
}

function downloadPngFile(file) {
  downloadBlob(new Blob([file.bytes], { type: "image/png" }), file.name);
}

async function saveSinglePng(file) {
  const blob = new Blob([file.bytes], { type: "image/png" });
  const shareFile = new File([blob], file.name, { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [shareFile] }) && navigator.share) {
    try {
      await navigator.share({
        files: [shareFile],
        title: file.name
      });
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
    }
  }

  downloadBlob(blob, file.name);
}

async function convertImage(entry, index, size, fallbackTransparentRgb, toleranceValueNumber, group) {
  const file = entry.file;
  const imageSettings = entry.settings;
  const transparentRgb = hexToRgb(imageSettings.color) || fallbackTransparentRgb;
  const image = await loadImage(file);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.naturalWidth;
  sourceCanvas.height = image.naturalHeight;

  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0);
  if (imageSettings.transparent) {
    applyTransparency(sourceContext, sourceCanvas.width, sourceCanvas.height, transparentRgb, toleranceValueNumber);
  }

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = size.width;
  outputCanvas.height = size.height;
  const outputContext = outputCanvas.getContext("2d");
  outputContext.clearRect(0, 0, size.width, size.height);

  const trimBox = size.trimTransparent
    ? findVisibleBounds(sourceContext, sourceCanvas.width, sourceCanvas.height)
    : null;
  const sourceX = trimBox ? trimBox.x : 0;
  const sourceY = trimBox ? trimBox.y : 0;
  const sourceWidth = trimBox ? trimBox.width : sourceCanvas.width;
  const sourceHeight = trimBox ? trimBox.height : sourceCanvas.height;
  const padding = size.padding || 0;
  const targetWidth = size.width - padding * 2;
  const targetHeight = size.height - padding * 2;
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight, 1);
  const drawWidth = Math.round(sourceWidth * scale);
  const drawHeight = Math.round(sourceHeight * scale);
  const drawX = Math.floor((size.width - drawWidth) / 2);
  const drawY = Math.floor((size.height - drawHeight) / 2);

  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(sourceCanvas, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
  if (imageSettings.transparent) {
    applyTransparency(outputContext, outputCanvas.width, outputCanvas.height, transparentRgb, toleranceValueNumber);
  }

  const blob = await canvasToBlob(outputCanvas);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const name = getOutputFilename(group, index, size);
  const hasTransparentPixels = hasTransparency(outputContext, outputCanvas.width, outputCanvas.height);
  const checks = buildChecks(name, outputCanvas.width, outputCanvas.height, size, hasTransparentPixels, bytes.length);

  return {
    name,
    width: outputCanvas.width,
    height: outputCanvas.height,
    originalWidth: image.naturalWidth,
    originalHeight: image.naturalHeight,
    checks,
    bytes,
    url: URL.createObjectURL(blob)
  };
}

async function autoDetectEntryColor(entry) {
  try {
    const image = await loadImage(entry.file);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    entry.settings.color = detectCornerBackgroundColor(context, canvas.width, canvas.height);
    entry.settings.colorMode = "auto";
  } catch (error) {
    console.error(error);
  }
}

function detectCornerBackgroundColor(context, width, height) {
  const maxX = Math.max(0, width - 1);
  const maxY = Math.max(0, height - 1);
  const samples = [
    context.getImageData(0, 0, 1, 1).data,
    context.getImageData(maxX, 0, 1, 1).data,
    context.getImageData(0, maxY, 1, 1).data,
    context.getImageData(maxX, maxY, 1, 1).data
  ].map(([red, green, blue]) => ({ red, green, blue }));

  const groups = [];
  const groupTolerance = 24;
  for (const sample of samples) {
    const match = groups.find((group) => colorDistance(group.average, sample) <= groupTolerance);
    if (match) {
      match.colors.push(sample);
      match.average = averageColors(match.colors);
    } else {
      groups.push({ colors: [sample], average: sample });
    }
  }

  groups.sort((a, b) => b.colors.length - a.colors.length);
  const selected = groups[0] && groups[0].colors.length > 1
    ? groups[0].average
    : averageColors(samples);

  return rgbToHex(Math.round(selected.red), Math.round(selected.green), Math.round(selected.blue));
}

function averageColors(colors) {
  const total = colors.reduce((sum, color) => ({
    red: sum.red + color.red,
    green: sum.green + color.green,
    blue: sum.blue + color.blue
  }), { red: 0, green: 0, blue: 0 });

  return {
    red: total.red / colors.length,
    green: total.green / colors.length,
    blue: total.blue / colors.length
  };
}

function colorDistance(colorA, colorB) {
  return Math.hypot(colorA.red - colorB.red, colorA.green - colorB.green, colorA.blue - colorB.blue);
}

function getOutputFilename(group, index, size) {
  if (size.fixedName) {
    return size.fixedName;
  }
  const digits = size.filenameDigits || 2;
  return `${size.filenamePrefix || ""}${String(index + 1).padStart(digits, "0")}.png`;
}

function buildChecks(name, width, height, size, hasTransparentPixels, byteLength) {
  const digits = size.filenameDigits || 2;
  const expectedName = size.fixedName
    ? name === size.fixedName
    : new RegExp(`^${escapeRegExp(size.filenamePrefix || "")}\\d{${digits}}\\.png$`).test(name);
  return [
    { label: "PNG形式", ok: name.endsWith(".png") },
    { label: `${size.width}×${size.height}px`, ok: width === size.width && height === size.height },
    { label: "ファイル名", ok: expectedName },
    { label: "1MB以下", ok: byteLength <= 1024 * 1024 },
    { label: "透明余白", ok: hasTransparentPixels }
  ];
}

function hasTransparency(context, width, height) {
  const data = context.getImageData(0, 0, width, height).data;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) {
      return true;
    }
  }
  return false;
}

function applyTransparency(context, width, height, target, toleranceValueNumber) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  const maxDistance = Math.max(1, toleranceValueNumber);

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const distance = Math.hypot(red - target.r, green - target.g, blue - target.b);

    if (distance <= maxDistance) {
      data[index + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);
}

function findVisibleBounds(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha >= 10) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX === -1 || maxY === -1) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Image load failed: ${file.name}`));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Canvas export failed"));
      }
    }, "image/png");
  });
}

function normalizeHex(value) {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toLowerCase()}`;
  }
  return "";
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex) || "#ffffff";
  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, file.bytes.length, true);
    localView.setUint32(22, file.bytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, file.bytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.bytes.length, true);
    centralView.setUint32(24, file.bytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + file.bytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, endHeader], { type: "application/zip" });
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
