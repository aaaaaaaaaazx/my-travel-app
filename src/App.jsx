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
  collection,
  query
} from 'firebase/firestore';
import { 
  Plane, Calendar, Plus, Trash2, Clock, 
  CheckCircle, AlertCircle, Loader2, X, Globe, ChevronRight,
  ArrowUp, ArrowDown, Edit3, Save, MapPin, Map as MapIcon
} from 'lucide-react';

/**
 * 🚀 行程專注穩定版 (2026.02.05):
 * 1. 功能精簡：移除航班、天氣、匯率分頁，專注行程管理。
 * 2. 權限修復：嚴格遵循登入後才啟動 Firestore 監聽的規則。
 * 3. 資料救援：固定連線至 'travel-yeh'，找回原本行程。
 * 4. 排序優化：支援靈敏的上下移動與原位編輯。
 */

const VERSION_INFO = "最後更新：2026/02/05 11:00 (行程專注修復版)";

// --- Firebase 初始化 ---
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try { return JSON.parse(__firebase_config); } catch (e) { console.error("Config error", e); }
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

// 關鍵：將 appId 指定回 'travel-yeh' 並清洗路徑字串
const appId = (typeof __app_id !== 'undefined' ? __app_id : 'travel-yeh').replace(/\//g, '_');

const App = () => {
  const [view, setView] = useState('home');
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [tripInfo, setTripInfo] = useState({ country: '', city: '', startDate: '', duration: 3 });
  const [itineraryData, setItineraryData] = useState({ days: {} });
  
  // 景點輸入狀態
  const [newSpot, setNewSpot] = useState({ time: '09:00', spot: '', note: '' });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  // 🎨 強力美化樣式注入
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
    const style = document.createElement('style');
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
      html, body, #root { 
        min-height: 100vh !important; 
        width: 100% !important; 
        margin: 0 !important; 
        padding: 0 !important; 
        background-color: #f8fafc !important; 
        font-family: 'Noto Sans TC', sans-serif !important; 
      }
      #root { display: flex !important; flex-direction: column !important; align-items: center !important; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
    `;
    document.head.appendChild(style);
  }, []);

  // 1. 身份驗證 (嚴格遵循 Rule 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth Error", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. 監聽旅程清單 (RULE 1)
  useEffect(() => {
    if (!user) return;
    const tripsRef = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    const unsub = onSnapshot(tripsRef, (snapshot) => {
      const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(tripList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, (err) => console.error("Firestore Permission Denied (Trips):", err));
    return () => unsub();
  }, [user]);

  // 3. 監聽特定旅程細節 (RULE 1)
  useEffect(() => {
    if (!user || !tripId) return;
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setItineraryData({ days: data.days || {} });
        setView('editor');
      }
    }, (err) => console.error("Firestore Permission Denied (Itinerary):", err));

    const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(tripRef, (docSnap) => {
      if (docSnap.exists()) setTripInfo(docSnap.data());
    }, (err) => console.error("Firestore Permission Denied (TripInfo):", err));

    return () => { unsubItin(); unsubTrip(); };
  }, [user, tripId]);

  // 工具函式
  const updateItinField = async (path, value) => {
    if (!user || !tripId) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
        [path]: value
      });
    } catch (err) { console.error("Update failed", err); }
  };

  const getFormattedDate = (baseDate, dayOffset) => {
    if (!baseDate) return "";
    const date = new Date(baseDate);
    date.setDate(date.getDate() + (dayOffset - 1));
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // 操作邏輯
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    const newId = crypto.randomUUID();
    const days = {};
    for (let i = 1; i <= Math.max(1, parseInt(tripInfo.duration)); i++) {
        days[i] = { spots: [] };
    }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', newId), {
        ...tripInfo, creator: user.uid, createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', newId), { days });
      setTripId(newId);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  const addSpot = async (e) => {
    e.preventDefault();
    const currentSpots = itineraryData.days[activeDay]?.spots || [];
    const updated = [...currentSpots, { ...newSpot, id: Date.now().toString() }];
    await updateItinField(`days.${activeDay}.spots`, updated);
    setNewSpot({ time: '09:00', spot: '', note: '' });
  };

  const moveSpot = async (idx, dir) => {
    const spots = [...(itineraryData.days[activeDay]?.spots || [])];
    const target = idx + dir;
    if (target < 0 || target >= spots.length) return;
    [spots[idx], spots[target]] = [spots[target], spots[idx]];
    await updateItinField(`days.${activeDay}.spots`, spots);
  };

  const startEdit = (item) => { setEditingId(item.id); setEditData({ ...item }); };
  const saveEdit = async () => {
    const spots = [...(itineraryData.days[activeDay]?.spots || [])];
    const updated = spots.map(s => s.id === editingId ? editData : s);
    await updateItinField(`days.${activeDay}.spots`, updated);
    setEditingId(null);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
         <Loader2 className="animate-spin text-blue-600" size={48} />
         <p className="text-slate-500 font-bold tracking-widest italic text-center px-6">安全連線建立中...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      {view === 'home' ? (
        /* 首頁視圖 */
        <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-fade-in">
          <div className="text-center mb-16">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0">
              <Plane size={48} />
            </div>
            <h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase">Travel Planner</h1>
            <p className="text-slate-400 font-bold tracking-widest uppercase text-sm italic">找回您的富國島冒險之旅</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-start">
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Plus className="text-blue-600" /> 建立新旅程</h3>
              <form onSubmit={handleCreate} className="bg-white p-10 rounded-[3rem] shadow-xl space-y-8 border border-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">國家</label>
                    <input required placeholder="如: 越南" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">城市</label>
                    <input required placeholder="如: 富國島" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">出發日期</label>
                    <input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">天數</label>
                    <input required type="number" min="1" max="14" placeholder="天數" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} />
                  </div>
                </div>
                <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2">
                  {isLoading ? <Loader2 className="animate-spin" size={24}/> : <><Plus size={24}/> 開始規劃</>}
                </button>
              </form>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600" /> 我的旅程清單 ({trips.length})</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                {trips.map((trip) => (
                  <div key={trip.id} onClick={() => setTripId(trip.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Globe size={24} /></div>
                      <div>
                        <h4 className="text-xl font-black text-slate-800 tracking-tight leading-none">{trip.city} 之旅</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{trip.country} · {trip.startDate}</p>
                      </div>
                    </div>
                    <ChevronRight className="text-slate-200 group-hover:text-blue-600 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-12 text-slate-300 text-[10px] font-bold uppercase tracking-widest">{VERSION_INFO}</div>
        </div>
      ) : (
        /* 編輯器視圖 */
        <div className="w-full flex flex-col items-center pb-24">
          <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-50">
            <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
              <div className="p-2 bg-blue-600 text-white rounded-2xl group-hover:rotate-12 transition-transform shadow-lg"><Plane size={24} className="rotate-45" /></div>
              <span className="tracking-tighter uppercase font-black">Traveler</span>
            </div>
            <div className="text-right">
              <div className="font-black text-slate-800 text-xl leading-none">{tripInfo.city}</div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 inline-block bg-slate-50 px-2 py-0.5 rounded-full">{tripInfo.startDate}</div>
            </div>
          </nav>
          
          <main className="w-full max-w-4xl p-6 md:p-12 animate-fade-in">
            <div className="flex gap-3 overflow-x-auto pb-6 mb-8 scrollbar-hide">
              {Object.keys(itineraryData.days).map(day => (
                <button key={day} onClick={() => {setActiveDay(parseInt(day)); setEditingId(null);}} className={`shrink-0 px-8 py-4 rounded-2xl font-black transition-all border ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-xl scale-105 border-blue-600' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>
                  D{day} · {getFormattedDate(tripInfo.startDate, parseInt(day)).split('/').slice(1).join('/')}
                </button>
              ))}
            </div>

            <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-sm border border-slate-100">
              <div className="flex justify-between items-end mb-10">
                <div><h2 className="text-5xl font-black text-slate-900 italic tracking-tighter leading-none text-center">Day {activeDay}</h2></div>
                <div className="w-16 h-1.5 bg-blue-600 rounded-full mb-2"></div>
              </div>

              <form onSubmit={addSpot} className="mb-10 space-y-3 bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                <div className="flex gap-3 flex-wrap md:flex-nowrap">
                   <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full md:w-auto shadow-sm">
                     <Clock size={18} className="text-blue-500" />
                     <input type="time" value={newSpot.time} onChange={e => setNewSpot({...newSpot, time: e.target.value})} className="bg-transparent font-black outline-none w-24" />
                   </div>
                   <input placeholder="今天要在那裡留下回憶？" required value={newSpot.spot} onChange={e => setNewSpot({...newSpot, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-bold outline-none shadow-sm" />
                </div>
                <div className="flex gap-3">
                   <textarea placeholder="詳細備註 (交通方式、必吃、行程筆記)..." value={newSpot.note} onChange={e => setNewSpot({...newSpot, note: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-medium outline-none h-20 resize-none text-sm shadow-sm" />
                   <button type="submit" className="bg-slate-900 text-white px-8 rounded-xl font-black flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"><Plus size={24}/><span className="text-[10px]">加入</span></button>
                </div>
              </form>

              <div className="space-y-8 relative before:content-[''] before:absolute before:left-[27px] before:top-4 before:bottom-4 before:w-1 before:bg-slate-50">
                {(itineraryData.days[activeDay]?.spots || []).map((item, idx) => (
                  <div key={item.id} className="relative pl-16 group">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
                      <button onClick={() => moveSpot(idx, -1)} disabled={idx === 0} className="text-slate-200 hover:text-blue-600 transition-all disabled:opacity-0 active:scale-125"><ArrowUp size={20}/></button>
                      <div className="w-14 h-14 bg-white border-4 border-slate-50 rounded-2xl flex items-center justify-center text-[10px] font-black text-blue-600 shadow-md group-hover:scale-110 transition-transform">{item.time}</div>
                      <button onClick={() => moveSpot(idx, 1)} disabled={idx === (itineraryData.days[activeDay]?.spots?.length || 0) - 1} className="text-slate-200 hover:text-blue-600 transition-all disabled:opacity-0 active:scale-125"><ArrowDown size={20}/></button>
                    </div>
                    
                    <div className={`p-8 bg-white border rounded-[2.5rem] flex justify-between items-start transition-all shadow-sm ${editingId === item.id ? 'border-blue-500 ring-8 ring-blue-50/50 shadow-2xl' : 'border-slate-100 hover:shadow-xl border-l-8 border-l-transparent hover:border-l-blue-600'}`}>
                      {editingId === item.id ? (
                        <div className="space-y-4 flex-1 animate-fade-in">
                           <div className="flex gap-2"><input type="time" value={editData.time} onChange={e => setEditData({...editData, time: e.target.value})} className="p-3 border rounded-xl font-black text-sm w-32 bg-slate-50 outline-none" /><input value={editData.spot} onChange={e => setEditData({...editData, spot: e.target.value})} className="flex-1 p-3 border rounded-xl font-black text-sm bg-slate-50 outline-none" /></div>
                           <textarea value={editData.note} onChange={e => setEditData({...editData, note: e.target.value})} className="w-full p-3 border rounded-xl text-sm h-24 resize-none bg-slate-50 outline-none" />
                           <div className="flex justify-end gap-3"><button onClick={() => setEditingId(null)} className="text-sm font-bold text-slate-400 px-4">取消</button><button onClick={saveEdit} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-black flex items-center gap-2 shadow-lg"><Save size={16}/> 儲存</button></div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-3"><h4 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">{item.spot}</h4><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black flex items-center gap-1 hover:bg-blue-600 hover:text-white transition-all shadow-sm"><MapPin size={12}/> 地圖</a></div>
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100"><p className="text-slate-500 text-sm italic whitespace-pre-wrap leading-relaxed">{item.note || "點擊右側編輯圖示編修行程..."}</p></div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all ml-4">
                            <button onClick={() => startEdit(item)} className="p-3 text-slate-300 hover:text-blue-500 bg-slate-50 rounded-2xl shadow-sm"><Edit3 size={18}/></button>
                            <button onClick={async () => {
                              const updated = itineraryData.days[activeDay].spots.filter(s => s.id !== item.id);
                              await updateItinField(`days.${activeDay}.spots`, updated);
                            }} className="p-3 text-slate-300 hover:text-red-500 bg-slate-50 rounded-2xl shadow-sm"><Trash2 size={18}/></button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {(!itineraryData.days[activeDay]?.spots || itineraryData.days[activeDay].spots.length === 0) && (
                   <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[3rem]">
                      <Calendar className="text-slate-100 mx-auto mb-6" size={80} />
                      <p className="text-slate-300 font-black text-xl italic text-center">今天還沒有安排任何景點！</p>
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
