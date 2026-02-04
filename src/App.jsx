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

// --- Firebase 配置與相容性處理 ---
let firebaseConfig = {};

// 安全地獲取環境變數，避免編譯器在不支援 import.meta 的環境報錯
const getEnv = (key) => {
  try {
    // 試圖存取 Vite 環境變數
    return import.meta.env[key];
  } catch (e) {
    return undefined;
  }
};

try {
  // 1. 優先從 GitHub Actions / Vite 環境變數讀取 (部署環境)
  const envConfig = getEnv('VITE_FIREBASE_CONFIG');
  if (envConfig) {
    firebaseConfig = JSON.parse(envConfig);
  } else if (typeof __firebase_config !== 'undefined') {
    // 2. 備選：從預覽環境全域變數讀取
    firebaseConfig = JSON.parse(__firebase_config);
  }
} catch (e) {
  console.warn("Firebase Config 未能正確加載，請檢查 GitHub Secrets 設定。");
}

// 初始化 Firebase (加入防錯，避免 Config 為空時崩潰)
const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-travel-app';

// Gemini API Key
const apiKey = getEnv('VITE_GEMINI_API_KEY') || "";

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

  // --- Auth 邏輯 (遵循 RULE 3) ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try { 
          await signInAnonymously(auth); 
        } catch (err) { 
          console.error("登入失敗:", err); 
        }
      } else { 
        setUser(u); 
      }
    });
    return () => unsubscribe();
  }, []);

  // --- 監聽資料 (遵循 RULE 1 & 2) ---
  useEffect(() => {
    if (!user || !tripId || !db) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        setItinerary(docSnap.data().days || {});
        setView('editor');
      }
    }, (err) => console.error("Firestore 讀取失敗:", err));

    return () => unsubItin();
  }, [user, tripId]);

  // 初始化網址偵測
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setTripId(id);
  }, []);

  // --- 處理函式 ---
  const handleStartPlanning = async (e) => {
    e.preventDefault();
    if (!user || !db) return;
    setIsLoading(true);
    const newId = crypto.randomUUID();
    const initialItin = {};
    for (let i = 1; i <= Math.max(1, parseInt(tripInfo.duration) || 1); i++) initialItin[i] = [];

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
      console.error("存檔失敗:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addEntry = async (e) => {
    e.preventDefault();
    if (!tripId || !db) return;
    const updatedDay = [...(itinerary[activeDay] || []), { ...newEntry, id: Date.now() }]
      .sort((a,b) => a.time.localeCompare(b.time));
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
      [`days.${activeDay}`]: updatedDay
    });
    setNewEntry({ time: '09:00', spot: '', note: '' });
  };

  // --- 安全檢查畫面 ---
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border max-w-md">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black mb-2 text-slate-900">未偵測到 Firebase 設定</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            網頁因為抓不到密鑰而空白。請確保您已在 GitHub Repo 的 <b>Settings {' > '} Secrets</b> 中新增了 <b>VITE_FIREBASE_CONFIG</b>。
          </p>
          <div className="bg-slate-50 p-4 rounded-2xl text-left text-[10px] font-mono break-all text-slate-600">
            期望格式: {"{\"apiKey\":\"...\",\"authDomain\":\"...\"}"}
          </div>
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
          <p className="text-slate-400 font-bold mb-10">輕鬆管理您的行程，與好友同步共享。</p>
          
          <form onSubmit={handleStartPlanning} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 text-left space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">目的地國家</label>
                <input required placeholder="例如：日本" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">目的地城市</label>
                <input required placeholder="例如：東京" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">出發日期</label>
                <input required type="date" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">旅遊天數</label>
                <input required type="number" min="1" max="14" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95">
              {isLoading ? <Loader2 className="animate-spin" /> : <>建立行程 <ArrowRight size={20}/></>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="font-black text-blue-600 text-xl flex items-center gap-2 cursor-pointer group" onClick={() => window.location.href = window.location.pathname}>
          <div className="p-2 bg-blue-50 rounded-xl group-hover:rotate-12 transition-transform">
            <Plane size={24} className="rotate-45" />
          </div>
          <span className="tracking-tighter">TRAVELER</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:block text-right">
            <p className="text-xs font-black text-slate-900 leading-none">{tripInfo.city}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{tripInfo.startDate}</p>
          </div>
          <button onClick={() => setShowShareModal(true)} className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors text-slate-600">
            <Share2 size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1200px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
        {/* 左側：天數選擇 */}
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
                  className={`py-3 rounded-2xl font-black text-sm transition-all ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  D{day}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右側：編輯區域 */}
        <div className="lg:col-span-9 space-y-6">
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Day {activeDay}</h2>
                <div className="h-1.5 w-12 bg-blue-600 rounded-full mt-3"></div>
              </div>
              <p className="text-slate-400 font-bold text-sm mb-1">{tripInfo.city}</p>
            </div>

            <form onSubmit={addEntry} className="mb-10 flex flex-wrap md:flex-nowrap gap-3 bg-slate-50 p-3 rounded-3xl">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
                <Clock size={16} className="text-slate-300" />
                <input type="time" value={newEntry.time} onChange={e => setNewEntry({...newEntry, time: e.target.value})} className="bg-transparent font-black text-slate-700 outline-none w-20" />
              </div>
              <input placeholder="今天要在那裡留下回憶？" required value={newEntry.spot} onChange={e => setNewEntry({...newEntry, spot: e.target.value})} className="flex-1 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black hover:bg-black transition-colors shadow-lg shadow-slate-200">加入行程</button>
            </form>

            <div className="space-y-6 relative before:content-[''] before:absolute before:left-[27px] before:top-4 before:bottom-4 before:w-1 before:bg-slate-50">
              {(!itinerary[activeDay] || itinerary[activeDay].length === 0) ? (
                <div className="text-center py-24 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <MapIcon className="text-slate-200" size={32} />
                  </div>
                  <p className="text-slate-400 font-bold">這一天還沒安排行程，<br/>趕快新增一個景點吧！</p>
                </div>
              ) : (
                itinerary[activeDay]?.map((item) => (
                  <div key={item.id} className="relative pl-14 group">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-14 h-14 bg-white border-4 border-slate-50 rounded-2xl flex items-center justify-center text-[10px] font-black text-blue-600 shadow-sm z-10 group-hover:scale-110 transition-transform">
                      {item.time}
                    </div>
                    <div className="p-6 bg-white border border-slate-100 rounded-3xl flex justify-between items-center group-hover:shadow-xl group-hover:shadow-slate-100 transition-all hover:-translate-y-1">
                      <div className="space-y-1">
                        <h4 className="font-black text-slate-800 text-xl tracking-tight">{item.spot}</h4>
                        {item.note && <p className="text-slate-400 text-sm font-medium">{item.note}</p>}
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => {
                            const updatedDay = itinerary[activeDay].filter(i => i.id !== item.id);
                            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
                              [`days.${activeDay}`]: updatedDay
                            });
                         }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                           <Trash2 size={18} />
                         </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 分享彈窗 */}
      {showShareModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[3rem] max-w-md w-full shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Share2 size={24}/></div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">分享行程</h3>
              </div>
              <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X /></button>
            </div>
            
            <p className="text-slate-500 mb-8 font-medium leading-relaxed">您可以將此連結傳送給旅伴，他們將能即時看到您規劃的最新行程。</p>
            
            <div className="flex gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
              <input readOnly value={window.location.href} className="flex-1 bg-transparent px-3 text-[10px] font-mono font-bold text-slate-400 outline-none overflow-hidden text-ellipsis" />
              <button 
                onClick={() => { 
                  try {
                    navigator.clipboard.writeText(window.location.href); 
                  } catch (e) {
                    // 備選方案
                    const input = document.createElement('input');
                    input.value = window.location.href;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                  }
                  setCopySuccess(true); 
                  setTimeout(()=>setCopySuccess(false), 2000); 
                }} 
                className={`px-5 py-3 rounded-xl flex items-center gap-2 font-black transition-all ${copySuccess ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'}`}
              >
                {copySuccess ? <CheckCircle size={18}/> : <Copy size={18}/>}
                <span className="text-xs">{copySuccess ? '已複製' : '複製'}</span>
              </button>
            </div>
            
            <button onClick={() => setShowShareModal(false)} className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-all text-sm">關閉視窗</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;