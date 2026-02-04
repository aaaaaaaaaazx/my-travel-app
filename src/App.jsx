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
 * 💡 配置說明：
 * 1. 已加入自動掛載 Tailwind CDN 的邏輯。
 * 2. 預設連線至您的 'travel-yeh' 專案。
 * 3. 優化 CSS 佈局確保首頁完美置中。
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
  const [isLoading, setIsLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [tripInfo, setTripInfo] = useState({ country: '', city: '', startDate: '', duration: 3 });
  const [itinerary, setItinerary] = useState({});
  const [newEntry, setNewEntry] = useState({ time: '09:00', spot: '' });

  // 🚀 自動掛載 Tailwind CDN
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
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

  // 行程監聽
  useEffect(() => {
    if (!user || !tripId) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    return onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        setItinerary(docSnap.data().days || {});
        setView('editor');
      }
    });
  }, [user, tripId]);

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
      setTripId(newId);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {view === 'home' ? (
        /* 首頁容器：使用 flex-1 填滿剩餘空間並水平垂直置中 */
        <div className="flex-1 flex flex-col items-center justify-center p-6 w-full">
          <div className="max-w-md w-full text-center animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl rotate-12 transition-transform hover:rotate-0">
              <Plane size={48} />
            </div>
            <h1 className="text-4xl font-black mb-4 tracking-tight">開始您的旅程</h1>
            <p className="text-slate-400 font-bold mb-10">連線至雲端專案：{appId}</p>
            
            <form onSubmit={handleCreate} className="bg-white p-10 rounded-[3rem] shadow-2xl space-y-6 text-left border border-slate-100">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">國家</label>
                  <input required placeholder="目的地國家" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">城市</label>
                  <input required placeholder="目的地城市" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">出發日期</label>
                <input required type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">旅遊天數</label>
                <input required type="number" min="1" max="14" placeholder="天數" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} />
              </div>
              <button disabled={isLoading || !user} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50">
                {isLoading ? <Loader2 className="animate-spin mx-auto" /> : "建立雲端行程"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* 編輯器容器：維持頂部導航並置中內容 */
        <div className="flex-1 flex flex-col items-center w-full pb-20">
          <nav className="w-full h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-50">
            <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.href = window.location.pathname}>
              <div className="p-2 bg-blue-50 rounded-xl group-hover:rotate-12 transition-transform">
                <Plane size={24} className="rotate-45" />
              </div>
              <span className="tracking-tighter uppercase">Traveler</span>
            </div>
            <div className="text-right">
              <div className="font-black text-slate-800 leading-none">{tripInfo.city} 之旅</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">{tripInfo.startDate}</div>
            </div>
          </nav>
          
          <main className="w-full max-w-4xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm text-center">
               <h2 className="text-5xl font-black mb-6 italic tracking-tighter">Day {activeDay}</h2>
               <div className="w-20 h-1.5 bg-blue-600 mx-auto rounded-full mb-8 shadow-sm shadow-blue-100"></div>
               <p className="text-slate-400 font-bold italic">行程資料已同步連線至雲端資料庫</p>
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default App;
