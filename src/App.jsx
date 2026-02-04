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
  Cloud, Sun, PlaneTakeoff
} from 'lucide-react';

/**
 * 🚀 穩定修復版：
 * 1. 解決解析 __firebase_config 失敗導致的白屏問題。
 * 2. 修復路徑段數錯誤 (Odd segment rule)。
 * 3. 強化 Auth 流程安全性。
 */

// 安全解析配置
let firebaseConfig = {};
try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = JSON.parse(__firebase_config);
  }
} catch (e) {
  console.error("Firebase Config 解析失敗", e);
}

// 初始化 Firebase (加入防呆)
const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// 修正 appId 路徑段數問題
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
  const [initError, setInitError] = useState(null);

  // 強力重設樣式，確保 100% 置中且覆蓋 Vite 預設
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }

    const style = document.createElement('style');
    style.innerHTML = `
      html, body, #root {
        min-height: 100% !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #f8fafc;
      }
      #root {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
      }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
    `;
    document.head.appendChild(style);
  }, []);

  // 身份驗證處理 (Rule 3: Auth Before Queries)
  useEffect(() => {
    if (!auth) {
      setInitError("Firebase 未能正確初始化，請檢查配置。");
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth 失敗", err);
        setInitError("登錄服務暫時無法連線。");
      }
    };
    
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 監聽行程列表
  useEffect(() => {
    if (!user || !db) return;
    const tripsRef = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    const unsubscribe = onSnapshot(
      tripsRef, 
      (snapshot) => {
        const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTrips(tripList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      },
      (error) => console.error("行程列表讀取失敗:", error)
    );
    return () => unsubscribe();
  }, [user]);

  // 監聽詳細行程
  useEffect(() => {
    if (!user || !tripId || !db) return;
    
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(
      itinRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          setItinerary(docSnap.data().days || {});
          setView('editor');
        }
      },
      (error) => console.error("詳細行程讀取失敗", error)
    );

    const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(
      tripRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          setTripInfo(docSnap.data());
        }
      },
      (error) => console.error("基本資訊讀取失敗", error)
    );

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
    } catch (err) {
      console.error("建立失敗", err);
    } finally { setIsLoading(false); }
  };

  const addEntry = async (e) => {
    e.preventDefault();
    if (!user || !tripId || !db) return;
    const entry = { ...newEntry, id: Date.now() };
    const dayData = itinerary[activeDay] || { spots: [], flights: [], weather: null };
    const updatedSpots = [...(dayData.spots || []), entry].sort((a, b) => a.time.localeCompare(b.time));
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
      [`days.${activeDay}.spots`]: updatedSpots
    });
    setNewEntry({ time: '09:00', spot: '' });
  };

  const addFlight = async (e) => {
    e.preventDefault();
    if (!user || !tripId || !db) return;
    const flight = { ...newFlight, id: Date.now() };
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
    const prompt = `提供 ${tripInfo.city} 在 ${dateStr} 的大約天氣 JSON: {"temp": "氣溫", "condition": "狀態", "tips": "建議"}`;

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
    } catch (err) {
      console.error("AI 天氣獲取失敗", err);
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

  // 錯誤狀態顯示
  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-2xl font-black text-slate-800 mb-2">啟動失敗</h2>
        <p className="text-slate-500">{initError}</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      {!user ? (
        <div className="flex flex-col items-center justify-center h-screen space-y-4">
           <Loader2 className="animate-spin text-blue-600" size={48} />
           <p className="text-slate-500 font-bold tracking-widest italic">安全連線建立中...</p>
        </div>
      ) : view === 'home' ? (
        <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-in fade-in duration-700">
          <div className="text-center mb-16">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0">
              <Plane size={48} />
            </div>
            <h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase">Travel Planner</h1>
            <p className="text-slate-400 font-bold tracking-widest uppercase text-sm">串聯航班與天氣的智能助手</p>
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
                    <input required placeholder="目的地" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">城市</label>
                    <input required placeholder="城市" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">出發日期</label>
                    <input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">天數</label>
                    <input required type="number" min="1" max="14" placeholder="天數" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} />
                  </div>
                </div>
                <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl transition-all active:scale-95">
                  {isLoading ? <Loader2 className="animate-spin mx-auto" /> : "開始規劃"}
                </button>
              </form>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Calendar className="text-blue-600" /> 旅程清單 ({trips.length})
              </h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                {trips.map((trip) => (
                  <div key={trip.id} onClick={() => setTripId(trip.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Globe size={24} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-800">{trip.city} 之旅</h4>
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
              <Plane size={24} className="rotate-45" />
              <span>TRAVELER</span>
            </div>
            <div className="text-right">
              <div className="font-black text-slate-800">{tripInfo.city} 之旅</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{tripInfo.startDate}</div>
            </div>
          </nav>
          
          <main className="w-full max-w-5xl p-6 md:p-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex gap-3 overflow-x-auto pb-8 mb-4 scrollbar-hide">
              {Object.keys(itinerary).map(day => (
                <button key={day} onClick={() => setActiveDay(parseInt(day))} className={`shrink-0 px-10 py-5 rounded-[2rem] font-black transition-all border ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-xl scale-105 border-blue-600' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>
                  D{day} · {getFormattedDate(tripInfo.startDate, parseInt(day)).split('/').slice(1).join('/')}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 text-blue-50"><Cloud size={80} /></div>
                <div className="relative z-10">
                    <h4 className="text-xs font-black text-slate-300 uppercase mb-4">當日天氣</h4>
                    {itinerary[activeDay]?.weather ? (
                        <div className="flex items-center gap-6">
                            <div className="text-4xl font-black text-slate-900">{itinerary[activeDay].weather.temp}</div>
                            <div className="text-slate-500 font-bold">
                                <p className="text-blue-600">{itinerary[activeDay].weather.condition}</p>
                                <p className="text-xs">{itinerary[activeDay].weather.tips}</p>
                            </div>
                        </div>
                    ) : (
                        <button onClick={getAiWeather} disabled={isAiLoading} className="bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 transition-colors">
                            {isAiLoading ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 獲取 AI 天氣建議
                        </button>
                    )}
                </div>
              </div>

              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 text-slate-50"><PlaneTakeoff size={80} /></div>
                <div className="relative z-10">
                    <h4 className="text-xs font-black text-slate-300 uppercase mb-4">航班資訊</h4>
                    <div className="space-y-3">
                        {itinerary[activeDay]?.flights?.map(f => (
                            <div key={f.id} className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-black uppercase">{f.type}</span>
                                    <span className="font-black text-slate-800">{f.flightNo}</span>
                                    <span className="text-xs text-slate-400">{f.time}</span>
                                </div>
                                <button onClick={() => deleteEntry(f.id, 'flights')} className="text-slate-200 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        ))}
                        <form onSubmit={addFlight} className="flex gap-2">
                            <input required placeholder="航班" className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none" value={newFlight.flightNo} onChange={e => setNewFlight({...newFlight, flightNo: e.target.value})} />
                            <input type="time" className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none" value={newFlight.time} onChange={e => setNewFlight({...newFlight, time: e.target.value})} />
                            <button type="submit" className="bg-slate-900 text-white p-2 rounded-xl"><Plus size={16}/></button>
                        </form>
                    </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-10 md:p-16 rounded-[4rem] border border-slate-100 shadow-sm">
              <h2 className="text-6xl font-black text-slate-900 italic mb-14 tracking-tighter">Day {activeDay}</h2>
              <form onSubmit={addEntry} className="mb-14 flex flex-wrap md:flex-nowrap gap-4 bg-slate-50 p-5 rounded-[2.5rem]">
                <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100">
                  <Clock size={20} className="text-blue-500" />
                  <input type="time" value={newEntry.time} onChange={e => setNewEntry({...newEntry, time: e.target.value})} className="bg-transparent font-black text-slate-700 outline-none w-28 text-lg" />
                </div>
                <input placeholder="今天想去哪裡？" required value={newEntry.spot} onChange={e => setNewEntry({...newEntry, spot: e.target.value})} className="flex-1 p-4 bg-white border border-slate-100 rounded-2xl font-bold outline-none text-lg" />
                <button type="submit" className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 shrink-0 text-lg">加入</button>
              </form>

              <div className="space-y-8 relative before:content-[''] before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-1.5 before:bg-slate-50 before:rounded-full">
                {itinerary[activeDay]?.spots?.map((item) => (
                  <div key={item.id} className="relative pl-20 group">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-16 bg-white border-8 border-slate-50 rounded-[1.5rem] flex items-center justify-center text-[11px] font-black text-blue-600 shadow-md z-10 group-hover:scale-110 transition-transform">{item.time}</div>
                    <div className="p-10 bg-white border border-slate-100 rounded-[3rem] flex justify-between items-center hover:shadow-2xl transition-all hover:-translate-y-2 group/item">
                      <h4 className="text-2xl font-black text-slate-800 tracking-tight">{item.spot}</h4>
                      <button onClick={() => deleteEntry(item.id, 'spots')} className="p-4 text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={24} /></button>
                    </div>
                  </div>
                ))}
                {(!itinerary[activeDay] || itinerary[activeDay]?.spots?.length === 0) && (
                  <div className="py-28 text-center border-4 border-dashed border-slate-50 rounded-[4rem] bg-slate-50/30">
                    <Sparkles className="text-slate-100 mx-auto mb-6" size={56} />
                    <p className="text-slate-300 font-black text-xl italic tracking-tight">今天的行程還是空的...</p>
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
