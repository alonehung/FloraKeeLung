import React, { useState, useEffect, useRef, ReactNode } from "react";

// Declare external globals from CDN
declare const L: any;
declare const google: any;
declare const Tone: any;

interface Landmark {
  id: number;
  name: string;
  lat: number;
  lng: number;
  expire: string | null;
  region: string;
}

const LOCAL_STORAGE_KEY_PREFIX = 'keelung-pikmin-v6'; 
const GOOGLE_CLIENT_ID_KEY = 'keelung-google-client-id-v6';
const GOOGLE_SHEET_ID_KEY = 'keelung-google-sheet-id-v6';
const MANUAL_TOKEN_KEY = 'keelung-manual-token-v6';

const ROUTE_COLORS = [
  { name: "紅色", hex: "#ef4444", borderClass: "border-red-500", textClass: "text-red-400", bgClass: "bg-red-500/10 border-red-500/30 font-bold" },
  { name: "藍色", hex: "#3b82f6", borderClass: "border-blue-500", textClass: "text-blue-400", bgClass: "bg-blue-500/10 border-blue-500/30 font-bold" },
  { name: "綠色", hex: "#10b981", borderClass: "border-emerald-500", textClass: "text-emerald-400", bgClass: "bg-emerald-500/10 border-emerald-500/30 font-bold" },
  { name: "紫色", hex: "#a855f7", borderClass: "border-purple-500", textClass: "text-purple-400", bgClass: "bg-purple-500/10 border-purple-500/30 font-bold" },
  { name: "橘色", hex: "#f97316", borderClass: "border-orange-500", textClass: "text-orange-400", bgClass: "bg-orange-500/10 border-orange-500/30 font-bold" },
  { name: "黃色", hex: "#f59e0b", borderClass: "border-amber-500", textClass: "text-amber-400", bgClass: "bg-amber-500/10 border-amber-500/30 font-bold" }
];

const DEFAULT_CLIENT_ID = '642819576340-7cul2favaq2kmn21bur34papjb8ofci7.apps.googleusercontent.com';
const DEFAULT_SHEET_ID = '1BmWfet3J7LaCrJZfNe8RN58LCI990o_9NySRRCc0BpU';

const PRESETS: Record<string, Landmark[]> = {
  keelung: [
    { id: 1, name: "G大型燈飾", lat: 25.131147, lng: 121.740986, expire: null, region: "keelung" },
    { id: 2, name: "整治旭川汀碑記", lat: 25.129665, lng: 121.741313, expire: null, region: "keelung" },
    { id: 3, name: "合作金庫基隆分行", lat: 25.129813, lng: 121.742466, expire: null, region: "keelung" },
    { id: 4, name: "淨水廠", lat: 25.130946, lng: 121.742961, expire: null, region: "keelung" },
    { id: 5, name: "基隆港客運大廈", lat: 25.13174, lng: 121.74341, expire: null, region: "keelung" },
    { id: 6, name: "基隆巿政府大樓", lat: 25.131706, lng: 121.744449, expire: null, region: "keelung" },
    { id: 7, name: "鯨魚-寧靜的午後", lat: 25.133026, lng: 121.744159, expire: null, region: "keelung" },
    { id: 8, name: "東岸旅客中心", lat: 25.134069, lng: 121.745093, expire: null, region: "keelung" },
    { id: 9, name: "長榮桂冠酒店", lat: 25.135163, lng: 121.746082, expire: null, region: "keelung" },
    { id: 10, name: "基隆巿觀光導覽地圖", lat: 25.136808, lng: 121.747946, expire: null, region: "keelung" },
    { id: 11, name: "哨船頭德宮牌樓", lat: 25.135826, lng: 121.748652, expire: null, region: "keelung" },
    { id: 12, name: "中央健保署基隆辦事處", lat: 25.135001, lng: 121.746875, expire: null, region: "keelung" },
    { id: 13, name: "般若共修會", lat: 25.134084, lng: 121.746874, expire: null, region: "keelung" },
    { id: 14, name: "武極宮", lat: 25.133364, lng: 121.748047, expire: null, region: "keelung" },
    { id: 15, name: "基隆塔", lat: 25.132885, lng: 121.746799, expire: null, region: "keelung" },
    { id: 16, name: "基隆遠東教會", lat: 25.131992, lng: 121.746071, expire: null, region: "keelung" },
    { id: 17, name: "岸田吳服店後門舊址", lat: 25.131446, lng: 121.745895, expire: null, region: "keelung" },
    { id: 18, name: "基隆參議會牌樓", lat: 25.130548, lng: 121.745202, expire: null, region: "keelung" },
    { id: 19, name: "彰化銀行基隆分行", lat: 25.129133, lng: 121.744256, expire: null, region: "keelung" },
    { id: 20, name: "鹿", lat: 25.130126, lng: 121.746758, expire: null, region: "keelung" }
  ]
};

const extractSheetId = (input: string): string => {
  if (!input) return "";
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
};

const fetchSheetViaJSONP = (sheetId: string): Promise<Landmark[]> => {
  return new Promise((resolve, reject) => {
    const callbackName = `gviz_callback_${Math.round(Math.random() * 1000000)}`;
    const script = document.createElement("script");
    
    const cleanup = () => {
      delete (window as any)[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout loading Google Sheet via JSONP"));
    }, 8000);

    (window as any)[callbackName] = (data: any) => {
      clearTimeout(timeout);
      cleanup();
      
      try {
        if (!data || !data.table || !data.table.rows) {
          reject(new Error("Invalid JSONP response structure"));
          return;
        }

        const loadedLandmarks: Landmark[] = [];
        const rows = data.table.rows;
        
        let startIndex = 0;
        if (rows.length > 0 && rows[0] && rows[0].c && rows[0].c[0]) {
          const firstCellVal = String(rows[0].c[0].v || "").trim();
          if (firstCellVal !== "" && isNaN(Number(firstCellVal))) {
            startIndex = 1;
          }
        }
        
        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row.c) continue;
          
          const idVal = row.c[0]?.v;
          const nameVal = row.c[1]?.v;
          const latVal = row.c[2]?.v;
          const lngVal = row.c[3]?.v;
          const expireVal = row.c[4]?.v;
          const regionVal = row.c[5]?.v;

          if (idVal === undefined || idVal === null) continue;
          
          const id = typeof idVal === "number" ? idVal : parseInt(String(idVal).trim(), 10);
          const name = nameVal !== undefined && nameVal !== null ? String(nameVal).trim() : `大花 ${id}`;
          const lat = typeof latVal === "number" ? latVal : parseFloat(String(latVal));
          const lng = typeof lngVal === "number" ? lngVal : parseFloat(String(lngVal));
          const expire = expireVal !== undefined && expireVal !== null ? String(expireVal).trim() : null;
          const region = regionVal !== undefined && regionVal !== null ? String(regionVal).trim() : "keelung";

          if (isNaN(id) || isNaN(lat) || isNaN(lng)) continue;

          loadedLandmarks.push({
            id,
            name,
            lat,
            lng,
            expire: (expire === "null" || expire === "") ? null : expire,
            region
          });
        }
        
        resolve(loadedLandmarks);
      } catch (err) {
        reject(err);
      }
    };

    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=responseHandler:${callbackName}`;
    script.onerror = (err) => {
      clearTimeout(timeout);
      cleanup();
      reject(err);
    };
    document.body.appendChild(script);
  });
};

// Haversine formula to compute distance between two GPS coordinates in meters
const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
};

// Helper to get the leaf window of a flower (leaves last indefinitely until bloomed again)
const getLeafWindow = (flower: { expire?: string | null }, currentTimeMs: number) => {
  const expireTime = flower.expire ? new Date(flower.expire).getTime() : 0;
  if (expireTime > currentTimeMs) {
    // Currently blooming, will expire and become a leaf at expireTime
    return {
      start: expireTime,
      end: Infinity
    };
  } else {
    // Currently a leaf
    return {
      start: currentTimeMs,
      end: Infinity
    };
  }
};

// Helper to calculate earliest time at which at least 5 flowers in a circle are leaf simultaneously,
// with the condition that the difference between the first and last flower becoming a leaf does not exceed 20 minutes.
const getEarliestForceBloomTimeForCircle = (circleFlowers: any[], currentTimeMs: number) => {
  if (circleFlowers.length < 5) return Infinity;

  const starts = circleFlowers.map(f => {
    const expireTime = f.expire ? new Date(f.expire).getTime() : 0;
    return expireTime > currentTimeMs ? expireTime : currentTimeMs;
  }).sort((a, b) => a - b);

  let bestTime = Infinity;

  for (let i = 0; i <= starts.length - 5; i++) {
    const minStart = starts[i];
    const maxStart = starts[i + 4];

    if (maxStart - minStart <= 20 * 60 * 1000) {
      const earliestT = Math.max(currentTimeMs, maxStart);
      if (earliestT < bestTime) {
        bestTime = earliestT;
      }
    }
  }

  return bestTime;
};

export default function App() {
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  // User login/identity state
  const [userRole, setUserRole] = useState<"planting" | "force_bloom" | null>(() => {
    const saved = localStorage.getItem("user_role");
    return (saved === "planting" || saved === "force_bloom") ? saved : null;
  });
  const [mapReady, setMapReady] = useState(false);
  const [activeRegion] = useState("keelung");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortSelector, setSortSelector] = useState("id_asc");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Time ticker
  const [now, setNow] = useState(Date.now());

  // Toast
  const [toast, setToast] = useState<{ show: boolean; text: string }>({ show: false, text: "" });

  // Google SSO & sheet permission
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [hasEditPermission, setHasEditPermission] = useState(false);

  // Command panel
  const [commandInput, setCommandInput] = useState("");
  const [commandFeedback, setCommandFeedback] = useState("💡 具有編輯權限者輸入：[編號]/[小時]h[分鐘]m 可更新今天時間");

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGPXModal, setShowGPXModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showNavModal, setShowNavModal] = useState(false);
  const [navGoogleUrl, setNavGoogleUrl] = useState("");
  const [navAppleUrl, setNavAppleUrl] = useState("");
  const [navPath, setNavPath] = useState<{ id: number; name: string }[]>([]);
  const [isNavLocating, setIsNavLocating] = useState(false);

  // New Point Addition & Inline Row Editing states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLat, setAddLat] = useState("");
  const [addLng, setAddLng] = useState("");
  const [addExpire, setAddExpire] = useState("");

  const [inlineTimeEditId, setInlineTimeEditId] = useState<number | null>(null);
  const [inlineTimeVal, setInlineTimeVal] = useState("");

  // Form Fields inside Modals
  const [configClientId, setConfigClientId] = useState(DEFAULT_CLIENT_ID);
  const [configSheetId, setConfigSheetId] = useState(DEFAULT_SHEET_ID);
  const [configManualToken, setConfigManualToken] = useState("");

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editExpire, setEditExpire] = useState("");

  const [gpxText, setGpxText] = useState("");

  // Planner & Route Customizations
  const [navModalTab, setNavModalTab] = useState<"planting" | "force_bloom">("planting");
  const [selectedRole, setSelectedRole] = useState<"planting" | "force_bloom" | null>(null);

  const handleLoginSubmit = () => {
    if (!selectedRole) return;
    localStorage.setItem("user_role", selectedRole);
    setUserRole(selectedRole);
    setNavModalTab(selectedRole);
    showToast("🌸 歡迎使用基隆大花導航與精算系統！");
    playSynthChime();
  };
  const [plantingSpeed, setPlantingSpeed] = useState<number>(5); // 5 km/h for walking, 15 km/h for riding
  const [plantingTarget, setPlantingTarget] = useState<"leaf" | "all">("all");
  const [forceBloomTarget, setForceBloomTarget] = useState<"leaf" | "all">("all");
  const [selectedSuggestedSpot, setSelectedSuggestedSpot] = useState<{ lat: number; lng: number; coveredIds: number[] } | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  // Refs for Leaflet Map
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<number, any>>({});
  const suggestedSpotCircleRef = useRef<any>(null);
  const suggestedSpotMarkerRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);
  const isMapInitialized = useRef(false);

  // Synths (ToneJS)
  const synthRef = useRef<any>(null);
  const bubbleSynthRef = useRef<any>(null);

  useEffect(() => {
    // Clock tick
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize data on mount
  useEffect(() => {
    // 1. Configs
    const savedClientId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || DEFAULT_CLIENT_ID;
    const rawSheetId = localStorage.getItem(GOOGLE_SHEET_ID_KEY) || DEFAULT_SHEET_ID;
    const savedSheetId = extractSheetId(rawSheetId);
    const savedManualToken = localStorage.getItem(MANUAL_TOKEN_KEY) || "";

    setConfigClientId(savedClientId);
    setConfigSheetId(savedSheetId);
    setConfigManualToken(savedManualToken);

    // 2. Load Local Landmark Snapshot first
    const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}_master_list`);
    let initialLandmarks = PRESETS.keelung;
    if (stored) {
      try {
        initialLandmarks = JSON.parse(stored);
      } catch (e) {
        initialLandmarks = PRESETS.keelung;
      }
    }
    setLandmarks(initialLandmarks);

    // 4. Try authenticating with saved manual token or pull sheets
    if (savedManualToken) {
      setGoogleAccessToken(savedManualToken);
      handleSuccessfulLogin(savedManualToken, savedSheetId);
    } else {
      pullDataFromSheets(null, savedSheetId);
    }

    // 5. Initialize GSI client
    setTimeout(() => {
      initGoogleClient(savedClientId, savedSheetId);
    }, 800);
  }, []);

  // Separate map initialization effect to ensure it runs when mapContainer is actually mounted in the DOM
  useEffect(() => {
    if (userRole && typeof L !== 'undefined' && mapContainerRef.current && !isMapInitialized.current) {
      try {
        const initialCenter = [25.132, 121.745];
        const mapObj = L.map(mapContainerRef.current, { zoomControl: false }).setView(initialCenter, 14);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(mapObj);

        L.control.zoom({ position: 'bottomright' }).addTo(mapObj);
        mapRef.current = mapObj;
        isMapInitialized.current = true;
        setMapReady(true);

        // One-time centering on initial landmarks if available
        const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}_master_list`);
        let mapCenterPoints = PRESETS.keelung;
        if (stored) {
          try {
            mapCenterPoints = JSON.parse(stored);
          } catch (e) {}
        }
        const regionLandmarks = mapCenterPoints.filter(l => l.region === "keelung");
        if (regionLandmarks.length > 0) {
          const avgLat = regionLandmarks.reduce((acc, cur) => acc + cur.lat, 0) / regionLandmarks.length;
          const avgLng = regionLandmarks.reduce((acc, cur) => acc + cur.lng, 0) / regionLandmarks.length;
          mapObj.setView([avgLat, avgLng], 14);
        }
      } catch (err) {
        console.error("Failed to initialize Leaflet Map:", err);
      }
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (err) {
          console.error("Failed to remove map:", err);
        }
        mapRef.current = null;
        isMapInitialized.current = false;
        setMapReady(false);
      }
    };
  }, [userRole]);

  // Recalculate Leaflet map layout sizes when layout toggles between Simple and Editor
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 150);
    }
  }, [hasEditPermission]);

  // Synths ToneJS Setup
  const initSynth = () => {
    try {
      const ToneObj = typeof window !== 'undefined' ? (window as any).Tone : null;
      if (!ToneObj) return;
      if (!synthRef.current) {
        const poly = new ToneObj.PolySynth(ToneObj.Synth).toDestination();
        poly.set({
          oscillator: { type: "triangle" },
          envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 0.8 }
        });
        poly.volume.value = -14;
        synthRef.current = poly;
      }
      if (!bubbleSynthRef.current) {
        const mono = new ToneObj.MonoSynth({
          oscillator: { type: "sine" },
          filter: { Q: 2, type: "bandpass", frequency: 450 },
          envelope: { attack: 0.01, decay: 0.06, sustain: 0, release: 0.06 }
        }).toDestination();
        mono.volume.value = -8;
        bubbleSynthRef.current = mono;
      }
    } catch (e) {
      console.log("ToneJS Init Error", e);
    }
  };

  const playSynthChime = () => {
    if (!soundEnabled) return;
    try {
      initSynth();
      const ToneObj = (window as any).Tone;
      if (!ToneObj) return;
      if (ToneObj.context.state !== "running") ToneObj.start();
      const nowTime = ToneObj.now();
      if (synthRef.current) {
        synthRef.current.triggerAttackRelease("C5", "8n", nowTime);
        synthRef.current.triggerAttackRelease("E5", "8n", nowTime + 0.08);
        synthRef.current.triggerAttackRelease("G5", "8n", nowTime + 0.16);
      }
    } catch (e) { console.log(e); }
  };

  const playBubbleSound = () => {
    if (!soundEnabled) return;
    try {
      initSynth();
      const ToneObj = (window as any).Tone;
      if (!ToneObj) return;
      if (ToneObj.context.state !== "running") ToneObj.start();
      const nowTime = ToneObj.now();
      if (bubbleSynthRef.current) {
        bubbleSynthRef.current.triggerAttackRelease("G4", "16n", nowTime);
        bubbleSynthRef.current.triggerAttackRelease("C5", "16n", nowTime + 0.05);
      }
    } catch (e) { console.log(e); }
  };

  const playErrorBuzz = () => {
    if (!soundEnabled) return;
    try {
      initSynth();
      const ToneObj = (window as any).Tone;
      if (!ToneObj) return;
      if (ToneObj.context.state !== "running") ToneObj.start();
      const nowTime = ToneObj.now();
      if (synthRef.current) {
        synthRef.current.triggerAttackRelease("F2", "6n", nowTime);
      }
    } catch (e) { console.log(e); }
  };

  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    if (nextVal) {
      // play bubble after state transition has a small lag, so manually call
      setTimeout(() => {
        if (nextVal) playBubbleSound();
      }, 50);
    }
  };

  // Toast Helper
  const showToast = (text: string) => {
    setToast({ show: true, text });
  };

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ show: false, text: "" });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // Google GSI Authorization flow
  const tokenClientRef = useRef<any>(null);

  const initGoogleClient = (clientId: string, sheetId: string) => {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      return;
    }
    try {
      tokenClientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly',
        callback: async (resp: any) => {
          if (resp.error) {
            showToast("❌ 授權失敗：" + resp.error);
            playErrorBuzz();
            return;
          }
          setGoogleAccessToken(resp.access_token);
          showToast("🔑 授權成功！正在讀取並評估試算表存取狀態...");
          await handleSuccessfulLogin(resp.access_token, sheetId);
        }
      });
    } catch (e) {
      console.error("Popup block or SDK load exception", e);
    }
  };

  const startGoogleLogin = () => {
    if (typeof google === 'undefined') {
      showToast("⚠️ Google SDK 未載入，請確認廣告攔截狀態，或貼上手動 Token！");
      setShowConfigModal(true);
      return;
    }
    if (!tokenClientRef.current) {
      initGoogleClient(configClientId, configSheetId);
    }
    if (!tokenClientRef.current) {
      showToast("⚠️ 沙盒預覽限制，請在雲端設定手動輸入 Access Token。");
      setShowConfigModal(true);
      return;
    }
    try {
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    } catch (e) {
      showToast("❌ 彈出視窗異常，請在雲端設定進行手動調試！");
      setShowConfigModal(true);
    }
  };

  const handleSuccessfulLogin = async (accessToken: string, sheetId: string) => {
    // 1. Fetch user identity
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGoogleUserEmail(data.email || "Google 帳號");
      }
    } catch (e) {
      setGoogleUserEmail("雲端使用者");
    }

    // 2. Check sheets write permission
    let editable = false;
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}?fields=capabilities/canEdit`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        editable = data.capabilities?.canEdit || false;
        setHasEditPermission(editable);
        if (editable) {
          showToast("✅ 解鎖「Editor 編輯寫入權限」！變更會自動推送至雲端。");
          playSynthChime();
        } else {
          showToast("ℹ️ 您對該試算表僅有「Viewer 檢視權限」，無法修改數據。");
          playBubbleSound();
        }
      } else {
        setHasEditPermission(false);
      }
    } catch (e) {
      setHasEditPermission(false);
    }

    // 3. Pull data
    await pullDataFromSheets(accessToken, sheetId);
  };

  const performGoogleLogout = () => {
    setGoogleAccessToken(null);
    setGoogleUserEmail(null);
    setHasEditPermission(false);
    showToast("🚪 已登出 Google，回復免登入唯讀狀態！");
    playBubbleSound();
    localStorage.removeItem(MANUAL_TOKEN_KEY);
    setConfigManualToken("");
    // Reload local data
    const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}_master_list`);
    if (stored) {
      try {
        setLandmarks(JSON.parse(stored));
      } catch (e) {
        setLandmarks(PRESETS.keelung);
      }
    }
  };

  // Helper to center the map on the loaded landmarks' center of gravity
  const centerMapOnLandmarks = (loadedLandmarks: Landmark[]) => {
    if (!mapRef.current) return;
    const regionLandmarks = loadedLandmarks.filter(l => l.region === activeRegion);
    if (regionLandmarks.length > 0) {
      const avgLat = regionLandmarks.reduce((acc, cur) => acc + cur.lat, 0) / regionLandmarks.length;
      const avgLng = regionLandmarks.reduce((acc, cur) => acc + cur.lng, 0) / regionLandmarks.length;
      mapRef.current.setView([avgLat, avgLng], 14);
    }
  };

  // Pull spreadsheet data
  const pullDataFromSheets = async (accessToken: string | null, sheetId: string) => {
    if (!sheetId) {
      showToast("⚠️ 未設定 Google 試算表 ID");
      return;
    }

    showToast("🔄 正在載入雲端試算表...");

    // Try reading via public JSONP format (No auth required, bypasses CORS perfectly) if no accessToken
    if (!accessToken) {
      try {
        const loadedLandmarks = await fetchSheetViaJSONP(sheetId);
        if (loadedLandmarks && loadedLandmarks.length > 0) {
          setLandmarks(loadedLandmarks);
          localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}_master_list`, JSON.stringify(loadedLandmarks));
          centerMapOnLandmarks(loadedLandmarks);
          showToast("📥 免登入唯讀載入完成！");
          playSynthChime();
          return;
        }
      } catch (e) {
        console.error("Public JSONP read failed, trying CSV export fallback", e);
        try {
          const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
          const response = await fetch(csvUrl);
          if (response.ok) {
            const csvText = await response.text();
            const rows = parseCSV(csvText);

            if (rows && rows.length > 0) {
              let startIndex = 0;
              if (rows[0] && rows[0][0]) {
                const firstCellVal = String(rows[0][0]).trim();
                if (firstCellVal !== "" && isNaN(Number(firstCellVal))) {
                  startIndex = 1;
                }
              }

              const loadedLandmarks: Landmark[] = [];
              for (let i = startIndex; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length < 4 || !row[0]) continue;
                const lat = parseFloat(row[2]);
                const lng = parseFloat(row[3]);
                if (isNaN(lat) || isNaN(lng)) continue;

                loadedLandmarks.push({
                  id: parseInt(row[0].trim(), 10),
                  name: row[1] ? row[1].trim() : `大花 ${row[0]}`,
                  lat: lat,
                  lng: lng,
                  expire: row[4] && row[4].trim() !== "null" && row[4].trim() !== "" ? row[4].trim() : null,
                  region: row[5] ? row[5].trim() : "keelung"
                });
              }
              if (loadedLandmarks.length > 0) {
                setLandmarks(loadedLandmarks);
                localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}_master_list`, JSON.stringify(loadedLandmarks));
                centerMapOnLandmarks(loadedLandmarks);
                showToast("📥 免登入唯讀載入完成！");
                playSynthChime();
                return;
              }
            }
          }
        } catch (csvErr) {
          console.error("Public CSV read failed, falling back to REST API", csvErr);
        }
      }
    }

    // Google Sheets REST API
    const fetchHeaders: Record<string, string> = {};
    if (accessToken) {
      fetchHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties/title)`, {
        headers: fetchHeaders
      });

      let targetSheetName = "Sheet1";
      if (metaResponse.ok) {
        const metaData = await metaResponse.json();
        if (metaData.sheets && metaData.sheets.length > 0) {
          targetSheetName = metaData.sheets[0].properties.title;
        }
      }

      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(targetSheetName)}!A1:F500`, {
        headers: fetchHeaders
      });

      if (response.ok) {
        const data = await response.json();
        const rows = data.values;
        
        if (!rows || rows.length === 0) {
          if (accessToken) {
            showToast("🌱 雲端為空！正在自動初始化預設大花點位...");
            await initializeSpreadsheetDefault(accessToken, sheetId, targetSheetName);
          } else {
            showToast("⚠️ 雲端試算表無資料且無寫入權限！");
          }
          return;
        }

        let startIndex = 0;
        if (rows[0] && rows[0][0]) {
          const firstCellVal = String(rows[0][0]).trim();
          if (firstCellVal !== "" && isNaN(Number(firstCellVal))) {
            startIndex = 1;
          }
        }

        const loadedLandmarks: Landmark[] = [];
        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 4 || !row[0]) continue;
          const lat = parseFloat(row[2]);
          const lng = parseFloat(row[3]);
          if (isNaN(lat) || isNaN(lng)) continue;

          loadedLandmarks.push({
            id: parseInt(row[0], 10),
            name: row[1] || `大花 ${row[0]}`,
            lat: lat,
            lng: lng,
            expire: row[4] && row[4] !== "null" ? row[4] : null,
            region: row[5] || "keelung"
          });
        }

        setLandmarks(loadedLandmarks);
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}_master_list`, JSON.stringify(loadedLandmarks));
        centerMapOnLandmarks(loadedLandmarks);
        showToast("📥 雲端資料同步完成！");
        playSynthChime();
      } else {
        showToast("⚠️ 雲端讀取失敗。請確認：1.已設為「任何人皆可檢視」 2.試算表 ID 正確");
        playErrorBuzz();
      }
    } catch (e) {
      showToast("⚠️ 連線至 Google API 失敗，請確認網路與權限並重試");
      playErrorBuzz();
    }
  };

  // Helper for manual parsing CSV
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i+1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') { i++; }
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(row);
    }
    return lines;
  };

  // Initialize spreadsheet with presets
  const initializeSpreadsheetDefault = async (accessToken: string, sheetId: string, sheetName: string) => {
    const defaultList = PRESETS.keelung;
    setLandmarks(defaultList);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}_master_list`, JSON.stringify(defaultList));

    const rows = [["ID", "Name", "Lat", "Lng", "Expire", "Region"]];
    defaultList.forEach(item => {
      rows.push([item.id.toString(), item.name, item.lat.toString(), item.lng.toString(), "null", item.region]);
    });

    try {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A1:F${rows.length}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rows })
      });
    } catch(e) {
      console.error(e);
    }
  };

  // Save/Push data to Cloud Sheet
  const pushDataToSheets = async (updatedLandmarks: Landmark[]) => {
    setLandmarks(updatedLandmarks);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}_master_list`, JSON.stringify(updatedLandmarks));

    if (!googleAccessToken || !hasEditPermission) return;

    try {
      const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${configSheetId}?fields=sheets(properties/title)`, {
        headers: { 'Authorization': `Bearer ${googleAccessToken}` }
      });
      let targetSheetName = "Sheet1";
      if (metaResponse.ok) {
        const metaData = await metaResponse.json();
        if (metaData.sheets && metaData.sheets.length > 0) {
          targetSheetName = metaData.sheets[0].properties.title;
        }
      }

      const rows: any[][] = [["ID", "Name", "Lat", "Lng", "Expire", "Region"]];
      updatedLandmarks.forEach(item => {
        rows.push([
          item.id,
          item.name,
          item.lat,
          item.lng,
          item.expire ? item.expire : "null",
          item.region
        ]);
      });

      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${configSheetId}/values/${encodeURIComponent(targetSheetName)}!A1:F${rows.length}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rows })
      });

      if (response.ok) {
        showToast("☁️ 資料成功儲存並上傳雲端！");
      } else {
        showToast("⚠️ 雲端寫入遭拒絕。請確認寫入權限");
      }
    } catch (e) {
      showToast("⚠️ 連線異常，僅存入本地暫存");
    }
  };

  // Core calculations for updateTable, cluster and planting recommendation
  const regionPoints = landmarks.filter(l => l.region === activeRegion);
  const bloomingFlowers = regionPoints
    .filter(l => l.expire && new Date(l.expire).getTime() > now)
    .map(l => ({
      ...l,
      expireTime: new Date(l.expire!).getTime()
    }))
    .sort((a, b) => a.expireTime - b.expireTime);

  const clusterIds = new Set<number>();
  let recommendedPlantingTime = "無建議時間";

  if (userRole === "planting") {
    // Planting mode: find the earliest starting time S for sequentially planting at least 5 flowers.
    // Include all region points, treating leaves as expired at `now`.
    const allRegionPointsWithTime = regionPoints.map(l => {
      const window = getLeafWindow(l, now);
      return {
        ...l,
        windowStart: window.start,
        windowEnd: window.end
      };
    }).sort((a, b) => a.windowStart - b.windowStart);

    if (allRegionPointsWithTime.length < 5) {
      recommendedPlantingTime = "本區花點不足 5 朵";
    } else {
      const getBestStartTimeFor5 = (flowers: typeof allRegionPointsWithTime) => {
        // Generate all 120 permutations of 5 elements
        const perms: number[][] = [];
        const generatePerms = (current: number[], remaining: number[]) => {
          if (remaining.length === 0) {
            perms.push(current);
            return;
          }
          for (let i = 0; i < remaining.length; i++) {
            generatePerms([...current, remaining[i]], remaining.filter((_, idx) => idx !== i));
          }
        };
        generatePerms([], [0, 1, 2, 3, 4]);

        let bestSStartForGroup = Infinity;
        const speedMps = (plantingSpeed * 1000) / 3600;

        for (const perm of perms) {
          let currentSMin = -Infinity;
          let currentSMax = Infinity;
          let accumulatedTravelTime = 0;

          for (let j = 0; j < 5; j++) {
            const currFlower = flowers[perm[j]];
            
            if (j > 0) {
              const prevFlower = flowers[perm[j - 1]];
              const dist = getDistance(prevFlower.lat, prevFlower.lng, currFlower.lat, currFlower.lng);
              accumulatedTravelTime += dist / speedMps;
            }
            
            const plantingDelaySec = j * 6 * 60; // 6 mins per flower in seconds
            const delayMs = (plantingDelaySec + accumulatedTravelTime) * 1000;
            
            const sMinForThis = currFlower.windowStart - delayMs;
            const sMaxForThis = currFlower.windowEnd - delayMs;

            if (sMinForThis > currentSMin) {
              currentSMin = sMinForThis;
            }
            if (sMaxForThis < currentSMax) {
              currentSMax = sMaxForThis;
            }
          }

          // Total duration of the planting route (30 mins of planting + travel time)
          const totalDurationSec = (5 * 6 * 60) + accumulatedTravelTime;
          if (totalDurationSec > 90 * 60) {
            continue; // Strictly reject permutations exceeding 90 minutes
          }

          const earliestValidS = Math.max(now, currentSMin);
          if (earliestValidS <= currentSMax) {
            if (earliestValidS < bestSStartForGroup) {
              bestSStartForGroup = earliestValidS;
            }
          }
        }

        return bestSStartForGroup;
      };

      let bestStartTime = Infinity;
      let bestGroup: typeof allRegionPointsWithTime = [];

      // Loop over all contiguous groups of 5 in sorted order
      for (let i = 0; i <= allRegionPointsWithTime.length - 5; i++) {
        const group = allRegionPointsWithTime.slice(i, i + 5);
        const minSStart = getBestStartTimeFor5(group);
        if (minSStart < bestStartTime) {
          bestStartTime = minSStart;
          bestGroup = group;
        }
      }

      // Populate clusterIds with the best group's IDs
      bestGroup.forEach(f => clusterIds.add(f.id));

      if (bestStartTime === Infinity) {
        recommendedPlantingTime = "無符合(或總時間超90分)之5花點路線";
      } else if (bestStartTime <= now) {
        recommendedPlantingTime = "可立即出發 (滿足5花點)";
      } else {
        const dateObj = new Date(bestStartTime);
        const dateStr = `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}`;
        const timeStr = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
        recommendedPlantingTime = `${dateStr} ${timeStr} (5花點同種最佳時間)`;
      }
    }
  } else if (userRole === "force_bloom") {
    // Force bloom mode: find the earliest time we have at least 5 leaves in a 500m radius circle.
    let bestForceBloomTime = Infinity;
    let bestCircleFlowers: typeof regionPoints = [];

    for (const seed of regionPoints) {
      // Find all region points within 500m of seed
      const nearby = regionPoints.filter(t => getDistance(seed.lat, seed.lng, t.lat, t.lng) <= 500);
      if (nearby.length >= 5) {
        const earliestForThis = getEarliestForceBloomTimeForCircle(nearby, now);
        if (earliestForThis < bestForceBloomTime) {
          bestForceBloomTime = earliestForThis;
          bestCircleFlowers = nearby;
        }
      }
    }

    // Populate clusterIds with flowers in the best force-bloom circle
    bestCircleFlowers.forEach(f => clusterIds.add(f.id));

    if (bestForceBloomTime === Infinity) {
      recommendedPlantingTime = "無符合 5 花點之駐點";
    } else if (bestForceBloomTime <= now) {
      recommendedPlantingTime = "可立即強開 (滿足5花點)";
    } else {
      const dateObj = new Date(bestForceBloomTime);
      const dateStr = `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}`;
      const timeStr = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
      recommendedPlantingTime = `${dateStr} ${timeStr} (駐點滿5花時間)`;
    }
  }

  const isClusterCheckbox = statusFilter === "cluster";

  const handleClusterCheckboxChange = (checked: boolean) => {
    setStatusFilter(checked ? "cluster" : "all");
  };

  const skipNavGeolocation = () => {
    const activeClusterPoints = processedPoints.filter(p => p.region === activeRegion && p.isClusterMember);
    if (activeClusterPoints.length === 0) return;

    const path = [...activeClusterPoints].sort((a, b) => a.id - b.id);
    const origin = `${path[0].lat},${path[0].lng}`;
    const destination = `${path[path.length - 1].lat},${path[path.length - 1].lng}`;
    
    let waypoints = "";
    if (path.length > 2) {
      const intermediate = path.slice(1, path.length - 1);
      waypoints = intermediate.map(p => `${p.lat},${p.lng}`).join("|");
    }
    
    let gUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) {
      gUrl += `&waypoints=${encodeURIComponent(waypoints)}`;
    }
    gUrl += `&travelmode=driving`;

    const aUrl = `https://maps.apple.com/?saddr=${origin}&daddr=${origin}&dirflg=d`;

    setNavGoogleUrl(gUrl);
    setNavAppleUrl(aUrl);
    setNavPath(path.map(p => ({ id: p.id, name: p.name })));
    setIsNavLocating(false);
    showToast("🚗 已改用首站為起點規劃導航！");
    playSynthChime();
  };

  const getMultiplePlantingRoutes = () => {
    // Filter target landmarks based on user selection ("leaf" or "all")
    const targets = processedPoints.filter(p => {
      if (p.region !== activeRegion) return false;
      if (plantingTarget === "leaf") {
        return !p.isBlooming; // only leaves
      }
      return true; // all
    });

    if (targets.length === 0) {
      return [];
    }

    // We want to partition the targets into separate sequential routes of at least 5 flowers each.
    // Let's copy targets and work on a mutable list of unassigned targets
    let unassigned = [...targets];
    const routes: {
      path: typeof targets;
      totalDistance: number;
      totalTravelTime: number;
      totalPlantingTime: number;
      totalDuration: number;
      steps: {
        type: "start" | "move";
        landmark: typeof targets[0];
        distance?: number;
        travelTime?: number;
      }[];
      recommendedStartTime: string;
      startTimeMs: number;
    }[] = [];

    const speedMps = (plantingSpeed * 1000) / 3600;

    // Helper to calculate route details for a given ordered path
    const calculateRouteDetails = (path: typeof targets) => {
      let totalDistance = 0;
      const steps: {
        type: "start" | "move";
        landmark: typeof targets[0];
        distance?: number;
        travelTime?: number;
      }[] = [];

      steps.push({
        type: "start",
        landmark: path[0]
      });

      for (let i = 1; i < path.length; i++) {
        const d = getDistance(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
        totalDistance += d;
        const tTime = d / speedMps;
        steps.push({
          type: "move",
          landmark: path[i],
          distance: d,
          travelTime: tTime
        });
      }

      const totalTravelTime = totalDistance / speedMps;
      const totalPlantingTime = path.length * 6 * 60; // 6 mins per flower in seconds
      const totalDuration = totalTravelTime + totalPlantingTime;

      let currentSMin = -Infinity;
      let currentSMax = Infinity;
      let accumulatedTravelTime = 0;

      for (let j = 0; j < path.length; j++) {
        const currFlower = path[j];
        const window = getLeafWindow(currFlower, now);
        
        if (j > 0) {
          const prevFlower = path[j - 1];
          const dist = getDistance(prevFlower.lat, prevFlower.lng, currFlower.lat, currFlower.lng);
          accumulatedTravelTime += dist / speedMps;
        }
        
        const plantingDelaySec = j * 6 * 60; // 6 mins per flower in seconds
        const delayMs = (plantingDelaySec + accumulatedTravelTime) * 1000;
        
        const sMinForThis = window.start - delayMs;
        const sMaxForThis = window.end - delayMs;

        if (sMinForThis > currentSMin) {
          currentSMin = sMinForThis;
        }
        if (sMaxForThis < currentSMax) {
          currentSMax = sMaxForThis;
        }
      }

      let recommendedStartTime = "無符合時間的路線";
      let startTimeMs = Infinity;

      if (totalDuration > 90 * 60) {
        recommendedStartTime = "總時間超過 90 分鐘上限 (請切換交通工具)";
      } else {
        const earliestValidS = Math.max(now, currentSMin);
        if (earliestValidS <= currentSMax) {
          startTimeMs = earliestValidS;
          if (earliestValidS <= now) {
            recommendedStartTime = "可立即出發";
          } else {
            const dateObj = new Date(earliestValidS);
            const dateStr = `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}`;
            recommendedStartTime = `${dateStr} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')} 出發`;
          }
        }
      }

      return {
        path,
        totalDistance,
        totalTravelTime,
        totalPlantingTime,
        totalDuration,
        steps,
        recommendedStartTime,
        startTimeMs
      };
    };

    // Partition unassigned targets into routes of size 5
    while (unassigned.length >= 5) {
      // Find starting point (prioritize earliest expire time among blooming, or first unassigned)
      let startIdx = 0;
      let earliestExpire = Infinity;
      for (let i = 0; i < unassigned.length; i++) {
        const exp = unassigned[i].expire ? new Date(unassigned[i].expire!).getTime() : Infinity;
        if (exp < earliestExpire) {
          earliestExpire = exp;
          startIdx = i;
        }
      }

      const path: typeof targets = [];
      let curr = unassigned[startIdx];
      path.push(curr);
      unassigned.splice(startIdx, 1);

      // Greedily find the nearest 4 unassigned neighbors
      for (let k = 0; k < 4; k++) {
        if (unassigned.length === 0) break;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < unassigned.length; i++) {
          const d = getDistance(curr.lat, curr.lng, unassigned[i].lat, unassigned[i].lng);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        curr = unassigned[bestIdx];
        path.push(curr);
        unassigned.splice(bestIdx, 1);
      }

      // Calculate details and add
      routes.push(calculateRouteDetails(path));
    }

    // If there are left-over targets (fewer than 5) and we already have at least one route:
    // Append each remaining target to its nearest route end/start point.
    if (unassigned.length > 0 && routes.length > 0) {
      while (unassigned.length > 0) {
        const item = unassigned[0];
        let bestRouteIdx = 0;
        let bestDist = Infinity;
        let appendTo = "end"; // or "start"

        for (let r = 0; r < routes.length; r++) {
          const routePath = routes[r].path;
          const startPt = routePath[0];
          const endPt = routePath[routePath.length - 1];
          
          const distToStart = getDistance(item.lat, item.lng, startPt.lat, startPt.lng);
          const distToEnd = getDistance(item.lat, item.lng, endPt.lat, endPt.lng);

          if (distToStart < bestDist) {
            bestDist = distToStart;
            bestRouteIdx = r;
            appendTo = "start";
          }
          if (distToEnd < bestDist) {
            bestDist = distToEnd;
            bestRouteIdx = r;
            appendTo = "end";
          }
        }

        // Insert/append the item to the best route
        const targetRoute = routes[bestRouteIdx];
        let newPath = [...targetRoute.path];
        if (appendTo === "start") {
          newPath.unshift(item);
        } else {
          newPath.push(item);
        }

        // Re-calculate the route details
        routes[bestRouteIdx] = calculateRouteDetails(newPath);
        unassigned.splice(0, 1);
      }
    } else if (unassigned.length > 0 && routes.length === 0) {
      // If total targets < 5, just put them all into a single route of length < 5
      routes.push(calculateRouteDetails(unassigned));
    }

    // Sort routes by recommended startTime (earliest first)
    return routes.sort((a, b) => a.startTimeMs - b.startTimeMs);
  };

  const getMultipleForceBloomRoutes = () => {
    const targets = processedPoints.filter(p => {
      if (p.region !== activeRegion) return false;
      if (forceBloomTarget === "leaf") {
        return !p.isBlooming; // only leaves
      }
      return true; // all
    });

    if (targets.length === 0) return [];

    const spots: {
      lat: number;
      lng: number;
      coveredIds: number[];
      coveredNames: string[];
      maxDist: number;
      recommendedStartTime: string;
      startTimeMs: number;
      totalDuration: number; // 30 mins
      flowersCount: number;
    }[] = [];
    let uncovered = [...targets];

    while (uncovered.length > 0 && spots.length < ROUTE_COLORS.length) {
      let bestCandidate: typeof spots[0] | null = null;
      let maxNewCoveredCount = 0;

      for (const seed of targets) {
        const nearby = targets.filter(t => getDistance(seed.lat, seed.lng, t.lat, t.lng) <= 500);
        if (nearby.length === 0) continue;

        // Centroid
        const sumLat = nearby.reduce((acc, p) => acc + p.lat, 0);
        const sumLng = nearby.reduce((acc, p) => acc + p.lng, 0);
        const cLat = sumLat / nearby.length;
        const cLng = sumLng / nearby.length;

        const coveredByCentroid = targets.filter(t => getDistance(cLat, cLng, t.lat, t.lng) <= 500);
        const newlyCovered = coveredByCentroid.filter(t => uncovered.some(u => u.id === t.id));

        if (newlyCovered.length > maxNewCoveredCount) {
          let maxDist = 0;
          coveredByCentroid.forEach(t => {
            const d = getDistance(cLat, cLng, t.lat, t.lng);
            if (d > maxDist) maxDist = d;
          });

          const bestForceBloomTime = getEarliestForceBloomTimeForCircle(coveredByCentroid, now);

          let recommendedStartTime = "無符合 5 花點之駐點";
          if (bestForceBloomTime !== Infinity) {
            if (bestForceBloomTime <= now) {
              recommendedStartTime = "可立即強開";
            } else {
              const dateObj = new Date(bestForceBloomTime);
              const dateStr = `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}`;
              recommendedStartTime = `${dateStr} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')} 強開`;
            }
          }

          maxNewCoveredCount = newlyCovered.length;
          bestCandidate = {
            lat: cLat,
            lng: cLng,
            coveredIds: coveredByCentroid.map(t => t.id),
            coveredNames: coveredByCentroid.map(t => t.name),
            maxDist,
            recommendedStartTime,
            startTimeMs: bestForceBloomTime,
            totalDuration: 30 * 60, // 30 mins in seconds
            flowersCount: coveredByCentroid.length
          };
        }
      }

      if (bestCandidate && maxNewCoveredCount > 0) {
        spots.push(bestCandidate);
        const coveredIdsSet = new Set(bestCandidate.coveredIds);
        uncovered = uncovered.filter(u => !coveredIdsSet.has(u.id));
      } else {
        break;
      }
    }

    // Filter to only those covering at least 5 flowers
    return spots.filter(s => s.coveredIds.length >= 5).sort((a, b) => a.startTimeMs - b.startTimeMs);
  };

  const handleExportSelectedRoute = () => {
    // 1. Get all active cluster/featured points
    const activeClusterPoints = processedPoints.filter(p => p.region === activeRegion && p.isClusterMember);
    
    if (activeClusterPoints.length === 0) {
      showToast("⚠️ 目前無精選點位（最少5花點內之點位）！");
      playErrorBuzz();
      return;
    }

    setNavGoogleUrl("");
    setNavAppleUrl("");
    setNavPath([]);
    setIsNavLocating(true);
    setShowNavModal(true);
    playSynthChime();

    // Nearest Neighbor solver
    const solveTSP = (points: typeof activeClusterPoints, startLat?: number, startLng?: number) => {
      const remaining = [...points];
      const path: typeof activeClusterPoints = [];
      
      let currLat = startLat !== undefined ? startLat : points[0].lat;
      let currLng = startLng !== undefined ? startLng : points[0].lng;
      
      if (startLat === undefined && startLng === undefined) {
        path.push(remaining[0]);
        remaining.splice(0, 1);
      }
      
      while (remaining.length > 0) {
        let bestIndex = 0;
        let bestDist = Infinity;
        
        for (let i = 0; i < remaining.length; i++) {
          const dy = remaining[i].lat - currLat;
          const dx = remaining[i].lng - currLng;
          const dist = dy * dy + dx * dx;
          if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
          }
        }
        
        const nextPt = remaining[bestIndex];
        path.push(nextPt);
        currLat = nextPt.lat;
        currLng = nextPt.lng;
        remaining.splice(bestIndex, 1);
      }
      
      return path;
    };

    const buildUrlsAndSet = (path: typeof activeClusterPoints, startLat?: number, startLng?: number) => {
      if (path.length === 0) return;
      
      // Google Maps
      const gOrigin = startLat !== undefined ? `${startLat},${startLng}` : `${path[0].lat},${path[0].lng}`;
      const gDestination = `${path[path.length - 1].lat},${path[path.length - 1].lng}`;
      
      let gWaypoints = "";
      if (startLat !== undefined) {
        if (path.length > 1) {
          const intermediate = path.slice(0, path.length - 1);
          gWaypoints = intermediate.map(p => `${p.lat},${p.lng}`).join("|");
        }
      } else {
        if (path.length > 2) {
          const intermediate = path.slice(1, path.length - 1);
          gWaypoints = intermediate.map(p => `${p.lat},${p.lng}`).join("|");
        }
      }
      
      let gUrl = `https://www.google.com/maps/dir/?api=1&origin=${gOrigin}&destination=${gDestination}`;
      if (gWaypoints) {
        gUrl += `&waypoints=${encodeURIComponent(gWaypoints)}`;
      }
      gUrl += `&travelmode=driving`;

      // Apple Maps
      const aOrigin = startLat !== undefined ? `${startLat},${startLng}` : `${path[0].lat},${path[0].lng}`;
      const aDestination = `${path[0].lat},${path[0].lng}`;
      let aUrl = `https://maps.apple.com/?saddr=${aOrigin}&daddr=${aDestination}&dirflg=d`;

      setNavGoogleUrl(gUrl);
      setNavAppleUrl(aUrl);
      setNavPath(path.map(p => ({ id: p.id, name: p.name })));
      setIsNavLocating(false);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          const path = solveTSP(activeClusterPoints, userLat, userLng);
          buildUrlsAndSet(path, userLat, userLng);
          showToast("🚗 已自動為您規劃含目前位置的最佳導航！");
        },
        (err) => {
          console.warn("Geolocation failed or denied", err);
          const path = solveTSP(activeClusterPoints);
          buildUrlsAndSet(path);
          showToast("⚠️ 定位失敗，已為您改用首站起點之導航規劃！");
        },
        { timeout: 3500, enableHighAccuracy: true }
      );
    } else {
      const path = solveTSP(activeClusterPoints);
      buildUrlsAndSet(path);
    }
  };

  // Full dataset with status tags
  const processedPoints = regionPoints.map(item => {
    const isBlooming = item.expire && new Date(item.expire).getTime() > now;
    let statusKey = 'leaf';
    let remainingSecs = 0;

    if (isBlooming) {
      const expTime = new Date(item.expire!).getTime();
      remainingSecs = Math.max(0, Math.floor((expTime - now) / 1000));
      const remainingHours = remainingSecs / 3600;

      if (remainingHours > 22) {
        statusKey = 'ribbon';
      } else if (remainingHours < 1) {
        statusKey = 'dying';
      } else {
        statusKey = 'blooming';
      }
    } else if (item.expire) {
      const expTime = new Date(item.expire).getTime();
      const elapsedMs = now - expTime;
      if (elapsedMs >= 15 * 60 * 1000) {
        statusKey = 'pending_report';
      }
    }

    const isClusterMember = clusterIds.has(item.id);

    return {
      ...item,
      isBlooming,
      statusKey,
      remainingSecs,
      isClusterMember
    };
  });

  // Apply filters
  const filteredPoints = processedPoints.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.id.toString() === searchTerm;
    
    let matchesStatus = true;
    if (statusFilter === 'ribbon') {
      matchesStatus = (item.statusKey === 'ribbon');
    } else if (statusFilter === 'blooming_only') {
      matchesStatus = (item.statusKey === 'blooming' || item.statusKey === 'ribbon' || item.statusKey === 'dying');
    } else if (statusFilter === 'dying_only') {
      matchesStatus = (item.statusKey === 'dying');
    } else if (statusFilter === 'leaf') {
      matchesStatus = (item.statusKey === 'leaf');
    } else if (statusFilter === 'pending_report') {
      matchesStatus = (item.statusKey === 'pending_report');
    } else if (statusFilter === 'cluster') {
      matchesStatus = item.isClusterMember;
    }

    return matchesSearch && matchesStatus;
  });

  // Sorting
  const sortedPoints = [...filteredPoints].sort((a, b) => {
    const activeSort = hasEditPermission ? sortSelector : 'time_asc';
    if (activeSort === 'id_asc') {
      return a.id - b.id;
    } else if (activeSort === 'id_desc') {
      return b.id - a.id;
    } else if (activeSort === 'time_asc') {
      if (!a.isBlooming && b.isBlooming) return 1;
      if (a.isBlooming && !b.isBlooming) return -1;
      if (!a.isBlooming && !b.isBlooming) {
        if (a.statusKey === 'pending_report' && b.statusKey !== 'pending_report') return -1;
        if (a.statusKey !== 'pending_report' && b.statusKey === 'pending_report') return 1;
        return a.id - b.id;
      }
      return a.remainingSecs - b.remainingSecs;
    } else if (activeSort === 'time_desc') {
      if (!a.isBlooming && b.isBlooming) return 1;
      if (a.isBlooming && !b.isBlooming) return -1;
      if (!a.isBlooming && !b.isBlooming) {
        if (a.statusKey === 'pending_report' && b.statusKey !== 'pending_report') return -1;
        if (a.statusKey !== 'pending_report' && b.statusKey === 'pending_report') return 1;
        return a.id - b.id;
      }
      return b.remainingSecs - a.remainingSecs;
    } else if (activeSort === 'name_asc') {
      return a.name.localeCompare(b.name, 'zh-Hant');
    }
    return 0;
  });

  // Keep map markers in sync with processedPoints and active status
  useEffect(() => {
    if (!mapRef.current || typeof L === 'undefined') return;

    // Clear old markers
    for (let key in markersRef.current) {
      mapRef.current.removeLayer(markersRef.current[key]);
    }
    markersRef.current = {};

    // Clear old polylines & circles
    polylinesRef.current.forEach(layer => mapRef.current.removeLayer(layer));
    polylinesRef.current = [];
    circlesRef.current.forEach(layer => mapRef.current.removeLayer(layer));
    circlesRef.current = [];

    // Map each landmark ID to its route color for visual linking
    const routeColorMap: Record<number, typeof ROUTE_COLORS[0]> = {};
    if (userRole === "planting") {
      const routes = getMultiplePlantingRoutes();
      routes.forEach((route, rIdx) => {
        const colorInfo = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
        route.path.forEach(p => {
          routeColorMap[p.id] = colorInfo;
        });
      });
    } else if (userRole === "force_bloom") {
      const spots = getMultipleForceBloomRoutes();
      spots.forEach((spot, sIdx) => {
        const colorInfo = ROUTE_COLORS[sIdx % ROUTE_COLORS.length];
        spot.coveredIds.forEach(id => {
          routeColorMap[id] = colorInfo;
        });
      });
    }

    processedPoints.forEach((item) => {
      // Only render marker on map if it matches current search & filter criteria for high consistency
      const isSearchMatched = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.id.toString() === searchTerm;
      let isFilterMatched = true;
      if (statusFilter === 'ribbon') isFilterMatched = (item.statusKey === 'ribbon');
      else if (statusFilter === 'blooming_only') isFilterMatched = item.isBlooming;
      else if (statusFilter === 'dying_only') isFilterMatched = (item.statusKey === 'dying');
      else if (statusFilter === 'leaf') isFilterMatched = (item.statusKey === 'leaf');
      else if (statusFilter === 'pending_report') isFilterMatched = (item.statusKey === 'pending_report');
      else if (statusFilter === 'cluster') isFilterMatched = item.isClusterMember;

      if (!isSearchMatched || !isFilterMatched) return;

      let markerHtml = '';
      const routeColor = routeColorMap[item.id];
      const isRouteMember = !!routeColor;

      if (item.isBlooming) {
        const remainingHours = item.remainingSecs / 3600;
        let pulseClass = "pulse-pink";
        let emoji = "🌸";
        
        if (isRouteMember) {
          pulseClass = "pulse-amber";
          emoji = "👑";
        } else if (item.isClusterMember) {
          pulseClass = "pulse-amber";
          emoji = "👑";
        } else if (remainingHours > 22) {
          pulseClass = "pulse-cyan";
          emoji = "🎀";
        } else if (remainingHours < 1) {
          pulseClass = "pulse-amber";
          emoji = "⚠️";
        }

        // Highlight route membership or cluster visually
        const clusterIndicator = isRouteMember ? 'border-solid scale-110 shadow-lg' : (item.isClusterMember ? 'border-amber-400 border-solid scale-110 shadow-lg shadow-amber-500/50' : 'border-white');
        const customStyle = isRouteMember ? `border-color: ${routeColor.hex}; border-width: 3px;` : '';

        markerHtml = `
          <div class="flex flex-col items-center justify-center">
            <div class="${pulseClass} w-7 h-7 flex items-center justify-center text-white text-[12px] shadow-md font-bold border-2 ${clusterIndicator}" style="${customStyle}">
              ${emoji}
            </div>
            <div class="bg-slate-950/90 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-full shadow-lg mt-1 border border-pink-400 whitespace-nowrap">
              #${item.id} ${item.name} ${isRouteMember ? '👑' : (item.isClusterMember ? '👑' : '')}
            </div>
          </div>
        `;
      } else if (item.statusKey === 'pending_report') {
        const elapsedMins = Math.floor((now - new Date(item.expire!).getTime()) / 60000);
        const clusterIndicator = isRouteMember ? 'border-solid scale-110 shadow-lg' : 'border-orange-400';
        const customStyle = isRouteMember ? `border-color: ${routeColor.hex}; border-width: 3px;` : '';

        markerHtml = `
          <div class="flex flex-col items-center justify-center">
            <div class="pulse-orange w-7 h-7 flex items-center justify-center text-white text-[12px] shadow-md font-bold border-2 ${clusterIndicator}" style="${customStyle}">
              📝
            </div>
            <div class="bg-slate-950/90 text-orange-400 font-extrabold text-[9px] px-1.5 py-0.5 rounded-full shadow-lg mt-1 border border-orange-500 whitespace-nowrap animate-pulse">
              #${item.id} 等待回報 (${elapsedMins}m)
            </div>
          </div>
        `;
      } else {
        const clusterIndicator = isRouteMember ? 'border-solid scale-110' : 'border-slate-500';
        const customStyle = isRouteMember ? `border-color: ${routeColor.hex}; border-width: 2.5px; opacity: 1;` : '';

        markerHtml = `
          <div class="flex flex-col items-center justify-center ${isRouteMember ? '' : 'opacity-60'}">
            <div class="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-white text-[10px] shadow border ${clusterIndicator}" style="${customStyle}">
              🍃
            </div>
            <div class="bg-slate-900 text-slate-400 font-semibold text-[9px] px-1 py-0.5 rounded-full shadow-sm mt-1 border border-slate-700 whitespace-nowrap">
              #${item.id}
            </div>
          </div>
        `;
      }

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-div-icon',
        iconSize: [30, 42],
        iconAnchor: [15, 21]
      });

      const marker = L.marker([item.lat, item.lng], { icon: customIcon }).addTo(mapRef.current);
      
      let tooltipContent = `<div class="text-slate-900 p-1 font-sans"><strong>#${item.id} ${item.name}</strong><br>`;
      if (item.isBlooming) {
        const h = Math.floor(item.remainingSecs / 3600);
        const m = Math.floor((item.remainingSecs % 3600) / 60);
        const s = item.remainingSecs % 60;
        
        if (item.statusKey === 'ribbon') {
          tooltipContent += `<span class="text-cyan-500 font-black">🎀 飄帶熱銷中</span><br>`;
        } else if (item.statusKey === 'dying') {
          tooltipContent += `<span class="text-amber-500 font-black">⚠️ 臨枯萎警戒</span><br>`;
        } else {
          tooltipContent += `<span class="text-pink-600 font-bold">🌸 正常開花中</span><br>`;
        }
        if (isRouteMember) {
          tooltipContent += `<span class="font-black" style="color: ${routeColor.hex}">👑 ${routeColor.name}路線點</span><br>`;
        } else if (item.isClusterMember) {
          tooltipContent += `<span class="text-amber-600 font-black">👑 15m 精選點</span><br>`;
        }
        tooltipContent += `剩餘時間: ${h}h ${m}m ${s}s<br>枯萎時間: ${formatDateLabel(item.expire)}</div>`;
      } else if (item.statusKey === 'pending_report') {
        const elapsedMins = Math.floor((now - new Date(item.expire!).getTime()) / 60000);
        tooltipContent += `<span class="text-orange-600 font-black">📝 等待回報中</span><br>`;
        if (isRouteMember) {
          tooltipContent += `<span class="font-black" style="color: ${routeColor.hex}">👑 ${routeColor.name}路線點</span><br>`;
        }
        tooltipContent += `已變回葉子: ${elapsedMins} 分鐘前</div>`;
      } else {
        tooltipContent += `<span class="text-slate-500">🍃 葉子狀態</span><br>`;
        if (isRouteMember) {
          tooltipContent += `<span class="font-black" style="color: ${routeColor.hex}">👑 ${routeColor.name}路線點</span><br>`;
        }
        tooltipContent += `</div>`;
      }

      marker.bindPopup(tooltipContent);
      marker.on('click', () => {
        mapRef.current.setView([item.lat, item.lng], 16);
        highlightRowInTable(item.id);
      });

      markersRef.current[item.id] = marker;
    });

    // Draw active paths or circles based on userRole
    if (userRole === "planting") {
      const routes = getMultiplePlantingRoutes();
      routes.forEach((route, rIdx) => {
        if (route.path.length === 0) return;
        const colorInfo = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
        const isSelected = selectedRouteIndex === rIdx;

        const polyline = L.polyline(
          route.path.map(p => [p.lat, p.lng]),
          {
            color: colorInfo.hex,
            weight: isSelected ? 6 : 3,
            opacity: isSelected ? 0.95 : 0.45,
            dashArray: isSelected ? undefined : '5, 5'
          }
        ).addTo(mapRef.current);

        polyline.bindPopup(`
          <div class="text-slate-900 font-sans p-1">
            <strong style="color: ${colorInfo.hex}">🚗 路線 ${rIdx + 1} (${colorInfo.name})</strong><br/>
            建議：<strong>${route.recommendedStartTime}</strong><br/>
            花數：${route.path.length} 朵<br/>
            時長：${Math.floor(route.totalDuration / 60)} 分 ${Math.round(route.totalDuration % 60)} 秒
          </div>
        `);

        polylinesRef.current.push(polyline);
      });
    } else if (userRole === "force_bloom") {
      const spots = getMultipleForceBloomRoutes();
      spots.forEach((spot, sIdx) => {
        const colorInfo = ROUTE_COLORS[sIdx % ROUTE_COLORS.length];
        const isSelected = selectedRouteIndex === sIdx;

        // Draw 500m circle
        const circle = L.circle([spot.lat, spot.lng], {
          radius: 500,
          color: colorInfo.hex,
          fillColor: colorInfo.hex,
          fillOpacity: isSelected ? 0.22 : 0.08,
          dashArray: isSelected ? undefined : '6, 6',
          weight: isSelected ? 3 : 1.5
        }).addTo(mapRef.current);

        circle.bindPopup(`
          <div class="text-slate-900 font-sans p-1">
            <strong style="color: ${colorInfo.hex}">🎯 駐點 ${sIdx + 1} (${colorInfo.name})</strong><br/>
            建議：<strong>${spot.recommendedStartTime}</strong><br/>
            覆蓋：${spot.coveredIds.length} 朵<br/>
            時長：定點強開 30 分鐘
          </div>
        `);

        circlesRef.current.push(circle);

        // Draw custom center marker with number
        const centerIcon = L.divIcon({
          html: `
            <div class="flex flex-col items-center justify-center">
              <div class="w-7 h-7 rounded-full text-white flex items-center justify-center border-2 border-white shadow-xl ${isSelected ? 'animate-bounce' : ''}" style="background-color: ${colorInfo.hex}">
                ${sIdx + 1}
              </div>
            </div>
          `,
          className: 'custom-suggested-spot-icon',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker([spot.lat, spot.lng], { icon: centerIcon }).addTo(mapRef.current);
        marker.bindPopup(`
          <div class="text-slate-900 font-sans p-1">
            <strong style="color: ${colorInfo.hex}">🎯 駐點 ${sIdx + 1} (${colorInfo.name})</strong><br/>
            建議：<strong>${spot.recommendedStartTime}</strong><br/>
            覆蓋：${spot.coveredIds.length} 朵<br/>
            時長：定點強開 30 分鐘
          </div>
        `);

        circlesRef.current.push(marker);
      });
    }

  }, [landmarks, statusFilter, searchTerm, mapReady, userRole, selectedRouteIndex, plantingSpeed, plantingTarget, forceBloomTarget]);

  // Focus table row
  const highlightRowInTable = (id: number) => {
    document.querySelectorAll('#table-body tr').forEach(row => {
      row.classList.remove('bg-purple-950/40', 'border-l-4', 'border-purple-500');
    });
    const selectedRow = document.getElementById(`row-${id}`);
    if (selectedRow) {
      selectedRow.classList.add('bg-purple-950/40', 'border-l-4', 'border-purple-500');
      selectedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Commands parsing logic
  const handleCommandInput = (val: string) => {
    setCommandInput(val);
    if (!hasEditPermission) {
      setCommandFeedback("❌ 唯讀狀態。登入且具編輯權限後方可更新。");
      return;
    }
    if (!val.trim()) {
      setCommandFeedback("💡 具有編輯權限者輸入：[編號]/[小時]h[分鐘]m 可更新今天時間");
      return;
    }

    const parsed = parseCommand(val);
    if (parsed) {
      const item = landmarks.find(l => l.id === parsed.id && l.region === activeRegion);
      if (item) {
        setCommandFeedback(`🌸 識別成功：將設定 #${parsed.id} (${item.name}) 開花：${parsed.hours}h ${parsed.minutes}m`);
      } else {
        setCommandFeedback(`目前區域找不到對應編號 #${parsed.id}。`);
      }
    } else {
      setCommandFeedback("無法識別命令語意。正確範例: 2//1h29m");
    }
  };

  const parseCommand = (str: string) => {
    str = str.trim();
    if (!str) return null;

    // e.g. "2//1h29m" or "2/1h29m"
    const updateSlashRegex = /^(\d+)\/+\s*([^/]+)$/;
    const matchSlash = str.match(updateSlashRegex);
    if (matchSlash) {
      const id = parseInt(matchSlash[1], 10);
      const timeStr = matchSlash[2].trim();
      const duration = parseDuration(timeStr);
      return { type: 'update', id, hours: duration.hours, minutes: duration.minutes };
    }

    if (str.includes('h') || str.includes('m')) {
      const hIndex = str.indexOf('h');
      if (hIndex !== -1) {
        const partBeforeH = str.substring(0, hIndex);
        const matchDigits = partBeforeH.match(/^(\d+)(\d)$/);
        if (matchDigits) {
          const id = parseInt(matchDigits[1], 10);
          const hours = parseInt(matchDigits[2], 10);
          const minutesPart = str.substring(hIndex + 1).replace('m', '').trim();
          const minutes = minutesPart ? parseInt(minutesPart, 10) : 0;
          return { type: 'update', id, hours, minutes };
        }
      }
    }
    return null;
  };

  const parseDuration = (timeStr: string) => {
    timeStr = timeStr.replace(/\//g, '').trim();
    let hours = 0, minutes = 0;
    const hMatch = timeStr.match(/(\d+)\s*h/i);
    const mMatch = timeStr.match(/(\d+)\s*m/i);
    if (hMatch) hours = parseInt(hMatch[1], 10);
    if (mMatch) minutes = parseInt(mMatch[1], 10);
    if (!hMatch && !mMatch && /^\d+$/.test(timeStr)) {
      minutes = parseInt(timeStr, 10);
    }
    return { hours, minutes };
  };

  const processCommandInput = async () => {
    if (!hasEditPermission) {
      showToast("❌ 權限拒絕！您僅有唯讀權限");
      playErrorBuzz();
      return;
    }

    const parsed = parseCommand(commandInput);
    if (!parsed) {
      playErrorBuzz();
      showToast("❌ 指令不完整或格式異常");
      return;
    }

    if (parsed.type === 'update') {
      const item = landmarks.find(l => l.id === parsed.id && l.region === activeRegion);
      if (!item) {
        playErrorBuzz();
        showToast(`❌ 目前區域找不到地標編號 #${parsed.id}`);
        return;
      }

      const newExpire = new Date(Date.now() + (parsed.hours * 60 + parsed.minutes) * 60 * 1000);
      const updatedList = landmarks.map(l => {
        if (l.id === parsed.id && l.region === activeRegion) {
          return { ...l, expire: newExpire.toISOString() };
        }
        return l;
      });

      await pushDataToSheets(updatedList);
      playSynthChime();
      showToast(`🌸 已透過指令更新 #${item.id}！將於 ${formatDateLabel(newExpire.toISOString())} 枯萎`);
      setCommandInput("");
      setCommandFeedback("💡 具有編輯權限者輸入：[編號]/[小時]h[分鐘]m 可更新今天時間");
      setTimeout(() => highlightRowInTable(item.id), 100);
    }
  };

  const quickUpdateDuration = async (id: number, h: number, m: number) => {
    if (!hasEditPermission) {
      showToast("❌ 權限拒絕！您僅有唯讀權限。");
      playErrorBuzz();
      return;
    }

    const item = landmarks.find(l => l.id === id && l.region === activeRegion);
    if (!item) return;
    const newExpire = new Date(Date.now() + (h * 60 + m) * 60 * 1000);
    
    const updatedList = landmarks.map(l => {
      if (l.id === id && l.region === activeRegion) {
        return { ...l, expire: newExpire.toISOString() };
      }
      return l;
    });

    await pushDataToSheets(updatedList);
    playSynthChime();
    showToast(`🌸 已快速更新 #${item.id} 開花：2h 24m`);
  };

  // Modal Handlers
  const triggerEditModal = (id: number) => {
    if (!hasEditPermission) {
      showToast("❌ 權限拒絕！您僅有唯讀權限。");
      playErrorBuzz();
      return;
    }

    const item = landmarks.find(l => l.id === id && l.region === activeRegion);
    if (!item) return;

    setEditId(item.id);
    setEditName(item.name);
    setEditLat(item.lat.toString());
    setEditLng(item.lng.toString());

    if (item.expire) {
      const dateObj = new Date(item.expire);
      const tzOffset = dateObj.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, -1);
      setEditExpire(localISOTime.substring(0, 16));
    } else {
      setEditExpire('');
    }

    if (mapRef.current) {
      mapRef.current.setView([item.lat, item.lng], 16);
    }
    setShowEditModal(true);
  };

  const saveModalChanges = async () => {
    if (editId === null) return;
    const updatedList = landmarks.map(l => {
      if (l.id === editId && l.region === activeRegion) {
        return {
          ...l,
          name: editName.trim(),
          lat: parseFloat(editLat),
          lng: parseFloat(editLng),
          expire: editExpire ? new Date(editExpire).toISOString() : null
        };
      }
      return l;
    });

    await pushDataToSheets(updatedList);
    setShowEditModal(false);
    playSynthChime();
    showToast(`📝 已儲存 #${editId} 的修改！`);
  };

  const deleteSelectedPoint = async () => {
    if (editId === null || !hasEditPermission) return;
    
    let filtered = landmarks.filter(l => !(l.id === editId && l.region === activeRegion));
    // Re-index remaining points in the active region to keep indexing sequentially perfect
    let index = 1;
    const reindexed = filtered.map(l => {
      if (l.region === activeRegion) {
        return { ...l, id: index++ };
      }
      return l;
    });

    await pushDataToSheets(reindexed);
    setShowEditModal(false);
    playErrorBuzz();
    showToast("🗑️ 已成功刪除該花卉標記點位");
  };

  const handleCoordinateInput = (val: string, setLat: (v: string) => void, setLng: (v: string) => void) => {
    if (val.includes(",")) {
      const cleaned = val.replace(/[()\[\]\s]/g, "");
      const parts = cleaned.split(",");
      if (parts.length === 2) {
        const latVal = parseFloat(parts[0]);
        const lngVal = parseFloat(parts[1]);
        if (!isNaN(latVal) && !isNaN(lngVal)) {
          setLat(parts[0]);
          setLng(parts[1]);
          showToast("✨ 已自動解析並拆分 Google Maps 經緯度座標！");
          return true;
        }
      }
    }
    return false;
  };

  const handleAddPoint = async () => {
    if (!addName.trim() || !addLat.trim() || !addLng.trim()) {
      showToast("❌ 請填寫完整名稱、緯度與經度！");
      playErrorBuzz();
      return;
    }
    const latNum = parseFloat(addLat);
    const lngNum = parseFloat(addLng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      showToast("❌ 經緯度格式不正確！");
      playErrorBuzz();
      return;
    }

    const activeRegionLandmarks = landmarks.filter(l => l.region === activeRegion);
    const nextId = activeRegionLandmarks.length > 0 ? Math.max(...activeRegionLandmarks.map(l => l.id)) + 1 : 1;

    const newPoint: Landmark = {
      id: nextId,
      name: addName.trim(),
      lat: latNum,
      lng: lngNum,
      expire: addExpire ? new Date(addExpire).toISOString() : null,
      region: activeRegion
    };

    const updatedList = [...landmarks, newPoint];
    await pushDataToSheets(updatedList);
    setShowAddModal(false);
    playSynthChime();
    showToast(`🌸 已成功新增點位 #${newPoint.id} (${newPoint.name})！`);

    // Reset inputs
    setAddName("");
    setAddLat("");
    setAddLng("");
    setAddExpire("");

    setTimeout(() => highlightRowInTable(newPoint.id), 100);
  };

  const handleInlineTimeSave = async (id: number) => {
    if (!hasEditPermission) {
      showToast("❌ 權限拒絕！您僅有唯讀權限。");
      playErrorBuzz();
      return;
    }

    const duration = parseDuration(inlineTimeVal);
    if (duration.hours === 0 && duration.minutes === 0) {
      showToast("❌ 無效的時間格式！請輸入如 23h24m 或 1h30m");
      playErrorBuzz();
      return;
    }

    const item = landmarks.find(l => l.id === id && l.region === activeRegion);
    if (!item) return;

    const newExpire = new Date(Date.now() + (duration.hours * 60 + duration.minutes) * 60 * 1000);
    const updatedList = landmarks.map(l => {
      if (l.id === id && l.region === activeRegion) {
        return { ...l, expire: newExpire.toISOString() };
      }
      return l;
    });

    await pushDataToSheets(updatedList);
    setInlineTimeEditId(null);
    playSynthChime();
    showToast(`🌸 已快速更新 #${item.id} 開花：${duration.hours}h ${duration.minutes}m`);
    setTimeout(() => highlightRowInTable(item.id), 100);
  };

  const saveConfigurations = async () => {
    const cleanSheetId = extractSheetId(configSheetId);
    setConfigSheetId(cleanSheetId);
    localStorage.setItem(GOOGLE_CLIENT_ID_KEY, configClientId);
    localStorage.setItem(GOOGLE_SHEET_ID_KEY, cleanSheetId);
    
    if (configManualToken.trim()) {
      localStorage.setItem(MANUAL_TOKEN_KEY, configManualToken.trim());
      setGoogleAccessToken(configManualToken.trim());
      await handleSuccessfulLogin(configManualToken.trim(), cleanSheetId);
    } else {
      localStorage.removeItem(MANUAL_TOKEN_KEY);
      setGoogleAccessToken(null);
      setGoogleUserEmail(null);
      setHasEditPermission(false);
      await pullDataFromSheets(null, cleanSheetId);
    }

    setShowConfigModal(false);
    showToast("⚙️ 雲端設定已儲存並同步！");
  };

  const parseAndLoadGPX = async () => {
    if (!gpxText.trim()) {
      showToast("❌ 請填入 GPX 軌跡代碼！");
      return;
    }

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(gpxText, "text/xml");
      const trkpts = xmlDoc.getElementsByTagName("trkpt");

      if (trkpts.length === 0) {
        showToast("❌ 找不到有效的 <trkpt> 地理特徵！");
        return;
      }

      let parsedPoints: { lat: number; lng: number }[] = [];
      for (let i = 0; i < trkpts.length; i++) {
        const latAttr = trkpts[i].getAttribute("lat");
        const lngAttr = trkpts[i].getAttribute("lon");
        if (latAttr && lngAttr) {
          const lat = parseFloat(latAttr);
          const lng = parseFloat(lngAttr);
          if (!isNaN(lat) && !isNaN(lng)) {
            parsedPoints.push({ lat, lng });
          }
        }
      }

      // Geo de-duplication
      let filteredPoints: { lat: number; lng: number }[] = [];
      parsedPoints.forEach(pt => {
        let isDuplicate = false;
        for (let existing of filteredPoints) {
          const distance = Math.sqrt(Math.pow(pt.lat - existing.lat, 2) + Math.pow(pt.lng - existing.lng, 2));
          if (distance < 0.00015) { 
            isDuplicate = true;
            break;
          }
        }
        if (!isDuplicate) {
          filteredPoints.push(pt);
        }
      });

      // Filter out all current points of activeRegion and merge in new GPX coordinates
      const preservedOtherRegions = landmarks.filter(l => l.region !== activeRegion);
      const newLandmarksFromGPX = filteredPoints.map((pt, idx) => ({
        id: idx + 1,
        name: `自訂大花 ${String(idx + 1).padStart(2, '0')}`,
        lat: pt.lat,
        lng: pt.lng,
        expire: null,
        region: activeRegion
      }));

      const finalMerged = [...preservedOtherRegions, ...newLandmarksFromGPX];
      await pushDataToSheets(finalMerged);
      setShowGPXModal(false);
      setGpxText("");
      
      if (mapRef.current && newLandmarksFromGPX.length > 0) {
        const avgLat = newLandmarksFromGPX.reduce((acc, cur) => acc + cur.lat, 0) / newLandmarksFromGPX.length;
        const avgLng = newLandmarksFromGPX.reduce((acc, cur) => acc + cur.lng, 0) / newLandmarksFromGPX.length;
        mapRef.current.setView([avgLat, avgLng], 15);
      }

      showToast(`✅ 成功導入 ${newLandmarksFromGPX.length} 個重組過濾自訂大花點位！`);
      playSynthChime();
    } catch (err) {
      showToast("❌ GPX 代碼解析異常，請確認 XML 語法。");
      console.error(err);
    }
  };

  const resetDataToDefault = async () => {
    const defaultList = PRESETS.keelung;
    await pushDataToSheets(defaultList);
    setShowResetModal(false);
    showToast("🌸 數據已淨化！已回復為基隆東岸 20 花預設。");
    playSynthChime();
  };

  const copyMarkdownTable = () => {
    let md = `| 編號 | 地名 | 變回葉子時間 | 經緯度 | 備註 |\n`;
    md += `| :---: | :--- | :--- | :--- | :--- |\n`;
    
    regionPoints.forEach((item) => {
      const isBlooming = item.expire && new Date(item.expire).getTime() > now;
      const expireLabel = isBlooming ? formatDateLabel(item.expire) : "-";
      md += `| ${item.id} | ${item.name} | ${expireLabel} | ${item.lat.toFixed(6)}, ${item.lng.toFixed(6)} | |\n`;
    });

    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = md;
    document.body.appendChild(tempTextarea);
    tempTextarea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextarea);
    
    showToast("📋 Markdown 報表已成功複製至剪貼簿！");
    playSynthChime();
  };

  // Helper date formatting
  const formatDateLabel = (isoString: string | null) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDateTimeShort = (isoString: string | null) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Statistics counts
  const totalBloomCount = processedPoints.filter(p => p.isBlooming).length;
  const totalLeafCount = processedPoints.filter(p => !p.isBlooming).length;

  if (!userRole) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#0b0f19] p-4 text-[#f1f5f9] relative overflow-hidden font-sans">
        {/* Subtle glowing gradients in background */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-block bg-pink-500/10 p-4 rounded-3xl border border-pink-500/30 mb-2">
              <span className="text-4xl">🌸</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400">
              花嶼雞籠 大花地圖
            </h1>
            <p className="text-slate-400 text-xs tracking-wider font-bold">
              基隆大花即時導航與駐點精算系統
            </p>
          </div>

          <div className="space-y-4">
            {/* Role Selection Label */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold block">🌱 請選擇您今日的種花方式：</label>
              
              <div className="grid grid-cols-1 gap-3">
                {/* Option 1: Planting */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole("planting");
                    playSynthChime();
                  }}
                  className={`p-4 rounded-2xl border text-left transition duration-200 relative overflow-hidden ${
                    selectedRole === "planting"
                      ? "bg-pink-500/10 border-pink-500"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚶‍♂️🚴‍♀️</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-xs text-pink-400">走路/騎車普通種花</h3>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        以種一株花 <strong className="text-white">6 分鐘</strong> 加上移動時間精算，規劃連續種花最優路線，出門一趟種最多花！
                      </p>
                    </div>
                  </div>
                  {selectedRole === "planting" && (
                    <div className="absolute top-2 right-2 text-pink-400">
                      <i className="fa-solid fa-circle-check"></i>
                    </div>
                  )}
                </button>

                {/* Option 2: Force Bloom */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole("force_bloom");
                    playSynthChime();
                  }}
                  className={`p-4 rounded-2xl border text-left transition duration-200 relative overflow-hidden ${
                    selectedRole === "force_bloom"
                      ? "bg-purple-500/10 border-purple-500"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎯⚡</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-xs text-purple-400">500m 雷達強開花</h3>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        利用 <strong className="text-white">500 米</strong> 雷達感應範圍，推薦最佳駐點，停在該點同時感應強開所有花朵！
                      </p>
                    </div>
                  </div>
                  {selectedRole === "force_bloom" && (
                    <div className="absolute top-2 right-2 text-purple-400">
                      <i className="fa-solid fa-circle-check"></i>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="button"
            onClick={handleLoginSubmit}
            disabled={!selectedRole}
            className={`w-full p-3.5 rounded-2xl font-black text-xs transition duration-200 flex items-center justify-center gap-2 shadow-lg ${
              selectedRole
                ? "bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:opacity-90 text-white cursor-pointer"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-850"
            }`}
          >
            <i className="fa-solid fa-rocket"></i>
            <span>進入大花地圖</span>
          </button>

          <p className="text-[9px] text-slate-500 text-center">
            💡 本平台經由基隆大花社群數據驅動，隨時可於系統頂端切換身分。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-12 bg-[#0b0f19] text-[#f1f5f9]">
      
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border-b border-purple-500/20 py-4 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <i className="fa-solid fa-cloud-moon absolute text-6xl top-2 left-10"></i>
          <i className="fa-solid fa-motorcycle absolute text-8xl bottom-2 right-20"></i>
        </div>
        
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center justify-between w-full lg:w-auto gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-pink-500/10 p-2 sm:p-2.5 rounded-2xl border border-pink-500/30">
                  <span className="text-2xl sm:text-3xl">🌸</span>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 flex items-center gap-2">
                    花嶼雞籠 
                    <span className="text-[10px] bg-red-500 text-white font-extrabold px-1.5 py-0.5 rounded-full tracking-normal">測試版</span>
                  </h1>
                  <p className="text-purple-300 text-[10px] sm:text-xs tracking-wider">以花為墨，以地為紙，把你的足跡，種進基隆的四季裡</p>
                </div>
              </div>

              {/* Mobile quick actions for non-logged-in or standard viewers */}
              <div className="flex lg:hidden items-center gap-2">
                {userRole && (
                  <button
                    onClick={() => {
                      localStorage.removeItem("user_role");
                      setUserRole(null);
                      setSelectedRole(null);
                      showToast("請重新選擇種花方式");
                      playSynthChime();
                    }}
                    className="text-[10px] font-black bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-400 px-2 py-1.5 rounded-xl transition flex items-center gap-1"
                    title="切換方式"
                  >
                    <span>{userRole === "planting" ? "🚶‍♂️種花" : "🎯強開"}</span>
                    <i className="fa-solid fa-arrows-rotate text-[8px]"></i>
                  </button>
                )}
                <div id="google-widget-mobile">
                  {googleUserEmail ? (
                    <button onClick={performGoogleLogout} className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2.5 py-1.5 rounded-xl text-xs font-bold transition">登出</button>
                  ) : (
                    <button onClick={startGoogleLogin} className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs transition shadow flex items-center gap-1.5">
                      <i className="fa-brands fa-google"></i> 登入
                    </button>
                  )}
                </div>
                <button onClick={() => setShowConfigModal(true)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 p-2 rounded-xl transition" title="雲端設定">
                  <i className="fa-solid fa-sliders text-xs"></i>
                </button>
              </div>
            </div>

            {/* Planting recommendation & settings bar */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-950/70 p-2 rounded-2xl border border-purple-500/30 text-[11px] sm:text-xs shadow-inner w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-pink-400 font-bold">
                <span className="flex items-center gap-1">
                  <i className={userRole === "planting" ? "fa-solid fa-seedling text-emerald-400" : "fa-solid fa-circle-dot text-purple-400"}></i> 
                  {userRole === "planting" ? "建議種花時間：" : "建議強開時間："}
                </span>
                <span className="text-white font-black bg-purple-950 px-2 py-0.5 rounded-lg border border-purple-500/30">
                  {recommendedPlantingTime}
                </span>
              </div>
              <div className="h-4 w-px bg-slate-800" />
              <button
                onClick={() => {
                  setSelectedSuggestedSpot(null);
                  setShowNavModal(true);
                  playSynthChime();
                }}
                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-extrabold px-3 py-1 rounded-xl transition active:scale-95 flex items-center gap-1.5 text-[10px] sm:text-[11px] shadow-md border border-pink-400/20"
              >
                <i className="fa-solid fa-compass"></i> 路線/強開駐點規劃
              </button>
            </div>
          </div>
          
          <div className="hidden lg:flex flex-wrap items-center gap-3">
            {userRole && (
              <div className="flex items-center gap-2 bg-slate-950/80 rounded-2xl p-2 border border-purple-500/30 text-xs">
                <span className="text-pink-400 font-bold">
                  {userRole === "planting" ? "🚶‍♂️ 走路/騎車種花" : "🎯 雷達強開花"}
                </span>
                <button
                  onClick={() => {
                    localStorage.removeItem("user_role");
                    setUserRole(null);
                    setSelectedRole(null);
                    showToast("請重新選擇種花方式");
                    playSynthChime();
                  }}
                  className="text-slate-300 hover:text-red-400 text-[10px] bg-[#0b0f19] border border-slate-800 px-2 py-0.5 rounded-lg font-bold transition ml-1"
                >
                  切換方式
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 bg-slate-950/80 rounded-2xl p-2 border border-purple-500/30 text-xs">
              <div id="google-widget">
                {googleUserEmail ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-bold text-slate-200">👤 {googleUserEmail.split('@')[0]}</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-extrabold ${hasEditPermission ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>{hasEditPermission ? "EDITOR" : "VIEWER"}</span>
                    <button onClick={performGoogleLogout} className="text-red-400 hover:text-red-300 ml-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2 py-0.5 rounded transition">登出</button>
                  </div>
                ) : (
                  <button onClick={startGoogleLogin} className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-extrabold px-3 py-1.5 rounded-xl transition shadow flex items-center gap-1.5">
                    <i className="fa-brands fa-google"></i> Google 登入
                  </button>
                )}
              </div>
            </div>

            <button onClick={() => setShowConfigModal(true)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 p-2.5 rounded-2xl transition" title="雲端設定">
              <i className="fa-solid fa-sliders text-sm"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast.show && (
        <div id="toast" className="fixed bottom-6 right-6 z-50 bg-slate-900/95 border border-pink-500/30 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 transition-all duration-300">
          <div className="text-xl">🌸</div>
          <div className="text-sm font-medium">{toast.text}</div>
        </div>
      )}

      {/* Main Grid Content */}
      <main className={
        hasEditPermission 
          ? "max-w-7xl mx-auto px-4 md:px-6 mt-6 flex-grow w-full grid grid-cols-1 lg:grid-cols-12 gap-6"
          : "max-w-md mx-auto px-4 mt-4 flex-grow w-full flex flex-col gap-4"
      }>
        
        {/* Left Column (or Map Block in Viewer Mode) */}
        <div className={hasEditPermission ? "lg:col-span-5 flex flex-col gap-6" : "flex flex-col gap-4"}>
          
          {hasEditPermission && (
            <>
              {/* Battle Info Card */}
              <div className="bg-slate-900/60 rounded-3xl p-5 border border-slate-800 flex flex-col gap-3 backdrop-blur-md">
                <h2 className="font-bold text-xs text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  <span>🗺️ 花田選擇</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${hasEditPermission ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20"}`}>
                    {hasEditPermission ? "☁️ 雲端同步編輯權限" : "👁️ 雲端免登入唯讀"}
                  </span>
                </h2>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm text-pink-400 font-extrabold bg-pink-500/10 border border-pink-500/20 py-2 px-4 rounded-xl flex-grow">
                    <span>📍 目前部署：基隆東岸 {regionPoints.length} 花</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      if (!hasEditPermission) {
                        showToast("❌ 權限不足！請先登入具備編輯權限之帳號");
                        playErrorBuzz();
                        return;
                      }
                      setAddName(`大花 ${regionPoints.length + 1}`);
                      setAddLat("25.1311");
                      setAddLng("121.7411");
                      setAddExpire("");
                      setShowAddModal(true);
                    }} className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 h-10 shadow-md">
                      <i className="fa-solid fa-plus"></i> 新增點位
                    </button>
                    <button onClick={() => {
                      if (!hasEditPermission) {
                        showToast("❌ 權限不足！請先登入具備編輯權限之帳號");
                        playErrorBuzz();
                        return;
                      }
                      setShowGPXModal(true);
                    }} className="bg-slate-800 text-emerald-400 hover:bg-slate-700 border border-emerald-500/30 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 h-10">
                      <i className="fa-solid fa-file-import"></i> 導入 GPX
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Command Card */}
              <div className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 flex flex-col gap-4 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                    <i className="fa-solid fa-terminal text-pink-500"></i>
                    CLI Prompt
                  </h2>
                  <button onClick={toggleSound} className="text-pink-400 hover:text-pink-300 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition">
                    <i className={`fa-solid ${soundEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
                    <span>音效：{soundEnabled ? '開' : '關'}</span>
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <input 
                      type="text" 
                      value={commandInput} 
                      onChange={(e) => handleCommandInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") processCommandInput();
                      }}
                      placeholder="例如: 2//1h29m (權限不足時僅能觀看)" 
                      className="w-full pl-4 pr-12 py-3 rounded-2xl bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm transition-all shadow-inner font-medium text-slate-200 placeholder-slate-600"
                    />
                    <button onClick={processCommandInput} className="absolute right-1.5 top-1.5 bottom-1.5 bg-purple-600 hover:bg-purple-700 text-white w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-95 shadow">
                      <i className="fa-solid fa-bolt"></i>
                    </button>
                  </div>
                  <div id="cmd-feedback" className={`text-[11px] italic px-1 min-h-[1.2rem] ${commandFeedback.includes('❌') ? 'text-red-400' : commandFeedback.includes('成功') ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    <span>{commandFeedback}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Radar Map (Always visible and kept mounted in DOM!) */}
          <div className="bg-slate-900/60 rounded-3xl p-4 border border-slate-800 flex flex-col gap-3 backdrop-blur-md">
            <div className="flex items-center justify-between px-2">
              <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <i className="fa-solid fa-map-location-dot text-indigo-400"></i>
                種花雷達地圖
              </h2>
              <div className="flex gap-2 text-[10px]">
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-cyan-400"></span> 🎀 飄帶
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-pink-500"></span> 🌸 咲
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> ⚠️ 快枯
                </span>
              </div>
            </div>
            {/* The leaf map target container */}
            <div 
              ref={mapContainerRef} 
              id="map" 
              style={{ height: hasEditPermission ? "420px" : "360px" }}
              className="rounded-2xl overflow-hidden border border-slate-800 relative"
            >
              {typeof L === 'undefined' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 text-center p-6 z-50">
                  <span className="text-3xl mb-2">🗺️</span>
                  <p className="text-sm font-bold text-slate-200">地圖組件加載失敗或被瀏覽器阻擋</p>
                  <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                    請確認您的網路連線正常。若您正在使用 GitHub Preview / Iframe 或沙盒環境，這可能是因為瀏覽器阻擋了第三方 CDN 腳本 (unpkg.com) 的載入。<br />
                    請點選右上角的 <span className="text-pink-400 font-bold">「新分頁開啟」</span> 以獲得完整且獨立的地圖瀏覽體驗！
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column (or Mobile Feed Block in Viewer Mode) */}
        <div className={hasEditPermission ? "lg:col-span-7 flex flex-col gap-6" : "flex flex-col gap-4"}>
          
          {hasEditPermission ? (
            <>
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 flex items-center justify-between backdrop-blur-md">
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">🌸 開花中</p>
                    <h3 id="stat-blooming-count" className="text-3xl font-black text-pink-500 mt-1">
                      {totalBloomCount} <span className="text-xs font-normal text-slate-400">朵</span>
                    </h3>
                  </div>
                  <span className="text-2xl bg-pink-500/10 border border-pink-500/20 p-2.5 rounded-xl">🌸</span>
                </div>
                
                <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 flex items-center justify-between backdrop-blur-md">
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">🍃 回歸葉子</p>
                    <h3 id="stat-leaf-count" className="text-3xl font-black text-slate-500 mt-1">
                      {totalLeafCount} <span className="text-xs font-normal text-slate-400">朵</span>
                    </h3>
                  </div>
                  <span className="text-2xl bg-slate-800/50 border border-slate-700/50 p-2.5 rounded-xl text-slate-400">🍃</span>
                </div>

                <div className="bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 rounded-2xl p-4 border border-purple-500/20 text-white flex flex-col justify-between gap-2 shadow">
                  <div className="text-[11px] font-bold text-purple-300 tracking-wider">📋 同步與系統重置</div>
                  <div className="flex gap-2">
                    <button onClick={() => pullDataFromSheets(googleAccessToken, configSheetId)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition duration-150 active:scale-95 flex items-center justify-center gap-1.5" id="btn-sync-now">
                      <i className="fa-solid fa-cloud-arrow-down"></i> 立即同步雲端
                    </button>
                    <button onClick={copyMarkdownTable} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition duration-150 active:scale-95 flex items-center justify-center gap-1" title="複製 Markdown">
                      <i className="fa-solid fa-copy"></i>
                    </button>
                    <button onClick={() => setShowResetModal(true)} className="bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 text-xs font-bold p-2 rounded-xl transition duration-150" title="重置為出廠預設">
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* Monitors Table Container */}
              <div className="bg-slate-900/60 rounded-3xl border border-slate-800 overflow-hidden flex flex-col flex-grow backdrop-blur-md">
                
                {/* Table Controller bar */}
                <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between w-full">
                    <button className="text-sm font-black border-b-2 border-pink-500 pb-1 text-pink-400 transition flex items-center gap-1.5">
                      <i className="fa-solid fa-list-ol mr-1"></i> 
                      景點監控列表 (<span id="total-count-badge">{regionPoints.length}</span>)
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="搜尋景點..." 
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-slate-500 text-xs"></i>
                    </div>
                    
                    <select 
                      value={statusFilter} 
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500 w-full"
                    >
                      <option value="all">顯示所有狀態</option>
                      <option value="ribbon">🎀 僅顯示飄帶中</option>
                      <option value="blooming_only">🌸 僅顯示一般開花</option>
                      <option value="dying_only">⚠️ 僅顯示快枯歸葉</option>
                      <option value="pending_report">📝 僅顯示等待回報中</option>
                      <option value="leaf">🍃 僅顯示葉子</option>
                      <option value="cluster">👑 僅顯示精選 (最少5花點)</option>
                    </select>
                    
                    <select 
                      value={sortSelector} 
                      onChange={(e) => setSortSelector(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-pink-400 font-bold focus:outline-none focus:ring-1 focus:ring-pink-500 w-full"
                    >
                      <option value="id_asc">🔢 排序：編號 (低 → 高)</option>
                      <option value="id_desc">🔢 排序：編號 (高 → 低)</option>
                      <option value="time_asc">⏳ 排序：剩餘花期 (短 → 長) 🚨</option>
                      <option value="time_desc">⏳ 排序：剩餘花期 (長 → 短)</option>
                      <option value="name_asc">🔤 排序：景點名稱 (A → Z)</option>
                    </select>
                  </div>
                </div>

                {/* Table Monitor list */}
                <div id="tab-monitor-container" className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/40 border-b border-slate-800 text-slate-400 text-[11px] font-bold tracking-wider uppercase">
                        <th className="py-3 px-4 text-center w-14">編號</th>
                        <th className="py-3 px-4">地標名稱 / 經緯度</th>
                        <th className="py-3 px-4">當前狀態</th>
                        <th className="py-3 px-4">枯萎倒數</th>
                        <th className="py-3 px-4 text-right pr-6">操作</th>
                      </tr>
                    </thead>
                    <tbody id="table-body" className="divide-y divide-slate-800/60 text-sm font-medium">
                      {sortedPoints.length > 0 ? (
                        sortedPoints.map((item) => {
                          let statusBadge: ReactNode = null;
                          let countdownLabel: ReactNode = null;

                          if (item.isBlooming) {
                            if (item.statusKey === 'ribbon') {
                              statusBadge = (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                                  🎀 飄帶中
                                </span>
                              );
                            } else if (item.statusKey === 'dying') {
                              statusBadge = (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  ⚠️ 臨枯萎
                                </span>
                              );
                            } else {
                              statusBadge = (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-pink-500/10 text-pink-400 border border-pink-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                                  🌸 開花中
                                </span>
                              );
                            }

                            const totalDuration = 23 * 60 * 60 * 1000;
                            const expTime = new Date(item.expire!).getTime();
                            const progressPercent = Math.max(0, Math.min(100, (1 - ((expTime - now) / totalDuration)) * 100));

                            const h = Math.floor(item.remainingSecs / 3600);
                            const m = Math.floor((item.remainingSecs % 3600) / 60);
                            const s = item.remainingSecs % 60;

                            if (item.statusKey === 'dying') {
                              const totalMinsLeft = Math.ceil(item.remainingSecs / 60);
                              countdownLabel = (
                                <div className="space-y-1">
                                  <div className="font-bold text-xs text-amber-400 animate-pulse">還有 {totalMinsLeft} 分變回葉子</div>
                                  <div className="w-24 bg-slate-800 rounded-full h-1 overflow-hidden">
                                    <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${100 - progressPercent}%` }}></div>
                                  </div>
                                </div>
                              );
                            } else {
                              countdownLabel = (
                                <div className="space-y-1">
                                  <div className="font-mono text-xs font-bold text-slate-200">
                                    {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
                                  </div>
                                  <div className="w-24 bg-slate-800 rounded-full h-1 overflow-hidden">
                                    <div className="bg-gradient-to-r from-pink-500 to-purple-500 h-1 rounded-full" style={{ width: `${100 - progressPercent}%` }}></div>
                                  </div>
                                </div>
                              );
                            }
                          } else if (item.statusKey === 'pending_report') {
                            statusBadge = (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-orange-500/10 text-orange-400 border border-orange-500/30 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                📝 等待回報中
                              </span>
                            );
                            const elapsedMins = Math.floor((now - new Date(item.expire!).getTime()) / 60000);
                            countdownLabel = (
                              <span className="text-orange-400 text-xs font-bold animate-pulse">
                                已變葉 {elapsedMins} 分鐘
                              </span>
                            );
                          } else {
                            statusBadge = (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800/60 text-slate-400 border border-slate-700/40">
                                🍃 葉子狀態
                              </span>
                            );
                            countdownLabel = <span className="text-slate-600 text-[11px]">已歸地</span>;
                          }

                          return (
                            <tr key={item.id} id={`row-${item.id}`} className="hover:bg-slate-900/50 transition border-b border-slate-800/40 align-middle">
                              <td className="py-3 px-4 text-center font-bold text-slate-500">{item.id}</td>
                              <td className="py-3 px-4 cursor-pointer" onClick={() => {
                                if (mapRef.current) {
                                  mapRef.current.setView([item.lat, item.lng], 16);
                                }
                                highlightRowInTable(item.id);
                              }}>
                                <div className="font-bold text-slate-200 hover:text-pink-400 transition flex items-center gap-1.5">
                                  {item.name}
                                  {item.isClusterMember && item.isBlooming && (
                                    <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-300 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5" title="屬於 15 分鐘內超過 5 朵的密集開花精選">
                                      👑 精選
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                                  <i className="fa-solid fa-location-dot"></i> {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                                </div>
                              </td>
                              <td className="py-3 px-4">{statusBadge}</td>
                              <td className="py-3 px-4">{countdownLabel}</td>
                              <td className="py-3 px-4 text-right pr-6">
                                <div className="flex justify-end items-center gap-3">
                                  {inlineTimeEditId === item.id ? (
                                    <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="text"
                                        value={inlineTimeVal}
                                        onChange={(e) => setInlineTimeVal(e.target.value)}
                                        placeholder="例如 23h24m"
                                        className="w-24 px-2 py-1 bg-slate-950 border border-purple-500 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-slate-600"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleInlineTimeSave(item.id);
                                          } else if (e.key === 'Escape') {
                                            setInlineTimeEditId(null);
                                          }
                                        }}
                                      />
                                      <button
                                        onClick={() => handleInlineTimeSave(item.id)}
                                        className="bg-purple-600 hover:bg-purple-700 text-white p-1 rounded-lg transition text-xs flex items-center justify-center w-6 h-6"
                                        title="儲存"
                                      >
                                        <i className="fa-solid fa-check text-[10px]"></i>
                                      </button>
                                      <button
                                        onClick={() => setInlineTimeEditId(null)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-400 p-1 rounded-lg transition text-xs flex items-center justify-center w-6 h-6"
                                        title="取消"
                                      >
                                        <i className="fa-solid fa-xmark text-[10px]"></i>
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      {item.isBlooming && item.expire && (
                                        <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                                          於 {formatDateTimeShort(item.expire)} 枯萎
                                        </span>
                                      )}
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!hasEditPermission) {
                                            showToast("❌ 權限不足！請先登入具備編輯權限之帳號");
                                            playErrorBuzz();
                                            return;
                                          }
                                          setInlineTimeEditId(item.id);
                                          setInlineTimeVal("");
                                        }}
                                        className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 hover:border-purple-500/40 text-xs font-bold py-1 px-2.5 rounded-lg transition duration-150 flex items-center gap-1 active:scale-95"
                                        title="直接輸入 xhxxm 剩餘時間"
                                      >
                                        <i className="fa-solid fa-clock text-[10px]"></i> 設時間
                                      </button>
                                      <button 
                                        onClick={() => triggerEditModal(item.id)}
                                        className="text-slate-500 hover:text-slate-300 p-1.5 rounded transition"
                                        title="編輯地標"
                                      >
                                        <i className="fa-solid fa-pencil text-xs"></i>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-500 text-xs">無符合條件的花朵點位</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            </>
          ) : (
            /* Simplified mobile landmarks list strictly sorted by wither countdown */
            <div className="bg-slate-900/60 rounded-3xl p-4 border border-slate-800 flex flex-col gap-4 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="font-black text-sm text-slate-100 flex items-center gap-2">
                  <i className="fa-solid fa-clock text-pink-500"></i>
                  枯萎倒數監控 ({processedPoints.filter(p => p.isBlooming).length} 朵開花中)
                </h2>
              </div>
              
              {/* Quick Search bar */}
              <div className="relative">
                <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="快速搜尋基隆東岸地標..." 
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-3.5 text-slate-500 text-xs"></i>
              </div>

              {/* Scrollable list of bento-style cards */}
              <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                {sortedPoints.length > 0 ? (
                  sortedPoints.map((item) => {
                    let statusBadge: ReactNode = null;
                    let countdownLabel: ReactNode = null;

                    if (item.isBlooming) {
                      const h = Math.floor(item.remainingSecs / 3600);
                      const m = Math.floor((item.remainingSecs % 3600) / 60);
                      const s = item.remainingSecs % 60;

                      if (item.statusKey === 'dying') {
                        const totalMinsLeft = Math.ceil(item.remainingSecs / 60);
                        countdownLabel = (
                          <span className="text-xs font-black text-amber-400 animate-pulse">
                            還有 {totalMinsLeft} 分變葉
                          </span>
                        );
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                            快枯萎
                          </span>
                        );
                      } else {
                        countdownLabel = (
                          <span className="font-mono text-xs font-bold text-pink-400">
                            🌸 {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
                          </span>
                        );
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-500/10 text-pink-400 border border-pink-500/30">
                            開花中
                          </span>
                        );
                      }
                    } else if (item.statusKey === 'pending_report') {
                      statusBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500/10 text-orange-400 border border-orange-500/30 animate-pulse">
                          📝 等待回報中
                        </span>
                      );
                      const elapsedMins = Math.floor((now - new Date(item.expire!).getTime()) / 60000);
                      countdownLabel = (
                        <span className="text-orange-400 text-[10px] font-bold animate-pulse">
                          已變葉 {elapsedMins} 分鐘
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800/60 text-slate-400 border border-slate-700/40">
                          葉子狀態
                        </span>
                      );
                      countdownLabel = <span className="text-slate-600 text-[10px]">已歸地</span>;
                    }

                    return (
                      <div 
                        key={item.id} 
                        onClick={() => {
                          if (mapRef.current) {
                            mapRef.current.setView([item.lat, item.lng], 16);
                          }
                          highlightRowInTable(item.id);
                        }}
                        className="bg-slate-950/40 border border-slate-800/60 hover:bg-slate-900/60 transition-all rounded-2xl p-3 flex items-center justify-between cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                            <span className="text-slate-500 font-mono text-[10px]">#{item.id}</span>
                            <span className="text-slate-200">{item.name}</span>
                            {item.isClusterMember && item.isBlooming && (
                              <span className="text-[9px] bg-amber-500/20 border border-amber-500/30 text-amber-300 font-extrabold px-1.5 py-0.5 rounded">
                                👑 精選
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-slate-500 font-medium">
                            📍 {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {statusBadge}
                          <div className="flex items-center gap-1">
                            {countdownLabel}
                            {item.isBlooming && item.expire && (
                              <span className="text-[10px] text-slate-500 font-normal">
                                (於 {formatDateTimeShort(item.expire)} 變葉)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    無符合條件的花朵點位
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Cloud Settings Slider Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-black text-base text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 flex items-center gap-2">
                <i className="fa-solid fa-gears text-purple-400"></i>
                花嶼雞籠 雲端設定
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-500 hover:text-slate-300">
                <i className="fa-solid fa-circle-xmark text-lg"></i>
              </button>
            </div>
            
            <div className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Google Client ID</label>
                <input 
                  type="text" 
                  value={configClientId} 
                  onChange={(e) => setConfigClientId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Google Spreadsheet ID</label>
                <input 
                  type="text" 
                  value={configSheetId} 
                  onChange={(e) => setConfigSheetId(e.target.value)}
                  placeholder="例如: 1BmWfet3J7LaCrJZfNe8RN58LCI990o_9NySRRCc0BpU"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <p className="mt-1.5 text-[10px] text-slate-400 leading-relaxed bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                  💡 <strong>貼心提示：</strong> 支援貼上<strong>整行 Google 試算表瀏覽器網址</strong>或<strong>純 ID</strong>！
                  請確保該試算表的共用權限設為：<strong className="text-pink-400">「知道連結的任何人皆可檢視」</strong>，即可享受免登入自動同步功能。
                </p>
              </div>
              <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl space-y-1.5">
                <span className="font-bold text-indigo-300 block"><i className="fa-solid fa-shield-halved"></i> 預覽與開發調試 Fallback:</span>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  若您的網頁託管於拒絕 Google 彈出登入的沙盒環境，您可手動在 <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" className="text-pink-400 underline hover:text-pink-300">OAuth Playground</a> 申請對應 Google Sheets API 的 Access Token 貼在下方：
                </p>
                <input 
                  type="password" 
                  value={configManualToken} 
                  onChange={(e) => setConfigManualToken(e.target.value)}
                  placeholder="手動貼上 Access Token (選填)" 
                  className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex gap-2 justify-end">
              <button onClick={() => setShowConfigModal(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition">取消</button>
              <button onClick={saveConfigurations} className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition shadow-lg flex items-center gap-1.5">
                <i className="fa-solid fa-floppy-disk"></i> 儲存並同步
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Point Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>✏️ 編輯大花地標</span>
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 hover:text-slate-300 transition">
                <i className="fa-solid fa-circle-xmark text-lg"></i>
              </button>
            </div>
            
            <div className="py-4 space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">景點地名</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">緯度 (Lat)</label>
                  <input 
                    type="text" 
                    value={editLat} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!handleCoordinateInput(val, setEditLat, setEditLng)) {
                        setEditLat(val);
                      }
                    }}
                    placeholder="例如: 25.132"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">經度 (Lng)</label>
                  <input 
                    type="text" 
                    value={editLng} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!handleCoordinateInput(val, setEditLat, setEditLng)) {
                        setEditLng(val);
                      }
                    }}
                    placeholder="例如: 121.745"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 mt-1">
                💡 <strong>座標速貼：</strong> 支援直接在上面任一格貼入 Google Maps 複製的座標，例如：<br />
                <code className="text-pink-400">(25.1285850, 121.7456590)</code> 或 <code className="text-pink-400">25.1285850, 121.7456590</code> 系統會自動拆分！
              </p>
              <div>
                <label className="text-slate-400 block mb-1">設定開花終止時間</label>
                <input 
                  type="datetime-local" 
                  value={editExpire} 
                  onChange={(e) => setEditExpire(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex gap-2">
              <button onClick={deleteSelectedPoint} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-1">
                <i className="fa-solid fa-trash-can"></i> 刪除此點
              </button>
              <div className="flex-grow"></div>
              <button onClick={() => setShowEditModal(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition">取消</button>
              <button onClick={saveModalChanges} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md">儲存修改</button>
            </div>
          </div>
        </div>
      )}

      {/* Point Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>➕ 新增自訂大花地標</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-300 transition">
                <i className="fa-solid fa-circle-xmark text-lg"></i>
              </button>
            </div>
            
            <div className="py-4 space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">景點地名</label>
                <input 
                  type="text" 
                  value={addName} 
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="例如: 基隆港東岸大花"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">緯度 (Lat)</label>
                  <input 
                    type="text" 
                    value={addLat} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!handleCoordinateInput(val, setAddLat, setAddLng)) {
                        setAddLat(val);
                      }
                    }}
                    placeholder="例如: 25.132"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">經度 (Lng)</label>
                  <input 
                    type="text" 
                    value={addLng} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!handleCoordinateInput(val, setAddLat, setAddLng)) {
                        setAddLng(val);
                      }
                    }}
                    placeholder="例如: 121.745"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 mt-1">
                💡 <strong>座標速貼：</strong> 支援直接在上面任一格貼入 Google Maps 複製的座標，例如：<br />
                <code className="text-pink-400">(25.1285850, 121.7456590)</code> 或 <code className="text-pink-400">25.1285850, 121.7456590</code> 系統會自動拆分！
              </p>
              <div>
                <label className="text-slate-400 block mb-1">開花終止時間 (選填，不填為葉子)</label>
                <input 
                  type="datetime-local" 
                  value={addExpire} 
                  onChange={(e) => setAddExpire(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex gap-2 justify-end">
              <button onClick={() => setShowAddModal(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition">取消</button>
              <button onClick={handleAddPoint} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md">新增地標</button>
            </div>
          </div>
        </div>
      )}

      {/* GPX Import Modal */}
      {showGPXModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2 pb-3 border-b border-slate-800">
              <i className="fa-solid fa-file-code text-purple-400"></i>
              匯入自訂 GPX 花朵路徑
            </h3>
            <p className="text-slate-400 text-xs my-3 leading-relaxed">
              可直接貼上 GPX 軌跡代碼。系統會為您重排所有地標，並自動進行微調過濾去重。
            </p>
            <textarea 
              rows={8} 
              value={gpxText} 
              onChange={(e) => setGpxText(e.target.value)}
              placeholder="請將 <?xml ...> 貼在這裡" 
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <div className="pt-4 flex gap-2 justify-end">
              <button onClick={() => setShowGPXModal(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition">取消</button>
              <button onClick={parseAndLoadGPX} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md flex items-center gap-1.5">
                <i className="fa-solid fa-circle-check"></i> 智慧解析並導入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="text-3xl text-red-500 mb-2">⚠️</div>
            <h3 className="font-bold text-base text-slate-200">確定清除所有數據並重置？</h3>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">這將會清除您當前對本區域的所有自訂標記與時間紀錄，回復至全新預設狀態。</p>
            <div className="pt-5 flex gap-2 justify-center">
              <button onClick={() => setShowResetModal(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition">取消</button>
              <button onClick={resetDataToDefault} className="bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md">確認清除</button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Modal */}
      {showNavModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧭</span>
                <h3 className="font-black text-sm sm:text-base text-slate-100">大花路線與最佳駐點規劃</h3>
              </div>
              <button onClick={() => setShowNavModal(false)} className="text-slate-500 hover:text-slate-300 p-1 transition">
                <i className="fa-solid fa-circle-xmark text-lg"></i>
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-800/80 mb-4 mt-3">
              <button
                onClick={() => setNavModalTab("planting")}
                className={`flex-1 pb-2.5 font-bold text-xs text-center border-b-2 transition ${
                  navModalTab === "planting"
                    ? "border-pink-500 text-pink-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                🚶‍♂️/🚴‍♀️ 走路騎車最優種花
              </button>
              <button
                onClick={() => setNavModalTab("force_bloom")}
                className={`flex-1 pb-2.5 font-bold text-xs text-center border-b-2 transition ${
                  navModalTab === "force_bloom"
                    ? "border-purple-500 text-purple-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                🎯 500m 強開最佳駐點
              </button>
            </div>

            {navModalTab === "planting" ? (
              <div className="space-y-4 py-1">
                {/* Speed Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold block">🚴 交通工具/移動時速：</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPlantingSpeed(5)}
                      className={`py-1.5 px-3 rounded-xl border text-[11px] font-bold transition ${
                        plantingSpeed === 5
                          ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                      }`}
                    >
                      🚶‍♂️ 走路種花 (5 km/h)
                    </button>
                    <button
                      onClick={() => setPlantingSpeed(15)}
                      className={`py-1.5 px-3 rounded-xl border text-[11px] font-bold transition ${
                        plantingSpeed === 15
                          ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                      }`}
                    >
                      🚴‍♀️ 騎車/慢行 (15 km/h)
                    </button>
                  </div>
                </div>

                {/* Compute and display multiple planting routes */}
                {(() => {
                  const routes = getMultiplePlantingRoutes();
                  if (routes.length === 0) {
                    return (
                      <div className="py-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800">
                        ⚠️ 當前無可規劃的目標花卉點位！
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                        💡 <strong>連續種花原理：</strong> 系統已自動將您欲種植的點位，以每條 5 花點（考慮 6 分鐘種花 + 移動時間與大花存活時間）為基準分組，並推薦最優順序與時間。點選以下路線卡片，可切換地圖高亮該路線！
                      </p>

                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                        {routes.map((route, rIdx) => {
                          const colorInfo = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
                          const isSelected = selectedRouteIndex === rIdx;
                          
                          return (
                            <div
                              key={rIdx}
                              onClick={() => {
                                setSelectedRouteIndex(rIdx);
                                if (mapRef.current && route.path.length > 0) {
                                  mapRef.current.setView([route.path[0].lat, route.path[0].lng], 16);
                                }
                              }}
                              className={`p-3.5 rounded-2xl border cursor-pointer transition duration-150 relative ${
                                isSelected 
                                  ? "bg-slate-900 border-2" 
                                  : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                              }`}
                              style={isSelected ? { borderColor: colorInfo.hex } : {}}
                            >
                              {/* Color Badge Header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorInfo.hex }} />
                                  <span className="text-xs font-black text-slate-100">
                                    路線 {rIdx + 1} ({colorInfo.name})
                                  </span>
                                </div>
                                <span className="text-[11px] font-extrabold text-pink-400">
                                  🌸 {route.path.length} 朵大花
                                </span>
                              </div>

                              {/* Info indicators */}
                              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300 mt-2">
                                <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/40">
                                  <p className="text-slate-500 text-[9px]">建議出發時間</p>
                                  <p className="font-bold text-emerald-400 mt-0.5">{route.recommendedStartTime}</p>
                                </div>
                                <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/40">
                                  <p className="text-slate-500 text-[9px]">總移動時長</p>
                                  <p className="font-bold text-purple-400 mt-0.5">
                                    {Math.floor(route.totalDuration / 60)} 分 {Math.round(route.totalDuration % 60)} 秒
                                  </p>
                                </div>
                              </div>

                              {/* Timeline detail inside selected item */}
                              {isSelected && (
                                <div className="mt-3 space-y-1 bg-slate-950/80 p-2.5 rounded-xl border border-slate-850/60 font-sans text-[10px]">
                                  <p className="text-[9px] text-slate-500 font-bold mb-1.5">🧭 路線詳細步驟：</p>
                                  {route.steps.map((step, idx) => {
                                    const hNum = step.landmark.id;
                                    const name = step.landmark.name;
                                    if (step.type === "start") {
                                      return (
                                        <div key={idx} className="flex items-start gap-1.5 py-0.5">
                                          <span className="bg-emerald-500/20 text-emerald-400 w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[8px] shrink-0 mt-0.5">起</span>
                                          <span className="font-bold text-slate-200">#{hNum} {name}</span>
                                        </div>
                                      );
                                    } else {
                                      const distText = step.distance! >= 1000 
                                        ? `${(step.distance! / 1000).toFixed(2)}km` 
                                        : `${Math.round(step.distance!)}m`;
                                      return (
                                        <div key={idx} className="space-y-0.5">
                                          <div className="pl-2 border-l border-dashed border-slate-800 text-[9px] text-slate-500">
                                            ↓ 下站 {distText}
                                          </div>
                                          <div className="flex items-start gap-1.5 py-0.5">
                                            <span className="bg-purple-500/20 text-purple-400 w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[8px] shrink-0 mt-0.5">{idx + 1}</span>
                                            <span className="font-bold text-slate-200">#{hNum} {name}</span>
                                          </div>
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                              )}

                              {/* Direct Google Maps Navigation button matching color */}
                              <div className="mt-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation(); // prevent card re-select trigger
                                    const origin = `${route.path[0].lat},${route.path[0].lng}`;
                                    const destination = `${route.path[route.path.length - 1].lat},${route.path[route.path.length - 1].lng}`;
                                    let waypoints = "";
                                    if (route.path.length > 2) {
                                      const intermediate = route.path.slice(1, route.path.length - 1);
                                      waypoints = intermediate.map(p => `${p.lat},${p.lng}`).join("|");
                                    }
                                    let gUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
                                    if (waypoints) {
                                      gUrl += `&waypoints=${encodeURIComponent(waypoints)}`;
                                    }
                                    gUrl += `&travelmode=${plantingSpeed === 5 ? "walking" : "bicycling"}`;
                                    window.open(gUrl, "_blank");
                                  }}
                                  className="w-full text-white font-extrabold py-2.5 px-3 rounded-xl text-[11px] transition shadow-md flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95"
                                  style={{ backgroundColor: colorInfo.hex }}
                                >
                                  <i className="fa-solid fa-map-location-dot"></i>
                                  <span>開啟 {colorInfo.name} 路線 Google Maps 連續種花導航</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-4 py-1">
                {/* List of recommended spots */}
                {(() => {
                  const spots = getMultipleForceBloomRoutes();
                  if (spots.length === 0) {
                    return (
                      <div className="py-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800">
                        ⚠️ 當前無可規劃的強開推薦駐點！(強開最少需 5 花點)
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                        💡 <strong>強開駐點原理：</strong> 以下定點駐點經 500m 半徑圓心精算，滿足最少 5 花點基準。點選下方駐點，地圖會立即高亮雷達圈！點按開啟 Google Maps 會直接導航至該定點。
                      </p>

                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                        {spots.map((spot, index) => {
                          const colorInfo = ROUTE_COLORS[index % ROUTE_COLORS.length];
                          const isSelected = selectedRouteIndex === index;
                          
                          return (
                            <div 
                              key={index}
                              onClick={() => {
                                setSelectedRouteIndex(index);
                                setSelectedSuggestedSpot({ lat: spot.lat, lng: spot.lng, coveredIds: spot.coveredIds });
                                if (mapRef.current) {
                                  mapRef.current.setView([spot.lat, spot.lng], 16);
                                }
                              }}
                              className={`p-3.5 rounded-2xl border cursor-pointer transition duration-150 relative ${
                                isSelected 
                                  ? "bg-slate-900 border-2" 
                                  : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                              }`}
                              style={isSelected ? { borderColor: colorInfo.hex } : {}}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorInfo.hex }} />
                                  <span className="text-xs font-black text-slate-100">
                                    定點強開駐點 {index + 1} ({colorInfo.name})
                                  </span>
                                </div>
                                <span className="text-[11px] font-extrabold text-pink-400">
                                  ⚡ 可強開 {spot.coveredIds.length} 朵花
                                </span>
                              </div>
                              
                              <div className="text-[10px] text-slate-300 space-y-1.5 my-2">
                                <div className="flex flex-wrap gap-1">
                                  {spot.coveredNames.map((name, nIdx) => (
                                    <span key={nIdx} className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400 text-[9px] whitespace-nowrap">
                                      #{spot.coveredIds[nIdx]} {name}
                                    </span>
                                  ))}
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/40">
                                    <p className="text-slate-500 text-[9px]">建議強開時間</p>
                                    <p className="font-bold text-amber-400 mt-0.5">{spot.recommendedStartTime}</p>
                                  </div>
                                  <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/40">
                                    <p className="text-slate-500 text-[9px]">最遠大花距離</p>
                                    <p className="font-bold text-slate-300 mt-0.5">{Math.round(spot.maxDist)}m</p>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-900/60">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const coordinateString = `${spot.lat.toFixed(7)}, ${spot.lng.toFixed(7)}`;
                                    const tempTextarea = document.createElement('textarea');
                                    tempTextarea.value = coordinateString;
                                    document.body.appendChild(tempTextarea);
                                    tempTextarea.select();
                                    document.execCommand('copy');
                                    document.body.removeChild(tempTextarea);
                                    showToast(`📋 駐點座標已複製：${coordinateString}`);
                                  }}
                                  className="bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition"
                                >
                                  <i className="fa-solid fa-copy"></i>
                                  <span>複製座標</span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const gUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
                                    window.open(gUrl, "_blank");
                                  }}
                                  className="text-white font-extrabold py-2.5 px-3 rounded-xl text-[11px] transition shadow-md flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95"
                                  style={{ backgroundColor: colorInfo.hex }}
                                >
                                  <i className="fa-solid fa-location-arrow"></i>
                                  <span>開啟 Google Maps 導航</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[10px] text-slate-500">
                {selectedSuggestedSpot ? "✨ 地圖上正顯示 500m 駐點雷達" : "💡 地圖支援同步顯示駐點雷達"}
              </span>
              <button 
                onClick={() => setShowNavModal(false)} 
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-2.5 rounded-xl text-xs transition"
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
