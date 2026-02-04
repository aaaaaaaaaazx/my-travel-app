import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
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
  Plane, Calendar, Plus, Trash2, Clock, Share2, 
  Copy, CheckCircle, AlertCircle, Loader2, Sparkles, X, ArrowRight, Globe, Map as MapIcon, ChevronRight
} from 'lucide-react';

/**
 * 🚀 更新重點：
 * 1. 首頁行程列表：新增「我的旅程」區塊，顯示所有已建立的行程。
 * 2. 雲端同步列表：透過 onSnapshot 即時獲取雲端行程資料。
 * 3. 置中與日期計算：維持原有的極致置中與自動日期計算功能。
 */

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
const appId = 'travel-yeh';

const App = () => {
  const [view, setView] = useState('home');
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [tripInfo, setTripInfo] = useState({ country: '', city: '', startDate: '', duration: 3 });
  const [itinerary, setItinerary] = useState({});
  const [newEntry, setNewEntry] = useState({ time: '09:00', spot: '' });

  // 🛠 強力重設樣式，確保首頁在內容增多時依然美觀且置中
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
    `;
    document.head.appendChild(style);
  }, []);

  // Auth 處理
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try { await signInAnonymously(auth); } catch (err) { console.error("Login failed", err); }
      } else { setUser(u); }
    });
    return () => unsubscribe();
  }, []);

  // 監聽所有行程列表 (首頁用)
  useEffect(() => {
    if (!user || !db) return;
    const tripsRef = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    return onSnapshot(tripsRef, (snapshot) => {
      const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // 依建立時間排序 (最新的在前面)
      setTrips(tripList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });
  }, [user]);

  // 監聽單一行程詳細資料 (編輯器用)
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
      if (docSnap.exists()) {
        setTripInfo(docSnap.data());
      }
    });

    return () => { unsubItin(); unsubTrip(); };
  }, [user, tripId]);

  // 日期計算函式
  const getFormattedDate = (baseDate, dayOffset) => {
    if (!baseDate) return "";
    const date = new Date(baseDate);
    date.setDate(date.getDate() + (dayOffset - 1));
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const newId = crypto.randomUUID();
    const days = {};
    for (let i = 1; i <= Math.max(1, parseInt(tripInfo.duration)); i++) days[i] = [];
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', newId), {
        ...tripInfo, creator: user.uid, createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', newId), { days });
      // 建立後自動進入編輯
      setTripId(newId);
    } finally { setIsLoading(false); }
  };

  const addEntry = async (e) => {
    e.preventDefault();
    if (!tripId || !db) return;
    const entry = { ...newEntry, id: Date.now() };
    const dayData = itinerary[activeDay] || [];
    const updatedDay = [...dayData, entry].sort((a, b) => a.time.localeCompare(b.time));
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
      [`days.${activeDay}`]: updatedDay
    });
    setNewEntry({ time: '09:00', spot: '' });
  };

  const deleteEntry = async (entryId) => {
    const updatedDay = itinerary[activeDay].filter(item => item.id !== entryId);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
      [`days.${activeDay}`]: updatedDay
    });
  };

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      {view === 'home' ? (
        <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-in fade-in duration-700">
          <div className="text-center mb-16">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0">
              <Plane size={48} />
            </div>
            <h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900">旅遊規劃網站</h1>
            <p className="text-slate-400 font-bold tracking-widest uppercase">Traveler · 雲端即時同步行程</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-start">
            {/* 左側：建立行程 */}
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-2">
                <Plus className="text-blue-600" /> 建立新旅程
              </h3>
              <form onSubmit={handleCreate} className="bg-white p-10 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] space-y-8 border border-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">國家</label>
                    <input required placeholder="目的地國家" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">城市</label>
                    <input required placeholder="目的地城市" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">出發日期</label>
                    <input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">旅遊天數</label>
                    <input required type="number" min="1" max="14" placeholder="天數" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} />
                  </div>
                </div>
                <button disabled={isLoading || !user} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50 text-lg flex items-center justify-center gap-2">
                  {isLoading ? <Loader2 className="animate-spin" /> : <><Plus size={24}/> 開始我的旅程</>}
                </button>
              </form>
            </div>

            {/* 右側：現有行程列表 */}
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-2">
                <Calendar className="text-blue-600" /> 我的旅程清單 ({trips.length})
              </h3>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
                {trips.map((trip) => (
                  <div 
                    key={trip.id} 
                    onClick={() => setTripId(trip.id)}
                    className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Globe size={24} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-800 tracking-tight">{trip.city} 之旅</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                          {trip.country} · {trip.startDate}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="text-slate-200 group-hover:text-blue-600 transition-colors" />
                  </div>
                ))}
                {trips.length === 0 && (
                  <div className="bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[2rem] py-20 text-center">
                    <p className="text-slate-300 font-bold italic">目前還沒有建立任何行程</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 編輯器視圖 */
        <div className="w-full flex flex-col items-center pb-24 min-h-screen">
          <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-50">
            <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.href = window.location.pathname}>
              <div className="p-2.5 bg-blue-600 text-white rounded-2xl group-hover:rotate-12 transition-transform shadow-lg shadow-blue-100">
                <Plane size={24} className="rotate-45" />
              </div>
              <span className="tracking-tighter uppercase">Traveler</span>
            </div>
            <div className="text-right">
              <div className="font-black text-slate-800 text-xl tracking-tight leading-none">{tripInfo.city} 之旅</div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2 inline-block bg-slate-50 px-3 py-1 rounded-full">{tripInfo.startDate} 出發</div>
            </div>
          </nav>
          
          <main className="w-full max-w-5xl p-6 md:p-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex gap-3 overflow-x-auto pb-8 mb-4 scrollbar-hide">
              {Object.keys(itinerary).map(day => (
                <button 
                  key={day} 
                  onClick={() => setActiveDay(parseInt(day))} 
                  className={`shrink-0 px-10 py-5 rounded-[2rem] font-black transition-all border flex flex-col items-center ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-2xl shadow-blue-100 border-blue-600 scale-105' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                >
                  <span className="text-xs opacity-60 mb-1">D{day}</span>
                  <span className="text-sm">{getFormattedDate(tripInfo.startDate, parseInt(day)).split('/').slice(1).join('/')}</span>
                </button>
              ))}
            </div>

            <div className="bg-white p-10 md:p-16 rounded-[4rem] border border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.02)]">
              <div className="flex justify-between items-end mb-14">
                <div className="space-y-2">
                  <h2 className="text-6xl font-black text-slate-900 tracking-tighter italic leading-none">Day {activeDay}</h2>
                  <p className="text-slate-400 font-bold tracking-widest uppercase text-sm ml-1">
                    {getFormattedDate(tripInfo.startDate, activeDay)}
                  </p>
                </div>
                <div className="w-24 h-2 bg-blue-600 rounded-full shadow-sm shadow-blue-100 mb-2"></div>
              </div>

              <form onSubmit={addEntry} className="mb-14 flex flex-wrap md:flex-nowrap gap-4 bg-slate-50 p-5 rounded-[2.5rem]">
                <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100">
                  <Clock size={20} className="text-blue-500" />
                  <input 
                    type="time" 
                    value={newEntry.time} 
                    onChange={e => setNewEntry({...newEntry, time: e.target.value})} 
                    className="bg-transparent font-black text-slate-700 outline-none w-28 text-lg" 
                  />
                </div>
                <input 
                  placeholder="今天想去哪裡留下足跡？" 
                  required 
                  value={newEntry.spot} 
                  onChange={e => setNewEntry({...newEntry, spot: e.target.value})} 
                  className="flex-1 p-4 bg-white border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 shadow-sm text-lg" 
                />
                <button type="submit" className="bg-slate-900 hover:bg-black text-white px-12 py-4 rounded-2xl font-black transition-all shadow-xl shadow-slate-100 active:scale-95 shrink-0 text-lg">
                  加入
                </button>
              </form>

              <div className="space-y-8 relative before:content-[''] before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-1.5 before:bg-slate-50 before:rounded-full">
                {itinerary[activeDay]?.map((item) => (
                  <div key={item.id} className="relative pl-20 group">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-16 bg-white border-8 border-slate-50 rounded-[1.5rem] flex items-center justify-center text-[11px] font-black text-blue-600 shadow-md z-10 group-hover:scale-110 transition-transform">
                      {item.time}
                    </div>
                    <div className="p-10 bg-white border border-slate-100 rounded-[3rem] flex justify-between items-center hover:shadow-2xl transition-all hover:-translate-y-2 group/item border-l-8 border-l-transparent hover:border-l-blue-600">
                      <h4 className="text-2xl font-black text-slate-800 tracking-tight">{item.spot}</h4>
                      <button 
                        onClick={() => deleteEntry(item.id)} 
                        className="p-4 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={24} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {(!itinerary[activeDay] || itinerary[activeDay].length === 0) && (
                  <div className="py-28 text-center border-4 border-dashed border-slate-50 rounded-[4rem] bg-slate-50/30">
                    <Sparkles className="text-slate-100 mx-auto mb-6" size={56} />
                    <p className="text-slate-300 font-black text-xl italic tracking-tight">今天的畫布還是空的...<br/>用精彩的行程填滿它吧！</p>
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
