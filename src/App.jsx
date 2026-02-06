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
  Plane, Calendar, Plus, Trash2, Clock, 
  CheckCircle, AlertCircle, Loader2, X, Globe, ChevronRight,
  ArrowUp, ArrowDown, Edit3, Save, MapPin, Map as MapIcon,
  ArrowLeftRight, Settings2, RotateCcw, TrendingUp, DollarSign, CheckCircle2, Search, Circle, Coins, ListChecks,
  Sun, Cloud, CloudRain, CloudLightning, Snowflake, Smartphone, Shirt, Bath, Pill, FileText, Package,
  Calculator, Equal, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, StickyNote, Eye, EyeOff,
  Umbrella, ThermometerSun, Wallet, Utensils, Home, Car, ShoppingBag, MoreHorizontal, Receipt, Sparkles
} from 'lucide-react';

/**
 * 🏆 Travel Planner - 彥麟製作最終黃金基準穩定版 (2026.02.06)
 * ------------------------------------------------
 * 1. 天氣頁面恢復：重新加入地點、開始日期、結束日期查詢表單。
 * 2. 費用管理系統：支援分類統計與雲端存檔。
 * 3. 建議事項強化：根據天氣代碼動態生成旅遊建議。
 * 4. 穩定性修復：解決編譯導致的白屏問題與權限報錯 (Rule 1 & 3)。
 */

const VERSION_INFO = "穩定版 V2.5 - 2026/02/06 23:40";

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
  { id: 'cat_3c', name: '3C 產品', icon: Smartphone, items: ['手機', '充電線', '充電器', '相機', '萬用轉接頭', '行動電源'] },
  { id: 'cat_clothing', name: '衣物', icon: Shirt, items: ['上衣', '褲子', '外套', '鞋子', '內衣褲', '墨鏡', '帽子'] },
  { id: 'cat_toiletries', name: '盥洗及衛生用品', icon: Bath, items: ['卸妝巾', '洗面乳', '牙膏', '牙刷', '毛巾', '濕紙巾'] },
  { id: 'cat_medicine', name: '個人藥品', icon: Pill, items: ['暈車藥', '過敏藥', '感冒藥', 'OK 繃', '個人用藥'] },
  { id: 'cat_docs', name: '重要文件', icon: FileText, items: ['護照', '簽證', '國際駕照', '機票', '住宿憑證'] },
  { id: 'cat_others', name: '其他用品', icon: Package, items: ['水壺', '鑰匙', '眼罩', '外幣現金', '頸枕'] }
];

// --- Firebase 安全初始化 ---
const getFirebaseServices = () => {
  try {
    const configStr = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
    const config = configStr ? JSON.parse(configStr) : {
      apiKey: "AIzaSyDHfIqjgq0cJ0fCuKlIBQhof6BEJsaYLg0",
      authDomain: "travel-yeh.firebaseapp.com",
      projectId: "travel-yeh",
      storageBucket: "travel-yeh.firebasestorage.app",
      messagingSenderId: "62005891712",
      appId: "1:62005891712:web:4653c17db0c38f981d0c65"
    };
    const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
    return {
      fAuth: getAuth(firebaseApp),
      fDb: getFirestore(firebaseApp),
      fAppId: typeof __app_id !== 'undefined' ? __app_id : 'travel-yeh'
    };
  } catch (e) {
    console.error("Firebase Services Init Failed", e);
    return { fAuth: null, fDb: null, fAppId: 'travel-yeh' };
  }
};

const { fAuth, fDb, fAppId } = getFirebaseServices();

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
        <a key={i} href={part} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1 break-all" onClick={e => e.stopPropagation()}>
          {part} <ExternalLink size={12} />
        </a>
      );
    }
    return part;
  });
};

// --- 天氣建議邏輯 ---
const getWeatherAdvice = (code) => {
  if (code === 0) return { label: "晴天", tips: "紫外線強，建議做好防曬並多補充水分。", icon: Sun, color: "text-orange-500" };
  if (code >= 1 && code <= 3) return { label: "多雲", tips: "天氣舒適，適合戶外活動，可準備薄外套。", icon: Cloud, color: "text-blue-400" };
  if (code >= 45 && code <= 48) return { label: "有霧", tips: "視線較差，若需開車請注意安全距離。", icon: Cloud, color: "text-slate-400" };
  if (code >= 51 && code <= 67) return { label: "陣雨", tips: "可能會有小雨，建議隨身攜帶折疊傘。", icon: CloudRain, color: "text-blue-500" };
  if (code >= 71 && code <= 77) return { label: "下雪", tips: "氣溫極低，請加強保暖，注意地面濕滑。", icon: Snowflake, color: "text-cyan-300" };
  if (code >= 80 && code <= 82) return { label: "大雨", tips: "雨勢較大，建議調整行程至室內場所。", icon: CloudRain, color: "text-indigo-600" };
  if (code >= 95) return { label: "雷雨", tips: "天氣惡劣，請待在室內，避免前往危險區域。", icon: CloudLightning, color: "text-purple-600" };
  return { label: "多雲時晴", tips: "根據當前天氣調整您的冒險計劃。", icon: Cloud, color: "text-blue-400" };
};

// --- 子組件：費用管理 ---
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
                <span className="text-slate-300 font-bold uppercase tracking-widest text-xs">twd</span>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">項目名稱</label>
                  <input required placeholder="如：當地晚餐" value={item} onChange={e => setItem(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none shadow-inner" />
              </div>
              <div className="w-full md:w-48 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">金額</label>
                  <input required type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none shadow-inner" />
              </div>
              <div className="w-full md:w-40 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">類別</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-black outline-none cursor-pointer">
                      {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
              </div>
              <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center shrink-0"><Plus size={28}/></button>
          </form>
      </div>
      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-50 overflow-hidden">
          <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black">
                  <tr><th className="px-8 py-5">內容</th><th className="px-8 py-5">類別</th><th className="px-8 py-5 text-right">金額</th><th className="px-8 py-5 text-center">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                  {expenses.length > 0 ? [...expenses].reverse().map(exp => {
                      const cat = EXPENSE_CATEGORIES.find(c => c.id === exp.category) || EXPENSE_CATEGORIES[5];
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-5 font-black text-slate-700">{exp.item}</td>
                            <td className="px-8 py-5">
                              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${cat.bg} ${cat.color} text-[10px] font-black`}>
                                <cat.icon size={12}/> {cat.name}
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right font-mono font-black text-slate-800 text-lg">${parseFloat(exp.amount).toLocaleString()}</td>
                            <td className="px-8 py-5 text-center">
                                <button onClick={async () => await updateItinField('expenses', expenses.filter(e => e.id !== exp.id))} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                  <Trash2 size={18}/>
                                </button>
                            </td>
                        </tr>
                      );
                  }) : (
                      <tr><td colSpan="4" className="px-8 py-20 text-center text-slate-300 font-bold italic tracking-widest"><Receipt className="mx-auto mb-4 opacity-20" size={48} />目前尚無記錄</td></tr>
                  )}
              </tbody>
          </table>
      </div>
    </div>
  );
};

// --- 子組件：天氣預測 (恢復表單查詢版) ---
const WeatherMaster = ({ tripInfo }) => {
  const defaultEndDate = useMemo(() => {
    if (!tripInfo?.startDate || !tripInfo?.duration) return '';
    try {
      const d = new Date(tripInfo.startDate);
      if (isNaN(d.getTime())) return '';
      d.setDate(d.getDate() + (parseInt(tripInfo.duration) - 1));
      return d.toISOString().split('T')[0];
    } catch (e) { return ''; }
  }, [tripInfo]);

  const [q, setQ] = useState({ 
    dest: tripInfo?.city || '', 
    start: tripInfo?.startDate || new Date().toISOString().split('T')[0],
    end: defaultEndDate 
  });

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tripInfo) setQ({ dest: tripInfo.city || '', start: tripInfo.startDate || '', end: defaultEndDate });
  }, [tripInfo, defaultEndDate]);

  const fetchWeather = async (e) => {
    if (e) e.preventDefault();
    if (!q.dest) return;
    setLoading(true); setError(null);
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.dest)}&count=1&language=zh&format=json`);
      const geoData = await geoRes.json();
      if (!geoData.results?.length) throw new Error('找不到該地點。');
      const { latitude, longitude, name } = geoData.results[0];
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${q.start}&end_date=${q.end || q.start}`);
      const weatherData = await weatherRes.json();
      setResults({
        location: name,
        daily: (weatherData.daily?.time || []).map((time, i) => ({
          date: time, max: weatherData.daily.temperature_2m_max[i], min: weatherData.daily.temperature_2m_min[i], code: weatherData.daily.weather_code[i]
        }))
      });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in space-y-10 w-full max-w-5xl mx-auto pb-10">
      <div className="bg-white p-8 md:p-12 rounded-[4rem] shadow-xl border border-slate-100">
        <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3"><Sun className="text-orange-500" /> 全球精準氣象查詢</h3>
        <form onSubmit={fetchWeather} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">目的地</label><input required value={q.dest} onChange={e => setQ({...q, dest: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none font-bold shadow-inner" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">開始日期</label><input required type="date" value={q.start} onChange={e => setQ({...q, start: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none shadow-inner" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">結束日期</label><input required type="date" value={q.end} min={q.start} onChange={e => setQ({...q, end: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none shadow-inner" /></div>
          <button type="submit" disabled={loading} className="bg-blue-600 text-white h-[60px] rounded-3xl font-black shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <Search size={20}/>} 查詢</button>
        </form>
        {error && <p className="mt-4 text-red-500 text-xs font-bold animate-pulse">{error}</p>}
      </div>
      {results && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {results.daily.map(day => {
            const advice = getWeatherAdvice(day.code);
            return (
              <div key={day.date} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-lg group transition-transform hover:-translate-y-1">
                  <p className="text-[10px] font-black text-slate-300 mb-4">{day.date}</p>
                  <div className="flex justify-between items-start mb-6"><advice.icon size={48} className={advice.color} /><div className="text-right"><p className="text-3xl font-black text-slate-800">{Math.round(day.max)}°</p><p className="text-sm font-bold text-slate-300">{Math.round(day.min)}°</p></div></div>
                  <div className="bg-slate-50 p-4 rounded-2xl"><p className={`font-black text-sm mb-1 ${advice.color}`}>{advice.label}</p><p className="text-[11px] text-slate-500 leading-relaxed font-bold">{advice.tips}</p></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- 子組件：匯率管理 (安全運算版) ---
const CurrencyMaster = ({ parentAmount, setParentAmount }) => {
  const [rates, setRates] = useState({});
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('TWD');
  const [calcDisplay, setCalcDisplay] = useState('0');

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
        const data = await res.json();
        if (data.result === 'success') setRates(data.rates || {});
      } catch (err) { console.error(err); }
    };
    if (fAuth) fetchRates();
  }, [baseCurrency]);

  const handleCalcInput = (val) => {
    if (val === 'C') setCalcDisplay('0');
    else if (val === '=') {
        try {
            const cleanDisplay = calcDisplay.replace(/[^-+*/.0-9]/g, '');
            if (!cleanDisplay) { setCalcDisplay('0'); return; }
            const result = new Function(`return ${cleanDisplay}`)();
            setCalcDisplay(String(parseFloat(Number(result).toFixed(8))));
        } catch (e) { setCalcDisplay('Error'); }
    } else setCalcDisplay(prev => (prev === '0' || prev === 'Error') ? val : prev + val);
  };

  const resultAmount = useMemo(() => (parentAmount * (rates[targetCurrency] || 0)).toFixed(2), [parentAmount, targetCurrency, rates]);

  return (
    <div className="animate-fade-in space-y-8 w-full max-w-5xl mx-auto pb-10">
      <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 p-8 md:p-14 transition-all">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-8 items-center">
          <div className="md:col-span-3 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">輸入金額</label>
            <div className="relative">
              <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
              <input type="number" value={parentAmount} onChange={e => setParentAmount(parseFloat(e.target.value) || 0)} className="w-full pl-14 pr-4 py-6 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none font-black text-2xl shadow-inner" />
              <div className="absolute right-4 top-1/2 -translate-y-1/2"><select value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)} className="bg-white border rounded-xl px-2 py-1 text-xs font-black shadow-sm">{Object.keys(currencyNames).map(c => <option key={c} value={c}>{currencyNames[c]}</option>)}</select></div>
            </div>
          </div>
          <div className="flex justify-center md:col-span-1"><div className="bg-blue-50 p-4 rounded-full text-blue-600 shadow-md group active:scale-90 transition-all"><ArrowLeftRight className="md:rotate-0 rotate-90" size={28} /></div></div>
          <div className="md:col-span-3 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">轉換結果</label>
            <div className="w-full pl-8 pr-6 py-5 bg-blue-600 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-blue-100">
              <div><span className="text-3xl font-black tracking-tight">{resultAmount}</span><p className="text-blue-100 text-[10px] font-bold">{currencyNames[targetCurrency]}</p></div>
              <select value={targetCurrency} onChange={e => setTargetCurrency(e.target.value)} className="bg-blue-700 text-white border-none rounded-xl px-3 py-1.5 text-xs font-black shadow-inner">{Object.keys(currencyNames).map(c => <option key={c} value={c}>{currencyNames[c]}</option>)}</select>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-slate-900 text-white p-8 md:p-12 rounded-[4rem] shadow-2xl border border-slate-800">
          <div className="flex items-center gap-3 mb-8 px-2"><div className="p-3 bg-blue-600 rounded-2xl shadow-lg"><Calculator size={24} /></div><h4 className="font-black text-2xl tracking-tight">旅程小計算機 (8位精度)</h4></div>
          <div className="bg-black/40 p-8 rounded-[2.5rem] mb-10 text-right shadow-inner border border-white/5 overflow-hidden"><span className="text-5xl md:text-6xl font-black font-mono tracking-tighter text-white block truncate leading-tight">{calcDisplay}</span></div>
          <div className="grid grid-cols-4 gap-4 md:gap-6">
              {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','C','+'].map(btn => (<button key={btn} onClick={() => handleCalcInput(btn)} className={`py-6 md:py-8 rounded-[1.5rem] font-black text-3xl transition-all shadow-sm active:scale-95 ${isNaN(btn) && btn !== '.' ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-white/10 hover:bg-white/20 transition-all'}`}>{btn}</button>))}
              <button onClick={() => handleCalcInput('=')} className="col-span-2 py-8 bg-green-600 text-white rounded-[1.5rem] font-black text-2xl hover:bg-green-500 transition-all active:scale-95 shadow-lg"><Equal size={32}/></button>
              <button onClick={() => setParentAmount(parseFloat(calcDisplay) || 0)} className="col-span-2 py-8 bg-white text-slate-900 rounded-[1.5rem] font-black text-xl hover:bg-slate-100 transition-all active:scale-95 shadow-xl">套用到金額</button>
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
  const [itineraryData, setItineraryData] = useState({ days: {}, checklist: [], expenses: [] });
  const [newSpot, setNewSpot] = useState({ time: '09:00', spot: '', note: '' });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
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
      } catch (e) {
        console.error("Auth process error", e);
        setIsLoading(false);
      }
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
    const unsubTrips = onSnapshot(tripsRef, (snapshot) => {
      setTrips(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, (err) => {
      console.error("Firestore Error:", err);
      if (err.code === 'permission-denied') setAiStatus({ type: 'error', message: '存取權限受限，請重新整理。' });
    });
    return () => unsubTrips();
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

  // 🎨 注入 Favicon 與 Tailwind 樣式
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

  if (isLoading) return <div className="flex flex-col items-center justify-center h-screen bg-slate-50"><Loader2 className="animate-spin text-blue-600 mb-2" size={48} /><p className="text-slate-500 font-bold italic tracking-widest leading-none">正在啟動彥麟的冒險引擎...</p></div>;

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      {aiStatus.message && ( <div className="fixed top-4 z-[200] px-6 py-3 rounded-2xl shadow-2xl bg-white border border-red-100 text-red-600 animate-fade-in flex items-center gap-3"> <span className="font-bold text-sm">{aiStatus.message}</span><button onClick={() => setAiStatus({ type: '', message: '' })}><X size={14}/></button> </div> )}

      {view === 'home' ? (
        <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-fade-in">
          <div className="text-center mb-16">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0 shadow-blue-200">
              <Plane size={48} />
            </div>
            <h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase">Travel Planner</h1>
            <p className="text-slate-400 font-bold tracking-widest text-sm italic text-center">找回您的冒險之旅-彥麟製作</p>
          </div>
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
        </div>
      ) : (
        <div className="w-full animate-fade-in flex flex-col items-center">
          <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-50">
            <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}><Plane size={24} className="rotate-45" /><span className="tracking-tighter uppercase font-black">Traveler</span></div>
            <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              {['itinerary', 'weather', 'expenses', 'checklist', 'currency'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm shadow-blue-50' : 'text-slate-400 hover:text-slate-600'}`}>
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
                      <h2 className="text-6xl font-black text-slate-900 tracking-tighter italic leading-none shrink-0">Day {activeDay}</h2>
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button onClick={() => moveDay(-1)} disabled={activeDay === 1} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors"><ArrowLeft size={20}/></button>
                        <div className="w-px h-6 bg-slate-200 my-auto"></div>
                        <button onClick={() => moveDay(1)} disabled={activeDay === parseInt(tripInfo.duration || "0")} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors"><ArrowRight size={20}/></button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <span className="text-lg text-slate-400 font-bold ml-1 mb-1 block tracking-tight">({getFormattedDate(tripInfo.startDate, activeDay)} {getDayOfWeek(tripInfo.startDate, activeDay)})</span>
                      <input className="text-3xl md:text-4xl font-black text-blue-600 bg-transparent outline-none border-b-2 border-transparent focus:border-blue-200 placeholder:text-slate-200 w-full transition-all" placeholder="輸入今日主題..." value={itineraryData?.days?.[activeDay]?.title || ''} onChange={e => updateItinField(`days.${activeDay}.title`, e.target.value)} />
                    </div>
                  </div>
                  <div className="flex justify-center md:justify-start">
                    <button onClick={() => setShowAllNotes(!showAllNotes)} className="flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-black transition-all shadow-sm border bg-white text-slate-500 hover:bg-slate-50 active:scale-95">
                      {showAllNotes ? <EyeOff size={16} /> : <Eye size={16} />} {showAllNotes ? '隱藏全部備註' : '顯示全部備註'}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-8 md:p-12 rounded-[4rem] shadow-sm border border-slate-100">
                  <form onSubmit={async e => { 
                    e.preventDefault(); 
                    const current = itineraryData?.days?.[activeDay]?.spots || []; 
                    await updateItinField(`days.${activeDay}.spots`, [...current, { ...newSpot, id: Date.now().toString() }]); 
                    setNewSpot({ time: '09:00', spot: '', note: '' }); 
                  }} className="mb-12 space-y-4 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
                    <div className="flex gap-3 flex-wrap md:flex-nowrap">
                       <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full md:w-auto shadow-sm">
                        <Clock size={18} className="text-blue-500" />
                        <input type="time" value={newSpot.time} onChange={e => setNewSpot({...newSpot, time: e.target.value})} className="bg-transparent font-black outline-none w-24" />
                      </div>
                      <input placeholder="今天要在那裡留下足跡？" required value={newSpot.spot} onChange={e => setNewSpot({...newSpot, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-bold outline-none shadow-sm" />
                    </div>
                    <div className="flex gap-3">
                      <textarea placeholder="細節、備註或心情..." value={newSpot.note} onChange={e => setNewSpot({...newSpot, note: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-medium h-20 resize-none text-sm shadow-sm" />
                      <button type="submit" className="bg-slate-900 text-white px-8 rounded-xl font-black active:scale-95 shadow-lg flex items-center justify-center"><Plus size={24}/></button>
                    </div>
                  </form>

                  <div className="space-y-8 relative before:content-[''] before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-1.5 before:bg-slate-50 before:rounded-full">
                    {(itineraryData?.days?.[activeDay]?.spots || []).map((item, idx) => {
                      const isExpanded = showAllNotes || !!expandedItems[item.id];
                      return (
                        <div key={item.id} className="relative pl-20 group">
                          <div className="absolute left-[-15px] top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                            <button onClick={() => { const spots = [...itineraryData.days[activeDay].spots]; if (idx > 0) { [spots[idx], spots[idx-1]] = [spots[idx-1], spots[idx]]; updateItinField(`days.${activeDay}.spots`, spots); } }} className="text-slate-200 hover:text-blue-600 transition-colors"><ArrowUp size={20}/></button>
                            <div className="w-16 h-16 bg-white border-8 border-slate-50 rounded-[1.5rem] flex items-center justify-center text-[11px] font-black text-blue-600 shadow-md group-hover:scale-110 transition-transform">{item.time}</div>
                            <button onClick={() => { const spots = [...itineraryData.days[activeDay].spots]; if (idx < (itineraryData.days[activeDay].spots?.length - 1)) { [spots[idx], spots[idx+1]] = [spots[idx+1], spots[idx]]; updateItinField(`days.${activeDay}.spots`, spots); } }} className="text-slate-200 hover:text-blue-600 transition-colors"><ArrowDown size={20}/></button>
                          </div>
                          <div onClick={() => setExpandedItems(prev => ({...prev, [item.id]: !prev[item.id]}))} className={`p-10 bg-white border rounded-[3rem] transition-all cursor-pointer hover:shadow-2xl ${isExpanded ? 'border-blue-100 shadow-lg' : 'border-slate-100'}`}>
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-4 flex-1">
                                  <div className="flex items-center gap-4 flex-wrap">
                                    <h4 className="text-3xl font-black text-slate-800 leading-tight tracking-tight">{item.spot}</h4>
                                    <div className="flex gap-2">
                                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-black shadow-sm hover:bg-blue-600 hover:text-white transition-all"><MapPin size={14} /> 地圖</a>
                                      {(item.note) && <div className={`px-2 py-1.5 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400'}`}><StickyNote size={12}/> {isExpanded ? '已展開' : '細節'}</div>}
                                    </div>
                                  </div>
                                  {isExpanded && (
                                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
                                      <p className="text-slate-500 text-sm italic whitespace-pre-wrap leading-relaxed">{renderTextWithLinks(item.note) || "暫無說明內容"}</p>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all"><button onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditData({...item}); }} className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"><Edit3 size={20} /></button><button onClick={async (e) => { e.stopPropagation(); if(confirm('確定刪除？')) { const updated = itineraryData.days[activeDay].spots.filter(s => s.id !== item.id); await updateItinField(`days.${activeDay}.spots`, updated); } }} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20}/></button></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(!itineraryData?.days?.[activeDay]?.spots?.length) && ( <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[3rem]"><Calendar className="text-slate-100 mx-auto mb-6" size={80} /><p className="text-slate-300 font-black text-xl italic text-center">今天還沒有安排任何行程！</p></div> )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'weather' ? <WeatherMaster tripInfo={tripInfo} /> : activeTab === 'expenses' ? <ExpenseMaster itineraryData={itineraryData} updateItinField={updateItinField} /> : activeTab === 'checklist' ? (
                <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in pb-10">
                    <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 text-center"><h3 className="text-2xl font-black text-slate-800">行李清單管理</h3><p className="text-slate-400 font-bold mt-1 tracking-widest italic">彥麟製作 - 冒險必備指南</p></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {CHECKLIST_CATEGORIES.map(cat => (
                            <div key={cat.id} className="bg-white p-8 rounded-[3rem] shadow-lg border border-slate-50 hover:shadow-xl transition-all">
                                <div className="flex items-center gap-3 mb-6"><div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><cat.icon size={24}/></div><h4 className="text-xl font-black text-slate-800">{cat.name}</h4></div>
                                <div className="space-y-3">{cat.items.map((item, i) => <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl font-bold text-slate-600"><CheckCircle size={16} className="text-slate-200"/>{item}</div>)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : <CurrencyMaster parentAmount={currencyAmount} setParentAmount={setCurrencyAmount} /> }
          </main>

          <div className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] p-3 flex justify-around items-center z-[100] shadow-2xl">
            <button onClick={() => setActiveTab('itinerary')} className={`p-4 rounded-2xl transition-all ${activeTab === 'itinerary' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}><Calendar size={20} /></button>
            <button onClick={() => setActiveTab('weather')} className={`p-4 rounded-2xl transition-all ${activeTab === 'weather' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-50'}`}><Sun size={20} /></button>
            <button onClick={() => setActiveTab('expenses')} className={`p-4 rounded-2xl transition-all ${activeTab === 'expenses' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-50'}`}><Wallet size={20} /></button>
            <button onClick={() => setActiveTab('checklist')} className={`p-4 rounded-2xl transition-all ${activeTab === 'checklist' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-50'}`}><ListChecks size={20} /></button>
            <button onClick={() => setActiveTab('currency')} className={`p-4 rounded-2xl transition-all ${activeTab === 'currency' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-50'}`}><Coins size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
