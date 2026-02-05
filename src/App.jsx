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
  ArrowLeftRight, Settings2, RotateCcw, TrendingUp, DollarSign, CheckCircle2, Search, Circle, Coins, ListChecks,
  Sun, Cloud, CloudRain, CloudLightning, Snowflake, Thermometer, Wind, Navigation
} from 'lucide-react';

/**
 * 🚀 全功能美化穩定整合版 (2026.02.05):
 * 1. 樣式強化：強制掛載 Tailwind 與 Noto Sans，確保美化不消失。
 * 2. 行程管理：方形日期導覽 + 每日主題大標題編輯。
 * 3. 天氣預測：整合 Open-Meteo，支援中文地點轉經緯度與智能穿衣建議。
 * 4. 匯率與清單：國家標註、混合匯率模式與 10 項預設行李清單。
 */

const VERSION_INFO = "最後更新：2026/02/05 17:30 (UI 美化與權限穩定版)";

// --- 靜態配置 ---
const currencyNames = {
  "USD": "美國 - 美金", "TWD": "台灣 - 台幣", "HKD": "香港 - 港幣", "JPY": "日本 - 日圓", "EUR": "歐盟 - 歐元",
  "GBP": "英國 - 英鎊", "AUD": "澳洲 - 澳幣", "CAD": "加拿大 - 加幣", "CNY": "中國 - 人民幣", "KRW": "韓國 - 韓元",
  "SGD": "新加坡 - 新加坡幣", "NZD": "紐西蘭 - 紐西蘭幣", "CHF": "瑞士 - 瑞士法郎", "SEK": "瑞典 - 瑞典克朗",
  "THB": "泰國 - 泰銖", "PHP": "菲律賓 - 菲律賓披索", "IDR": "印尼 - 印尼盾", "VND": "越南 - 越南盾",
  "MYR": "馬來西亞 - 馬來西亞幣", "INR": "印度 - 印度盧比", "MOP": "澳門 - 澳門幣", "ZAR": "南非 - 南非幣"
};

const DEFAULT_ITEMS = [
  "護照 (正本與影本)", "簽證或入境許可證明", "當地外幣與信用卡", "手機與專用充電線",
  "行動電源 (需隨身攜帶)", "萬國轉接頭與變壓器", "常備藥品 (感冒、止痛、胃藥)",
  "盥洗用品與保養品", "換洗衣物與舒適鞋子", "預定憑證 (機票、飯店、門票)"
];

// --- Firebase 初始化 ---
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try { return JSON.parse(__firebase_config); } catch (e) {}
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
const appId = 'travel-yeh'; // 固定為原本有資料的 ID
const apiKey = ""; // 執行環境自動注入

// --- 子組件：氣象大師 ---
const WeatherMaster = ({ tripInfo }) => {
  const [q, setQ] = useState({ 
    dest: tripInfo.city || '', 
    start: tripInfo.startDate || new Date().toISOString().split('T')[0],
    end: '' 
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const getWeatherInfo = (code) => {
    if (code === 0) return { icon: Sun, label: "晴天", color: "text-orange-500", tip: "紫外線強，建議著輕便透氣衣物並防曬。" };
    if (code <= 3) return { icon: Cloud, label: "多雲", color: "text-blue-400", tip: "天氣舒適，適合薄長袖或 T-shirt 加薄外套。" };
    if (code >= 51 && code <= 67) return { icon: CloudRain, label: "有雨", color: "text-blue-600", tip: "出門記得帶傘，建議穿著防水材質鞋子。" };
    if (code >= 95) return { icon: CloudLightning, label: "雷雨", color: "text-indigo-700", tip: "雷雨交加，儘量留在室內，注意安全。" };
    if (code >= 71 && code <= 77) return { icon: Snowflake, label: "降雪", color: "text-sky-300", tip: "氣溫極低，請務必穿著發熱衣、厚大衣與毛帽。" };
    return { icon: Cloud, label: "陰天", color: "text-slate-400", tip: "天氣陰涼，建議多層次穿搭以便調整。" };
  };

  const fetchWeather = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.dest)}&count=1&language=zh&format=json`);
      const geoData = await geoRes.json();
      if (!geoData.results) throw new Error('找不到該地點，請嘗試輸入更準確的城市名稱。');
      const { latitude, longitude, name } = geoData.results[0];
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${q.start}&end_date=${q.end || q.start}`);
      const weatherData = await weatherRes.json();
      setResults({
        location: name,
        daily: weatherData.daily.time.map((time, i) => ({
          date: time, max: weatherData.daily.temperature_2m_max[i], min: weatherData.daily.temperature_2m_min[i], code: weatherData.daily.weather_code[i]
        }))
      });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in space-y-10 w-full max-w-5xl mx-auto">
      <div className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100">
        <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3"><Sun className="text-orange-500" /> 全球精準天氣預測</h3>
        <form onSubmit={fetchWeather} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">旅遊目的地</label><div className="relative"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/><input required value={q.dest} onChange={e => setQ({...q, dest: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none font-bold shadow-inner transition-all" placeholder="如：富國島" /></div></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">開始日期</label><input required type="date" value={q.start} onChange={e => setQ({...q, start: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none font-bold shadow-inner transition-all" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">結束日期</label><input required type="date" value={q.end} min={q.start} onChange={e => setQ({...q, end: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none font-bold shadow-inner transition-all" /></div>
          <button type="submit" disabled={loading} className="bg-blue-600 text-white h-[60px] rounded-3xl font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <Search size={20}/>} 搜尋氣象</button>
        </form>
        {error && <p className="mt-4 text-red-500 text-sm font-bold flex items-center gap-2 animate-pulse"><AlertCircle size={16}/> {error}</p>}
      </div>
      {results && (
        <div className="space-y-6">
          <div className="flex items-end gap-4 ml-4"><h4 className="text-4xl font-black text-slate-900 tracking-tighter italic">{results.location}</h4><span className="text-slate-400 font-bold text-sm mb-1 uppercase tracking-widest">Forecast</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {results.daily.map(day => {
              const info = getWeatherInfo(day.code);
              return (
                <div key={day.date} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-lg hover:shadow-2xl transition-all group">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">{day.date}</p>
                  <div className="flex justify-between items-start mb-6"><info.icon className={`${info.color} group-hover:scale-110 transition-transform`} size={48} /><div className="text-right"><p className="text-3xl font-black text-slate-800">{Math.round(day.max)}°</p><p className="text-sm font-bold text-slate-300">{Math.round(day.min)}°</p></div></div>
                  <div className="bg-slate-50 p-4 rounded-2xl"><p className={`font-black text-sm mb-1 ${info.color}`}>{info.label}</p><p className="text-[11px] text-slate-500 font-bold leading-relaxed">{info.tip}</p></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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
    try { return JSON.parse(localStorage.getItem('custom_rates')) || {}; } catch (e) { return {}; }
  });
  const [useCustom, setUseCustom] = useState(() => {
    try { return JSON.parse(localStorage.getItem('use_custom_status')) || {}; } catch (e) { return {}; }
  });

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
      const data = await res.json();
      if (data.result === 'success') { setRates(data.rates || {}); setError(null); }
      else { throw new Error('API 異常'); }
    } catch (err) { setError('匯率同步失敗。'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchRates(); }, [baseCurrency]);
  useEffect(() => {
    localStorage.setItem('custom_rates', JSON.stringify(customRates));
    localStorage.setItem('use_custom_status', JSON.stringify(useCustom));
  }, [customRates, useCustom]);

  const convertedAmount = useMemo(() => {
    const rate = (useCustom[targetCurrency] && customRates[targetCurrency]) ? customRates[targetCurrency] : (rates[targetCurrency] || 0);
    return (amount * rate).toFixed(2);
  }, [amount, targetCurrency, rates, customRates, useCustom]);

  const filteredCurrencies = Object.keys(rates).filter(c => (currencyNames[c] || "").toLowerCase().includes(searchTerm.toLowerCase()) || c.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="animate-fade-in space-y-8 w-full max-w-5xl mx-auto">
      <div className="bg-white rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-10 md:p-14">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-8 items-center">
            <div className="md:col-span-3"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">輸入金額</label>
              <div className="relative"><div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"><DollarSign size={24} /></div><input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-[2rem] outline-none transition-all text-2xl font-black" /><div className="absolute right-4 top-1/2 -translate-y-1/2"><select value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)} className="bg-white border shadow-sm rounded-xl px-3 py-1.5 text-xs font-black cursor-pointer outline-none">{Object.keys(rates).map(curr => <option key={curr} value={curr}>{curr}</option>)}</select></div></div>
            </div>
            <div className="flex justify-center md:col-span-1"><div className="bg-blue-50 p-4 rounded-full text-blue-600 shadow-inner"><ArrowLeftRight size={28} /></div></div>
            <div className="md:col-span-3"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">轉換結果</label>
              <div className="w-full pl-8 pr-6 py-5 bg-blue-600 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-blue-100"><div><span className="text-3xl font-black">{convertedAmount}</span><p className="text-blue-100 text-[10px] mt-1 font-bold">{targetCurrency}</p></div><select value={targetCurrency} onChange={e => setTargetCurrency(e.target.value)} className="bg-blue-700 text-white border-none rounded-xl px-3 py-1.5 text-xs font-black cursor-pointer outline-none">{Object.keys(rates).map(curr => <option key={curr} value={curr}>{curr}</option>)}</select></div>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 border-t px-10 py-5 flex flex-wrap gap-4 justify-between items-center">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><TrendingUp size={16} className="text-green-500" /><span>{useCustom[targetCurrency] ? `自定義 (${targetCurrency})` : '採用即時市場匯率'}</span></div>
          <div className="flex gap-4"><button onClick={() => setShowSettings(!showSettings)} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${showSettings ? 'bg-blue-600 text-white' : 'bg-white border shadow-sm'}`}><Settings2 size={16} /> 匯率管理</button><button onClick={fetchRates} className="text-xs font-black text-blue-600 p-2"><RotateCcw size={16} /></button></div>
        </div>
      </div>
      {showSettings && (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-8 border-b flex justify-between items-center bg-slate-50/50"><div><h3 className="font-black text-xl text-slate-800">國家匯率自定義</h3><p className="text-xs text-slate-300 font-bold">手動覆寫各國市場匯率</p></div><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" placeholder="搜尋..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-12 pr-6 py-3 border rounded-2xl text-sm font-bold outline-none focus:ring-4 ring-blue-50 w-64" /></div></div>
          <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
            <table className="w-full text-left"><thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black sticky top-0 z-10"><tr><th className="px-8 py-5">國家與幣別</th><th className="px-8 py-5 text-right">市場</th><th className="px-8 py-5 text-center">模式</th><th className="px-8 py-5 text-right">數值</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCurrencies.map(curr => (
                  <tr key={curr} className="hover:bg-blue-50/30 transition-colors"><td className="px-8 py-5"><div className="font-black text-slate-700">{currencyNames[curr] || "其他"}</div><div className="text-[10px] text-slate-400 font-bold uppercase">{curr}</div></td><td className="px-8 py-5 text-right font-mono text-slate-500 text-sm font-bold">{rates[curr]?.toFixed(4)}</td><td className="px-8 py-5 text-center"><button onClick={() => setUseCustom(p => ({...p, [curr]: !p[curr]}))} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${useCustom[curr] ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{useCustom[curr] ? '手動' : '自動'}</button></td><td className="px-8 py-5 text-right"><input type="number" step="0.0001" disabled={!useCustom[curr]} value={customRates[curr] || ''} onChange={e => setCustomRates(p => ({...p, [curr]: parseFloat(e.target.value) || 0}))} className={`w-24 p-2 border rounded-xl text-sm text-right font-bold ${useCustom[curr] ? 'bg-white border-orange-300' : 'bg-slate-50 border-transparent text-slate-300'}`} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 子組件：清單管理 ---
const ChecklistMaster = ({ itineraryData, updateItinField }) => {
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [tempText, setTempText] = useState('');
  const checklist = itineraryData.checklist || [];
  const completed = checklist.filter(i => i.completed).length;
  const progress = checklist.length > 0 ? Math.round((completed / checklist.length) * 100) : 0;

  return (
    <div className="animate-fade-in space-y-8 w-full max-w-5xl mx-auto">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
        <div className="flex justify-between items-end mb-4"><div><h3 className="text-2xl font-black text-slate-800">行李準備進度</h3><p className="text-sm font-bold text-slate-400">已整理 {completed} / {checklist.length} 件</p></div><span className="text-4xl font-black text-blue-600 italic">{progress}%</span></div>
        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-blue-600 transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div></div>
      </div>
      <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100">
        <form onSubmit={async e => { e.preventDefault(); if (!newItem.trim()) return; await updateItinField('checklist', [...checklist, { id: Date.now().toString(), text: newItem.trim(), completed: false }]); setNewItem(''); }} className="mb-10 flex gap-4"><input placeholder="新增必備物品..." value={newItem} onChange={e => setNewItem(e.target.value)} className="flex-1 p-5 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none font-bold shadow-inner transition-all" /><button type="submit" className="bg-blue-600 text-white px-8 rounded-3xl font-black shadow-lg"><Plus size={28}/></button></form>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {checklist.map(item => (
            <div key={item.id} className={`p-6 rounded-[2rem] border flex items-center justify-between group transition-all ${item.completed ? 'bg-slate-50 opacity-60' : 'bg-white hover:border-blue-100'}`}>
              <div className="flex items-center gap-4 flex-1"><button onClick={async () => await updateItinField('checklist', checklist.map(i => i.id === item.id ? {...i, completed: !i.completed} : i))} className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${item.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-200'}`}>{item.completed && <CheckCircle2 size={20} />}</button>
                {editingId === item.id ? <input autoFocus value={tempText} onChange={e => setTempText(e.target.value)} onBlur={async () => { await updateItinField('checklist', checklist.map(i => i.id === item.id ? {...i, text: tempText} : i)); setEditingId(null); }} className="bg-blue-50 px-2 py-1 rounded font-bold outline-none flex-1" /> : <span onClick={() => { setEditingId(item.id); setTempText(item.text); }} className={`font-bold cursor-text flex-1 ${item.completed ? 'line-through text-slate-400 italic' : 'text-slate-700'}`}>{item.text}</span>}
              </div>
              <button onClick={async () => await updateItinField('checklist', checklist.filter(i => i.id !== item.id))} className="p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>
      </div>
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
  const [itineraryData, setItineraryData] = useState({ days: {}, checklist: [] });
  const [newSpot, setNewSpot] = useState({ time: '09:00', spot: '', note: '' });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  // 🎨 強力注入美化 CSS
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script'); script.id = 'tailwind-cdn'; script.src = 'https://cdn.tailwindcss.com'; document.head.appendChild(script);
    }
    const style = document.createElement('style'); style.id = 'stable-ui-style-final';
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
      html, body, #root { 
        min-height: 100vh !important; width: 100% !important; margin: 0 !important; padding: 0 !important; 
        background-color: #f8fafc !important; font-family: 'Noto Sans TC', sans-serif !important; 
      }
      #root { display: flex !important; flex-direction: column !important; align-items: center !important; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
    `; document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { await signInWithCustomToken(auth, __initial_auth_token); } 
        else { await signInAnonymously(auth); }
      } catch (err) { console.error("Auth failed", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); setIsLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const tripsRef = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    return onSnapshot(tripsRef, snapshot => {
      const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(tripList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, err => console.error("Permission error (Trips)", err));
  }, [user]);

  useEffect(() => {
    if (!user || !tripId) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, docSnap => {
      if (docSnap.exists()) { setItineraryData({ days: docSnap.data().days || {}, checklist: docSnap.data().checklist || [] }); setView('editor'); }
    }, err => console.error("Permission error (Itinerary)", err));
    const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(tripRef, docSnap => { if (docSnap.exists()) setTripInfo(docSnap.data()); });
    return () => { unsubItin(); unsubTrip(); };
  }, [user, tripId]);

  const updateItinField = async (field, value) => {
    if (!user || !tripId) return;
    try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), { [field]: value }); }
    catch (err) { console.error("Update failed", err); }
  };

  const getFormattedDate = (baseDate, dayOffset) => {
    if (!baseDate) return "";
    const date = new Date(baseDate); date.setDate(date.getDate() + (dayOffset - 1));
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const handleCreate = async e => {
    e.preventDefault(); if (!user) return; setIsLoading(true);
    const newId = crypto.randomUUID(); const days = {};
    for (let i = 1; i <= Math.max(1, parseInt(tripInfo.duration)); i++) { days[i] = { spots: [], title: '' }; }
    const initialChecklist = DEFAULT_ITEMS.map((text, i) => ({ id: `c${i}`, text, completed: false }));
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', newId), { ...tripInfo, creator: user.uid, createdAt: new Date().toISOString() });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', newId), { days, checklist: initialChecklist });
      setTripId(newId);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-screen space-y-4 bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={48} /><p className="text-slate-500 font-black italic">雲端資料載入中...</p></div>;

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      {view === 'home' ? (
        <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-fade-in">
          <div className="text-center mb-16"><div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0 shadow-blue-200"><Plane size={48} /></div><h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase">Travel Planner</h1><p className="text-slate-400 font-bold tracking-widest text-sm italic text-center">找回您的富國島冒險之旅</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-start">
            <div className="space-y-6"><h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Plus className="text-blue-600" /> 建立新旅程</h3>
              <form onSubmit={handleCreate} className="bg-white p-10 rounded-[3rem] shadow-xl space-y-8 border border-white">
                <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">國家</label><input required placeholder="如: 越南" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">城市</label><input required placeholder="如: 富國島" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} /></div></div>
                <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">日期</label><input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">天數</label><input required type="number" min="1" max="14" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} /></div></div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl active:scale-95 transition-all">開始規劃</button></form></div>
            <div className="space-y-6"><h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600" /> 旅程清單 ({trips.length})</h3><div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">{trips.map(trip => (<div key={trip.id} onClick={() => setTripId(trip.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between"><div className="flex items-center gap-5"><div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm"><Globe size={24} /></div><div><h4 className="text-xl font-black text-slate-800 tracking-tight leading-tight">{trip.city} 之旅</h4><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{trip.country} · {trip.startDate}</p></div></div><ChevronRight className="text-slate-200 group-hover:text-blue-600 transition-colors" /></div>))}</div></div></div><div className="mt-12 text-slate-300 text-[10px] font-bold uppercase tracking-widest text-center">{VERSION_INFO}</div></div>
      ) : (
        <div className="w-full flex flex-col items-center pb-24">
          <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-50">
            <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}><div className="p-2 bg-blue-600 text-white rounded-2xl group-hover:rotate-12 transition-transform shadow-lg"><Plane size={24} className="rotate-45" /></div><span className="tracking-tighter uppercase font-black">Traveler</span></div>
            <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              <button onClick={() => setActiveTab('itinerary')} className={`px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'itinerary' ? 'bg-white text-blue-600 shadow-sm shadow-blue-50' : 'text-slate-400 hover:text-slate-600'}`}><Calendar size={14}/> 行程</button>
              <button onClick={() => setActiveTab('weather')} className={`px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'weather' ? 'bg-white text-blue-600 shadow-sm shadow-blue-50' : 'text-slate-400 hover:text-slate-600'}`}><Sun size={14}/> 天氣</button>
              <button onClick={() => setActiveTab('checklist')} className={`px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'checklist' ? 'bg-white text-blue-600 shadow-sm shadow-blue-50' : 'text-slate-400 hover:text-slate-600'}`}><ListChecks size={14}/> 清單</button>
              <button onClick={() => setActiveTab('currency')} className={`px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'currency' ? 'bg-white text-blue-600 shadow-sm shadow-blue-50' : 'text-slate-400 hover:text-slate-600'}`}><Coins size={14}/> 匯率</button>
            </div>
            <div className="text-right"><div className="font-black text-slate-800 text-xl leading-none">{tripInfo.city}</div><div className="text-[11px] text-slate-400 font-bold uppercase mt-1 inline-block bg-slate-50 px-2 py-0.5 rounded-full">{tripInfo.startDate}</div></div>
          </nav>
          
          <main className="w-full max-w-5xl p-6 md:p-12 animate-fade-in">
            {activeTab === 'itinerary' ? (
              <div className="space-y-12">
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">{Object.keys(itineraryData.days || {}).map(day => ( <button key={day} onClick={() => {setActiveDay(parseInt(day)); setEditingId(null);}} className={`shrink-0 w-28 h-28 rounded-3xl font-black transition-all border flex flex-col items-center justify-center gap-1 shadow-sm ${activeDay === parseInt(day) ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-105' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}><span className="text-xs uppercase opacity-60">Day</span><span className="text-3xl leading-none">{day}</span><span className="text-[10px] mt-1 font-bold">{getFormattedDate(tripInfo.startDate, parseInt(day)).split('/').slice(1).join('/')}</span></button> ))}</div>
                <div className="text-center md:text-left space-y-4"><div className="flex flex-col md:flex-row md:items-end gap-4"><h2 className="text-6xl font-black text-slate-900 tracking-tighter italic leading-none shrink-0">Day {activeDay}</h2><input className="text-3xl md:text-4xl font-black text-blue-600 bg-transparent outline-none border-b-2 border-transparent focus:border-blue-200 placeholder:text-slate-200 flex-1 transition-all" placeholder="輸入今日主題..." value={itineraryData.days?.[activeDay]?.title || ''} onChange={e => updateItinField(`days.${activeDay}.title`, e.target.value)} /></div><div className="flex items-center justify-center md:justify-start gap-3"><p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-sm shrink-0">{getFormattedDate(tripInfo.startDate, activeDay)}</p><div className="h-1 flex-1 bg-slate-50 rounded-full max-w-[300px]"></div></div></div>
                <div className="bg-white p-8 md:p-12 rounded-[4rem] shadow-sm border border-slate-100">
                  <form onSubmit={async e => { e.preventDefault(); const updated = [...(itineraryData.days[activeDay]?.spots || []), { ...newSpot, id: Date.now().toString() }]; await updateItinField(`days.${activeDay}.spots`, updated); setNewSpot({ time: '09:00', spot: '', note: '' }); }} className="mb-12 space-y-3 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner"><div className="flex gap-3 flex-wrap md:flex-nowrap"><div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full md:w-auto shadow-sm"><Clock size={18} className="text-blue-500" /><input type="time" value={newSpot.time} onChange={e => setNewSpot({...newSpot, time: e.target.value})} className="bg-transparent font-black outline-none w-24" /></div><input placeholder="想在那裡留下足跡？" required value={newSpot.spot} onChange={e => setNewSpot({...newSpot, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-bold outline-none shadow-sm" /></div><div className="flex gap-3"><textarea placeholder="詳細備註..." value={newSpot.note} onChange={e => setNewSpot({...newSpot, note: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-medium h-20 resize-none text-sm shadow-sm" /><button type="submit" className="bg-slate-900 text-white px-8 rounded-xl font-black flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg"><Plus size={24}/><span className="text-[10px]">加入</span></button></div></form>
                  <div className="space-y-10 relative before:content-[''] before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-1.5 before:bg-slate-50 before:rounded-full">
                    {(itineraryData.days[activeDay]?.spots || []).map((item, idx) => (
                      <div key={item.id} className="relative pl-20 group"><div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1"><button onClick={async () => { const spots = [...itineraryData.days[activeDay].spots]; if (idx === 0) return; [spots[idx], spots[idx-1]] = [spots[idx-1], spots[idx]]; await updateItinField(`days.${activeDay}.spots`, spots); }} className="text-slate-200 hover:text-blue-600 active:scale-125 transition-all"><ArrowUp size={20}/></button><div className="w-16 h-16 bg-white border-8 border-slate-50 rounded-[1.5rem] flex items-center justify-center text-[11px] font-black text-blue-600 shadow-md group-hover:scale-110 transition-transform">{item.time}</div><button onClick={async () => { const spots = [...itineraryData.days[activeDay].spots]; if (idx === spots.length - 1) return; [spots[idx], spots[idx+1]] = [spots[idx+1], spots[idx]]; await updateItinField(`days.${activeDay}.spots`, spots); }} className="text-slate-200 hover:text-blue-600 active:scale-125 transition-all"><ArrowDown size={20}/></button></div><div className={`p-10 bg-white border rounded-[3rem] transition-all group/item ${editingId === item.id ? 'border-blue-600 shadow-2xl ring-8 ring-blue-50' : 'border-slate-100 hover:shadow-2xl shadow-sm'}`}>
                          {editingId === item.id ? ( <div className="space-y-4 flex-1 animate-fade-in"><div className="flex gap-2"><input type="time" value={editData.time} onChange={e => setEditData({...editData, time: e.target.value})} className="p-3 border rounded-xl font-black text-sm w-32 bg-slate-50 outline-none" /><input value={editData.spot} onChange={e => setEditData({...editData, spot: e.target.value})} className="flex-1 p-3 border rounded-xl font-black text-sm bg-slate-50 outline-none" /></div><textarea value={editData.note} onChange={e => setEditData({...editData, note: e.target.value})} className="w-full p-3 border rounded-xl text-sm h-24 resize-none bg-slate-50 outline-none" /><div className="flex justify-end gap-3"><button onClick={() => setEditingId(null)} className="text-sm font-bold text-slate-400 px-4">取消</button><button onClick={async () => { const spots = itineraryData.days[activeDay].spots.map(s => s.id === editingId ? editData : s); await updateItinField(`days.${activeDay}.spots`, spots); setEditingId(null); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-black shadow-lg"><Save size={16}/> 儲存</button></div></div>
                          ) : ( <div className="flex justify-between items-start gap-4"><div className="space-y-4 flex-1"><div className="flex items-center gap-4 flex-wrap"><h4 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">{item.spot}</h4><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all inline-flex items-center gap-1.5 text-xs font-black shadow-sm"><MapPin size={14} /> 地圖</a></div><div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100"><p className="text-slate-500 text-sm italic whitespace-pre-wrap leading-relaxed">{item.note || "暫無詳細說明..."}</p></div></div><div className="flex flex-col gap-2 opacity-0 group-hover/item:opacity-100 transition-all"><button onClick={() => { setEditingId(item.id); setEditData({...item}); }} className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl"><Edit3 size={20} /></button><button onClick={async () => await updateItinField(`days.${activeDay}.spots`, itineraryData.days[activeDay].spots.filter(s => s.id !== item.id))} className="p-3 text-slate-300 hover:text-red-500 bg-red-50 rounded-2xl"><Trash2 size={20}/></button></div></div> )}
                        </div></div>
                    ))}
                    {(!itineraryData.days[activeDay]?.spots || itineraryData.days[activeDay].spots.length === 0) && ( <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[3rem]"><Calendar className="text-slate-100 mx-auto mb-6" size={80} /><p className="text-slate-300 font-black text-xl italic text-center">今天還沒有安排任何景點！</p></div> )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'weather' ? (
              <WeatherMaster tripInfo={tripInfo} />
            ) : activeTab === 'checklist' ? (
              <ChecklistMaster itineraryData={itineraryData} updateItinField={updateItinField} />
            ) : (
              <CurrencyMaster />
            )}
          </main>

          <div className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] p-3 flex justify-around items-center z-[100] shadow-2xl">
            <button onClick={() => setActiveTab('itinerary')} className={`p-4 rounded-2xl transition-all ${activeTab === 'itinerary' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><Calendar size={20} /></button>
            <button onClick={() => setActiveTab('weather')} className={`p-4 rounded-2xl transition-all ${activeTab === 'weather' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><Sun size={20} /></button>
            <button onClick={() => setActiveTab('checklist')} className={`p-4 rounded-2xl transition-all ${activeTab === 'checklist' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><ListChecks size={20} /></button>
            <button onClick={() => setActiveTab('currency')} className={`p-4 rounded-2xl transition-all ${activeTab === 'currency' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><Coins size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
