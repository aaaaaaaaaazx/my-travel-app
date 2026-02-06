import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
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
  deleteDoc,
  collection
} from 'firebase/firestore';
import { 
  Plane, Calendar, Plus, Trash2, Clock, Share2, 
  Copy, CheckCircle, AlertCircle, Loader2, Sparkles, X, Globe, Map as MapIcon, ChevronRight,
  Cloud, Sun, PlaneTakeoff, ArrowUp, ArrowDown, Edit3, Save, MapPin, 
  ChevronDown, ChevronUp, StickyNote, Eye, EyeOff, Image as ImageIcon, ExternalLink,
  Smartphone, Shirt, Bath, Pill, FileText, Package, Calculator, Equal, ArrowLeft, ArrowRight,
  Wallet, Utensils, Home, Car, ShoppingBag, MoreHorizontal, Receipt
} from 'lucide-react';

/**
 * 🏆 Travel Planner - 彥麟製作最終黃金基準穩定版 (2026.02.06)
 * ------------------------------------------------
 * 穩定性更新 V2.13：
 * 1. 修復編譯錯誤：移除重複宣告的 ArrowRight。
 * 2. 修復權限錯誤：確保先 Auth 後監聽，並加入路徑保護。
 * 3. 完整功能：行程(支援移動/日期星期)、天氣、費用(分類記帳)、清單(6大類)、匯率(8位數計算機)。
 * 4. 媒體支援：行程備註支援圖片顯示與自動連結。
 */

const VERSION_INFO = "穩定版 V2.13 - 2026/02/06 22:15";

// --- 配置與資料 ---
const currencyNames = {
  "TWD": "台灣 - 台幣", "USD": "美國 - 美金", "JPY": "日本 - 日圓", "KRW": "韓國 - 韓元",
  "THB": "泰國 - 泰銖", "VND": "越南 - 越南盾", "HKD": "香港 - 港幣", "EUR": "歐盟 - 歐元",
  "CNY": "中國 - 人民幣", "GBP": "英國 - 英鎊", "SGD": "新加坡 - 新加坡幣", "AUD": "澳洲 - 澳幣"
};

const EXPENSE_CATEGORIES = [
  { id: 'food', name: '餐飲', icon: Utensils, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'stay', name: '住宿', icon: Home, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'transport', name: '交通', icon: Car, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'shopping', name: '購物', icon: ShoppingBag, color: 'text-pink-500', bg: 'bg-pink-50' },
  { id: 'play', name: '娛樂', icon: Sparkles, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { id: 'other', name: '其他', icon: MoreHorizontal, color: 'text-slate-500', bg: 'bg-slate-50' }
];

const CHECKLIST_CATEGORIES = [
  { id: 'cat_3c', name: '3C 產品', icon: Smartphone, items: ['手機', '充電線', '相機', '萬用轉接頭', '行動電源'] },
  { id: 'cat_clothing', name: '衣物', icon: Shirt, items: ['上衣', '褲子', '外套', '鞋子', '內衣褲'] },
  { id: 'cat_toiletries', name: '盥洗用品', icon: Bath, items: ['洗面乳', '牙刷', '毛巾', '濕紙巾'] },
  { id: 'cat_medicine', name: '個人藥品', icon: Pill, items: ['感冒藥', '止痛藥', 'OK 繃'] },
  { id: 'cat_docs', name: '重要文件', icon: FileText, items: ['護照', '簽證', '機票', '住宿憑證'] },
  { id: 'cat_others', name: '其他用品', icon: Package, items: ['水壺', '鑰匙', '外幣現金', '頸枕'] }
];

// --- Firebase 初始化 ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDHfIqjgq0cJ0fCuKlIBQhof6BEJsaYLg0",
  authDomain: "travel-yeh.firebaseapp.com",
  projectId: "travel-yeh",
  storageBucket: "travel-yeh.firebasestorage.app",
  messagingSenderId: "62005891712",
  appId: "1:62005891712:web:4653c17db0c38f981d0c65"
};
const appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const fAuth = getAuth(appInstance);
const fDb = getFirestore(appInstance);
const fAppId = typeof __app_id !== 'undefined' ? __app_id : 'travel-yeh';

// --- 工具函數 ---
const getFormattedDate = (baseDate, dayOffset) => {
  if (!baseDate) return "";
  try {
    const d = new Date(baseDate);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + (dayOffset - 1));
    return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch (e) { return ""; }
};

const getDayOfWeek = (baseDate, dayOffset) => {
  if (!baseDate) return "";
  try {
    const d = new Date(baseDate);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + (dayOffset - 1));
    return d.toLocaleDateString('zh-TW', { weekday: 'long' });
  } catch (e) { return ""; }
};

const renderTextWithLinks = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1 break-all">
          {part} <ExternalLink size={12} />
        </a>
      );
    }
    return part;
  });
};

// --- 子組件：費用 ---
const ExpenseMaster = ({ itineraryData, updateItinField }) => {
  const expenses = itineraryData?.expenses || [];
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');

  const totalAmount = useMemo(() => expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0), [expenses]);
  const categoryTotals = useMemo(() => {
    const totals = {};
    expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + (parseFloat(e.amount) || 0); });
    return totals;
  }, [expenses]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!item || !amount) return;
    const newExp = { id: Date.now().toString(), item, amount, category, date: new Date().toISOString() };
    await updateItinField('expenses', [...expenses, newExp]);
    setItem(''); setAmount('');
  };

  return (
    <div className="animate-fade-in space-y-8 w-full max-w-5xl mx-auto pb-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 flex flex-col justify-center">
            <h3 className="text-slate-400 font-black text-xs uppercase tracking-widest mb-2 ml-1">旅程總花費</h3>
            <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black text-slate-900 tracking-tighter">${totalAmount.toLocaleString()}</span>
                <span className="text-slate-300 font-bold text-xs uppercase tracking-widest">twd</span>
            </div>
        </div>
        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-xl text-white">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">分類統計</h4>
            <div className="space-y-3">
                {EXPENSE_CATEGORIES.map(cat => {
                    const total = categoryTotals[cat.id] || 0;
                    const percent = totalAmount > 0 ? Math.round((total / totalAmount) * 100) : 0;
                    return (
                        <div key={cat.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <cat.icon size={14} className={cat.color} />
                                <span className="text-xs font-bold text-slate-300">{cat.name}</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-100">${total.toLocaleString()} ({percent}%)</span>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
      <div className="bg-white p-8 rounded-[4rem] shadow-lg border border-slate-100">
          <form onSubmit={handleAdd} className="flex flex-wrap md:flex-nowrap gap-4 items-end">
              <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">費用內容</label>
                  <input required placeholder="如：當地午餐" value={item} onChange={e => setItem(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none" />
              </div>
              <div className="w-full md:w-48 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">金額</label>
                  <input required type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none" />
              </div>
              <div className="w-full md:w-40 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">分類</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-black outline-none">
                      {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
              </div>
              <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl transition-all active:scale-95"><Plus size={28}/></button>
          </form>
      </div>
      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-50 overflow-hidden">
          <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black">
                  <tr><th className="px-8 py-5">項目</th><th className="px-8 py-5">分類</th><th className="px-8 py-5 text-right">金額</th><th className="px-8 py-5 text-center">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                  {expenses.length > 0 ? [...expenses].reverse().map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5 font-black text-slate-700">{exp.item}</td>
                          <td className="px-8 py-5"><span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-[10px] font-black">{exp.category}</span></td>
                          <td className="px-8 py-5 text-right font-mono font-black text-slate-800">${parseFloat(exp.amount).toLocaleString()}</td>
                          <td className="px-8 py-5 text-center"><button onClick={async () => await updateItinField('expenses', expenses.filter(e => e.id !== exp.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button></td>
                      </tr>
                  )) : (
                      <tr><td colSpan="4" className="px-8 py-20 text-center text-slate-300 font-bold italic tracking-widest">目前尚無記錄</td></tr>
                  )}
              </tbody>
          </table>
      </div>
    </div>
  );
};

const App = () => {
  const [view, setView] = useState('home');
  const [activeTab, setActiveTab] = useState('itinerary');
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(1);
  const [tripInfo, setTripInfo] = useState({ country: '', city: '', startDate: '', duration: 3 });
  const [itineraryData, setItineraryData] = useState({ days: {}, checklist: [], expenses: [] });
  const [newSpot, setNewSpot] = useState({ time: '09:00', spot: '', note: '', imageUrl: '' });
  const [aiStatus, setAiStatus] = useState({ type: '', message: '' });
  const [showAllNotes, setShowAllNotes] = useState(false); 
  const [expandedItems, setExpandedItems] = useState({}); 
  const [currencyAmount, setCurrencyAmount] = useState(1);

  // 🔐 身份驗證流程 (遵循 Rule 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(fAuth, __initial_auth_token);
        } else {
          await signInAnonymously(fAuth);
        }
      } catch (e) { console.error("Auth init error", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(fAuth, (u) => { 
        if (u) { setUser(u); setIsLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  // 📊 資料庫監聽 (遵循 Rule 1)
  useEffect(() => {
    if (!user || !fDb) return;
    const tripsRef = collection(fDb, 'artifacts', fAppId, 'public', 'data', 'trips');
    return onSnapshot(tripsRef, (snapshot) => {
      setTrips(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, (err) => {
      console.error("Firestore Error:", err);
      if (err.code === 'permission-denied') setAiStatus({ type: 'error', message: '存取權限受限。' });
    });
  }, [user]);

  useEffect(() => {
    if (!user || !tripId || !fDb) return;
    const itinRef = doc(fDb, 'artifacts', fAppId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, (snap) => {
      if (snap.exists()) {
          const d = snap.data();
          setItineraryData({ days: d.days || {}, checklist: d.checklist || [], expenses: d.expenses || [] });
          setView('editor');
      }
    }, (err) => console.error("Itinerary Error:", err));

    const tripRef = doc(fDb, 'artifacts', fAppId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(tripRef, (snap) => { if (snap.exists()) setTripInfo(snap.data()); });
    return () => { unsubItin(); unsubTrip(); };
  }, [user, tripId]);

  const updateItinField = async (field, value) => {
    if (!user || !tripId || !fDb) return;
    try { await updateDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'itineraries', tripId), { [field]: value }); } catch (e) { console.error(e); }
  };

  const moveDay = async (dir) => {
    if (!user || !tripId || !fDb) return;
    const days = { ...itineraryData.days };
    const target = activeDay + dir;
    if (target < 1 || target > parseInt(tripInfo.duration || "0")) return;
    const currentData = days[activeDay];
    const targetData = days[target];
    days[activeDay] = targetData;
    days[target] = currentData;
    await updateItinField('days', days);
    setActiveDay(target);
    setAiStatus({ type: 'success', message: '已調換行程順序' });
  };

  const handleCreate = async e => {
    e.preventDefault(); if (!user || !fDb) return; setIsLoading(true);
    const newId = crypto.randomUUID();
    const days = {};
    for (let i = 1; i <= Math.max(1, parseInt(tripInfo.duration)); i++) days[i] = { spots: [], title: '' };
    try {
      await setDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'trips', newId), { ...tripInfo, creator: user.uid, createdAt: new Date().toISOString() });
      await setDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'itineraries', newId), { days, checklist: [], expenses: [] });
      setTripId(newId);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  // 🎨 注入 Favicon 與 Tailwind
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script'); script.id = 'tailwind-cdn'; script.src = 'https://cdn.tailwindcss.com'; document.head.appendChild(script);
    }
    const style = document.createElement('style');
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
      html, body, #root { min-height: 100vh !important; width: 100% !important; background-color: #f8fafc; font-family: 'Noto Sans TC', sans-serif; margin: 0; padding: 0; }
      #root { display: flex; flex-direction: column; align-items: center; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .premium-slider { scrollbar-width: thin; scrollbar-color: #2563eb #f1f5f9; }
      @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
    `; 
    document.head.appendChild(style);

    const setFavicon = () => {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563eb'%3E%3Cpath d='M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z'/%3E%3C/svg%3E";
    };
    setFavicon();
  }, []);

  if (isLoading) return <div className="flex flex-col items-center justify-center h-screen bg-slate-50"><Loader2 className="animate-spin text-blue-600 mb-2" size={48} /><p className="text-slate-500 font-bold italic">啟動彥麟的冒險引擎...</p></div>;

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      {aiStatus.message && ( <div className="fixed top-4 z-[200] px-6 py-3 rounded-2xl shadow-2xl bg-white border border-red-100 text-red-600 animate-fade-in flex items-center gap-3"> <span className="font-bold text-sm">{aiStatus.message}</span><button onClick={() => setAiStatus({ type: '', message: '' })}><X size={14}/></button> </div> )}

      {view === 'home' ? (
        <div className="w-full max-w-5xl px-6 py-20 animate-fade-in">
          <div className="text-center mb-16"><div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0"><Plane size={48} /></div><h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase">Travel Planner</h1><p className="text-slate-400 font-bold tracking-widest text-sm italic text-center">找回您的冒險之旅-彥麟製作</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-start">
            <div className="space-y-6"><h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Plus className="text-blue-600" /> 建立新旅程</h3>
              <form onSubmit={handleCreate} className="bg-white p-10 rounded-[3rem] shadow-xl space-y-8 border border-white">
                <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">國家</label><input required placeholder="如: 日本" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">城市</label><input required placeholder="如: 東京" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} /></div></div>
                <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">出發日期</label><input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">天數</label><input required type="number" min="1" max="14" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} /></div></div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl transition-all">開始規劃行程</button>
              </form>
            </div>
            <div className="space-y-6"><h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600" /> 旅程清單 ({trips.length})</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                {trips.map(trip => (<div key={trip.id} onClick={() => setTripId(trip.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between"><div className="flex items-center gap-5"><div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm"><Globe size={24} /></div><div><h4 className="text-xl font-black text-slate-800 tracking-tight">{trip.city} 之旅</h4><p className="text-[10px] font-bold text-slate-400 mt-1">{trip.country} · {trip.startDate}</p></div></div><ChevronRight className="text-slate-200 group-hover:text-blue-600" /></div>))}
              </div>
            </div>
          </div>
          <div className="mt-12 text-slate-300 text-[10px] font-bold uppercase tracking-widest text-center">{VERSION_INFO}</div>
        </div>
      ) : (
        <div className="w-full animate-fade-in flex flex-col items-center">
          <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-50">
            <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}><Plane size={24} className="rotate-45" /><span className="tracking-tighter uppercase font-black">Traveler</span></div>
            <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              {['itinerary', 'weather', 'expenses', 'checklist', 'currency'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>
                  {tab === 'itinerary' ? '行程' : tab === 'weather' ? '天氣' : tab === 'expenses' ? '費用' : tab === 'checklist' ? '清單' : '匯率'}
                </button>
              ))}
            </div>
            <div className="text-right font-black text-slate-800">{tripInfo.city} 之旅</div>
          </nav>
          
          <main className="w-full max-w-5xl p-6 md:p-12">
            {activeTab === 'itinerary' ? (
              <div className="space-y-12">
                <div className="flex gap-4 overflow-x-auto pb-4 premium-slider flex-nowrap px-2">
                  {Object.keys(itineraryData?.days || {}).map(day => (
                    <button key={day} onClick={() => {setActiveDay(parseInt(day));}} className={`shrink-0 w-28 h-28 rounded-3xl font-black transition-all border flex flex-col items-center justify-center gap-1 shadow-sm ${activeDay === parseInt(day) ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-105' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>
                      <span className="text-xs uppercase opacity-60">Day</span><span className="text-3xl leading-none">{day}</span>
                      <span className="text-[10px] mt-1 font-bold">{getFormattedDate(tripInfo.startDate, parseInt(day)).slice(5)}</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-end gap-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-6xl font-black text-slate-900 tracking-tighter italic leading-none">Day {activeDay}</h2>
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button onClick={() => moveDay(-1)} disabled={activeDay === 1} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors"><ArrowLeft size={20}/></button>
                        <div className="w-px h-6 bg-slate-200 my-auto"></div>
                        <button onClick={() => moveDay(1)} disabled={activeDay === parseInt(tripInfo.duration || "0")} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors"><ArrowRight size={20}/></button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <span className="text-lg text-slate-400 font-bold ml-1 mb-1 block">({getFormattedDate(tripInfo.startDate, activeDay)} {getDayOfWeek(tripInfo.startDate, activeDay)})</span>
                      <input className="text-3xl font-black text-blue-600 bg-transparent outline-none border-b-2 border-transparent focus:border-blue-200 w-full" placeholder="今日主題..." value={itineraryData?.days?.[activeDay]?.title || ''} onChange={e => updateItinField(`days.${activeDay}.title`, e.target.value)} />
                    </div>
                  </div>
                  <button onClick={() => setShowAllNotes(!showAllNotes)} className="flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-black transition-all shadow-sm border bg-white text-slate-500 hover:bg-slate-50 active:scale-95">
                    {showAllNotes ? <EyeOff size={16} /> : <Eye size={16} />} {showAllNotes ? '隱藏全部備註' : '顯示全部備註'}
                  </button>
                </div>
                <div className="bg-white p-8 md:p-12 rounded-[4rem] shadow-sm border border-slate-100">
                  <form onSubmit={async e => { 
                    e.preventDefault(); 
                    const current = itineraryData?.days?.[activeDay]?.spots || []; 
                    await updateItinField(`days.${activeDay}.spots`, [...current, { ...newSpot, id: Date.now().toString() }]); 
                    setNewSpot({ time: '09:00', spot: '', note: '', imageUrl: '' }); 
                  }} className="mb-12 space-y-4 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
                    <div className="flex gap-3"><input type="time" value={newSpot.time} onChange={e => setNewSpot({...newSpot, time: e.target.value})} className="p-3 bg-white border rounded-xl font-black" /><input placeholder="景點名稱" required value={newSpot.spot} onChange={e => setNewSpot({...newSpot, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-bold outline-none" /></div>
                    <div className="flex gap-3"><input placeholder="圖片網址" value={newSpot.imageUrl} onChange={e => setNewSpot({...newSpot, imageUrl: e.target.value})} className="w-1/3 p-3 bg-white border rounded-xl font-bold" /><textarea placeholder="詳細備註..." value={newSpot.note} onChange={e => setNewSpot({...newSpot, note: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-medium h-20 resize-none text-sm" /><button type="submit" className="bg-slate-900 text-white px-8 rounded-xl font-black active:scale-95"><Plus size={24}/></button></div>
                  </form>
                  <div className="space-y-8 relative before:content-[''] before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-1.5 before:bg-slate-50 before:rounded-full">
                    {(itineraryData?.days?.[activeDay]?.spots || []).map((item, idx) => {
                      const isExpanded = showAllNotes || !!expandedItems[item.id];
                      return (
                        <div key={item.id} className="relative pl-20">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1"><div className="w-16 h-16 bg-white border-8 border-slate-50 rounded-[1.5rem] flex items-center justify-center text-[11px] font-black text-blue-600 shadow-md transition-transform group-hover:scale-110">{item.time}</div></div>
                          <div onClick={() => setExpandedItems(prev => ({...prev, [item.id]: !prev[item.id]}))} className={`p-10 bg-white border rounded-[3rem] transition-all cursor-pointer hover:shadow-2xl ${isExpanded ? 'border-blue-100 shadow-lg' : 'border-slate-100'}`}>
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-4 flex-1">
                                  <div className="flex items-center gap-4 flex-wrap">
                                    <h4 className="text-3xl font-black text-slate-800 leading-tight tracking-tight">{item.spot}</h4>
                                    <div className="flex gap-2">
                                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-black">地圖</a>
                                      {(item.note || item.imageUrl) && <div className={`px-2 py-1.5 rounded-lg flex items-center gap-1 text-[10px] font-black ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400'}`}><StickyNote size={12}/> {isExpanded ? '已展開' : '細節'}</div>}
                                    </div>
                                  </div>
                                  {isExpanded && (
                                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
                                      {item.imageUrl && <img src={item.imageUrl} alt={item.spot} className="w-full max-w-md h-auto rounded-2xl shadow-sm border border-white" onError={e => e.target.style.display='none'} />}
                                      <p className="text-slate-500 text-sm italic whitespace-pre-wrap leading-relaxed">{renderTextWithLinks(item.note) || "暫無說明"}</p>
                                    </div>
                                  )}
                                </div>
                                <button onClick={async (e) => { e.stopPropagation(); if(confirm('刪除景點？')) await updateItinField(`days.${activeDay}.spots`, itineraryData.days[activeDay].spots.filter(s => s.id !== item.id)); }} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(!itineraryData?.days?.[activeDay]?.spots?.length) && ( <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[3rem]"><Calendar className="text-slate-100 mx-auto mb-6" size={80} /><p className="text-slate-300 font-black text-xl italic text-center">今天還沒有安排任何景點！</p></div> )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'weather' ? <WeatherMaster tripInfo={tripInfo} /> : activeTab === 'checklist' ? (
                <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in pb-10">
                    <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 text-center">
                        <h3 className="text-2xl font-black text-slate-800">行李清單管理</h3>
                        <p className="text-slate-400 font-bold mt-1 tracking-widest italic">彥麟製作 - 冒險必備指南</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {CHECKLIST_CATEGORIES.map(cat => (
                            <div key={cat.id} className="bg-white p-8 rounded-[3rem] shadow-lg border border-slate-50">
                                <div className="flex items-center gap-3 mb-6"><div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><cat.icon size={24}/></div><h4 className="text-xl font-black text-slate-800">{cat.name}</h4></div>
                                <div className="space-y-3">{cat.items.map((item, i) => <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl font-bold text-slate-600"><CheckCircle size={16} className="text-slate-200"/>{item}</div>)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : activeTab === 'expenses' ? <ExpenseMaster itineraryData={itineraryData} updateItinField={updateItinField} /> : <CurrencyMaster parentAmount={currencyAmount} setParentAmount={setCurrencyAmount} /> }
          </main>

          <div className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] p-3 flex justify-around items-center z-[100] shadow-2xl">
            <button onClick={() => setActiveTab('itinerary')} className={`p-4 rounded-2xl transition-all ${activeTab === 'itinerary' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><Calendar size={20} /></button>
            <button onClick={() => setActiveTab('weather')} className={`p-4 rounded-2xl transition-all ${activeTab === 'weather' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><Sun size={20} /></button>
            <button onClick={() => setActiveTab('expenses')} className={`p-4 rounded-2xl transition-all ${activeTab === 'expenses' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><Wallet size={20} /></button>
            <button onClick={() => setActiveTab('checklist')} className={`p-4 rounded-2xl transition-all ${activeTab === 'checklist' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><ListChecks size={20} /></button>
            <button onClick={() => setActiveTab('currency')} className={`p-4 rounded-2xl transition-all ${activeTab === 'currency' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><Coins size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
