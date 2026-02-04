import React, { useState, useEffect } from 'react';
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
  Plane, Calendar, Plus, Trash2, Clock, Share2, 
  Copy, CheckCircle, AlertCircle, Loader2, Sparkles, X, ArrowRight, Globe, Map as MapIcon, ChevronRight,
  Cloud, Sun, PlaneTakeoff, ArrowUp, ArrowDown, Edit3, Save, MapPin, CheckSquare, Coins, ListChecks, Search, ExternalLink
} from 'lucide-react';

/**
 * 🚀 全功能整合版：
 * 1. 航班管理：含去回程日期、Google Flights 連結。
 * 2. 旅行行程：支援上下調整排序。
 * 3. 天氣頁面：整合 Google 搜尋查詢。
 * 4. 準備清單：內建完整基本選項。
 * 5. 匯率頁面：修復查詢與計算邏輯。
 */

const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try { return JSON.parse(__firebase_config); } catch (e) { console.error("Canvas Config 解析失敗", e); }
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

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'travel-yeh';
const appId = rawAppId.replace(/\//g, '_');
const apiKey = ""; 

// 預設準備清單項目
const DEFAULT_CHECKLIST = [
  { id: 'c1', text: '護照、證件', done: false },
  { id: 'c2', text: '錢包、外幣、信用卡', done: false },
  { id: 'c3', text: '住宿憑證', done: false },
  { id: 'c4', text: '手機、行動電源 (含線)', done: false },
  { id: 'c5', text: '充電線 (含手錶)', done: false },
  { id: 'c6', text: '環保購物袋', done: false },
  { id: 'c7', text: '筆', done: false },
  { id: 'c8', text: '雨傘', done: false },
  { id: 'c9', text: '濕紙巾、酒精擦', done: false },
  { id: 'c10', text: '萬國轉接頭', done: false },
  { id: 'c11', text: '衣服、內衣褲、睡衣、襪子', done: false },
  { id: 'c12', text: '保養品、除粉刺貼、化妝品', done: false },
  { id: 'c13', text: '隨身鏡、圓梳', done: false },
  { id: 'c14', text: '網路卡', done: false },
  { id: 'c15', text: '隨身藥品、眼藥水', done: false },
  { id: 'c16', text: '口罩', done: false },
  { id: 'c17', text: '影印護照、證件', done: false },
  { id: 'c18', text: '泳衣、運動服', done: false }
];

const App = () => {
  const [view, setView] = useState('home');
  const [activeTab, setActiveTab] = useState('itinerary');
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [tripInfo, setTripInfo] = useState({ country: '', city: '', startDate: '', duration: 3 });
  const [itineraryData, setItineraryData] = useState({ days: {}, checklist: [], currencyInfo: null, flightsInfo: { departDate: '', returnDate: '', flights: [] } });
  const [aiLoading, setAiLoading] = useState(false);

  // 指數退避重試
  const fetchWithRetry = async (url, options, retries = 5, delay = 1000) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw err;
    }
  };

  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn'; script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
    const style = document.createElement('style');
    style.innerHTML = `
      html, body, #root { min-height: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background-color: #f8fafc; }
      #root { display: flex !important; flex-direction: column !important; align-items: center !important; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
    `;
    document.head.appendChild(style);
  }, []);

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

  useEffect(() => {
    if (!user || !db) return;
    const tripsRef = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    return onSnapshot(tripsRef, (snapshot) => {
      const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(tripList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });
  }, [user]);

  useEffect(() => {
    if (!user || !tripId || !db) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setItineraryData({
          days: data.days || {},
          checklist: data.checklist || DEFAULT_CHECKLIST,
          currencyInfo: data.currencyInfo || null,
          flightsInfo: data.flightsInfo || { departDate: '', returnDate: '', flights: [] }
        });
        setView('trip');
      }
    });
    const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(tripRef, (docSnap) => {
      if (docSnap.exists()) setTripInfo(docSnap.data());
    });
    return () => { unsubItin(); unsubTrip(); };
  }, [user, tripId]);

  const updateItinField = async (path, value) => {
    if (!user || !tripId) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
      [path]: value
    });
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
    for (let i = 1; i <= Math.max(1, parseInt(tripInfo.duration)); i++) {
        days[i] = { spots: [], weather: null };
    }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', newId), {
        ...tripInfo, creator: user.uid, createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', newId), { 
        days, 
        checklist: DEFAULT_CHECKLIST,
        flightsInfo: { departDate: tripInfo.startDate, returnDate: '', flights: [] }
      });
      setTripId(newId);
      setActiveTab('itinerary');
    } finally { setIsLoading(false); }
  };

  const callGemini = async (prompt, isJson = false) => {
    setAiLoading(true);
    try {
      const body = { 
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ "google_search": {} }]
      };
      if (isJson) body.generationConfig = { responseMimeType: "application/json" };
      const result = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      return result.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setAiLoading(false);
    }
  };

  // --- 分頁組件 ---

  const ItineraryView = () => {
    const [newSpot, setNewSpot] = useState({ time: '09:00', spot: '', note: '' });
    const currentDay = itineraryData.days[activeDay] || { spots: [] };

    const addSpot = async (e) => {
      e.preventDefault();
      const updated = [...(currentDay.spots || []), { ...newSpot, id: Date.now().toString() }];
      await updateItinField(`days.${activeDay}.spots`, updated);
      setNewSpot({ time: '09:00', spot: '', note: '' });
    };

    const moveSpot = async (idx, dir) => {
      const spots = [...(currentDay.spots || [])];
      const target = idx + dir;
      if (target < 0 || target >= spots.length) return;
      [spots[idx], spots[target]] = [spots[target], spots[idx]];
      await updateItinField(`days.${activeDay}.spots`, spots);
    };

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
        <div className="flex gap-3 overflow-x-auto pb-6 mb-8 scrollbar-hide">
          {Object.keys(itineraryData.days).map(day => (
            <button key={day} onClick={() => setActiveDay(parseInt(day))} className={`shrink-0 px-8 py-4 rounded-2xl font-black transition-all border ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>
              D{day} · {getFormattedDate(tripInfo.startDate, parseInt(day)).split('/').slice(1).join('/')}
            </button>
          ))}
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-end mb-10">
            <div>
               <h2 className="text-5xl font-black text-slate-900 italic tracking-tighter">Day {activeDay}</h2>
               <p className="text-slate-400 font-bold uppercase text-xs mt-1 tracking-widest">{getFormattedDate(tripInfo.startDate, activeDay)}</p>
            </div>
            <div className="w-16 h-1.5 bg-blue-600 rounded-full mb-2"></div>
          </div>

          <form onSubmit={addSpot} className="mb-10 space-y-3 bg-slate-50 p-6 rounded-3xl border">
            <div className="flex gap-3 flex-wrap md:flex-nowrap">
               <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full md:w-auto">
                 <Clock size={18} className="text-blue-500" />
                 <input type="time" value={newSpot.time} onChange={e => setNewSpot({...newSpot, time: e.target.value})} className="bg-transparent font-black outline-none w-24" />
               </div>
               <input placeholder="景點名稱" required value={newSpot.spot} onChange={e => setNewSpot({...newSpot, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-bold outline-none" />
            </div>
            <div className="flex gap-3">
               <textarea placeholder="詳細備註..." value={newSpot.note} onChange={e => setNewSpot({...newSpot, note: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-medium outline-none h-20 resize-none text-sm" />
               <button type="submit" className="bg-slate-900 text-white px-8 rounded-xl font-black flex flex-col items-center justify-center gap-1 active:scale-95">
                 <Plus size={24}/><span className="text-[10px]">加入</span>
               </button>
            </div>
          </form>

          <div className="space-y-8 relative before:content-[''] before:absolute before:left-[27px] before:top-4 before:bottom-4 before:w-1 before:bg-slate-50">
            {currentDay.spots?.map((item, idx) => (
              <div key={item.id} className="relative pl-16 group">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                  <button onClick={() => moveSpot(idx, -1)} className="text-slate-200 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"><ArrowUp size={16}/></button>
                  <div className="w-14 h-14 bg-white border-4 border-slate-50 rounded-2xl flex items-center justify-center text-[10px] font-black text-blue-600 shadow-md">{item.time}</div>
                  <button onClick={() => moveSpot(idx, 1)} className="text-slate-200 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"><ArrowDown size={16}/></button>
                </div>
                <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] flex justify-between items-start hover:shadow-xl transition-all border-l-8 hover:border-l-blue-600 shadow-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                       <h4 className="text-2xl font-black text-slate-800">{item.spot}</h4>
                       <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black flex items-center gap-1 hover:bg-blue-600 hover:text-white transition-all"><MapPin size={12}/> 地圖</a>
                    </div>
                    <p className="text-slate-500 text-sm italic whitespace-pre-wrap">{item.note || "暫無備註..."}</p>
                  </div>
                  <button onClick={async () => {
                    const filtered = currentDay.spots.filter(s => s.id !== item.id);
                    await updateItinField(`days.${activeDay}.spots`, filtered);
                  }} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 p-2 transition-all"><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
            {(!currentDay.spots || currentDay.spots.length === 0) && (
              <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem] text-slate-300 font-bold italic">行程還是空的，開始規劃吧！</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const FlightView = () => {
    const fInfo = itineraryData.flightsInfo || { departDate: '', returnDate: '', flights: [] };
    const [newF, setNewF] = useState({ flightNo: '', time: '08:00', type: '起飛' });

    const saveDates = (field, val) => updateItinField(`flightsInfo.${field}`, val);

    const addFlight = async (e) => {
      e.preventDefault();
      const updated = [...(fInfo.flights || []), { ...newF, id: Date.now().toString() }];
      await updateItinField(`flightsInfo.flights`, updated);
      setNewF({ flightNo: '', time: '08:00', type: '起飛' });
    };

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black flex items-center gap-2"><Plane className="text-blue-600"/> 航班管理</h3>
            <a href="https://www.google.com/travel/flights?hl=zh-TW" target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-blue-600 hover:text-white transition-all">
              <Globe size={14}/> 前往 Google Flights
            </a>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">起飛日期</label>
              <input type="date" value={fInfo.departDate} onChange={e => saveDates('departDate', e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">回程日期</label>
              <input type="date" value={fInfo.returnDate} onChange={e => saveDates('returnDate', e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold" />
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {fInfo.flights?.map(f => (
              <div key={f.id} className="p-6 bg-slate-50 rounded-3xl border flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-100">
                    <PlaneTakeoff size={20}/>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <span className="text-xl font-black text-slate-800">{f.flightNo}</span>
                       <span className="bg-white px-2 py-0.5 rounded-full text-[9px] font-black border text-slate-400 uppercase">{f.type}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">{f.time}</p>
                  </div>
                </div>
                <button onClick={async () => {
                  const filtered = fInfo.flights.filter(fl => fl.id !== f.id);
                  await updateItinField(`flightsInfo.flights`, filtered);
                }} className="text-slate-200 hover:text-red-500 p-2 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={20}/></button>
              </div>
            ))}
          </div>

          <form onSubmit={addFlight} className="flex gap-3 bg-slate-900 p-5 rounded-[2.5rem] shadow-xl">
             <input required placeholder="航班編號 (如: BR198)" value={newF.flightNo} onChange={e => setNewF({...newF, flightNo: e.target.value.toUpperCase()})} className="flex-1 p-3 rounded-2xl bg-white/10 text-white placeholder-white/30 border-none outline-none font-black text-sm focus:bg-white/20" />
             <input type="time" value={newF.time} onChange={e => setNewF({...newF, time: e.target.value})} className="p-3 rounded-2xl bg-white/10 text-white border-none outline-none font-black text-sm w-32 focus:bg-white/20" />
             <button type="submit" className="bg-blue-600 text-white px-8 rounded-2xl font-black hover:bg-blue-500 active:scale-95 transition-all shadow-lg">新增航班</button>
          </form>
        </div>
      </div>
    );
  };

  const WeatherView = () => {
    const currentWeather = itineraryData.days[activeDay]?.weather;

    const fetchWeather = async () => {
      const prompt = `利用 Google 搜尋查出「${tripInfo.city}」在「${getFormattedDate(tripInfo.startDate, activeDay)}」的天氣預報資訊。輸出 JSON: {"temp": "氣溫", "condition": "狀態", "tips": "建議"}`;
      const res = await callGemini(prompt, true);
      if (res) {
        try {
          const data = JSON.parse(res);
          await updateItinField(`days.${activeDay}.weather`, data);
        } catch (e) {}
      }
    };

    return (
      <div className="bg-white p-12 rounded-[4rem] shadow-sm border text-center animate-in fade-in duration-500 relative overflow-hidden max-w-4xl mx-auto">
        <div className="absolute top-0 right-0 p-10 text-blue-50/50 -z-10"><Cloud size={180}/></div>
        <h3 className="text-2xl font-black mb-10 flex items-center justify-center gap-2"><Sun className="text-yellow-500"/> 當日即時天氣</h3>
        
        {currentWeather ? (
          <div className="space-y-6">
            <div className="text-8xl font-black text-slate-900 tracking-tighter">{currentWeather.temp}</div>
            <div className="text-2xl font-black text-blue-600">{currentWeather.condition}</div>
            <div className="bg-blue-50 p-8 rounded-[3rem] border border-blue-100 max-w-md mx-auto shadow-sm">
              <p className="text-blue-700 font-bold text-sm leading-relaxed whitespace-pre-wrap">{currentWeather.tips}</p>
            </div>
            <button onClick={fetchWeather} className="text-slate-300 text-xs font-bold underline mt-8 hover:text-blue-600 transition-all">重新獲取最新預報</button>
          </div>
        ) : (
          <div className="py-10">
            <Sparkles className="text-blue-200 mx-auto mb-6" size={64}/>
            <p className="text-slate-400 font-bold mb-8">準備查詢：{tripInfo.city} · {getFormattedDate(tripInfo.startDate, activeDay)}</p>
            <button onClick={fetchWeather} disabled={aiLoading} className="bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black shadow-xl flex items-center gap-3 mx-auto hover:scale-105 active:scale-95 transition-all">
              {aiLoading ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>} 獲取 Google 搜尋建議
            </button>
          </div>
        )}
      </div>
    );
  };

  const ChecklistView = () => {
    const [newItem, setNewItem] = useState('');
    const list = itineraryData.checklist || DEFAULT_CHECKLIST;

    const addItem = async (e) => {
      e.preventDefault();
      if (!newItem) return;
      const updated = [...list, { id: Date.now().toString(), text: newItem, done: false }];
      await updateItinField('checklist', updated);
      setNewItem('');
    };

    const toggle = async (id) => {
      const updated = list.map(item => item.id === id ? { ...item, done: !item.done } : item);
      await updateItinField('checklist', updated);
    };

    return (
      <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border animate-in fade-in duration-500 max-w-4xl mx-auto">
        <h3 className="text-2xl font-black mb-8 flex items-center gap-2"><ListChecks className="text-green-500"/> 行前準備清單</h3>
        <form onSubmit={addItem} className="flex gap-3 mb-10 bg-slate-50 p-4 rounded-3xl border">
           <input placeholder="手動新增清單項目..." value={newItem} onChange={e => setNewItem(e.target.value)} className="flex-1 p-3 bg-white border rounded-2xl outline-none font-bold" />
           <button type="submit" className="bg-slate-900 text-white px-8 rounded-2xl font-black active:scale-95">新增</button>
        </form>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
           {list.map(item => (
             <div key={item.id} onClick={() => toggle(item.id)} className={`flex items-center justify-between p-5 rounded-2xl border cursor-pointer transition-all ${item.done ? 'bg-slate-50 opacity-50' : 'bg-white hover:border-green-500 hover:shadow-md'}`}>
                <div className="flex items-center gap-4">
                  {item.done ? <CheckCircle className="text-green-500" /> : <Circle className="text-slate-200" />}
                  <span className={`font-bold ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                </div>
                <button onClick={(e) => {
                   e.stopPropagation();
                   updateItinField('checklist', list.filter(i => i.id !== item.id));
                }} className="text-slate-200 hover:text-red-500 p-2"><Trash2 size={16}/></button>
             </div>
           ))}
        </div>
      </div>
    );
  };

  const CurrencyView = () => {
    const [amount, setAmount] = useState('1000');
    const info = itineraryData.currencyInfo;

    const fetchRate = async () => {
      const prompt = `利用 Google 搜尋查出目前「台幣 TWD」兌換「${tripInfo.country} 當地主要貨幣」的匯率。
      必須輸出 JSON 格式且僅含以下欄位：{"rate": 數值, "currencyName": "貨幣名稱", "tips": "換匯建議"}。`;
      const res = await callGemini(prompt, true);
      if (res) {
        try {
          const data = JSON.parse(res);
          await updateItinField('currencyInfo', data);
        } catch (e) { console.error("JSON parse error", e); }
      }
    };

    const calculatedValue = info ? (parseFloat(amount) * parseFloat(info.rate)).toFixed(2) : 0;

    return (
      <div className="bg-white p-12 rounded-[4rem] shadow-sm border text-center animate-in fade-in duration-500 max-w-4xl mx-auto">
        <h3 className="text-2xl font-black mb-10 flex items-center justify-center gap-2"><Coins className="text-yellow-600"/> 匯率即時查詢</h3>
        
        {info ? (
          <div className="space-y-8 animate-in zoom-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-2xl mx-auto">
               <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 mb-2 tracking-widest">輸入台幣 TWD</p>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-transparent text-5xl font-black w-full text-center outline-none text-slate-800" />
               </div>
               <div className="p-8 bg-blue-600 text-white rounded-[3rem] shadow-2xl shadow-blue-200 flex flex-col items-center justify-center">
                  <p className="text-[10px] font-black opacity-60 mb-2 tracking-widest">估算 {info.currencyName}</p>
                  <div className="text-5xl font-black truncate w-full">{Number(calculatedValue).toLocaleString()}</div>
                  <p className="text-[10px] mt-4 opacity-80 font-black bg-white/20 px-4 py-1 rounded-full">1 TWD = {info.rate} {info.currencyName}</p>
               </div>
            </div>
            <div className="bg-slate-50 p-8 rounded-[3rem] border text-left italic text-sm text-slate-500 font-bold leading-relaxed shadow-inner">
               <Sparkles size={16} className="text-blue-500 mb-2"/>
               {info.tips}
            </div>
            <button onClick={fetchRate} className="text-slate-300 text-xs font-bold underline hover:text-blue-600 transition-all">重新獲取匯率資料</button>
          </div>
        ) : (
          <div className="py-10">
            <Coins className="text-blue-100 mx-auto mb-6" size={100} />
            <p className="text-slate-400 font-bold mb-8 uppercase tracking-widest">獲取 {tripInfo.country} 貨幣資訊中...</p>
            <button onClick={fetchRate} disabled={aiLoading} className="bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black shadow-xl flex items-center gap-3 mx-auto hover:scale-105 active:scale-95 transition-all">
              {aiLoading ? <Loader2 className="animate-spin" size={24}/> : <Coins size={24}/>} 查詢即時匯率
            </button>
          </div>
        )}
      </div>
    );
  };

  // --- 主視圖邏輯 ---

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
         <Loader2 className="animate-spin text-blue-600" size={48} />
         <p className="text-slate-500 font-bold tracking-widest italic">安全連線建立中...</p>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-in fade-in duration-700">
        <div className="text-center mb-16">
          <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0">
            <Plane size={48} />
          </div>
          <h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase">Travel Planner</h1>
          <p className="text-slate-400 font-bold tracking-widest uppercase text-sm italic">智能導覽，讓旅行從此簡單</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-start">
          <div className="space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Plus className="text-blue-600" /> 建立新旅程</h3>
            <form onSubmit={handleCreate} className="bg-white p-10 rounded-[3rem] shadow-xl space-y-8 border border-white">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">國家</label>
                  <input required placeholder="目的地國家" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">城市</label>
                  <input required placeholder="目的地城市" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">出發日期</label>
                  <input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">天數</label>
                  <input required type="number" min="1" max="14" placeholder="天數" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} />
                </div>
              </div>
              <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="animate-spin" size={24}/> : <><Plus size={24}/> 開始旅程</>}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600" /> 我的旅程清單 ({trips.length})</h3>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
              {trips.map((trip) => (
                <div key={trip.id} onClick={() => setTripId(trip.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Globe size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-800 tracking-tight">{trip.city} 之旅</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{trip.country} · {trip.startDate}</p>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-200 group-hover:text-blue-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center pb-24">
      <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-50">
        <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
          <div className="p-2 bg-blue-600 text-white rounded-2xl group-hover:rotate-12 transition-transform shadow-lg">
            <Plane size={24} className="rotate-45" />
          </div>
          <span className="tracking-tighter uppercase font-black">Traveler</span>
        </div>
        
        <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl gap-1">
          {[
            { id: 'itinerary', icon: Calendar, label: '旅程行程' },
            { id: 'flight', icon: PlaneTakeoff, label: '航班管理' },
            { id: 'weather', icon: Sun, label: '當天天氣' },
            { id: 'checklist', icon: ListChecks, label: '準備清單' },
            { id: 'currency', icon: Coins, label: '匯率換算' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="text-right">
          <div className="font-black text-slate-800 text-xl leading-none">{tripInfo.city}</div>
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 inline-block bg-slate-50 px-2 py-0.5 rounded-full">{tripInfo.startDate}</div>
        </div>
      </nav>

      <div className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] p-3 flex justify-around items-center z-[100] shadow-2xl">
         {[
           { id: 'itinerary', icon: Calendar },
           { id: 'flight', icon: PlaneTakeoff },
           { id: 'weather', icon: Sun },
           { id: 'checklist', icon: ListChecks },
           { id: 'currency', icon: Coins }
         ].map(tab => (
           <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`p-4 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}>
             <tab.icon size={20} />
           </button>
         ))}
      </div>
      
      <main className="w-full p-6 md:p-12">
        {activeTab === 'itinerary' && <ItineraryView />}
        {activeTab === 'flight' && <FlightView />}
        {activeTab === 'weather' && <WeatherView />}
        {activeTab === 'checklist' && <ChecklistView />}
        {activeTab === 'currency' && <CurrencyView />}
      </main>
    </div>
  );
};

const Circle = ({ className }) => (
  <div className={`w-6 h-6 border-2 rounded-lg ${className}`}></div>
);

export default App;
