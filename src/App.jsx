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
 * 💡 修復重點：
 * 1. 使用安全存取方式讀取環境變數，防止 import.meta.env 未定義時報錯。
 * 2. 優先偵測 Canvas 預覽環境的全域變數 __firebase_config。
 */

// --- Firebase 配置載入邏輯 ---
let firebaseConfig = null;

try {
  // 1. 優先偵測預覽環境提供的全域變數
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = JSON.parse(__firebase_config);
  } else {
    // 2. 部署環境：安全存取 Vite 的環境變數
    // 檢查 import.meta 及其 env 屬性是否存在
    const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
    const envConfig = metaEnv.VITE_FIREBASE_CONFIG;
    
    if (envConfig) {
      firebaseConfig = JSON.parse(envConfig);
    }
  }
} catch (e) {
  console.error("Firebase Config 解析失敗:", e);
}

// 初始化 Firebase (加入防護，避免 Config 為空時崩潰)
const app = (firebaseConfig && firebaseConfig.apiKey) ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-travel-app';

const App = () => {
  const [view, setView] = useState('home');
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [tripInfo, setTripInfo] = useState({ title: '我的旅遊', country: '', city: '', startDate: '', duration: 3 });
  const [itinerary, setItinerary] = useState({});
  const [newEntry, setNewEntry] = useState({ time: '09:00', spot: '', note: '' });

  // 1. Auth 處理：遵循先驗證後查詢規則
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

  // 2. 資料監聽：遵循正確的路徑結構 (RULE 1)
  useEffect(() => {
    if (!user || !tripId || !db) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    return onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        setItinerary(docSnap.data().days || {});
        setView('editor');
      }
    }, (err) => {
      console.error("Firestore 監聽失敗 (請確認 Rules 是否發佈):", err);
    });
  }, [user, tripId]);

  // 3. 偵測網址參數 (分享功能)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setTripId(id);
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    if (!user || !db) return;
    setIsLoading(true);
    const newId = crypto.randomUUID();
    const days = {};
    const dayCount = Math.max(1, parseInt(tripInfo.duration) || 1);
    for (let i = 1; i <= dayCount; i++) days[i] = [];

    try {
      // 寫入基本行程資訊
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', newId), {
        ...tripInfo, 
        creator: user.uid, 
        createdAt: new Date().toISOString()
      });
      // 寫入空的每日行程結構
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', newId), { days });
      
      setTripId(newId);
      const url = new URL(window.location.href);
      url.searchParams.set('id', newId);
      window.history.pushState({}, '', url);
    } catch (err) {
      console.error("存檔失敗:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addEntry = async (e) => {
    e.preventDefault();
    if (!tripId || !db) return;
    const entry = { ...newEntry, id: Date.now() };
    const updatedDay = [...(itinerary[activeDay] || []), entry].sort((a, b) => a.time.localeCompare(b.time));
    
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
        [`days.${activeDay}`]: updatedDay
      });
      setNewEntry({ time: '09:00', spot: '', note: '' });
    } catch (err) {
      console.error("更新行程失敗:", err);
    }
  };

  // --- 配置錯誤 UI 提示 ---
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center font-sans">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 max-w-md w-full">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black mb-3 text-slate-900">Firebase 設定錯誤</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            無法載入資料庫配置。請檢查 GitHub Secrets 中的 <b>VITE_FIREBASE_CONFIG</b> 格式是否為正確的 JSON。
          </p>
          <div className="text-left bg-slate-50 p-4 rounded-2xl text-[10px] font-mono text-slate-400 break-all leading-tight">
            {"{\"apiKey\": \"...\", \"authDomain\": \"...\"}"}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0">
            <Plane size={48} />
          </div>
          <h1 className="text-4xl font-black mb-4 text-slate-900 tracking-tight">旅遊規劃助手</h1>
          <p className="text-slate-400 font-bold mb-10">開始您的雲端協作行程</p>
          
          <form onSubmit={handleStart} className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-left space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">國家</label>
                <input required placeholder="例如：日本" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">城市</label>
                <input required placeholder="例如：東京" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">出發日期</label>
              <input required type="date" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">旅遊天數</label>
              <input required type="number" min="1" max="14" placeholder="天數" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all" />
            </div>
            <button type="submit" disabled={isLoading || !user} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50">
              {isLoading ? <Loader2 className="animate-spin" /> : <>建立雲端行程 <ArrowRight size={20}/></>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <nav className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.href = window.location.pathname}>
          <div className="p-2 bg-blue-50 rounded-xl group-hover:rotate-12 transition-transform">
            <Plane size={24} className="rotate-45" />
          </div>
          <span className="tracking-tighter">TRAVELER</span>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-lg font-black text-slate-800 leading-none">{tripInfo.city} 之旅</p>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">{tripInfo.startDate}</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-8">
        <div className="flex gap-3 overflow-x-auto pb-6 mb-8 scrollbar-hide">
          {Object.keys(itinerary).map(day => (
            <button 
              key={day} 
              onClick={() => setActiveDay(parseInt(day))} 
              className={`shrink-0 px-10 py-4 rounded-2xl font-black transition-all ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-2xl shadow-blue-100 scale-105' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
            >
              Day {day}
            </button>
          ))}
        </div>

        <div className="bg-white p-10 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-slate-50 pointer-events-none">
            <MapIcon size={120} />
          </div>

          <div className="relative z-10">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter">第 {activeDay} 天</h2>
                <div className="h-2 w-16 bg-blue-600 rounded-full mt-4"></div>
              </div>
            </div>

            <form onSubmit={addEntry} className="mb-12 bg-slate-50 p-4 rounded-3xl flex flex-wrap md:flex-nowrap gap-3 items-center">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
                <Clock size={16} className="text-slate-300" />
                <input type="time" value={newEntry.time} onChange={e => setNewEntry({...newEntry, time: e.target.value})} className="bg-transparent font-black text-slate-700 outline-none w-24" />
              </div>
              <input placeholder="今天要在那裡留下回憶？" required value={newEntry.spot} onChange={e => setNewEntry({...newEntry, spot: e.target.value})} className="flex-1 p-3 bg-white border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
              <button type="submit" className="bg-slate-900 hover:bg-black text-white px-10 py-3 rounded-2xl font-black transition-all shadow-lg shadow-slate-200 active:scale-95">
                加入行程
              </button>
            </form>

            <div className="space-y-6 relative before:content-[''] before:absolute before:left-[27px] before:top-4 before:bottom-4 before:w-1 before:bg-slate-50">
              {itinerary[activeDay]?.map((item, idx) => (
                <div key={idx} className="relative pl-14 group">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-14 h-14 bg-white border-4 border-slate-50 rounded-2xl flex items-center justify-center text-[10px] font-black text-blue-600 shadow-sm z-10 group-hover:scale-110 transition-transform">
                    {item.time}
                  </div>
                  <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] flex justify-between items-center hover:shadow-2xl hover:shadow-slate-100 transition-all hover:-translate-y-1">
                    <div className="space-y-1">
                      <h4 className="text-2xl font-black text-slate-800 tracking-tight">{item.spot}</h4>
                      {item.note && <p className="text-slate-400 font-bold text-sm">{item.note}</p>}
                    </div>
                    <button 
                      onClick={async () => {
                        const updatedDay = itinerary[activeDay].filter((_, i) => i !== idx);
                        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
                          [`days.${activeDay}`]: updatedDay
                        });
                      }}
                      className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
              
              {(!itinerary[activeDay] || itinerary[activeDay].length === 0) && (
                <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[3rem]">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="text-slate-200" size={40} />
                  </div>
                  <p className="text-slate-300 font-black text-xl">今天還沒有安排任何行程，<br/>快來規劃您的專屬旅程！</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
