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
  deleteDoc,
  collection
} from 'firebase/firestore';
import { 
  Plane, Calendar, Plus, Trash2, Clock, 
  CheckCircle, AlertCircle, Loader2, X, Globe, ChevronRight,
  ArrowUp, ArrowDown, Edit3, Save, MapPin, Map as MapIcon,
  ArrowLeftRight, Settings2, RotateCcw, TrendingUp, DollarSign, CheckCircle2, Search, Circle, Coins, ListChecks,
  Sun, Cloud, CloudRain, CloudLightning, Snowflake, Smartphone, Shirt, Bath, Pill, FileText, Package,
  Calculator, Equal, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, StickyNote, Eye, EyeOff
} from 'lucide-react';

/**
 * 🏆 Travel Planner - 彥麟製作最終黃金穩定版 (2026.02.06)
 * ------------------------------------------------
 * 1. 備註摺疊系統：預設隱藏行程備註，支援「全局開關」與「單獨點擊展開」。
 * 2. 標籤圖案優化：動態注入旅遊圖示作為瀏覽器 Favicon (藍色飛機)。
 * 3. 日期調整：加入整天行程移動功能 (往前/往後移)。
 * 4. 標題強化：Day 標題與導覽列同步顯示日期與星期幾。
 * 5. 計算機優化：運算精度維持小數點後 8 位數。
 * 6. 完整計算機：匯率頁面下方配置完整實體計算機。
 * 7. 天氣優化：結束日期自動預設為旅程最後一天。
 */

const VERSION_INFO = "穩定版 V2.0 - 2026/02/06 17:40";

// --- 靜態配置與資料對照 ---
const currencyNames = {
  "TWD": "台灣 - 台幣", "USD": "美國 - 美金", "JPY": "日本 - 日圓", "KRW": "韓國 - 韓元",
  "THB": "泰國 - 泰銖", "VND": "越南 - 越南盾", "HKD": "香港 - 港幣", "EUR": "歐盟 - 歐元",
  "CNY": "中國 - 人民幣", "GBP": "英國 - 英鎊", "SGD": "新加坡 - 新加坡幣", "AUD": "澳洲 - 澳幣"
};

const CHECKLIST_CATEGORIES = [
  { id: 'cat_3c', name: '3C 產品', icon: Smartphone, items: ['手機', '充電線', '充電器', '相機', '萬用轉接頭', '行動電源', '筆記型電腦'] },
  { id: 'cat_clothing', name: '衣物', icon: Shirt, items: ['上衣', '褲子', '外套', '鞋子', '內衣褲', '墨鏡', '帽子', '圍巾', '手套'] },
  { id: 'cat_toiletries', name: '盥洗及衛生用品', icon: Bath, items: ['卸妝巾', '洗面乳', '牙膏', '牙刷', '牙線', '毛巾', '濕紙巾', '面紙'] },
  { id: 'cat_medicine', name: '個人藥品', icon: Pill, items: ['暈車藥', '過敏藥', '消毒用品', '感冒藥', 'OK 繃', '蚊蟲止癢藥'] },
  { id: 'cat_docs', name: '重要文件', icon: FileText, items: ['身分證', '護照', '居留證', '簽證', '國際駕照', '登機證或機票', '住宿或交通票券'] },
  { id: 'cat_others', name: '其他用品', icon: Package, items: ['空水壺或環保杯', '家中鑰匙', '眼罩', '外幣現金或信用卡', '耳塞', '頸枕'] }
];

// --- Firebase 初始化 ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'travel-yeh';

// --- 工具函數 ---
const getFormattedDate = (baseDate, dayOffset) => {
  if (!baseDate) return "";
  try {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + (dayOffset - 1));
    return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch (e) { return ""; }
};

const getDayOfWeek = (baseDate, dayOffset, short = false) => {
  if (!baseDate) return "";
  try {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + (dayOffset - 1));
    const weekday = d.toLocaleDateString('zh-TW', { weekday: 'long' });
    return short ? weekday.replace('星期', '') : weekday;
  } catch (e) { return ""; }
};

const formatFullDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

// --- 子組件：天氣預測 ---
const WeatherMaster = ({ tripInfo }) => {
  const defaultEndDate = useMemo(() => {
    if (!tripInfo?.startDate || !tripInfo?.duration) return '';
    try {
      const d = new Date(tripInfo.startDate);
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

  const getWeatherInfo = (code) => {
    if (code === 0) return { icon: Sun, label: "晴天", color: "text-orange-500", tip: "紫外線強，建議注意防曬。" };
    if (code <= 3) return { icon: Cloud, label: "多雲", color: "text-blue-400", tip: "天氣舒適，適合多層次穿搭。" };
    if (code >= 51 && code <= 67) return { icon: CloudRain, label: "有雨", color: "text-blue-600", tip: "記得帶傘，建議穿防水鞋。" };
    if (code >= 95) return { icon: CloudLightning, label: "雷雨", color: "text-indigo-700", tip: "天氣不穩，建議待在室內。" };
    return { icon: Cloud, label: "陰天", color: "text-slate-400", tip: "天氣陰涼，建議攜帶薄外套。" };
  };

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
        daily: weatherData.daily.time.map((time, i) => ({
          date: time, max: weatherData.daily.temperature_2m_max[i], min: weatherData.daily.temperature_2m_min[i], code: weatherData.daily.weather_code[i]
        }))
      });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in space-y-10 w-full max-w-5xl mx-auto">
      <div className="bg-white p-8 md:p-12 rounded-[4rem] shadow-xl border border-slate-100">
        <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3"><Sun className="text-orange-500" /> 全球精準氣象查詢</h3>
        <form onSubmit={fetchWeather} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">目的地</label><input required value={q.dest} onChange={e => setQ({...q, dest: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none font-bold shadow-inner transition-all" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">開始日期</label><input required type="date" value={q.start} onChange={e => setQ({...q, start: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">結束日期</label><input required type="date" value={q.end} min={q.start} onChange={e => setQ({...q, end: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" /></div>
          <button type="submit" disabled={loading} className="bg-blue-600 text-white h-[60px] rounded-3xl font-black shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <Search size={20}/>} 查詢</button>
        </form>
        {error && <p className="mt-4 text-red-500 text-xs font-bold animate-pulse">{error}</p>}
      </div>
      {results && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {results.daily.map(day => {
            const info = getWeatherInfo(day.code);
            return (
              <div key={day.date} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-lg group">
                <p className="text-[10px] font-black text-slate-300 mb-4">{day.date}</p>
                <div className="flex justify-between items-start mb-6"><info.icon className={`${info.color}`} size={48} /><div className="text-right"><p className="text-3xl font-black text-slate-800">{Math.round(day.max)}°</p><p className="text-sm font-bold text-slate-300">{Math.round(day.min)}°</p></div></div>
                <div className="bg-slate-50 p-4 rounded-2xl"><p className={`font-black text-sm mb-1 ${info.color}`}>{info.label}</p><p className="text-[11px] text-slate-500 leading-relaxed">{info.tip}</p></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- 子組件：進階清單管理 ---
const ChecklistMaster = ({ itineraryData, updateItinField }) => {
  const [editingId, setEditingId] = useState(null);
  const [tempText, setTempText] = useState('');
  const [addingToCategory, setAddingToCategory] = useState(null);
  const [newItemText, setNewItemText] = useState('');

  const checklist = itineraryData?.checklist || [];
  const completedCount = checklist.filter(i => i.completed).length;
  const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  const groupedItems = useMemo(() => {
    const groups = {};
    CHECKLIST_CATEGORIES.forEach(cat => groups[cat.id] = []);
    checklist.forEach(item => {
      const catId = item.categoryId || 'cat_others';
      if (!groups[catId]) groups[catId] = [];
      groups[catId].push(item);
    });
    return groups;
  }, [checklist]);

  const handleAddItem = async (catId) => {
    if (!newItemText.trim()) return;
    const newItem = { id: Date.now().toString(), text: newItemText.trim(), completed: false, categoryId: catId };
    await updateItinField('checklist', [...checklist, newItem]);
    setNewItemText(''); setAddingToCategory(null);
  };

  return (
    <div className="animate-fade-in space-y-8 w-full max-w-5xl mx-auto">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
        <div className="flex justify-between items-end mb-4"><div><h3 className="text-2xl font-black text-slate-800 tracking-tight">行李準備進度</h3><p className="text-sm font-bold text-slate-400">總共 {checklist.length} 項，已完成 {completedCount} 項</p></div><span className="text-5xl font-black text-blue-600 italic">{progress}%</span></div>
        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${progress}%` }}></div></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {CHECKLIST_CATEGORIES.map(cat => (
          <div key={cat.id} className="bg-white p-8 rounded-[3rem] shadow-lg border border-slate-50 flex flex-col h-fit hover:shadow-2xl transition-all">
            <div className="flex items-center justify-between mb-6"><div className="flex items-center gap-3"><div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm"><cat.icon size={24} /></div><h4 className="text-xl font-black text-slate-800">{cat.name}</h4></div><button onClick={() => setAddingToCategory(cat.id === addingToCategory ? null : cat.id)} className="p-2 text-slate-300 hover:text-blue-500"><Plus size={20} /></button></div>
            {addingToCategory === cat.id && <div className="mb-4 flex gap-2"><input autoFocus placeholder="新增項目..." value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddItem(cat.id)} className="flex-1 p-3 bg-slate-50 border-2 border-blue-100 rounded-xl text-sm font-bold outline-none" /><button onClick={() => handleAddItem(cat.id)} className="bg-blue-600 text-white px-4 rounded-xl font-black shadow-md"><CheckCircle2 size={18}/></button></div>}
            <div className="space-y-3">
              {(groupedItems[cat.id] || []).map(item => (
                <div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${item.completed ? 'bg-slate-50 opacity-60' : 'bg-white hover:border-blue-100 shadow-sm'}`}>
                  <div className="flex items-center gap-3 flex-1"><button onClick={async () => await updateItinField('checklist', checklist.map(i => i.id === item.id ? {...i, completed: !i.completed} : i))} className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${item.completed ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-100' : 'border-slate-200'}`}>{item.completed && <CheckCircle size={16} />}</button>
                    {editingId === item.id ? <input autoFocus value={tempText} onChange={e => setTempText(e.target.value)} onBlur={async () => { await updateItinField('checklist', checklist.map(i => i.id === item.id ? {...i, text: tempText} : i)); setEditingId(null); }} className="bg-blue-50 px-2 py-1 rounded font-bold outline-none flex-1 border-b-2 border-blue-500" /> : <span onClick={() => { setEditingId(item.id); setTempText(item.text); }} className={`text-sm font-bold cursor-text flex-1 ${item.completed ? 'line-through text-slate-400 italic' : 'text-slate-700'}`}>{item.text}</span>}
                  </div>
                  <button onClick={async () => await updateItinField('checklist', checklist.filter(i => i.id !== item.id))} className="p-1.5 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 子組件：匯率管理 (高精度 8 位版) ---
const CurrencyMaster = () => {
  const [rates, setRates] = useState({});
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('TWD');
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');

  const [customRates, setCustomRates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('custom_rates')) || {}; } catch(e) { return {}; }
  });
  const [useCustom, setUseCustom] = useState(() => {
    try { return JSON.parse(localStorage.getItem('use_custom_status')) || {}; } catch(e) { return {}; }
  });

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
      const data = await res.json();
      if (data.result === 'success') setRates(data.rates || {});
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchRates(); }, [baseCurrency]);
  useEffect(() => {
    localStorage.setItem('custom_rates', JSON.stringify(customRates));
    localStorage.setItem('use_custom_status', JSON.stringify(useCustom));
  }, [customRates, useCustom]);

  const handleCalcInput = (val) => {
    if (val === 'C') setCalcDisplay('0');
    else if (val === '=') {
        try {
            const result = Function(`'use strict'; return (${calcDisplay})`)();
            setCalcDisplay(String(parseFloat(Number(result).toFixed(8))));
        } catch (e) { setCalcDisplay('Error'); }
    } else setCalcDisplay(prev => prev === '0' || prev === 'Error' ? val : prev + val);
  };

  const applyCalcToAmount = () => {
    const val = parseFloat(calcDisplay);
    if (!isNaN(val)) setAmount(val);
  };

  const handleSwap = () => {
    const temp = baseCurrency; setBaseCurrency(targetCurrency); setTargetCurrency(temp);
  };

  const convertedAmount = useMemo(() => {
    const rate = (useCustom[targetCurrency] && customRates[targetCurrency]) ? customRates[targetCurrency] : (rates[targetCurrency] || 0);
    return (amount * rate).toFixed(2);
  }, [amount, targetCurrency, rates, customRates, useCustom]);

  const majorCurrencies = Object.keys(currencyNames);
  const filteredCurrencies = majorCurrencies.filter(c => 
    (currencyNames[c] || "").toLowerCase().includes(searchTerm.toLowerCase()) || c.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in space-y-8 w-full max-w-5xl mx-auto">
      <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden transition-all p-10 md:p-14">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-8 items-center">
          <div className="md:col-span-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">輸入金額</label>
            <div className="relative">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"><DollarSign size={24} /></div>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full pl-14 pr-4 py-6 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-3xl outline-none transition-all text-2xl font-black shadow-inner" />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                 <select value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)} className="bg-white border shadow-sm rounded-xl px-2 py-1 text-xs font-black outline-none transition-all max-w-[150px]">
                   {majorCurrencies.map(curr => <option key={curr} value={curr}>{currencyNames[curr] || curr}</option>)}
                 </select>
              </div>
            </div>
          </div>
          <div className="flex justify-center md:col-span-1"><button onClick={handleSwap} className="bg-blue-50 p-4 rounded-full text-blue-600 shadow-inner hover:bg-blue-600 hover:text-white transition-all duration-500 active:scale-90 group shadow-md"><ArrowLeftRight className="md:rotate-0 rotate-90" size={28} /></button></div>
          <div className="md:col-span-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">轉換結果</label>
            <div className="w-full pl-8 pr-6 py-5 bg-blue-600 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-blue-100">
              <div><span className="text-3xl font-black tracking-tight">{convertedAmount}</span><p className="text-blue-100 text-[10px] mt-1 font-bold">{currencyNames[targetCurrency] || targetCurrency}</p></div>
              <select value={targetCurrency} onChange={e => setTargetCurrency(e.target.value)} className="bg-blue-700 text-white border-none rounded-xl px-3 py-1.5 text-xs font-black outline-none max-w-[150px] transition-all">
                {majorCurrencies.map(curr => <option key={curr} value={curr}>{currencyNames[curr] || curr}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-8 flex justify-between items-center"><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><TrendingUp size={16} className="text-green-500" /><span>匯率已同步</span></div><div className="flex gap-4"><button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-black transition-all bg-white border text-slate-600 shadow-sm"><Settings2 size={16} /> 匯率管理</button><button onClick={fetchRates} className="text-xs font-black text-blue-600 p-2 hover:bg-blue-100 rounded-xl transition-all"><RotateCcw size={16} /></button></div></div>
      </div>

      <div className="bg-slate-900 text-white p-8 md:p-12 rounded-[4rem] shadow-2xl border border-slate-800">
          <div className="flex items-center gap-3 mb-8 px-2"><div className="p-3 bg-blue-600 rounded-2xl"><Calculator size={24} /></div><h4 className="font-black text-2xl tracking-tight">旅程小計算機</h4></div>
          <div className="bg-black/40 p-8 rounded-[2.5rem] mb-10 text-right shadow-inner border border-white/5"><span className="text-6xl font-black font-mono tracking-tighter text-white block truncate leading-tight">{calcDisplay}</span></div>
          <div className="grid grid-cols-4 gap-4 md:gap-6">
              {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','C','+'].map(btn => (<button key={btn} onClick={() => handleCalcInput(btn)} className={`py-6 md:py-8 rounded-[1.5rem] font-black text-3xl transition-all shadow-sm active:scale-95 ${isNaN(btn) && btn !== '.' ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}>{btn}</button>))}
              <button onClick={() => handleCalcInput('=')} className="col-span-2 py-8 bg-green-600 text-white rounded-[1.5rem] font-black text-2xl hover:bg-green-500 transition-all active:scale-95"><Equal size={32}/></button>
              <button onClick={applyCalcToAmount} className="col-span-2 py-8 bg-white text-slate-900 rounded-[1.5rem] font-black text-xl hover:bg-slate-100 transition-all active:scale-95 shadow-xl">套用到匯率輸入</button>
          </div>
      </div>
      {showSettings && (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-8 border-b flex justify-between items-center bg-slate-50/50"><div><h3 className="font-black text-xl text-slate-800 tracking-tight">匯率管理</h3></div><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" placeholder="搜尋..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-12 pr-6 py-3 border rounded-2xl text-sm font-bold outline-none focus:ring-4 ring-blue-50 w-64 transition-all shadow-sm" /></div></div>
          <div className="max-h-[400px] overflow-y-auto scrollbar-hide"><table className="w-full text-left"><thead className="bg-slate-50 text-slate-400 text-[10px] font-black sticky top-0"><tr><th className="px-8 py-5">國家與幣別</th><th className="px-8 py-5 text-right">市場</th><th className="px-8 py-5 text-center">模式</th><th className="px-8 py-5 text-right">數值</th></tr></thead><tbody className="divide-y divide-slate-50">{filteredCurrencies.map(curr => (<tr key={curr} className="hover:bg-blue-50/20 transition-colors"><td className="px-8 py-5"><div className="font-black text-slate-700">{currencyNames[curr]}</div><div className="text-[10px] text-slate-400 font-bold uppercase">{curr}</div></td><td className="px-8 py-5 text-right font-mono font-bold">{rates[curr]?.toFixed(4)}</td><td className="px-8 py-5 text-center"><button onClick={() => setUseCustom(p => ({...p, [curr]: !p[curr]}))} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${useCustom[curr] ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{useCustom[curr] ? '手動' : '自動'}</button></td><td className="px-8 py-5 text-right"><input type="number" step="0.0001" disabled={!useCustom[curr]} value={customRates[curr] || ''} onChange={e => setCustomRates(p => ({...p, [curr]: parseFloat(e.target.value) || 0}))} className={`w-24 p-2 border rounded-xl text-sm text-right font-bold transition-all ${useCustom[curr] ? 'bg-white border-orange-300 ring-4 ring-orange-50' : 'bg-slate-50'}`} /></td></tr>))}</tbody></table></div>
        </div>
      )}
      {loading && <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-[200] flex flex-col items-center justify-center"><Loader2 className="animate-spin text-blue-600 mb-2" size={48} /></div>}
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
  const [aiStatus, setAiStatus] = useState({ type: '', message: '' });
  const [editingTripId, setEditingTripId] = useState(null);

  // 🌟 備註展開管理狀態
  const [showAllNotes, setShowAllNotes] = useState(false); // 全局開關 (預設隱藏)
  const [expandedItems, setExpandedItems] = useState({}); // 單個手動展開記錄

  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script'); script.id = 'tailwind-cdn'; script.src = 'https://cdn.tailwindcss.com'; document.head.appendChild(script);
    }
    const style = document.createElement('style'); style.id = 'premium-ui-engine-v2';
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
      html, body, #root { min-height: 100vh !important; width: 100% !important; background-color: #f8fafc !important; font-family: 'Noto Sans TC', sans-serif !important; }
      #root { display: flex !important; flex-direction: column !important; align-items: center !important; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .premium-slider { scrollbar-width: thin; scrollbar-color: #2563eb #f1f5f9; }
      .premium-slider::-webkit-scrollbar { height: 6px; }
      .premium-slider::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
      .premium-slider::-webkit-scrollbar-thumb { background-color: #2563eb; border-radius: 10px; border: 2px solid #f1f5f9; }
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

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token); 
      else await signInAnonymously(auth);
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); setIsLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const tripsRef = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    return onSnapshot(tripsRef, (snapshot) => {
      const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(tripList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });
  }, [user]);

  useEffect(() => {
    if (!user || !tripId) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, docSnap => {
      if (docSnap.exists()) { setItineraryData({ days: docSnap.data().days || {}, checklist: docSnap.data().checklist || [] }); setView('editor'); }
    });
    const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(tripRef, docSnap => { if (docSnap.exists()) setTripInfo(docSnap.data()); });
    return () => { unsubItin(); unsubTrip(); };
  }, [user, tripId]);

  const updateItinField = async (field, value) => {
    if (!user || !tripId) return;
    try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), { [field]: value }); } catch (err) { console.error(err); }
  };

  const moveDay = async (direction) => {
    if (!user || !tripId) return;
    const days = { ...itineraryData.days };
    const targetDay = activeDay + direction;
    if (targetDay < 1 || targetDay > parseInt(tripInfo.duration)) return;
    const currentData = days[activeDay];
    const targetData = days[targetDay];
    days[activeDay] = targetData;
    days[targetDay] = currentData;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), { days });
    setActiveDay(targetDay);
    setAiStatus({ type: 'success', message: `已調換行程順序` });
  };

  const handleCreateOrUpdate = async e => {
    e.preventDefault(); if (!user) return; setIsLoading(true);
    if (editingTripId) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', editingTripId), { ...tripInfo });
      setEditingTripId(null); setTripInfo({ country: '', city: '', startDate: '', duration: 3 });
      setIsLoading(false);
    } else {
      const newId = crypto.randomUUID(); const days = {};
      for (let i = 1; i <= Math.max(1, parseInt(tripInfo.duration)); i++) days[i] = { spots: [], title: '' };
      const initialChecklist = [];
      CHECKLIST_CATEGORIES.forEach(cat => cat.items.forEach((text, i) => initialChecklist.push({ id: `${cat.id}_${i}`, text, completed: false, categoryId: cat.id })));
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', newId), { ...tripInfo, creator: user.uid, createdAt: new Date().toISOString() });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', newId), { days, checklist: initialChecklist });
      setTripId(newId); setIsLoading(false);
    }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-screen bg-slate-50"><Loader2 className="animate-spin text-blue-600 mb-2" size={48} /><p className="text-slate-500 font-black italic tracking-widest leading-none">同步雲端資料中...</p></div>;

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      {aiStatus.message && ( <div className={`fixed top-4 z-[200] px-6 py-3 rounded-2xl shadow-2xl animate-fade-in flex items-center gap-3 border ${aiStatus.type === 'success' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'}`}> <span className="font-bold text-sm">{aiStatus.message}</span><button onClick={() => setAiStatus({ type: '', message: '' })}><X size={14}/></button> </div> )}

      {view === 'home' ? (
        <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-fade-in">
          <div className="text-center mb-16"><div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0"><Plane size={48} /></div><h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase">Travel Planner</h1><p className="text-slate-400 font-bold tracking-widest text-sm italic text-center">找回您的冒險之旅-彥麟製作</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-start">
            <div className="space-y-6"><h3 className="text-xl font-black text-slate-800 flex items-center gap-2">{editingTripId ? <Edit3 className="text-blue-600" /> : <Plus className="text-blue-600" />} {editingTripId ? '編輯旅程' : '建立新旅程'}</h3>
              <form onSubmit={handleCreateOrUpdate} className="bg-white p-10 rounded-[3rem] shadow-xl space-y-8 border border-white shadow-slate-200">
                <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">國家</label><input required placeholder="如: 日本" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">城市</label><input required placeholder="如: 東京" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} /></div></div>
                <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">出發日期</label><input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">天數</label><input required type="number" min="1" max="14" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} /></div></div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl transition-all">{editingTripId ? '儲存修改' : '開始規劃'}</button>
                {editingTripId && <button type="button" onClick={() => { setEditingTripId(null); setTripInfo({country:'', city:'', startDate:'', duration:3}); }} className="w-full text-slate-400 font-bold py-2">取消</button>}
              </form>
            </div>
            <div className="space-y-6"><h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600" /> 旅程清單 ({trips.length})</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                {trips.map(trip => (<div key={trip.id} onClick={() => setTripId(trip.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between"><div className="flex items-center gap-5"><div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm"><Globe size={24} /></div><div><h4 className="text-xl font-black text-slate-800 tracking-tight">{trip.city} 之旅</h4><p className="text-[10px] font-bold text-slate-400 mt-1">{trip.country} · {trip.startDate}</p><p className="text-[9px] text-slate-300 font-bold mt-1">建立於 {formatFullDate(trip.createdAt)}</p></div></div><div className="flex items-center gap-1"><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={(e) => { e.stopPropagation(); setEditingTripId(trip.id); setTripInfo({...trip}); }} className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl"><Edit3 size={18}/></button><button onClick={async (e) => { e.stopPropagation(); if(confirm('確定刪除？')) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', trip.id)); }} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl"><Trash2 size={18}/></button></div><ChevronRight className="text-slate-200" /></div></div>))}
              </div>
            </div>
          </div>
          <div className="mt-12 text-slate-300 text-[10px] font-bold uppercase tracking-widest text-center">{VERSION_INFO}</div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center pb-24 animate-fade-in">
          <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-50">
            <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}><div className="p-2 bg-blue-600 text-white rounded-2xl shadow-lg"><Plane size={24} className="rotate-45" /></div><span className="tracking-tighter uppercase">Traveler</span></div>
            <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              <button onClick={() => setActiveTab('itinerary')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'itinerary' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>行程</button>
              <button onClick={() => setActiveTab('weather')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'weather' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>天氣</button>
              <button onClick={() => setActiveTab('checklist')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'checklist' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>清單</button>
              <button onClick={() => setActiveTab('currency')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'currency' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>匯率</button>
            </div>
            <div className="text-right"><div className="font-black text-slate-800 text-xl leading-none">{tripInfo.city} 之旅</div><div className="text-[11px] text-slate-400 font-bold uppercase mt-1 inline-block bg-slate-50 px-2 py-0.5 rounded-full">{tripInfo.startDate}</div></div>
          </nav>
          
          <main className="w-full max-w-5xl p-6 md:p-12">
            {activeTab === 'itinerary' ? (
              <div className="space-y-12">
                <div className="flex gap-4 overflow-x-auto pb-4 premium-slider flex-nowrap px-2">{Object.keys(itineraryData?.days || {}).map(day => ( <button key={day} onClick={() => {setActiveDay(parseInt(day)); setEditingId(null);}} className={`shrink-0 w-28 h-28 rounded-3xl font-black transition-all border flex flex-col items-center justify-center gap-1 shadow-sm ${activeDay === parseInt(day) ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-105' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}><span className="text-xs uppercase opacity-60">Day</span><span className="text-3xl leading-none">{day}</span><span className="text-[10px] mt-1 font-bold">{getFormattedDate(tripInfo.startDate, parseInt(day)).slice(5)}</span></button> ))}</div>
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-end gap-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-6xl font-black text-slate-900 tracking-tighter italic leading-none shrink-0">Day {activeDay}</h2>
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200"><button onClick={() => moveDay(-1)} disabled={activeDay === 1} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20"><ArrowLeft size={20}/></button><div className="w-px h-6 bg-slate-200 my-auto"></div><button onClick={() => moveDay(1)} disabled={activeDay === parseInt(tripInfo.duration)} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20"><ArrowRight size={20}/></button></div>
                    </div>
                    <div className="flex-1">
                      <span className="text-lg text-slate-400 font-bold ml-1 mb-1 block">({getFormattedDate(tripInfo.startDate, activeDay)} {getDayOfWeek(tripInfo.startDate, activeDay)})</span>
                      <input className="text-3xl md:text-4xl font-black text-blue-600 bg-transparent outline-none border-b-2 border-transparent focus:border-blue-200 placeholder:text-slate-200 w-full" placeholder="今日主題..." value={itineraryData?.days?.[activeDay]?.title || ''} onChange={e => updateItinField(`days.${activeDay}.title`, e.target.value)} />
                    </div>
                  </div>
                  {/* 🌟 全局摺疊開關 */}
                  <div className="flex justify-center md:justify-start">
                    <button 
                      onClick={() => setShowAllNotes(!showAllNotes)}
                      className={`flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-black transition-all shadow-sm border ${showAllNotes ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}
                    >
                      {showAllNotes ? <EyeOff size={16} /> : <Eye size={16} />}
                      {showAllNotes ? '隱藏全部備註' : '顯示全部備註'}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-8 md:p-12 rounded-[4rem] shadow-sm border border-slate-100">
                  <form onSubmit={async e => { e.preventDefault(); const current = itineraryData?.days?.[activeDay]?.spots || []; await updateItinField(`days.${activeDay}.spots`, [...current, { ...newSpot, id: Date.now().toString() }]); setNewSpot({ time: '09:00', spot: '', note: '' }); }} className="mb-12 space-y-3 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner"><div className="flex gap-3 flex-wrap md:flex-nowrap"><div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full md:w-auto"><Clock size={18} className="text-blue-500" /><input type="time" value={newSpot.time} onChange={e => setNewSpot({...newSpot, time: e.target.value})} className="bg-transparent font-black outline-none w-24" /></div><input placeholder="想在那裡留下足跡？" required value={newSpot.spot} onChange={e => setNewSpot({...newSpot, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-bold outline-none" /></div><div className="flex gap-3"><textarea placeholder="備註..." value={newSpot.note} onChange={e => setNewSpot({...newSpot, note: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-medium h-20 resize-none text-sm" /><button type="submit" className="bg-slate-900 text-white px-8 rounded-xl font-black active:scale-95 shadow-lg"><Plus size={24}/></button></div></form>
                  <div className="space-y-8 relative before:content-[''] before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-1.5 before:bg-slate-50 before:rounded-full">
                    {(itineraryData?.days?.[activeDay]?.spots || []).map((item, idx) => {
                      const isExpanded = showAllNotes || !!expandedItems[item.id];
                      return (
                        <div key={item.id} className="relative pl-20 group">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1"><button onClick={() => { const spots = [...itineraryData.days[activeDay].spots]; if (idx > 0) { [spots[idx], spots[idx-1]] = [spots[idx-1], spots[idx]]; updateItinField(`days.${activeDay}.spots`, spots); } }} className="text-slate-200 hover:text-blue-600 transition-colors"><ArrowUp size={20}/></button><div className="w-16 h-16 bg-white border-8 border-slate-50 rounded-[1.5rem] flex items-center justify-center text-[11px] font-black text-blue-600 shadow-md group-hover:scale-110 transition-transform">{item.time}</div><button onClick={() => { const spots = [...itineraryData.days[activeDay].spots]; if (idx < spots.length-1) { [spots[idx], spots[idx+1]] = [spots[idx+1], spots[idx]]; updateItinField(`days.${activeDay}.spots`, spots); } }} className="text-slate-200 hover:text-blue-600 transition-colors"><ArrowDown size={20}/></button></div>
                          <div 
                            onClick={() => setExpandedItems(prev => ({...prev, [item.id]: !prev[item.id]}))}
                            className={`p-10 bg-white border rounded-[3rem] transition-all cursor-pointer ${editingId === item.id ? 'border-blue-600 shadow-2xl ring-8 ring-blue-50' : 'border-slate-100 hover:shadow-2xl'}`}
                          >
                            {editingId === item.id ? ( <div className="space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}><div className="flex gap-2"><input type="time" value={editData.time} onChange={e => setEditData({...editData, time: e.target.value})} className="p-3 border rounded-xl font-black w-32 bg-slate-50 outline-none" /><input value={editData.spot} onChange={e => setEditData({...editData, spot: e.target.value})} className="flex-1 p-3 border rounded-xl font-black bg-slate-50 outline-none" /></div><textarea value={editData.note} onChange={e => setEditData({...editData, note: e.target.value})} className="w-full p-3 border rounded-xl h-24 bg-slate-50 outline-none text-sm" /><div className="flex justify-end gap-3"><button onClick={() => setEditingId(null)} className="text-sm font-bold text-slate-400 px-4">取消</button><button onClick={async () => { const spots = itineraryData.days[activeDay].spots.map(s => s.id === editingId ? editData : s); await updateItinField(`days.${activeDay}.spots`, spots); setEditingId(null); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-black shadow-lg">儲存</button></div></div>
                            ) : ( <div className="flex justify-between items-start gap-4">
                                <div className="space-y-4 flex-1">
                                  <div className="flex items-center gap-4 flex-wrap">
                                    <h4 className="text-3xl font-black text-slate-800 leading-tight">{item.spot}</h4>
                                    <div className="flex gap-2">
                                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all inline-flex items-center gap-1.5 text-xs font-black shadow-sm"><MapPin size={14} /> 地圖</a>
                                      {item.note && (
                                        <div className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                                          <StickyNote size={12}/> {isExpanded ? '已展開' : '有備註'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {item.note && isExpanded && <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 animate-fade-in"><p className="text-slate-500 text-sm italic whitespace-pre-wrap leading-relaxed">{item.note}</p></div>}
                                </div>
                                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all"><button onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditData({...item}); }} className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl"><Edit3 size={20} /></button><button onClick={async (e) => { e.stopPropagation(); if(confirm('刪除景點？')) { const updated = itineraryData.days[activeDay].spots.filter(s => s.id !== item.id); await updateItinField(`days.${activeDay}.spots`, updated); } }} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl"><Trash2 size={20} /></button></div>
                              </div> )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : activeTab === 'weather' ? <WeatherMaster tripInfo={tripInfo} /> : activeTab === 'checklist' ? <ChecklistMaster itineraryData={itineraryData} updateItinField={updateItinField} /> : <CurrencyMaster /> }
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
