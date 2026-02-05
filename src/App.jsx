import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc,
  collection,
  query
} from 'firebase/firestore';
import { 
  Plane, Calendar, Plus, Trash2, Clock, 
  CheckCircle, AlertCircle, Loader2, X, Globe, ChevronRight,
  ArrowUp, ArrowDown, Edit3, Save, MapPin, Map as MapIcon,
  ArrowLeftRight, Settings2, RotateCcw, TrendingUp, DollarSign, CheckCircle2, Search, Circle, Coins
} from 'lucide-react';

/**
 * 🚀 全功能整合穩定版 (2026.02.05):
 * 1. 修復 Permission Denied：確保所有 Firestore 監聽器僅在身份驗證成功後啟動，並增加錯誤回呼。
 * 2. 匯率頁面：整合「智慧匯率大師」邏輯，支援自定義匯率與搜尋。
 * 3. 資料救援：固定 appId 並處理路徑規範，確保富國島行程可見。
 * 4. 介面美化：使用 Noto Sans TC 並強化 Tailwind CSS 渲染。
 */

const VERSION_INFO = "最後更新：2026/02/05 11:40 (權限修復與匯率整合版)";

// --- 配置與幣別資料 ---
const currencyNames = {
  "USD": "美金", "TWD": "台幣", "HKD": "港幣", "JPY": "日圓", "EUR": "歐元",
  "GBP": "英鎊", "AUD": "澳幣", "CAD": "加幣", "CNY": "人民幣", "KRW": "韓元",
  "SGD": "新加坡幣", "NZD": "紐西蘭幣", "CHF": "瑞士法郎", "SEK": "瑞典克朗",
  "THB": "泰銖", "PHP": "菲律賓披索", "IDR": "印尼盾", "VND": "越南盾",
  "MYR": "馬來西亞幣", "INR": "印度盧比", "MOP": "澳門幣", "ZAR": "南非幣",
  "BRL": "巴西里亞爾", "MXN": "墨西哥披索", "TRY": "土耳其里拉"
};

const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try { return JSON.parse(__firebase_config); } catch (e) { console.error("Config error", e); }
  }
  return {
    apiKey: "AIzaSyDHfIqjgq0cJ0fCuKlIBQhof6BEJsaYLg0",
    authDomain: "travel-yeh.firebaseapp.com",
    projectId: "travel-yeh",
    storageBucket: "travel-yeh.firebasestorage.app",
    messagingSenderId: "62005891712",
    appId: "1:62005891712:web:4653c17db0c38f981d0c65",
    measurementId: "G-46DG11FWVQ"
  };
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 💡 權限與資料救援：優先使用環境 ID，並確保相容性
const appId = typeof __app_id !== 'undefined' ? __app_id.replace(/\//g, '_') : 'travel-yeh';
const apiKey = ""; // 執行環境自動注入

// --- AI 與數據處理工具 ---
const cleanJsonResponse = (text) => {
  if (!text) return null;
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

const callGemini = async (userQuery, isJson = false) => {
  const systemPrompt = isJson 
    ? "You are a travel assistant. Output valid JSON only, no markdown."
    : "You are a helpful travel assistant.";
    
  const payload = { 
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    tools: [{ "google_search": {} }],
    generationConfig: isJson ? { responseMimeType: "application/json" } : {}
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text;
};

// --- 子組件：匯率大師 ---
const CurrencyMaster = () => {
  const [rates, setRates] = useState({});
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('TWD');
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const [customRates, setCustomRates] = useState(() => {
    const saved = localStorage.getItem('custom_rates');
    return saved ? JSON.parse(saved) : {};
  });

  const [useCustom, setUseCustom] = useState(() => {
    const saved = localStorage.getItem('use_custom_status');
    return saved ? JSON.parse(saved) : {};
  });

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
      const data = await res.json();
      if (data.result === 'success') {
        setRates(data.rates);
        setError(null);
      } else { throw new Error('無法獲取匯率數據'); }
    } catch (err) {
      setError('匯率讀取失敗，請檢查網路連線。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRates(); }, [baseCurrency]);

  useEffect(() => {
    localStorage.setItem('custom_rates', JSON.stringify(customRates));
    localStorage.setItem('use_custom_status', JSON.stringify(useCustom));
  }, [customRates, useCustom]);

  const getCurrentRate = (currency) => {
    if (useCustom[currency] && customRates[currency]) return customRates[currency];
    return rates[currency] || 0;
  };

  const convertedAmount = useMemo(() => {
    const rate = getCurrentRate(targetCurrency);
    return (amount * rate).toFixed(2);
  }, [amount, targetCurrency, rates, customRates, useCustom]);

  const filteredCurrencies = Object.keys(rates).filter(currency => {
    const name = currencyNames[currency] || "";
    return currency.toLowerCase().includes(searchTerm.toLowerCase()) || name.includes(searchTerm);
  });

  return (
    <div className="animate-fade-in space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-10">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-8 items-center">
            <div className="md:col-span-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">輸入金額</label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"><DollarSign size={20} /></div>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full pl-12 pr-4 py-5 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all text-2xl font-black" />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)} className="bg-white border shadow-sm rounded-lg px-2 py-1 text-xs font-black cursor-pointer outline-none">
                    {Object.keys(rates).map(curr => <option key={curr} value={curr}>{curr}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-center md:col-span-1">
              <div className="bg-blue-50 p-4 rounded-full text-blue-600 shadow-inner">
                <ArrowLeftRight className="md:rotate-0 rotate-90" size={24} />
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">轉換結果</label>
              <div className="relative">
                <div className="w-full pl-6 pr-4 py-5 bg-blue-600 rounded-2xl text-white flex items-center justify-between shadow-xl shadow-blue-100">
                  <div>
                    <span className="text-3xl font-black">{convertedAmount}</span>
                    <p className="text-blue-200 text-[10px] mt-1 font-bold">1 {baseCurrency} = {getCurrentRate(targetCurrency).toFixed(4)} {targetCurrency}</p>
                  </div>
                  <select value={targetCurrency} onChange={(e) => setTargetCurrency(e.target.value)} className="bg-blue-700 text-white border-none rounded-lg px-2 py-1 text-xs font-black cursor-pointer outline-none">
                    {Object.keys(rates).map(curr => <option key={curr} value={curr}>{curr}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border-t px-10 py-5 flex flex-wrap gap-4 justify-between items-center">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <TrendingUp size={16} className="text-green-500" />
            <span>{useCustom[targetCurrency] ? `正在使用自定義匯率 (${currencyNames[targetCurrency] || targetCurrency})` : '目前採用即時市場匯率'}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowSettings(!showSettings)} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${showSettings ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-600 shadow-sm'}`}>
              <Settings2 size={16} /> 匯率管理
            </button>
            <button onClick={fetchRates} className="text-xs font-black text-blue-600 flex items-center gap-1 uppercase tracking-tighter"><RotateCcw size={14} /> 重整</button>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="font-black text-xl text-slate-800">匯率自定義管理</h3>
              <p className="text-xs text-slate-400 font-bold">您可以手動覆寫市場匯率值</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder="搜尋..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border rounded-xl text-sm font-bold outline-none focus:ring-4 ring-blue-50 transition-all" />
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black sticky top-0 z-10">
                <tr>
                  <th className="px-8 py-4">貨幣</th>
                  <th className="px-8 py-4 text-right">市場</th>
                  <th className="px-8 py-4 text-center">模式</th>
                  <th className="px-8 py-4">自定義數值</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCurrencies.map(curr => (
                  <tr key={curr} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-8 py-4">
                      <div className="font-black text-slate-700">{curr}</div>
                      <div className="text-[10px] text-slate-400 font-bold">{currencyNames[curr] || "其他"}</div>
                    </td>
                    <td className="px-8 py-4 text-right font-mono text-slate-500 text-sm">{rates[curr]?.toFixed(4)}</td>
                    <td className="px-8 py-4 text-center">
                      <button onClick={() => setUseCustom(p => ({...p, [curr]: !p[curr]}))} className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${useCustom[curr] ? 'bg-orange-100 text-orange-600 border border-orange-200' : 'bg-green-100 text-green-600 border border-green-200'}`}>
                        {useCustom[curr] ? '自定義' : '市場'}
                      </button>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <input type="number" step="0.0001" disabled={!useCustom[curr]} value={customRates[curr] || ''} onChange={(e) => setCustomRates(p => ({...p, [curr]: parseFloat(e.target.value) || 0}))} className={`w-24 px-3 py-1.5 rounded-xl border text-sm font-bold ${useCustom[curr] ? 'bg-white border-orange-300' : 'bg-slate-50 border-transparent text-slate-300'}`} />
                        {useCustom[curr] && <Save size={14} className="text-orange-500 animate-pulse" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-md z-[200] flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-blue-600 mb-2" size={40} />
          <p className="text-blue-600 font-black tracking-widest text-sm">更新匯率中...</p>
        </div>
      )}
    </div>
  );
};

// --- 主組件 App ---

const App = () => {
  const [view, setView] = useState('home');
  const [activeTab, setActiveTab] = useState('itinerary'); 
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [tripInfo, setTripInfo] = useState({ country: '', city: '', startDate: '', duration: 3 });
  const [itineraryData, setItineraryData] = useState({ days: {} });
  
  const [newSpot, setNewSpot] = useState({ time: '09:00', spot: '', note: '' });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
      html, body, #root { min-height: 100vh !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background-color: #f8fafc !important; font-family: 'Noto Sans TC', sans-serif !important; }
      #root { display: flex !important; flex-direction: column !important; align-items: center !important; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
    `;
    document.head.appendChild(style);
  }, []);

  // 1. 身份驗證 (嚴格遵循 Rule 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth failed", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. 監聽旅程清單 (RULE 1)
  useEffect(() => {
    if (!user) return;
    const tripsRef = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    const unsub = onSnapshot(tripsRef, (snapshot) => {
      const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(tripList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, (err) => {
      console.error("Firestore Permission Denied (Trips):", err);
    });
    return () => unsub();
  }, [user]);

  // 3. 監聽特定旅程細節 (RULE 1)
  useEffect(() => {
    if (!user || !tripId) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        setItineraryData({ days: docSnap.data().days || {} });
        setView('editor');
      }
    }, (err) => console.error("Firestore Permission Denied (Itinerary):", err));

    const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(tripRef, (docSnap) => {
      if (docSnap.exists()) setTripInfo(docSnap.data());
    }, (err) => console.error("Firestore Permission Denied (TripInfo):", err));

    return () => { unsubItin(); unsubTrip(); };
  }, [user, tripId]);

  const updateItinField = async (path, value) => {
    if (!user || !tripId) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), { [path]: value });
  };

  const getFormattedDate = (baseDate, dayOffset) => {
    if (!baseDate) return "";
    const date = new Date(baseDate);
    date.setDate(date.getDate() + (dayOffset - 1));
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    const newId = crypto.randomUUID();
    const days = {};
    for (let i = 1; i <= Math.max(1, parseInt(tripInfo.duration)); i++) { days[i] = { spots: [] }; }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', newId), {
        ...tripInfo, creator: user.uid, createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', newId), { days });
      setTripId(newId);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
         <Loader2 className="animate-spin text-blue-600" size={48} />
         <p className="text-slate-500 font-black italic">建立連線與權限配置中...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      {view === 'home' ? (
        <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-fade-in">
          <div className="text-center mb-16">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0"><Plane size={48} /></div>
            <h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase leading-none">Travel Planner</h1>
            <p className="text-slate-400 font-bold tracking-widest text-sm italic">找回您的富國島冒險之旅</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-start">
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Plus className="text-blue-600" /> 建立新旅程</h3>
              <form onSubmit={handleCreate} className="bg-white p-10 rounded-[3rem] shadow-xl space-y-8 border border-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">國家</label><input required placeholder="如: 越南" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">城市</label><input required placeholder="如: 富國島" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">日期</label><input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">天數</label><input required type="number" min="1" max="14" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} /></div>
                </div>
                <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl active:scale-95 transition-all">{isLoading ? <Loader2 className="animate-spin mx-auto" /> : "開始規劃"}</button>
              </form>
            </div>
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600" /> 旅程清單 ({trips.length})</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                {trips.map((trip) => (
                  <div key={trip.id} onClick={() => setTripId(trip.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Globe size={24} /></div>
                      <div><h4 className="text-xl font-black text-slate-800 tracking-tight">{trip.city} 之旅</h4><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{trip.country} · {trip.startDate}</p></div>
                    </div>
                    <ChevronRight className="text-slate-200 group-hover:text-blue-600 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-12 text-slate-300 text-[10px] font-bold uppercase tracking-widest">{VERSION_INFO}</div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center pb-24">
          <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-50">
            <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
              <div className="p-2 bg-blue-600 text-white rounded-2xl group-hover:rotate-12 transition-transform shadow-lg"><Plane size={24} className="rotate-45" /></div>
              <span className="tracking-tighter uppercase font-black">Traveler</span>
            </div>
            <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              <button onClick={() => setActiveTab('itinerary')} className={`px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'itinerary' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Calendar size={14}/> 行程規劃</button>
              <button onClick={() => setActiveTab('currency')} className={`px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'currency' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Coins size={14}/> 匯率管理</button>
            </div>
            <div className="text-right">
              <div className="font-black text-slate-800 text-xl leading-none">{tripInfo.city}</div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 inline-block bg-slate-50 px-2 py-0.5 rounded-full">{tripInfo.startDate}</div>
            </div>
          </nav>
          
          <main className="w-full max-w-5xl p-6 md:p-12 animate-fade-in">
            {activeTab === 'itinerary' ? (
              <div className="space-y-10">
                <div className="flex gap-3 overflow-x-auto pb-6 scrollbar-hide">
                  {Object.keys(itineraryData.days).map(day => (
                    <button key={day} onClick={() => {setActiveDay(parseInt(day)); setEditingId(null);}} className={`shrink-0 px-10 py-4 rounded-2xl font-black transition-all border ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-xl scale-105 border-blue-600' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>D{day} · {getFormattedDate(tripInfo.startDate, parseInt(day)).split('/').slice(1).join('/')}</button>
                  ))}
                </div>
                <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-sm border border-slate-100">
                  <div className="flex justify-between items-end mb-10">
                    <h2 className="text-5xl font-black text-slate-900 italic tracking-tighter">Day {activeDay}</h2>
                    <div className="w-16 h-1.5 bg-blue-600 rounded-full mb-2"></div>
                  </div>
                  <form onSubmit={addSpot} className="mb-10 space-y-3 bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                    <div className="flex gap-3 flex-wrap md:flex-nowrap">
                       <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full md:w-auto shadow-sm"><Clock size={18} className="text-blue-500" /><input type="time" value={newSpot.time} onChange={e => setNewSpot({...newSpot, time: e.target.value})} className="bg-transparent font-black outline-none w-24" /></div>
                       <input placeholder="今天想到哪裡？" required value={newSpot.spot} onChange={e => setNewSpot({...newSpot, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-bold outline-none shadow-sm" />
                    </div>
                    <div className="flex gap-3">
                       <textarea placeholder="詳細備註..." value={newSpot.note} onChange={e => setNewSpot({...newSpot, note: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-medium h-20 resize-none text-sm shadow-sm" />
                       <button type="submit" className="bg-slate-900 text-white px-8 rounded-xl font-black flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-lg"><Plus size={24}/><span className="text-[10px]">加入</span></button>
                    </div>
                  </form>
                  <div className="space-y-8 relative before:content-[''] before:absolute before:left-[27px] before:top-4 before:bottom-4 before:w-1 before:bg-slate-50">
                    {(itineraryData.days[activeDay]?.spots || []).map((item, idx) => (
                      <div key={item.id} className="relative pl-16 group">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
                          <button onClick={async () => {
                            const spots = [...itineraryData.days[activeDay].spots]; if (idx === 0) return;
                            [spots[idx], spots[idx-1]] = [spots[idx-1], spots[idx]];
                            await updateItinField(`days.${activeDay}.spots`, spots);
                          }} className="text-slate-200 hover:text-blue-600 active:scale-125"><ArrowUp size={20}/></button>
                          <div className="w-14 h-14 bg-white border-4 border-slate-50 rounded-2xl flex items-center justify-center text-[10px] font-black text-blue-600 shadow-md group-hover:scale-110 transition-transform">{item.time}</div>
                          <button onClick={async () => {
                            const spots = [...itineraryData.days[activeDay].spots]; if (idx === spots.length - 1) return;
                            [spots[idx], spots[idx+1]] = [spots[idx+1], spots[idx]];
                            await updateItinField(`days.${activeDay}.spots`, spots);
                          }} className="text-slate-200 hover:text-blue-600 active:scale-125"><ArrowDown size={20}/></button>
                        </div>
                        <div className={`p-8 bg-white border rounded-[2.5rem] flex justify-between items-start transition-all shadow-sm ${editingId === item.id ? 'border-blue-500 ring-8 ring-blue-50/50 shadow-2xl' : 'border-slate-100 hover:shadow-xl border-l-8 border-l-transparent hover:border-l-blue-600'}`}>
                          {editingId === item.id ? (
                            <div className="space-y-4 flex-1 animate-fade-in">
                               <div className="flex gap-2"><input type="time" value={editData.time} onChange={e => setEditData({...editData, time: e.target.value})} className="p-3 border rounded-xl font-black text-sm w-32 bg-slate-50 outline-none" /><input value={editData.spot} onChange={e => setEditData({...editData, spot: e.target.value})} className="flex-1 p-3 border rounded-xl font-black text-sm bg-slate-50 outline-none" /></div>
                               <textarea value={editData.note} onChange={e => setEditData({...editData, note: e.target.value})} className="w-full p-3 border rounded-xl text-sm h-24 resize-none bg-slate-50 outline-none" />
                               <div className="flex justify-end gap-3"><button onClick={() => setEditingId(null)} className="text-sm font-bold text-slate-400 px-4">取消</button><button onClick={async () => { const spots = itineraryData.days[activeDay].spots.map(s => s.id === editingId ? editData : s); await updateItinField(`days.${activeDay}.spots`, spots); setEditingId(null); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-black flex items-center gap-2 shadow-lg"><Save size={16}/> 儲存</button></div>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-3 flex-1">
                                <div className="flex items-center gap-3"><h4 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">{item.spot}</h4><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black flex items-center gap-1 hover:bg-blue-600 hover:text-white transition-all shadow-sm"><MapPin size={12}/> 地圖</a></div>
                                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100"><p className="text-slate-500 text-sm italic whitespace-pre-wrap leading-relaxed">{item.note || "點擊右側編輯圖示編修行程..."}</p></div>
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all ml-4">
                                <button onClick={() => { setEditingId(item.id); setEditData({ ...item }); }} className="p-3 text-slate-300 hover:text-blue-500 bg-slate-50 rounded-2xl shadow-sm"><Edit3 size={18}/></button>
                                <button onClick={async () => { const updated = itineraryData.days[activeDay].spots.filter(s => s.id !== item.id); await updateItinField(`days.${activeDay}.spots`, updated); }} className="p-3 text-slate-300 hover:text-red-500 bg-slate-50 rounded-2xl shadow-sm"><Trash2 size={18}/></button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!itineraryData.days[activeDay]?.spots || itineraryData.days[activeDay].spots.length === 0) && (
                       <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[3rem]"><Calendar className="text-slate-100 mx-auto mb-6" size={80} /><p className="text-slate-300 font-black text-xl italic text-center">今天還沒有安排任何景點！</p></div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <CurrencyMaster />
            )}
          </main>

          <div className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] p-3 flex justify-around items-center z-[100] shadow-2xl">
            <button onClick={() => setActiveTab('itinerary')} className={`p-4 rounded-2xl transition-all ${activeTab === 'itinerary' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><Calendar size={20} /></button>
            <button onClick={() => setActiveTab('currency')} className={`p-4 rounded-2xl transition-all ${activeTab === 'currency' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><Coins size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
