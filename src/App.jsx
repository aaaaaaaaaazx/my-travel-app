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
  updateDoc
} from 'firebase/firestore';
import { 
  Plane, Calendar, Plus, Trash2, Clock, Share2, 
  Copy, CheckCircle, AlertCircle, Loader2, Sparkles, X, ArrowRight, Globe, Map as MapIcon
} from 'lucide-react';

/**
 * 💡 核心配置邏輯：
 * 1. 優先偵測 Canvas 預覽環境變數。
 * 2. 次之偵測 GitHub Secrets 注入的變數。
 * 3. 最終使用預設的 'travel-yeh' 配置作為備援。
 */

const getFirebaseConfig = () => {
  // 1. 偵測預覽環境 (Canvas)
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try { return JSON.parse(__firebase_config); } catch (e) {}
  }

  // 2. 偵測生產環境變數 (Vite / GitHub Secrets)
  try {
    const envConfig = import.meta.env.VITE_FIREBASE_CONFIG;
    if (envConfig) return JSON.parse(envConfig);
  } catch (e) {}

  // 3. 回退方案：您的專屬配置
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
const app = firebaseConfig?.apiKey ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = 'travel-yeh'; // 鎖定您的專案 ID

// Gemini API Key (可透過環境變數注入)
const apiKey = ""; 

const App = () => {
  const [view, setView] = useState('home');
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [tripInfo, setTripInfo] = useState({ country: '', city: '', startDate: '', duration: 3 });
  const [itinerary, setItinerary] = useState({});
  const [newEntry, setNewEntry] = useState({ time: '09:00', spot: '', note: '' });

  // 1. 身份驗證：確保在進行任何 Firestore 操作前已登入
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try { await signInAnonymously(auth); } catch (err) { console.error("Login Error", err); }
      } else { setUser(u); }
    });
    return () => unsubscribe();
  }, []);

  // 2. 資料同步：即時監聽 Firestore 中的行程資料
  useEffect(() => {
    if (!user || !tripId || !db) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsub = onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        setItinerary(docSnap.data().days || {});
        setView('editor');
      }
    }, (err) => console.error("Firestore Error", err));
    return () => unsub();
  }, [user, tripId]);

  // 3. 分享功能：偵測網址中的 ID
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setTripId(id);
  }, []);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!user || !db) return;
    setIsLoading(true);
    const newId = crypto.randomUUID();
    const days = {};
    const dCount = Math.max(1, parseInt(tripInfo.duration) || 1);
    for (let i = 1; i <= dCount; i++) days[i] = [];

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', newId), {
        ...tripInfo, creator: user.uid, createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', newId), { days });
      
      setTripId(newId);
      const url = new URL(window.location.href);
      url.searchParams.set('id', newId);
      window.history.pushState({}, '', url);
    } catch (err) {
      console.error("Create Trip Failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addEntry = async (e) => {
    e.preventDefault();
    if (!tripId || !db) return;
    const entry = { ...newEntry, id: Date.now() };
    const updatedDay = [...(itinerary[activeDay] || []), entry].sort((a,b) => a.time.localeCompare(b.time));
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
      [`days.${activeDay}`]: updatedDay
    });
    setNewEntry({ time: '09:00', spot: '', note: '' });
  };

  const getAiSuggestions = async () => {
    if (!apiKey || isAiLoading) return;
    setIsAiLoading(true);
    // AI 邏輯實作點...
    setTimeout(() => setIsAiLoading(false), 2000);
  };

  if (!firebaseConfig?.apiKey) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold">配置缺失</h2>
          <p className="text-slate-500 text-sm">請檢查您的環境變數設定。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {view === 'home' ? (
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
          <div className="mb-8 flex h-20 w-20 rotate-12 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-xl">
            <Plane size={40} />
          </div>
          <h1 className="text-4xl font-black mb-10 tracking-tight">旅遊規劃助手</h1>
          
          <form onSubmit={handleCreateTrip} className="w-full max-w-md bg-white p-10 rounded-[3rem] shadow-2xl border space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <input required placeholder="國家" className="w-full rounded-2xl bg-slate-50 p-4 font-bold outline-none focus:ring-2 focus:ring-blue-500" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} />
              <input required placeholder="城市" className="w-full rounded-2xl bg-slate-50 p-4 font-bold outline-none focus:ring-2 focus:ring-blue-500" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} />
            </div>
            <input required type="date" className="w-full rounded-2xl bg-slate-50 p-4 font-bold outline-none" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} />
            <input required type="number" min="1" max="14" placeholder="天數" className="w-full rounded-2xl bg-slate-50 p-4 font-bold outline-none" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} />
            <button disabled={isLoading || !user} className="w-full rounded-2xl bg-blue-600 py-5 font-black text-white shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">
              {isLoading ? <Loader2 className="animate-spin mx-auto" /> : "建立雲端行程"}
            </button>
          </form>
        </div>
      ) : (
        <div className="pb-20">
          <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white/80 px-8 backdrop-blur-md">
            <div className="flex items-center gap-2 font-black text-blue-600 cursor-pointer" onClick={() => window.location.href = window.location.pathname}>
              <Plane size={24} className="rotate-45" /> TRAVELER
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-slate-800 leading-none">{tripInfo.city}</p>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{tripInfo.startDate}</span>
              </div>
              <button onClick={() => setShowShareModal(true)} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                <Share2 size={18} className="text-slate-600" />
              </button>
            </div>
          </nav>

          <main className="mx-auto max-w-5xl p-8">
            <div className="flex gap-2 overflow-x-auto pb-6 mb-4 scrollbar-hide">
              {Object.keys(itinerary).map(day => (
                <button key={day} onClick={() => setActiveDay(parseInt(day))} className={`shrink-0 px-10 py-4 rounded-2xl font-black transition-all ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border hover:bg-slate-50'}`}>Day {day}</button>
              ))}
            </div>

            <div className="bg-white p-10 md:p-12 rounded-[3rem] border shadow-sm">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-4xl font-black text-slate-900">第 {activeDay} 天</h2>
                <button onClick={getAiSuggestions} disabled={!apiKey || isAiLoading} className="flex items-center gap-2 text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded-xl transition-all disabled:opacity-30">
                  <Sparkles size={18} /> {isAiLoading ? "思考中..." : "AI 建議"}
                </button>
              </div>

              <form onSubmit={addEntry} className="mb-10 flex gap-3 bg-slate-50 p-3 rounded-3xl">
                <input type="time" value={newEntry.time} onChange={e => setNewEntry({...newEntry, time: e.target.value})} className="p-3 bg-white rounded-2xl border font-black" />
                <input placeholder="想去哪裡？" required value={newEntry.spot} onChange={e => setNewEntry({...newEntry, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit" className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black hover:bg-black transition-all">加入</button>
              </form>

              <div className="space-y-6">
                {itinerary[activeDay]?.map((item, idx) => (
                  <div key={item.id || idx} className="p-8 bg-slate-50 rounded-[2.5rem] flex justify-between items-center group border border-transparent hover:border-blue-100 transition-all">
                    <div className="flex gap-6 items-center">
                      <div className="bg-white px-4 py-2 rounded-xl font-black text-blue-600 shadow-sm">{item.time}</div>
                      <div className="text-xl font-black text-slate-800">{item.spot}</div>
                    </div>
                    <button onClick={async () => {
                      const updatedDay = itinerary[activeDay].filter((_, i) => i !== idx);
                      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), { [`days.${activeDay}`]: updatedDay });
                    }} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
                {(!itinerary[activeDay] || itinerary[activeDay].length === 0) && (
                  <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[3rem]">
                    <p className="text-slate-300 font-black text-xl italic">這天還沒有行程，快來新增吧！</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3.5rem] max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-3xl font-black tracking-tighter">分享行程</h3>
              <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X /></button>
            </div>
            <p className="text-slate-400 font-bold mb-8">複製下方連結分享給旅伴，他們就能即時看到最新的行程更新。</p>
            <div className="flex gap-2 p-2 bg-slate-50 rounded-2xl border">
              <input readOnly value={window.location.href} className="flex-1 bg-transparent px-4 text-[10px] font-mono font-black text-slate-400 outline-none truncate" />
              <button 
                onClick={() => { 
                  navigator.clipboard.writeText(window.location.href); 
                  setCopySuccess(true); 
                  setTimeout(()=>setCopySuccess(false), 2000); 
                }} 
                className={`px-6 py-3 rounded-xl font-black transition-all ${copySuccess ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}
              >
                {copySuccess ? <CheckCircle size={20}/> : <Copy size={20}/>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
