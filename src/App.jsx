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
  Cloud, Sun, PlaneTakeoff, ArrowUp, ArrowDown
} from 'lucide-react';

/**
 * 🚀 功能優化版：
 * 1. 航班資訊置頂：優先管理交通細節。
 * 2. 行程卡片移動：新增 Up/Down 按鈕，支援景點重新排序。
 * 3. AI 天氣穩定化：強化 Gemini API 呼叫與 JSON 解析邏輯。
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
  const [newEntry, setNewEntry] = useState({ time: '09:00', spot: '' });
  const [newFlight, setNewFlight] = useState({ flightNo: '', time: '08:00', type: '起飛' });

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

  // 1. 身份驗證流程
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

  // 2. 監聽行程列表
  useEffect(() => {
    if (!user || !db) return;
    const tripsRef = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    return onSnapshot(tripsRef, (snapshot) => {
      const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(tripList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, (error) => console.error("List sync error", error));
  }, [user]);

  // 3. 監聽詳細行程
  useEffect(() => {
    if (!user || !tripId || !db) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        setItinerary(docSnap.data().days || {});
        setView('editor');
      }
    }, (error) => console.error("Detail sync error", error));

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
    } catch (err) { console.error("Create failed", err); } finally { setIsLoading(false); }
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
    setNewEntry({ time: '09:00', spot: '' });
  };

  const moveEntry = async (index, direction) => {
    if (!user || !tripId || !db) return;
    const dayData = itinerary[activeDay];
    const spots = [...(dayData.spots || [])];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= spots.length) return;
    
    // 交換順序
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
    const prompt = `請提供 ${tripInfo.city} 在 ${dateStr} 的天氣預測。必須回答 JSON 格式且僅含以下欄位：{"temp": "氣溫範圍", "condition": "天氣狀態(如: 晴天, 多雲, 短暫陣雨)", "tips": "穿衣與旅遊建議"}。不要包含額外的說明。`;

    const fetchWithRetry = async (retries = 3) => {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        if (!response.ok) throw new Error("API request failed");
        const result = await response.json();
        return JSON.parse(result.candidates[0].content.parts[0].text);
      } catch (err) {
        if (retries > 0) return await fetchWithRetry(retries - 1);
        throw err;
      }
    };

    try {
      const weatherData = await fetchWithRetry();
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
        [`days.${activeDay}.weather`]: weatherData
      });
    } catch (err) {
      console.error("AI 天氣生成最終失敗", err);
    } finally {
      setIsAiLoading(false);
    }
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
    <div className="w-full flex flex-col items-center min-h-screen">
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
            <h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase">Traveler Planner</h1>
            <p className="text-slate-400 font-bold tracking-widest uppercase text-sm">航班行程與 AI 天氣管家</p>
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
                    <input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">旅遊天數</label>
                    <input required type="number" min="1" max="14" placeholder="天數" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} />
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
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2 inline-block bg-slate-50 px-3 py-1 rounded-full">{tripInfo.startDate} 出發</div>
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

            {/* 行程列表區區 */}
            <div className="bg-white p-10 md:p-16 rounded-[4rem] border border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.02)]">
              <div className="flex justify-between items-end mb-14">
                <div className="space-y-2">
                  <h2 className="text-6xl font-black text-slate-900 tracking-tighter italic leading-none">Day {activeDay}</h2>
                  <p className="text-slate-400 font-bold uppercase text-sm ml-1">{getFormattedDate(tripInfo.startDate, activeDay)}</p>
                </div>
                <div className="w-24 h-2 bg-blue-600 rounded-full shadow-sm mb-2"></div>
              </div>

              <form onSubmit={addEntry} className="mb-14 flex flex-wrap md:flex-nowrap gap-4 bg-slate-50 p-5 rounded-[2.5rem]">
                <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-sm border">
                  <Clock size={20} className="text-blue-500" />
                  <input type="time" value={newEntry.time} onChange={e => setNewEntry({...newEntry, time: e.target.value})} className="bg-transparent font-black text-slate-700 outline-none w-28 text-lg" />
                </div>
                <input placeholder="今天想去哪裡留下足跡？" required value={newEntry.spot} onChange={e => setNewEntry({...newEntry, spot: e.target.value})} className="flex-1 p-4 bg-white border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 text-lg" />
                <button type="submit" className="bg-slate-900 hover:bg-black text-white px-12 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 shrink-0 text-lg">加入</button>
              </form>

              <div className="space-y-8 relative before:content-[''] before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-1.5 before:bg-slate-50 before:rounded-full">
                {itinerary[activeDay]?.spots?.map((item, idx) => (
                  <div key={item.id} className="relative pl-20 group">
                    {/* 左側排序控制與時間 */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
                       <button onClick={() => moveEntry(idx, -1)} className="p-1 hover:bg-blue-50 text-slate-200 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"><ArrowUp size={16}/></button>
                       <div className="w-16 h-16 bg-white border-8 border-slate-50 rounded-[1.5rem] flex items-center justify-center text-[11px] font-black text-blue-600 shadow-md z-10 group-hover:scale-110 transition-transform">{item.time}</div>
                       <button onClick={() => moveEntry(idx, 1)} className="p-1 hover:bg-blue-50 text-slate-200 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"><ArrowDown size={16}/></button>
                    </div>
                    {/* 景點卡片 */}
                    <div className="p-10 bg-white border border-slate-100 rounded-[3rem] flex justify-between items-center hover:shadow-2xl transition-all hover:-translate-y-2 group/item border-l-8 border-l-transparent hover:border-l-blue-600">
                      <h4 className="text-2xl font-black text-slate-800 tracking-tight">{item.spot}</h4>
                      <button onClick={() => deleteEntry(item.id, 'spots')} className="p-4 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover/item:opacity-100"><Trash2 size={24} /></button>
                    </div>
                  </div>
                ))}
                
                {(!itinerary[activeDay] || itinerary[activeDay]?.spots?.length === 0) && (
                  <div className="py-28 text-center border-4 border-dashed border-slate-50 rounded-[4rem] bg-slate-50/30">
                    <Sparkles className="text-slate-100 mx-auto mb-6" size={56} />
                    <p className="text-slate-300 font-black text-xl italic tracking-tight text-center">行程是空的... 用精彩的項目填滿它吧！</p>
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
