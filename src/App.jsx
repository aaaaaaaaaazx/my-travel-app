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
  collection
} from 'firebase/firestore';
import { 
  Plane, Calendar, Plus, Trash2, Clock, 
  CheckCircle, AlertCircle, Loader2, X, Globe, ChevronRight,
  ArrowUp, ArrowDown, Edit3, Save, MapPin, Map as MapIcon,
  ArrowLeftRight, Settings2, RotateCcw, TrendingUp, DollarSign, CheckCircle2, Search, Circle, Coins
} from 'lucide-react';

/**
 * 🚀 行程規劃與每日主題增強版 (2026.02.05):
 * 1. 每日大標題：Day X 旁加入可編輯的今日主題欄位，自動同步雲端。
 * 2. 方形日期導覽：上方導覽維持寬大方形卡片，顯示具體月份日期。
 * 3. 權限修復：嚴格遵守身份驗證後才啟動 Firestore 監聽，解決 Permission Denied。
 * 4. 匯率整合：完整保留自定義匯率管理功能。
 */

const VERSION_INFO = "最後更新：2026/02/05 15:45 (每日主題編輯版)";

// --- Firebase 初始化 ---
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

// 💡 遵循 RULE 1：路徑格式必須正確，清除斜線
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'travel-yeh';
const appId = rawAppId.replace(/\//g, '_');
const apiKey = ""; // 執行環境自動注入

const currencyNames = {
  "USD": "美金", "TWD": "台幣", "HKD": "港幣", "JPY": "日圓", "EUR": "歐元",
  "GBP": "英鎊", "AUD": "澳幣", "CAD": "加幣", "CNY": "人民幣", "KRW": "韓元",
  "SGD": "新加坡幣", "NZD": "紐西蘭幣", "CHF": "瑞士法郎", "SEK": "瑞典克朗",
  "THB": "泰銖", "PHP": "菲律賓披索", "IDR": "印尼盾", "VND": "越南盾",
  "MYR": "馬來西亞幣", "INR": "印度盧比", "MOP": "澳門幣", "ZAR": "南非幣"
};

const cleanJsonResponse = (text) => {
  if (!text) return null;
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- 子組件：匯率管理 ---
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
      setError('連線失敗，請檢查網路。');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRates(); }, [baseCurrency]);

  useEffect(() => {
    localStorage.setItem('custom_rates', JSON.stringify(customRates));
    localStorage.setItem('use_custom_status', JSON.stringify(useCustom));
  }, [customRates, useCustom]);

  const convertedAmount = useMemo(() => {
    const rate = (useCustom[targetCurrency] && customRates[targetCurrency]) 
      ? customRates[targetCurrency] 
      : (rates[targetCurrency] || 0);
    return (amount * rate).toFixed(2);
  }, [amount, targetCurrency, rates, customRates, useCustom]);

  const filteredCurrencies = Object.keys(rates).filter(currency => {
    const name = currencyNames[currency] || "";
    return currency.toLowerCase().includes(searchTerm.toLowerCase()) || name.includes(searchTerm);
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 md:p-12">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-6 items-center">
            <div className="md:col-span-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">輸入金額</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><DollarSign size={20} /></div>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all text-2xl font-black" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)} className="bg-white border rounded-lg px-2 py-1 text-xs font-black outline-none">
                    {Object.keys(rates).map(curr => <option key={curr} value={curr}>{curr}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-center md:col-span-1"><div className="bg-blue-50 p-3 rounded-full text-blue-600 shadow-inner"><ArrowLeftRight size={24} /></div></div>
            <div className="md:col-span-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">轉換結果</label>
              <div className="w-full pl-6 pr-4 py-4 bg-blue-600 rounded-2xl text-white flex items-center justify-between shadow-xl shadow-blue-100">
                <div><span className="text-3xl font-black">{convertedAmount}</span><p className="text-blue-200 text-[10px] mt-1 font-bold">{targetCurrency}</p></div>
                <select value={targetCurrency} onChange={(e) => setTargetCurrency(e.target.value)} className="bg-blue-700 text-white border-none rounded-lg px-2 py-1 text-xs font-black outline-none">
                  {Object.keys(rates).map(curr => <option key={curr} value={curr}>{curr}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 border-t px-8 py-4 flex flex-wrap gap-4 justify-between items-center">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <TrendingUp size={16} className="text-green-500" />
            <span>{useCustom[targetCurrency] ? `自定義匯率 (${targetCurrency})` : '採用即時市場匯率'}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSettings(!showSettings)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${showSettings ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 shadow-sm'}`}><Settings2 size={14} /> 匯率管理</button>
            <button onClick={fetchRates} className="text-xs font-black text-blue-600 p-2"><RotateCcw size={14} /></button>
          </div>
        </div>
      </div>
      {showSettings && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
            <h3 className="font-black text-lg text-slate-800">匯率自定義</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input type="text" placeholder="搜尋..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 border rounded-xl text-sm font-bold outline-none focus:ring-4 ring-blue-50" />
            </div>
          </div>
          <div className="max-h-[350px] overflow-y-auto scrollbar-hide">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black sticky top-0">
                <tr><th className="px-6 py-3">幣別</th><th className="px-6 py-3 text-right">市場</th><th className="px-6 py-3 text-center">模式</th><th className="px-6 py-3 text-right">自定義</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCurrencies.map(curr => (
                  <tr key={curr} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4"><div className="font-black text-slate-700">{curr}</div><div className="text-[10px] text-slate-400 font-bold">{currencyNames[curr] || "其他"}</div></td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500 text-sm font-bold">{rates[curr]?.toFixed(4)}</td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => setUseCustom(p => ({...p, [curr]: !p[curr]}))} className={`px-3 py-1 rounded-full text-[10px] font-black ${useCustom[curr] ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{useCustom[curr] ? '手動' : '自動'}</button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <input type="number" step="0.0001" disabled={!useCustom[curr]} value={customRates[curr] || ''} onChange={(e) => setCustomRates(p => ({...p, [curr]: parseFloat(e.target.value) || 0}))} className={`w-20 p-1 border rounded-lg text-sm text-right font-bold ${useCustom[curr] ? 'bg-white border-orange-300' : 'bg-slate-50 border-transparent text-slate-300'}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 主 App 組件 ---

const App = () => {
  const [view, setView] = useState('home');
  const [activeTab, setActiveTab] = useState('itinerary');
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(1);
  const [tripInfo, setTripInfo] = useState({ country: '', city: '', startDate: '', duration: 3 });
  const [itineraryData, setItineraryData] = useState({ days: {} });
  
  const [newSpot, setNewSpot] = useState({ time: '09:00', spot: '', note: '' });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [aiStatus, setAiStatus] = useState({ type: '', message: '' });

  // 🎨 樣式與美化注入
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn'; script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
    const style = document.createElement('style');
    style.id = 'stable-ui-engine';
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
      html, body, #root { 
        min-height: 100vh !important; width: 100% !important; margin: 0 !important; padding: 0 !important; 
        background-color: #f8fafc !important; font-family: 'Noto Sans TC', sans-serif !important; 
      }
      #root { display: flex !important; flex-direction: column !important; align-items: center !important; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
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
        } else { await signInAnonymously(auth); }
      } catch (err) { console.error("Auth failed", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 監聽旅程清單 (加上權限防護 if !user)
  useEffect(() => {
    if (!user) return;
    const tripsRef = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    return onSnapshot(tripsRef, (snapshot) => {
      const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(tripList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, (err) => console.error("Firestore Permission error (Trips):", err));
  }, [user]);

  // 3. 監聽詳細行程
  useEffect(() => {
    if (!user || !tripId) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        setItineraryData({ days: docSnap.data().days || {} });
        setView('editor');
      }
    }, (err) => console.error("Firestore Permission error (Itinerary):", err));

    const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(tripRef, (docSnap) => {
      if (docSnap.exists()) setTripInfo(docSnap.data());
    }, (err) => console.error("Firestore Permission error (TripInfo):", err));

    return () => { unsubItin(); unsubTrip(); };
  }, [user, tripId]);

  const updateItinField = async (path, value) => {
    if (!user || !tripId) return;
    try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), { [path]: value }); }
    catch (err) { console.error("Update error", err); }
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
         <Loader2 className="animate-spin text-blue-600" size={48} />
         <p className="text-slate-500 font-black italic">正在載入雲端行程與權限...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      {aiStatus.message && (
        <div className={`fixed top-4 z-[200] px-6 py-3 rounded-2xl shadow-2xl animate-fade-in flex items-center gap-3 border ${aiStatus.type === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-white border-blue-100 text-blue-600'}`}>
          <span className="font-bold text-sm">{String(aiStatus.message)}</span>
          <button onClick={() => setAiStatus({ type: '', message: '' })}><X size={14}/></button>
        </div>
      )}

      {view === 'home' ? (
        <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-fade-in">
          <div className="text-center mb-16">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0 shadow-blue-200"><Plane size={48} /></div>
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
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl active:scale-95 transition-all">開始規劃</button>
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
                    <ChevronRight className="text-slate-200 group-hover:text-blue-600" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-12 text-slate-300 text-[10px] font-bold uppercase tracking-widest">{VERSION_INFO}</div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center pb-24 animate-fade-in">
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
              <div className="text-[11px] text-slate-400 font-bold mt-1 inline-block bg-slate-50 px-2 py-0.5 rounded-full">{tripInfo.startDate}</div>
            </div>
          </nav>
          
          <main className="w-full max-w-5xl p-6 md:p-12">
            {activeTab === 'itinerary' ? (
              <div className="space-y-12">
                {/* Square Date Navigation */}
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                  {Object.keys(itineraryData.days).map(day => (
                    <button 
                      key={day} 
                      onClick={() => {setActiveDay(parseInt(day)); setEditingId(null);}} 
                      className={`shrink-0 w-28 h-28 rounded-3xl font-black transition-all border flex flex-col items-center justify-center gap-1 shadow-sm ${activeDay === parseInt(day) ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-105' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                    >
                      <span className="text-xs uppercase opacity-60">Day</span>
                      <span className="text-3xl leading-none">{day}</span>
                      <span className="text-[10px] mt-1 font-bold">
                        {getFormattedDate(tripInfo.startDate, parseInt(day)).split('/').slice(1).join('/')}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Big Day Header with Editable Title */}
                <div className="text-center md:text-left space-y-4">
                  <div className="flex flex-col md:flex-row md:items-end gap-4">
                    <h2 className="text-6xl font-black text-slate-900 tracking-tighter italic leading-none shrink-0">
                      Day {activeDay}
                    </h2>
                    <input 
                      className="text-3xl md:text-4xl font-black text-blue-600 bg-transparent outline-none border-b-2 border-transparent focus:border-blue-200 placeholder:text-slate-200 flex-1 transition-all"
                      placeholder="為這天取個主題大標題..."
                      value={itineraryData.days?.[activeDay]?.title || ''}
                      onChange={(e) => updateItinField(`days.${activeDay}.title`, e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-3">
                     <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-sm shrink-0">
                       {getFormattedDate(tripInfo.startDate, activeDay)}
                     </p>
                     <div className="h-1 flex-1 bg-slate-50 rounded-full max-w-[300px]"></div>
                  </div>
                </div>

                {/* Content Area */}
                <div className="bg-white p-8 md:p-12 rounded-[4rem] shadow-sm border border-slate-100">
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const currentSpots = itineraryData.days[activeDay]?.spots || [];
                    const updated = [...currentSpots, { ...newSpot, id: Date.now().toString() }];
                    await updateItinField(`days.${activeDay}.spots`, updated);
                    setNewSpot({ time: '09:00', spot: '', note: '' });
                  }} className="mb-12 space-y-3 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
                    <div className="flex gap-3 flex-wrap md:flex-nowrap">
                       <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full md:w-auto"><Clock size={18} className="text-blue-500" /><input type="time" value={newSpot.time} onChange={e => setNewSpot({...newSpot, time: e.target.value})} className="bg-transparent font-black outline-none w-24" /></div>
                       <input placeholder="今天要在那裡留下回憶？" required value={newSpot.spot} onChange={e => setNewSpot({...newSpot, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-bold outline-none" />
                    </div>
                    <div className="flex gap-3">
                       <textarea placeholder="詳細備註 (交通、必吃、行程小筆記)..." value={newSpot.note} onChange={e => setNewSpot({...newSpot, note: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-medium h-20 resize-none text-sm" />
                       <button type="submit" className="bg-slate-900 text-white px-8 rounded-xl font-black flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg"><Plus size={24}/><span className="text-[10px]">加入</span></button>
                    </div>
                  </form>

                  <div className="space-y-10 relative before:content-[''] before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-1.5 before:bg-slate-50 before:rounded-full">
                    {(itineraryData.days[activeDay]?.spots || []).map((item, idx) => (
                      <div key={item.id} className="relative pl-20 group">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                          <button onClick={async () => {
                            const spots = [...itineraryData.days[activeDay].spots]; if (idx === 0) return;
                            [spots[idx], spots[idx-1]] = [spots[idx-1], spots[idx]];
                            await updateItinField(`days.${activeDay}.spots`, spots);
                          }} className="text-slate-200 hover:text-blue-600 active:scale-125 transition-all"><ArrowUp size={20}/></button>
                          <div className="w-16 h-16 bg-white border-8 border-slate-50 rounded-[1.5rem] flex items-center justify-center text-[11px] font-black text-blue-600 shadow-md group-hover:scale-110 transition-transform">{item.time}</div>
                          <button onClick={async () => {
                            const spots = [...itineraryData.days[activeDay].spots]; if (idx === spots.length - 1) return;
                            [spots[idx], spots[idx+1]] = [spots[idx+1], spots[idx]];
                            await updateItinField(`days.${activeDay}.spots`, spots);
                          }} className="text-slate-200 hover:text-blue-600 active:scale-125 transition-all"><ArrowDown size={20}/></button>
                        </div>
                        <div className={`p-10 bg-white border rounded-[3rem] transition-all group/item ${editingId === item.id ? 'border-blue-600 shadow-2xl ring-8 ring-blue-50' : 'border-slate-100 hover:shadow-2xl shadow-sm'}`}>
                          {editingId === item.id ? (
                            <div className="space-y-4 flex-1 animate-fade-in">
                               <div className="flex gap-2"><input type="time" value={editData.time} onChange={e => setEditData({...editData, time: e.target.value})} className="p-3 border rounded-xl font-black text-sm w-32 bg-slate-50 outline-none" /><input value={editData.spot} onChange={e => setEditData({...editData, spot: e.target.value})} className="flex-1 p-3 border rounded-xl font-black text-sm bg-slate-50 outline-none" /></div>
                               <textarea value={editData.note} onChange={e => setEditData({...editData, note: e.target.value})} className="w-full p-3 border rounded-xl text-sm h-24 resize-none bg-slate-50 outline-none" />
                               <div className="flex justify-end gap-3"><button onClick={() => setEditingId(null)} className="text-sm font-bold text-slate-400 px-4">取消</button><button onClick={async () => { const spots = itineraryData.days[activeDay].spots.map(s => s.id === editingId ? editData : s); await updateItinField(`days.${activeDay}.spots`, spots); setEditingId(null); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-black shadow-lg"><Save size={16}/> 儲存</button></div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start gap-4">
                              <div className="space-y-4 flex-1">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <h4 className="text-3xl font-black text-slate-800 tracking-tight">{item.spot}</h4>
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all inline-flex items-center gap-1.5 text-xs font-black shadow-sm"><MapPin size={14} /> 查看地圖</a>
                                </div>
                                <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-50">
                                   <p className="text-slate-500 font-medium leading-relaxed whitespace-pre-wrap text-sm italic">{item.note || "暫無詳細說明..."}</p>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 opacity-0 group-hover/item:opacity-100 transition-all">
                                <button onClick={() => { setEditingId(item.id); setEditData({...item}); }} className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl"><Edit3 size={20} /></button>
                                <button onClick={async () => { const updated = itineraryData.days[activeDay].spots.filter(s => s.id !== item.id); await updateItinField(`days.${activeDay}.spots`, updated); }} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl"><Trash2 size={20} /></button>
                              </div>
                            </div>
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
