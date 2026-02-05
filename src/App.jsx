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
  Cloud, Sun, PlaneTakeoff, ArrowUp, ArrowDown, Edit3, Save, MapPin, CheckSquare, Coins, ListChecks, Search, ExternalLink, Circle
} from 'lucide-react';

/**
 * 🚀 全功能整合修復版 (2026.02.05):
 * 1. 修復編譯錯誤：移除 import.meta，改用相容語法讀取金鑰。
 * 2. 行程編修：支援景點原位編輯與靈敏排序。
 * 3. AI 增強：整合 Google 搜尋功能，解決天氣與匯率失效問題。
 */

const VERSION_INFO = "最後更新：2026/02/05 09:15 (金鑰更新與編修功能版)";

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
const appId = typeof __app_id !== 'undefined' ? __app_id.replace(/\//g, '_') : 'travel-yeh';

/**
 * 🔑 API 金鑰配置
 * 已更換為您提供的最新金鑰。
 */
const apiKey = "AIzaSyC1cfkL05eH5JQm1wEGBs7BWHyuZy7l-bU"; 

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
  const [aiStatus, setAiStatus] = useState({ type: '', message: '' });

  // 🛠 樣式修復注入
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn'; script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
    const style = document.createElement('style');
    style.innerHTML = `
      html, body, #root { min-height: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background-color: #f8fafc; font-family: sans-serif; }
      #root { display: flex !important; flex-direction: column !important; align-items: center !important; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
    `;
    document.head.appendChild(style);
  }, []);

  const fetchWithRetry = async (url, options, retries = 5, delay = 1000) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      if (retries > 0 && !err.message.includes("403") && !err.message.includes("401")) {
        await new Promise(r => setTimeout(r, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw err;
    }
  };

  const cleanJsonResponse = (text) => {
    if (!text) return null;
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
  };

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
        days, checklist: DEFAULT_CHECKLIST, flightsInfo: { departDate: tripInfo.startDate, returnDate: '', flights: [] }
      });
      setTripId(newId);
      setActiveTab('itinerary');
    } finally { setIsLoading(false); }
  };

  const callGemini = async (userQuery, isJson = false) => {
    if (!apiKey) { setAiStatus({ type: 'error', message: '尚未填入 API Key' }); return null; }
    setAiLoading(true);
    setAiStatus({ type: 'loading', message: '正在呼叫 Google 搜尋獲取最新數據...' });
    
    try {
      const systemPrompt = isJson 
        ? "You are a precise travel data analyst. Your output MUST be valid JSON only."
        : "You are a travel assistant.";
      const payload = { 
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ "google_search": {} }],
        generationConfig: isJson ? { responseMimeType: "application/json" } : {}
      };
      const result = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      let text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      setAiStatus({ type: 'success', message: '查詢成功！' });
      setTimeout(() => setAiStatus({ type: '', message: '' }), 3000);
      return isJson ? cleanJsonResponse(text) : text;
    } catch (e) {
      console.error("AI 失敗:", e);
      setAiStatus({ type: 'error', message: `查詢失敗: ${e.message}` });
      return null;
    } finally { setAiLoading(false); }
  };

  // --- 子組件 ---

  const ItineraryView = () => {
    const [newSpot, setNewSpot] = useState({ time: '09:00', spot: '', note: '' });
    const [editingSpotId, setEditingSpotId] = useState(null);
    const [editData, setEditData] = useState({});
    const currentDay = itineraryData.days[activeDay] || { spots: [] };

    const addSpot = async (e) => {
      e.preventDefault();
      const updated = [...(currentDay.spots || []), { ...newSpot, id: Date.now().toString() }];
      await updateItinField(`days.${activeDay}.spots`, updated);
      setNewSpot({ time: '09:00', spot: '', note: '' });
    };

    const startEdit = (item) => { setEditingSpotId(item.id); setEditData({ ...item }); };
    const saveEdit = async () => {
      const updated = currentDay.spots.map(s => s.id === editingSpotId ? editData : s);
      await updateItinField(`days.${activeDay}.spots`, updated);
      setEditingSpotId(null);
    };

    const moveSpot = async (idx, dir) => {
      const spots = [...(currentDay.spots || [])];
      const target = idx + dir;
      if (target < 0 || target >= spots.length) return;
      [spots[idx], spots[target]] = [spots[target], spots[idx]];
      await updateItinField(`days.${activeDay}.spots`, spots);
    };

    return (
      <div className="animate-fade-in max-w-4xl mx-auto w-full">
        <div className="flex gap-3 overflow-x-auto pb-6 mb-8 scrollbar-hide">
          {Object.keys(itineraryData.days).map(day => (
            <button key={day} onClick={() => {setActiveDay(parseInt(day)); setEditingSpotId(null);}} className={`shrink-0 px-8 py-4 rounded-2xl font-black transition-all border ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-xl scale-105 border-blue-600' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>
              D{day} · {getFormattedDate(tripInfo.startDate, parseInt(day)).split('/').slice(1).join('/')}
            </button>
          ))}
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-end mb-10">
            <div>
               <h2 className="text-5xl font-black text-slate-900 italic tracking-tighter leading-none">Day {activeDay}</h2>
               <p className="text-slate-400 font-bold uppercase text-[10px] mt-2 tracking-widest">{getFormattedDate(tripInfo.startDate, activeDay)}</p>
            </div>
            <div className="w-16 h-1.5 bg-blue-600 rounded-full mb-2"></div>
          </div>

          <form onSubmit={addSpot} className="mb-10 space-y-3 bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="flex gap-3 flex-wrap md:flex-nowrap">
               <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full md:w-auto shadow-sm">
                 <Clock size={18} className="text-blue-500" />
                 <input type="time" value={newSpot.time} onChange={e => setNewSpot({...newSpot, time: e.target.value})} className="bg-transparent font-black outline-none w-24" />
               </div>
               <input placeholder="今天想到哪裡？" required value={newSpot.spot} onChange={e => setNewSpot({...newSpot, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-bold outline-none shadow-sm" />
            </div>
            <div className="flex gap-3">
               <textarea placeholder="詳細備註..." value={newSpot.note} onChange={e => setNewSpot({...newSpot, note: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-medium outline-none h-20 resize-none text-sm shadow-sm" />
               <button type="submit" className="bg-slate-900 text-white px-8 rounded-xl font-black flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"><Plus size={24}/><span className="text-[10px]">加入</span></button>
            </div>
          </form>

          <div className="space-y-8 relative before:content-[''] before:absolute before:left-[27px] before:top-4 before:bottom-4 before:w-1 before:bg-slate-50">
            {currentDay.spots?.map((item, idx) => (
              <div key={item.id} className="relative pl-16 group">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
                  <button onClick={() => moveSpot(idx, -1)} disabled={idx === 0} className="text-slate-200 hover:text-blue-600 transition-all disabled:opacity-0 active:scale-125"><ArrowUp size={20}/></button>
                  <div className="w-14 h-14 bg-white border-4 border-slate-50 rounded-2xl flex items-center justify-center text-[10px] font-black text-blue-600 shadow-md group-hover:scale-110 transition-transform">{item.time}</div>
                  <button onClick={() => moveSpot(idx, 1)} disabled={idx === currentDay.spots.length - 1} className="text-slate-200 hover:text-blue-600 transition-all disabled:opacity-0 active:scale-125"><ArrowDown size={20}/></button>
                </div>
                
                <div className={`p-8 bg-white border rounded-[2.5rem] flex justify-between items-start transition-all shadow-sm ${editingSpotId === item.id ? 'border-blue-500 ring-8 ring-blue-50/50' : 'border-slate-100 hover:shadow-xl border-l-8 border-l-transparent hover:border-l-blue-600'}`}>
                  {editingSpotId === item.id ? (
                    <div className="space-y-4 flex-1 animate-fade-in">
                       <div className="flex gap-2">
                          <input type="time" value={editData.time} onChange={e => setEditData({...editData, time: e.target.value})} className="p-3 border rounded-xl font-black text-sm w-32 bg-slate-50 outline-none" />
                          <input value={editData.spot} onChange={e => setEditData({...editData, spot: e.target.value})} className="flex-1 p-3 border rounded-xl font-black text-sm bg-slate-50 outline-none" />
                       </div>
                       <textarea value={editData.note} onChange={e => setEditData({...editData, note: e.target.value})} className="w-full p-3 border rounded-xl text-sm h-24 resize-none bg-slate-50 outline-none" />
                       <div className="flex justify-end gap-3">
                          <button onClick={() => setEditingSpotId(null)} className="text-sm font-bold text-slate-400 px-4">取消</button>
                          <button onClick={saveEdit} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-black flex items-center gap-2"><Save size={16}/> 儲存</button>
                       </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                           <h4 className="text-2xl font-black text-slate-800 tracking-tight">{item.spot}</h4>
                           <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black flex items-center gap-1 hover:bg-blue-600 hover:text-white transition-all shadow-sm"><MapPin size={12}/> 地圖</a>
                        </div>
                        <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                           <p className="text-slate-500 text-sm italic whitespace-pre-wrap leading-relaxed">{item.note || "點擊編輯圖示進行修改..."}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all ml-4">
                        <button onClick={() => startEdit(item)} className="p-3 text-slate-300 hover:text-blue-500 bg-slate-50 rounded-2xl shadow-sm"><Edit3 size={18}/></button>
                        <button onClick={async () => {
                          await updateItinField(`days.${activeDay}.spots`, currentDay.spots.filter(s => s.id !== item.id));
                        }} className="p-3 text-slate-300 hover:text-red-500 bg-slate-50 rounded-2xl shadow-sm"><Trash2 size={18}/></button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const FlightView = () => {
    const fInfo = itineraryData.flightsInfo || { departDate: '', returnDate: '', flights: [] };
    const [newF, setNewF] = useState({ flightNo: '', time: '08:00', type: '去程' });
    const addFlight = async (e) => { e.preventDefault(); await updateItinField(`flightsInfo.flights`, [...(fInfo.flights || []), { ...newF, id: Date.now().toString() }]); setNewF({ flightNo: '', time: '08:00', type: '去程' }); };
    const getFlightAi = async (id, flightNo) => { const info = await callGemini(`查航班「${flightNo}」目前的航空公司、起訖城市與航程。`); if (info) { await updateItinField(`flightsInfo.flights`, fInfo.flights.map(f => f.id === id ? { ...f, aiInfo: info } : f)); } };

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in w-full">
        <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black flex items-center gap-2"><Plane className="text-blue-600"/> 航班管理</h3>
            <a href="https://www.google.com/travel/flights?hl=zh-TW" target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
              <Globe size={14}/> Google Flights
            </a>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">去程日期</label><input type="date" value={fInfo.departDate} onChange={e => updateItinField('flightsInfo.departDate', e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">回程日期</label><input type="date" value={fInfo.returnDate} onChange={e => updateItinField('flightsInfo.returnDate', e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold" /></div>
          </div>
          <div className="space-y-4 mb-10">
            {fInfo.flights?.map(f => (
              <div key={f.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center group relative overflow-hidden transition-all">
                <div className="flex items-center gap-4 relative z-10"><div className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-100"><PlaneTakeoff size={20}/></div><div><div className="flex items-center gap-3"><span className="text-xl font-black text-slate-800">{f.flightNo}</span><span className="bg-white px-2 py-0.5 rounded-full text-[9px] font-black border border-slate-200 text-slate-400 uppercase">{f.type}</span></div><p className="text-xs text-slate-400 font-bold mt-1">{f.time}</p>{f.aiInfo && <p className="text-[11px] text-slate-500 italic mt-2 bg-white/80 p-3 rounded-xl border border-white leading-relaxed">{f.aiInfo}</p>}</div></div>
                <div className="flex gap-2 relative z-10 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => getFlightAi(f.id, f.flightNo)} className="p-2.5 text-blue-500 hover:bg-blue-100 bg-white rounded-xl shadow-sm"><Sparkles size={18}/></button><button onClick={async () => { await updateItinField(`flightsInfo.flights`, fInfo.flights.filter(fl => fl.id !== f.id)); }} className="p-2.5 text-slate-300 hover:text-red-500 bg-white rounded-xl shadow-sm"><Trash2 size={18}/></button></div>
              </div>
            ))}
          </div>
          <form onSubmit={addFlight} className="flex gap-3 bg-slate-900 p-5 rounded-[2.5rem] shadow-xl"><input required placeholder="航班號 (如: BR198)" value={newF.flightNo} onChange={e => setNewF({...newF, flightNo: e.target.value.toUpperCase()})} className="flex-1 p-3 rounded-2xl bg-white/10 text-white border-none outline-none font-black text-sm" /><input type="time" value={newF.time} onChange={e => setNewF({...newF, time: e.target.value})} className="p-3 rounded-2xl bg-white/10 text-white border-none outline-none font-black text-sm w-32" /><button type="submit" className="bg-blue-600 text-white px-8 rounded-2xl font-black hover:bg-blue-500 active:scale-95 transition-all">新增</button></form>
        </div>
      </div>
    );
  };

  const WeatherView = () => {
    const currentWeather = itineraryData.days[activeDay]?.weather;
    const fetchWeather = async () => {
      const prompt = `利用 Google 搜尋查出「${tripInfo.city}」在「${getFormattedDate(tripInfo.startDate, activeDay)}」的天氣。輸出 JSON：{"temp": "氣溫", "condition": "狀態", "tips": "建議"}`;
      const res = await callGemini(prompt, true); if (res) { try { await updateItinField(`days.${activeDay}.weather`, JSON.parse(res)); } catch (e) {} }
    };

    return (
      <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100 text-center animate-fade-in relative overflow-hidden max-w-4xl mx-auto w-full">
        <div className="absolute top-0 right-0 p-10 text-blue-50/50 -z-10"><Cloud size={180}/></div>
        <h3 className="text-2xl font-black mb-10 flex items-center justify-center gap-2"><Sun className="text-yellow-500"/> 當日即時天氣預測</h3>
        {currentWeather ? (
          <div className="space-y-6"><div className="text-8xl font-black text-slate-900 tracking-tighter leading-none">{currentWeather.temp}</div><div className="text-2xl font-black text-blue-600">{currentWeather.condition}</div><div className="bg-blue-50 p-8 rounded-[3rem] border border-blue-100 max-w-md mx-auto shadow-sm shadow-blue-50"><p className="text-blue-700 font-bold text-sm leading-relaxed">{currentWeather.tips}</p></div><button onClick={fetchWeather} className="text-slate-300 text-xs font-bold underline mt-8 hover:text-blue-600">重新獲取天氣</button></div>
        ) : (
          <div className="py-10"><Sparkles className="text-blue-50 mx-auto mb-6" size={80}/><p className="text-slate-400 font-bold mb-8 uppercase tracking-widest text-xs text-center italic">{tripInfo.city} · {getFormattedDate(tripInfo.startDate, activeDay)}</p><button onClick={fetchWeather} disabled={aiLoading} className="bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black shadow-xl flex items-center gap-3 mx-auto hover:scale-105 active:scale-95 transition-all">{aiLoading ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>} 獲取 Google 天氣資訊</button></div>
        )}
      </div>
    );
  };

  const ChecklistView = () => {
    const list = itineraryData.checklist || DEFAULT_CHECKLIST;
    const [newItem, setNewItem] = useState('');
    const toggle = async (id) => { await updateItinField('checklist', list.map(item => item.id === id ? { ...item, done: !item.done } : item)); };

    return (
      <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 animate-fade-in max-w-4xl mx-auto w-full">
        <h3 className="text-2xl font-black mb-8 flex items-center gap-2"><ListChecks className="text-green-500"/> 行前準備清單</h3>
        <form onSubmit={async (e) => { e.preventDefault(); if(!newItem) return; await updateItinField('checklist', [...list, { id: Date.now().toString(), text: newItem, done: false }]); setNewItem(''); }} className="flex gap-3 mb-10 bg-slate-50 p-4 rounded-3xl border border-slate-100"><input placeholder="新增個人必備項目..." value={newItem} onChange={e => setNewItem(e.target.value)} className="flex-1 p-3 bg-white border border-slate-200 rounded-2xl outline-none font-bold" /><button type="submit" className="bg-slate-900 text-white px-8 rounded-2xl font-black active:scale-95">新增</button></form>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {list.map(item => (
             <div key={item.id} onClick={() => toggle(item.id)} className={`flex items-center justify-between p-5 rounded-2xl border cursor-pointer transition-all ${item.done ? 'bg-slate-50 opacity-50' : 'bg-white hover:border-green-500 hover:shadow-md'}`}><div className="flex items-center gap-4">{item.done ? <CheckCircle className="text-green-500" /> : <div className="w-6 h-6 border-2 border-slate-200 rounded-lg" />}<span className={`font-bold ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span></div><button onClick={(e) => { e.stopPropagation(); updateItinField('checklist', list.filter(i => i.id !== item.id)); }} className="text-slate-200 hover:text-red-500 p-2 transition-all"><Trash2 size={16}/></button></div>
           ))}
        </div>
      </div>
    );
  };

  const CurrencyView = () => {
    const info = itineraryData.currencyInfo;
    const [amount, setAmount] = useState('1000');
    const fetchRate = async () => {
      const prompt = `利用 Google 搜尋查出台幣 TWD 兌換「${tripInfo.country}」當地貨幣匯率。輸出純 JSON：{"rate": 匯率, "currencyName": "名稱", "tips": "建議"}`;
      const res = await callGemini(prompt, true); if (res) { try { await updateItinField('currencyInfo', JSON.parse(res)); } catch (e) {} }
    };

    return (
      <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100 text-center animate-fade-in max-w-4xl mx-auto w-full">
        <h3 className="text-2xl font-black mb-10 flex items-center justify-center gap-2"><Coins className="text-yellow-600"/> 匯率換算助理</h3>
        {info ? (
          <div className="space-y-8"><div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-2xl mx-auto"><div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 shadow-inner"><p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest text-center italic">TWD 台幣</p><input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-transparent text-5xl font-black w-full text-center outline-none text-slate-800" /></div><div className="p-8 bg-blue-600 text-white rounded-[3rem] shadow-2xl flex flex-col items-center justify-center animate-fade-in"><p className="text-[10px] font-black opacity-60 mb-2 tracking-widest uppercase text-center italic">{info.currencyName}</p><div className="text-5xl font-black truncate w-full">{Number(parseFloat(amount) * parseFloat(info.rate)).toLocaleString(undefined, {maximumFractionDigits: 2})}</div><p className="text-[10px] mt-4 opacity-80 font-black bg-white/20 px-4 py-1 rounded-full text-center tracking-wider">Rate: 1 TWD = {info.rate}</p></div></div><div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 text-left italic text-sm text-slate-500 font-bold leading-relaxed shadow-sm"><Sparkles size={16} className="text-blue-500 mb-2 inline mr-2"/> {info.tips}</div><button onClick={fetchRate} className="text-slate-300 text-xs font-bold underline hover:text-blue-600">重新獲取匯率</button></div>
        ) : (
          <div className="py-10"><Coins className="text-blue-50 mx-auto mb-6" size={100} /><p className="text-slate-400 font-bold mb-8 uppercase tracking-widest text-xs text-center italic">正在連線 Google 搜尋匯率...</p><button onClick={fetchRate} disabled={aiLoading} className="bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black shadow-xl flex items-center gap-3 mx-auto hover:scale-105 active:scale-95 transition-all">{aiLoading ? <Loader2 className="animate-spin" size={24}/> : <Coins size={24}/>} 查詢即時匯率</button></div>
        )}
      </div>
    );
  };

  // --- 基礎架構 ---

  if (!user) { return ( <div className="flex flex-col items-center justify-center h-screen space-y-4"> <Loader2 className="animate-spin text-blue-600" size={48} /> <p className="text-slate-500 font-bold tracking-widest italic text-center px-6">建立安全同步環境中...</p> </div> ); }

  if (view === 'home') {
    return (
      <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-fade-in">
        <div className="text-center mb-16"><div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0"><Plane size={48} /></div><h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase leading-none">Travel Planner</h1><p className="text-slate-400 font-bold tracking-widest uppercase text-sm italic">整合 AI 與 Google 搜尋的旅遊管家</p></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-start">
          <div className="space-y-6"><h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Plus className="text-blue-600" /> 建立新旅程</h3><form onSubmit={handleCreate} className="bg-white p-10 rounded-[3rem] shadow-xl space-y-8 border border-slate-100"><div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">國家</label><input required placeholder="如: 日本" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">城市</label><input required placeholder="如: 東京" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} /></div></div><div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">出發日期</label><input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">天數</label><input required type="number" min="1" max="14" placeholder="天數" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} /></div></div><button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2">{isLoading ? <Loader2 className="animate-spin" size={24}/> : <><Plus size={24}/> 開始規劃</>}</button></form></div>
          <div className="space-y-6"><h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600" /> 我的旅程清單 ({trips.length})</h3><div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">{trips.map((trip) => ( <div key={trip.id} onClick={() => setTripId(trip.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between animate-fade-in"><div className="flex items-center gap-5"><div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Globe size={24} /></div><div><h4 className="text-xl font-black text-slate-800 tracking-tight leading-tight">{trip.city} 之旅</h4><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{trip.country} · {trip.startDate}</p></div></div><ChevronRight className="text-slate-200 group-hover:text-blue-600 transition-colors" /></div> ))}</div></div>
        </div>
        <div className="mt-12 text-slate-300 text-[10px] font-bold uppercase tracking-widest">{VERSION_INFO}</div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      {aiStatus.message && ( <div className={`fixed top-4 z-[200] px-6 py-3 rounded-2xl shadow-2xl animate-fade-in flex items-center gap-3 border ${aiStatus.type === 'error' ? 'bg-red-50 border-red-100 text-red-600' : aiStatus.type === 'success' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-white border-blue-100 text-blue-600'}`}> {aiStatus.type === 'loading' ? <Loader2 className="animate-spin" size={18}/> : aiStatus.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle size={18}/>} <span className="font-bold text-sm tracking-tight">{aiStatus.message}</span> <button onClick={() => setAiStatus({ type: '', message: '' })} className="hover:scale-125 transition-transform"><X size={14}/></button> </div> )}
      <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-50"><div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}><div className="p-2 bg-blue-600 text-white rounded-2xl group-hover:rotate-12 transition-transform shadow-lg shadow-blue-100"><Plane size={24} className="rotate-45" /></div><span className="tracking-tighter uppercase font-black">Traveler</span></div><div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl gap-1">{[{ id: 'itinerary', icon: Calendar, label: '行程' },{ id: 'flight', icon: PlaneTakeoff, label: '航班' },{ id: 'weather', icon: Sun, label: '天氣' },{ id: 'checklist', icon: ListChecks, label: '清單' },{ id: 'currency', icon: Coins, label: '匯率' }].map(tab => ( <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm shadow-blue-50' : 'text-slate-400 hover:text-slate-600'}`}> <tab.icon size={14} /> {tab.label} </button> ))}</div><div className="text-right"><div className="font-black text-slate-800 text-xl leading-none">{tripInfo.city}</div><div className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 inline-block bg-slate-50 px-2 py-0.5 rounded-full">{tripInfo.startDate}</div></div></nav>
      <div className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] p-3 flex justify-around items-center z-[100] shadow-2xl">{[{ id: 'itinerary', icon: Calendar },{ id: 'flight', icon: PlaneTakeoff },{ id: 'weather', icon: Sun },{ id: 'checklist', icon: ListChecks },{ id: 'currency', icon: Coins }].map(tab => ( <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`p-4 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}> <tab.icon size={20} /> </button> ))}</div>
      <main className="w-full p-6 md:p-12 animate-fade-in">{activeTab === 'itinerary' && <ItineraryView />}{activeTab === 'flight' && <FlightView />}{activeTab === 'weather' && <WeatherView />}{activeTab === 'checklist' && <ChecklistView />}{activeTab === 'currency' && <CurrencyView />}</main>
    </div>
  );
};

export default App;
