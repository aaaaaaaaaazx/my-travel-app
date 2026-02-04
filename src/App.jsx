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
  Cloud, Sun, PlaneTakeoff, ArrowUp, ArrowDown, ExternalLink, Edit3, Save, MapPin
} from 'lucide-react';

/**
 * 🚀 功能全面升級版：
 * 1. 結構化景點：支援「主項目」與「詳細說明」。
 * 2. 內建編輯：支援卡片點擊即時編輯。
 * 3. 地圖對接：自動產生 Google Maps 搜尋連結。
 * 4. 排序與置頂：維持航班置頂與手動排序功能。
 */

const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try { return JSON.parse(__firebase_config); } catch (e) { console.error("Canvas Config 解析失敗", e); }
  }
  try {
    const envConfig = import.meta.env.VITE_FIREBASE_CONFIG;
    if (envConfig) return JSON.parse(envConfig);
  } catch (e) {}
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

const apiKey = ""; // Gemini API Key

const App = () => {
  const [view, setView] = useState('home');
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [tripInfo, setTripInfo] = useState({ country: '', city: '', startDate: '', duration: 3 });
  const [itinerary, setItinerary] = useState({});
  const [newEntry, setNewEntry] = useState({ time: '09:00', spot: '', note: '' });
  const [newFlight, setNewFlight] = useState({ flightNo: '', time: '08:00', type: '起飛' });
  const [editingId, setEditingId] = useState(null);
  const [tempEditData, setTempEditData] = useState({});

  // 🛠 樣式重設與注入
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
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

  // 1. 身份驗證
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

  // 2. 監聽清單
  useEffect(() => {
    if (!user || !db) return;
    const tripsRef = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    return onSnapshot(tripsRef, (snapshot) => {
      const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(tripList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });
  }, [user]);

  // 3. 監聽行程
  useEffect(() => {
    if (!user || !tripId || !db) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        setItinerary(docSnap.data().days || {});
        setView('editor');
      }
    });
    const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(tripRef, (docSnap) => {
      if (docSnap.exists()) setTripInfo(docSnap.data());
    });
    return () => { unsubItin(); unsubTrip(); };
  }, [user, tripId]);

  const getFormattedDate = (baseDate, dayOffset) => {
    if (!baseDate) return "";
    const date = new Date(baseDate);
    date.setDate(date.getDate() + (dayOffset - 1));
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user || !db) return;
    setIsLoading(true);
    const newId = crypto.randomUUID();
    const days = {};
    for (let i = 1; i <= Math.max(1, parseInt(tripInfo.duration)); i++) {
        days[i] = { spots: [], flights: [], weather: null };
    }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', newId), {
        ...tripInfo, creator: user.uid, createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', newId), { days });
      setTripId(newId);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  const addEntry = async (e) => {
    e.preventDefault();
    if (!user || !tripId || !db) return;
    const entry = { ...newEntry, id: Date.now().toString() };
    const dayData = itinerary[activeDay] || { spots: [], flights: [], weather: null };
    const updatedSpots = [...(dayData.spots || []), entry];
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
      [`days.${activeDay}.spots`]: updatedSpots
    });
    setNewEntry({ time: '09:00', spot: '', note: '' });
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setTempEditData({ ...item });
  };

  const saveEdit = async () => {
    if (!user || !tripId || !db) return;
    const dayData = itinerary[activeDay];
    const updatedSpots = dayData.spots.map(s => s.id === editingId ? tempEditData : s);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
      [`days.${activeDay}.spots`]: updatedSpots
    });
    setEditingId(null);
  };

  const moveEntry = async (index, direction) => {
    if (!user || !tripId || !db) return;
    const dayData = itinerary[activeDay];
    const spots = [...(dayData.spots || [])];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= spots.length) return;
    [spots[index], spots[targetIndex]] = [spots[targetIndex], spots[index]];
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
      [`days.${activeDay}.spots`]: spots
    });
  };

  const addFlight = async (e) => {
    e.preventDefault();
    if (!user || !tripId || !db) return;
    const flight = { ...newFlight, id: Date.now().toString() };
    const dayData = itinerary[activeDay] || { spots: [], flights: [], weather: null };
    const updatedFlights = [...(dayData.flights || []), flight];
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
      [`days.${activeDay}.flights`]: updatedFlights
    });
    setNewFlight({ flightNo: '', time: '08:00', type: '起飛' });
  };

  const getAiWeather = async () => {
    if (!user || !apiKey || isAiLoading) return;
    setIsAiLoading(true);
    const dateStr = getFormattedDate(tripInfo.startDate, activeDay);
    const prompt = `提供 ${tripInfo.city} 在 ${dateStr} 的天氣預測 JSON: {"temp": "氣溫", "condition": "狀態", "tips": "建議"}`;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
      });
      const result = await response.json();
      const weatherData = JSON.parse(result.candidates[0].content.parts[0].text);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
        [`days.${activeDay}.weather`]: weatherData
      });
    } catch (err) { console.error(err); } finally { setIsAiLoading(false); }
  };

  const deleteEntry = async (entryId, type = 'spots') => {
    if (!user || !tripId || !db) return;
    const list = itinerary[activeDay][type] || [];
    const updated = list.filter(item => item.id !== entryId);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
      [`days.${activeDay}.${type}`]: updated
    });
  };

  return (
    <div className="w-full flex flex-col items-center min-h-screen font-sans">
      {!user ? (
        <div className="flex flex-col items-center justify-center h-screen space-y-4">
           <Loader2 className="animate-spin text-blue-600" size={48} />
           <p className="text-slate-500 font-bold tracking-widest">安全連線中...</p>
        </div>
      ) : view === 'home' ? (
        <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-in fade-in duration-700">
          <div className="text-center mb-16">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0">
              <Plane size={48} />
            </div>
            <h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase">Travel Planner</h1>
            <p className="text-slate-400 font-bold tracking-widest uppercase text-sm italic">隨心所欲規劃您的完美旅程</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-start">
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Plus className="text-blue-600" /> 建立新旅程
              </h3>
              <form onSubmit={handleCreate} className="bg-white p-10 rounded-[3rem] shadow-xl space-y-8 border border-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">國家</label>
                    <input required placeholder="目的地" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">城市</label>
                    <input required placeholder="城市" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} />
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
                <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl transition-all active:scale-95">
                  {isLoading ? <Loader2 className="animate-spin mx-auto" /> : <><Plus size={24}/> 開始旅程</>}
                </button>
              </form>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Calendar className="text-blue-600" /> 我的旅程清單 ({trips.length})
              </h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                {trips.map((trip) => (
                  <div key={trip.id} onClick={() => setTripId(trip.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Globe size={24} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-800 tracking-tight">{trip.city} 之旅</h4>
                        <p className="text-[10px] font-bold text-slate-400">{trip.country} · {trip.startDate}</p>
                      </div>
                    </div>
                    <ChevronRight className="text-slate-200 group-hover:text-blue-600" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center pb-24">
          <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-50">
            <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
              <div className="p-2 bg-blue-600 text-white rounded-2xl group-hover:rotate-12 transition-transform shadow-lg">
                <Plane size={24} className="rotate-45" />
              </div>
              <span className="tracking-tighter uppercase font-black">Traveler</span>
            </div>
            <div className="text-right">
              <div className="font-black text-slate-800 text-xl leading-none">{tripInfo.city} 之旅</div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2 inline-block bg-slate-50 px-3 py-1 rounded-full">{tripInfo.startDate} 出發</div>
            </div>
          </nav>
          
          <main className="w-full max-w-5xl p-6 md:p-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex gap-3 overflow-x-auto pb-8 mb-4 scrollbar-hide">
              {Object.keys(itinerary).map(day => (
                <button key={day} onClick={() => setActiveDay(parseInt(day))} className={`shrink-0 px-10 py-5 rounded-[2rem] font-black transition-all border flex flex-col items-center ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-xl scale-105 border-blue-600' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>
                  <span className="text-xs opacity-60 mb-1">D{day}</span>
                  <span className="text-sm">{getFormattedDate(tripInfo.startDate, parseInt(day)).split('/').slice(1).join('/')}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* 航班資訊卡 (置頂) */}
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 text-slate-50 transition-transform group-hover:scale-110"><PlaneTakeoff size={80} /></div>
                <div className="relative z-10">
                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em] mb-4">當日航班資訊</h4>
                    <div className="space-y-3">
                        {itinerary[activeDay]?.flights?.map(f => (
                            <div key={f.id} className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-2xl border">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-black uppercase">{f.type}</span>
                                    <span className="font-black text-slate-800">{f.flightNo}</span>
                                    <span className="text-xs text-slate-400 font-bold">{f.time}</span>
                                </div>
                                <button onClick={() => deleteEntry(f.id, 'flights')} className="text-slate-200 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        ))}
                        <form onSubmit={addFlight} className="flex gap-2">
                            <input required placeholder="航班" className="flex-1 bg-slate-50 border rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10" value={newFlight.flightNo} onChange={e => setNewFlight({...newFlight, flightNo: e.target.value})} />
                            <input type="time" className="bg-slate-50 border rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10" value={newFlight.time} onChange={e => setNewFlight({...newFlight, time: e.target.value})} />
                            <button type="submit" className="bg-slate-900 text-white p-2 rounded-xl hover:bg-black transition-colors"><Plus size={16}/></button>
                        </form>
                    </div>
                </div>
              </div>

              {/* 天氣預測卡 */}
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 text-blue-50 transition-transform group-hover:scale-110"><Cloud size={80} /></div>
                <div className="relative z-10">
                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em] mb-4">當日天氣預測</h4>
                    {itinerary[activeDay]?.weather ? (
                        <div className="flex items-center gap-6">
                            <div className="text-4xl font-black text-slate-900">{itinerary[activeDay].weather.temp}</div>
                            <div className="text-slate-500 font-bold text-sm">
                                <p className="text-blue-600 flex items-center gap-1"><Sun size={16}/> {itinerary[activeDay].weather.condition}</p>
                                <p className="text-xs mt-1 text-slate-400 leading-tight">{itinerary[activeDay].weather.tips}</p>
                            </div>
                        </div>
                    ) : (
                        <button onClick={getAiWeather} disabled={isAiLoading} className="bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-blue-100">
                            {isAiLoading ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 獲取 AI 天氣建議
                        </button>
                    )}
                </div>
              </div>
            </div>

            {/* 行程列表 */}
            <div className="bg-white p-10 md:p-16 rounded-[4rem] border border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.02)]">
              <div className="flex justify-between items-end mb-14">
                <div className="space-y-2">
                  <h2 className="text-6xl font-black text-slate-900 tracking-tighter italic leading-none">Day {activeDay}</h2>
                  <p className="text-slate-400 font-bold uppercase text-sm ml-1">{getFormattedDate(tripInfo.startDate, activeDay)}</p>
                </div>
                <div className="w-24 h-2 bg-blue-600 rounded-full shadow-sm mb-2"></div>
              </div>

              {/* 新增行程表單 */}
              <form onSubmit={addEntry} className="mb-14 space-y-4 bg-slate-50 p-6 rounded-[2.5rem]">
                <div className="flex gap-4 flex-wrap md:flex-nowrap">
                   <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-sm border w-full md:w-auto">
                    <Clock size={20} className="text-blue-500" />
                    <input type="time" value={newEntry.time} onChange={e => setNewEntry({...newEntry, time: e.target.value})} className="bg-transparent font-black text-slate-700 outline-none w-28 text-lg" />
                  </div>
                  <input placeholder="今天要在那裡留下回憶？" required value={newEntry.spot} onChange={e => setNewEntry({...newEntry, spot: e.target.value})} className="flex-1 p-4 bg-white border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 text-lg shadow-sm" />
                </div>
                <div className="flex gap-4">
                  <textarea placeholder="詳細說明或備註 (選填)" value={newEntry.note} onChange={e => setNewEntry({...newEntry, note: e.target.value})} className="flex-1 p-4 bg-white border border-slate-100 rounded-2xl font-medium outline-none focus:ring-4 focus:ring-blue-500/5 text-sm shadow-sm h-24 resize-none" />
                  <button type="submit" className="bg-slate-900 hover:bg-black text-white px-12 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 shrink-0 text-lg flex flex-col items-center justify-center gap-1">
                    <Plus size={24}/>
                    <span className="text-xs">加入</span>
                  </button>
                </div>
              </form>

              {/* 行程卡片清單 */}
              <div className="space-y-10 relative before:content-[''] before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-1.5 before:bg-slate-50 before:rounded-full">
                {itinerary[activeDay]?.spots?.map((item, idx) => (
                  <div key={item.id} className="relative pl-20 group">
                    {/* 左側排序控制 */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
                       <button onClick={() => moveEntry(idx, -1)} className="p-1 hover:bg-blue-50 text-slate-200 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"><ArrowUp size={16}/></button>
                       <div className="w-16 h-16 bg-white border-8 border-slate-50 rounded-[1.5rem] flex items-center justify-center text-[11px] font-black text-blue-600 shadow-md z-10 group-hover:scale-110 transition-transform">
                          {editingId === item.id ? <Edit3 size={16} className="animate-pulse" /> : item.time}
                       </div>
                       <button onClick={() => moveEntry(idx, 1)} className="p-1 hover:bg-blue-50 text-slate-200 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"><ArrowDown size={16}/></button>
                    </div>

                    {/* 景點卡片內容 */}
                    <div className={`p-10 bg-white border rounded-[3rem] transition-all group/item ${editingId === item.id ? 'border-blue-600 shadow-2xl ring-4 ring-blue-50' : 'border-slate-100 hover:shadow-2xl hover:-translate-y-2 border-l-8 border-l-transparent hover:border-l-blue-600 shadow-sm'}`}>
                      {editingId === item.id ? (
                        /* 編輯模式 */
                        <div className="space-y-4">
                          <div className="flex gap-4">
                            <input type="time" value={tempEditData.time} onChange={e => setTempEditData({...tempEditData, time: e.target.value})} className="p-3 bg-slate-50 rounded-xl font-black border border-blue-100 outline-none w-32" />
                            <input value={tempEditData.spot} onChange={e => setTempEditData({...tempEditData, spot: e.target.value})} className="flex-1 p-3 bg-slate-50 rounded-xl font-black border border-blue-100 outline-none" />
                          </div>
                          <textarea value={tempEditData.note} onChange={e => setTempEditData({...tempEditData, note: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl font-medium border border-blue-100 outline-none h-24 resize-none" />
                          <div className="flex justify-end gap-3">
                            <button onClick={() => setEditingId(null)} className="px-6 py-2 rounded-xl font-bold text-slate-400 hover:bg-slate-50">取消</button>
                            <button onClick={saveEdit} className="px-8 py-2 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-100 flex items-center gap-2"><Save size={18}/> 儲存更新</button>
                          </div>
                        </div>
                      ) : (
                        /* 顯示模式 */
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-3">
                                <h4 className="text-3xl font-black text-slate-800 tracking-tight">{item.spot}</h4>
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors inline-flex items-center gap-1 text-xs font-bold">
                                  <MapPin size={14} /> 地圖
                                </a>
                            </div>
                            <p className="text-slate-500 font-medium leading-relaxed whitespace-pre-wrap">{item.note || "點擊編輯加入景點說明..."}</p>
                          </div>
                          <div className="flex flex-col gap-2 opacity-0 group-hover/item:opacity-100 transition-all translate-x-4 group-hover/item:translate-x-0">
                            <button onClick={() => startEditing(item)} className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all">
                              <Edit3 size={20} />
                            </button>
                            <button onClick={() => deleteEntry(item.id, 'spots')} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {(!itinerary[activeDay] || itinerary[activeDay]?.spots?.length === 0) && (
                  <div className="py-28 text-center border-4 border-dashed border-slate-50 rounded-[4rem] bg-slate-50/30">
                    <Sparkles className="text-slate-100 mx-auto mb-6" size={56} />
                    <p className="text-slate-300 font-black text-xl italic tracking-tight text-center">空空的行程... 用精彩的景點填滿這一天吧！</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default App;
