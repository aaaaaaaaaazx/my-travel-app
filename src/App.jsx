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
 * 1. 支援 GitHub Secrets 注入 (VITE_FIREBASE_CONFIG)。
 * 2. 支援 Canvas 預覽環境全域變數。
 * 3. 使用您指定的 appId: 'travel-yeh'。
 */

const getFirebaseConfig = () => {
  // 優先偵測預覽環境的全域變數
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try {
      return JSON.parse(__firebase_config);
    } catch (e) {
      console.error("解析系統全域配置失敗");
    }
  }

  // 備選：從 Vite 環境變數讀取 (GitHub Actions 部署用)
  try {
    const envConfig = import.meta.env?.VITE_FIREBASE_CONFIG;
    if (envConfig) {
      return JSON.parse(envConfig);
    }
  } catch (e) {
    // 忽略靜態解析警告
  }

  return null;
};

const firebaseConfig = getFirebaseConfig();
const app = firebaseConfig && firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// 您選取的專案識別碼
const appId = 'travel-yeh'; 

// Gemini API Key 
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
  const [tripInfo, setTripInfo] = useState({ title: '我的旅遊', country: '', city: '', startDate: '', duration: 3 });
  const [itinerary, setItinerary] = useState({});
  const [newEntry, setNewEntry] = useState({ time: '09:00', spot: '', note: '' });

  // 身份驗證邏輯
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try { 
          await signInAnonymously(auth); 
        } catch (err) { 
          console.error("匿名登入失敗:", err); 
        }
      } else { 
        setUser(u); 
      }
    });
    return () => unsubscribe();
  }, []);

  // 行程資料監聽
  useEffect(() => {
    if (!user || !tripId || !db) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    return onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        setItinerary(docSnap.data().days || {});
        setView('editor');
      }
    }, (err) => console.error("Firestore 監聽失敗:", err));
  }, [user, tripId]);

  // 網址參數偵測
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setTripId(id);
  }, []);

  const handleStartPlanning = async (e) => {
    e.preventDefault();
    if (!user || !db) return;
    setIsLoading(true);
    const newId = crypto.randomUUID();
    const durationCount = Math.max(1, parseInt(tripInfo.duration) || 1);
    const initialItin = {};
    for (let i = 1; i <= durationCount; i++) initialItin[i] = [];

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', newId), {
        ...tripInfo, creator: user.uid, createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', newId), {
        days: initialItin
      });
      setTripId(newId);
      const url = new URL(window.location.href);
      url.searchParams.set('id', newId);
      window.history.pushState({}, '', url);
    } catch (err) {
      console.error("建立行程失敗:", err);
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

  if (!firebaseConfig || !firebaseConfig.apiKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border max-w-md">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black mb-2 text-slate-900">未偵測到 Firebase 設定</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            請確認您的 GitHub Secrets 中已新增了 <b>VITE_FIREBASE_CONFIG</b>。
          </p>
        </div>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-xl w-full text-center">
          <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl rotate-12 transition-transform hover:rotate-0">
            <Plane size={40} />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tight text-slate-900">開始規劃旅遊</h1>
          <p className="text-slate-400 font-bold mb-10">連線至您的專屬雲端專案：{appId}</p>
          <form onSubmit={handleStartPlanning} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 text-left space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <input required placeholder="國家" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold" />
              <input required placeholder="城市" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input required type="date" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
              <input required type="number" min="1" max="14" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg active:scale-95">
              {isLoading ? <Loader2 className="animate-spin" /> : <>建立行程 <ArrowRight size={20}/></>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <nav className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="font-black text-blue-600 text-xl flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = window.location.pathname}>
          <Plane size={24} className="rotate-45" /> TRAVELER
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowShareModal(true)} className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 text-slate-600">
            <Share2 size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1200px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2 text-sm">
              <Calendar size={16} className="text-blue-500" /> 行程天數
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(itinerary).map(day => (
                <button 
                  key={day} 
                  onClick={() => setActiveDay(parseInt(day))} 
                  className={`py-3 rounded-2xl font-black text-sm transition-all ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}
                >
                  D{day}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 space-y-6">
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h2 className="text-3xl font-black mb-8">Day {activeDay} - {tripInfo.city}</h2>
            <form onSubmit={addEntry} className="mb-10 flex gap-3 bg-slate-50 p-3 rounded-3xl">
              <input type="time" value={newEntry.time} onChange={e => setNewEntry({...newEntry, time: e.target.value})} className="p-3 bg-white rounded-2xl border font-black" />
              <input placeholder="新增景點..." required value={newEntry.spot} onChange={e => setNewEntry({...newEntry, spot: e.target.value})} className="flex-1 p-3 bg-white rounded-2xl border font-bold outline-none" />
              <button type="submit" className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black hover:bg-black transition-colors">加入</button>
            </form>

            <div className="space-y-4">
              {itinerary[activeDay]?.map((item, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center group">
                  <div className="flex gap-4 items-center">
                    <span className="font-black text-blue-600">{item.time}</span>
                    <span className="font-bold text-slate-800 text-lg">{item.spot}</span>
                  </div>
                  <button onClick={() => {
                    const updatedDay = itinerary[activeDay].filter((_, i) => i !== idx);
                    updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), { [`days.${activeDay}`]: updatedDay });
                  }} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
              {(!itinerary[activeDay] || itinerary[activeDay].length === 0) && (
                <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                  <p className="text-slate-300 font-bold italic">這一天還沒有行程安排</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showShareModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[3rem] max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">分享行程</h3>
              <button onClick={() => setShowShareModal(false)}><X /></button>
            </div>
            <div className="flex gap-2">
              <input readOnly value={window.location.href} className="flex-1 bg-slate-50 p-4 rounded-xl text-xs font-mono truncate" />
              <button 
                onClick={() => { 
                  navigator.clipboard.writeText(window.location.href); 
                  setCopySuccess(true); 
                  setTimeout(()=>setCopySuccess(false), 2000); 
                }} 
                className={`px-6 py-3 rounded-xl text-white font-bold transition-all ${copySuccess ? 'bg-green-500' : 'bg-blue-600'}`}
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
