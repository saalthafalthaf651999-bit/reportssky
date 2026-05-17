/**
 * SKY MOBILES — optional Firebase Firestore multi-device sync.
 * Loads firebase-config.js when present; falls back to local-only storage.
 */
(function () {
  const DEVICE_KEY = "sky_mobiles_device_id";
  const PUSH_DEBOUNCE_MS = 900;

  let db = null;
  let docRef = null;
  let unsubscribe = null;
  let pushTimer = null;
  let applyingRemote = false;
  let shopKey = "";

  function deviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "d_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function shopDocId(email) {
    return String(email || "default")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 120);
  }

  function isEnabled() {
    return Boolean(window.SKY_FIREBASE?.enabled && window.SKY_FIREBASE?.config?.projectId);
  }

  function setStatus(text, ok) {
    const el = document.getElementById("cloud-sync-status");
    if (el) {
      el.textContent = text;
      el.classList.toggle("sync-ok", Boolean(ok));
      el.classList.toggle("sync-off", !ok);
    }
  }

  function loadFirebaseScripts() {
    return new Promise((resolve, reject) => {
      if (window.firebase?.firestore) {
        resolve();
        return;
      }
      const ver = "10.12.0";
      const base = `https://www.gstatic.com/firebasejs/${ver}`;
      const scripts = [`${base}/firebase-app-compat.js`, `${base}/firebase-firestore-compat.js`];
      let i = 0;
      const next = () => {
        if (i >= scripts.length) {
          resolve();
          return;
        }
        const s = document.createElement("script");
        s.src = scripts[i++];
        s.onload = next;
        s.onerror = () => reject(new Error("Firebase SDK failed to load"));
        document.head.appendChild(s);
      };
      next();
    });
  }

  async function init(email) {
    if (!isEnabled()) {
      setStatus("Cloud sync off — add firebase-config.js to enable multi-device sync.", false);
      return false;
    }
    try {
      await loadFirebaseScripts();
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(window.SKY_FIREBASE.config);
      }
      db = window.firebase.firestore();
      shopKey = shopDocId(email);
      docRef = db.collection("sky_mobiles_workspaces").doc(shopKey);
      setStatus("Cloud sync connected — live across devices.", true);
      return true;
    } catch (err) {
      console.warn("Cloud sync init failed", err);
      setStatus("Cloud sync unavailable — using local storage only.", false);
      return false;
    }
  }

  function buildPayload() {
    if (typeof window.skyBuildSyncPayload !== "function") return null;
    return window.skyBuildSyncPayload();
  }

  function applyPayload(payload) {
    if (!payload || applyingRemote) return;
    applyingRemote = true;
    try {
      if (typeof window.skyApplySyncPayload === "function") {
        window.skyApplySyncPayload(payload);
      }
    } finally {
      applyingRemote = false;
    }
  }

  function pushNow() {
    if (!docRef || applyingRemote) return;
    const payload = buildPayload();
    if (!payload) return;
    docRef
      .set(
        {
          ...payload,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: deviceId(),
        },
        { merge: true }
      )
      .catch((err) => console.warn("Cloud push failed", err));
  }

  function pushDebounced() {
    if (!docRef) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, PUSH_DEBOUNCE_MS);
  }

  function startListener() {
    if (!docRef || unsubscribe) return;
    unsubscribe = docRef.onSnapshot(
      (snap) => {
        if (!snap.exists) return;
        const remote = snap.data();
        const remoteDevice = remote.updatedBy;
        if (remoteDevice === deviceId()) return;
        const localMeta = localStorage.getItem("sky_mobiles_meta_v1");
        let localAt = 0;
        try {
          localAt = JSON.parse(localMeta || "{}").savedAt
            ? new Date(JSON.parse(localMeta).savedAt).getTime()
            : 0;
        } catch {
          /* ignore */
        }
        const remoteAt = remote.clientSavedAt ? new Date(remote.clientSavedAt).getTime() : 0;
        if (remoteAt && localAt && remoteAt <= localAt) return;
        applyPayload(remote);
        if (typeof window.skyOnCloudSync === "function") window.skyOnCloudSync(false);
      },
      (err) => console.warn("Cloud listener error", err)
    );
  }

  async function start(email) {
    const ok = await init(email);
    if (!ok) return;
    startListener();
    const snap = await docRef.get().catch(() => null);
    if (snap?.exists) {
      applyPayload(snap.data());
      if (typeof window.skyOnCloudSync === "function") window.skyOnCloudSync(true);
    } else {
      pushNow();
    }
  }

  function stop() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    docRef = null;
    db = null;
  }

  window.SkyCloudSync = {
    isEnabled,
    start,
    stop,
    pushDebounced,
    pushNow,
    isApplyingRemote: () => applyingRemote,
  };
})();
