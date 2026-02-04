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
  getDoc, 
  onSnapshot, 
  collection,
  updateDoc
} from 'firebase/firestore';
import { 
  MapPin, Calendar, Plus, Trash2, Clock, ChevronRight, ChevronLeft,
  Plane, Save, Map as MapIcon, Navigation, Info, ArrowRight, Wind,
  Globe, Sparkles, Loader2, X, Share2, Copy, CheckCircle
} from 'lucide-react';

// --- Firebase 初始化環境變數 ---
// 使用環境提供的全域變數 __firebase_config 與 __app_id
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'travel-planner-pro';

// Gemini API Key 按照規定設為空字串，環境會自動處理
const geminiApiKey = ""; 

const App = () => {
  const [view, setView] = useState('home');
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [activeDay, setActiveDay] = useState(1);
  const [entryType, setEntryType] = useState('spot');
  
  const [tripInfo, setTripInfo] = useState({
    title: '我的旅遊行程',
    country: '',
    city: '',
    startDate: '',
    duration: 3
  });
  
  const [itinerary, setItinerary] = useState({});
  const [newEntry, setNewEntry] = useState({ 
    time: '', spot: '', note: '', flightNo: '', from: '', to: '' 
  });

  // --- Firebase 驗證邏輯 (遵循規則 3) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Firebase 驗證錯誤:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- 檢查網址參數載入行程 ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      setTripId(id);
      loadTrip(id);
    }
  }, []);

  // --- Firestore 即時同步監聽 (遵循規則 1 & 2) ---
  useEffect(() => {
    if (!user || !tripId) return;

    // 監聽基本資訊
    const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(tripRef, (docSnap) => {
      if (docSnap.exists()) setTripInfo(docSnap.data());
    }, (error) => console.error("行程資訊監聽錯誤:", error));

    // 監聽詳細行程
    const itinRef = doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, (docSnap) => {
      if (docSnap.exists()) {
        setItinerary(docSnap.data().days || {});
        setView('editor');
      }
    }, (error) => console.error("行程細節監聽錯誤:", error));

    return () => { unsubTrip(); unsubItin(); };
  }, [user, tripId]);

  const loadTrip = async (id) => {
    const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', id);
    const snap = await getDoc(tripRef);
    if (snap.exists()) {
      setTripInfo(snap.data());
      setView('editor');
    }
  };

  const handleStartPlanning = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    
    const newId = crypto.randomUUID();
    const durationCount = Math.max(1, parseInt(tripInfo.duration) || 1);
    const initialItin = {};
    for (let i = 1; i <= durationCount; i++) initialItin[i] = [];

    try {
      // 儲存基本資訊 (規則 1)
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', newId), {
        ...tripInfo,
        duration: durationCount,
        creator: user.uid,
        createdAt: new Date().toISOString()
      });
      // 儲存詳細行程 (規則 1)
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', newId), {
        days: initialItin
      });
      
      setTripId(newId);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('id', newId);
      window.history.pushState({}, '', newUrl);
    } catch (err) {
      console.error("建立行程失敗:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addEntry = async (e) => {
    e.preventDefault();
    if (!tripId || !user) return;
    const entry = { ...newEntry, id: Date.now(), type: entryType };
    if (entryType === 'spot' && !entry.spot) return;
    if (entryType === 'flight' && !entry.flightNo) return;

    const updatedDay = [...(itinerary[activeDay] || []), entry].sort((a,b) => a.time.localeCompare(b.time));
    const newItin = { ...itinerary, [activeDay]: updatedDay };
    
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
        days: newItin
      });
      setNewEntry({ time: '', spot: '', note: '', flightNo: '', from: '', to: '' });
    } catch (err) {
      console.error("新增紀錄失敗:", err);
    }
  };

  const deleteEntry = async (id) => {
    if (!tripId || !user) return;
    const updatedDay = itinerary[activeDay].filter(item => item.id !== id);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
        days: { ...itinerary, [activeDay]: updatedDay }
      });
    } catch (err) {
      console.error("刪除失敗:", err);
    }
  };

  const generateAiSuggestions = async () => {
    // 雖然金鑰由環境填充，但呼叫時仍需確認有存取能力
    setIsAiLoading(true);
    const prompt = `請推薦在 ${tripInfo.city}, ${tripInfo.country} 旅遊的 3 個景點。請以繁體中文回答，並嚴格遵循以下 JSON 格式: { "suggestions": [{ "time": "10:00", "spot": "景點名", "note": "景點簡介" }] }`;
    
    // 實作指數退避的 API 呼叫
    const callWithRetry = async (currentAttempt = 0) => {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        if (!res.ok) throw new Error(`API 錯誤: ${res.status}`);
        
        const result = await res.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);
        
        const newSpots = data.suggestions.map(s => ({ ...s, id: Math.random(), type: 'spot' }));
        const updatedDay = [...(itinerary[activeDay] || []), ...newSpots].sort((a,b) => a.time.localeCompare(b.time));
        
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'itineraries', tripId), {
          days: { ...itinerary, [activeDay]: updatedDay }
        });
      } catch (err) {
        if (currentAttempt < 5) {
          const delay = Math.pow(2, currentAttempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
          return callWithRetry(currentAttempt + 1);
        }
        console.error("AI 推薦失敗:", err);
      }
    };

    await callWithRetry();
    setIsAiLoading(false);
  };

  const copyUrl = () => {
    const el = document.createElement('textarea');
    el.value = window.location.href;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full text-center">
          <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl transform rotate-12">
            <Plane size={40} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">開始規劃您的旅程</h1>
          <p className="text-slate-500 mb-10 text-lg">透過雲端即時同步，讓您的旅遊行程永不遺失</p>
          
          <form onSubmit={handleStartPlanning} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 space-y-6 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">目的地國家</label>
                <input required placeholder="例如：日本" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">城市</label>
                <input required placeholder="例如：東京" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">預計出發日</label>
                <input required type="date" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">旅遊總天數</label>
                <input required type="number" min="1" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <button type="submit" disabled={isLoading || !user} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-blue-700 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
              {isLoading ? <Loader2 className="animate-spin" /> : <>立即建立雲端行程 <ArrowRight /></>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white/90 backdrop-blur-md border-b sticky top-0 z-50 h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 font-black text-xl text-blue-600 cursor-pointer" onClick={() => { window.location.search = ''; setView('home'); }}>
          <Plane className="rotate-45" /> <span>TRAVELER</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-widest">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> 同步中
          </div>
          <button onClick={() => setShowShareModal(true)} className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors text-slate-600">
            <Share2 size={20}/>
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左側面板：天數與 AI 助手 */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calendar size={18} className="text-blue-500"/> 行程天數</h3>
            <div className="grid grid-cols-4 gap-2">
              {Object.keys(itinerary).map(day => (
                <button 
                  key={day} 
                  onClick={() => setActiveDay(parseInt(day))} 
                  className={`h-11 rounded-xl font-bold transition-all ${activeDay === parseInt(day) ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  D{day}
                </button>
              ))}
            </div>
          </div>
          <button 
            onClick={generateAiSuggestions} 
            disabled={isAiLoading} 
            className="w-full py-4 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {isAiLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />} ✨ AI 推薦行程
          </button>
        </div>

        {/* 中間：行程編輯區 */}
        <div className="lg:col-span-5 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm min-h-[700px]">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-800">DAY {activeDay}</h2>
              <p className="text-slate-400 font-bold text-xs uppercase mt-1 tracking-widest">{tripInfo.city}, {tripInfo.country}</p>
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setEntryType('spot')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${entryType === 'spot' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>景點</button>
              <button onClick={() => setEntryType('flight')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${entryType === 'flight' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>航班</button>
            </div>
          </div>

          <form onSubmit={addEntry} className="mb-8 p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap gap-3 items-end shadow-inner">
            <div className="flex-1 min-w-[100px]">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">抵達時間</label>
              <input type="time" value={newEntry.time} onChange={e => setNewEntry({...newEntry, time: e.target.value})} className="w-full p-3 rounded-xl border-none shadow-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-[2] min-w-[180px]">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">{entryType === 'spot' ? '景點名稱' : '航班編號'}</label>
              <input placeholder={entryType === 'spot' ? "例如：淺草寺" : "例如：BR198"} value={entryType === 'spot' ? newEntry.spot : newEntry.flightNo} onChange={e => setNewEntry({...newEntry, [entryType === 'spot' ? 'spot' : 'flightNo']: e.target.value})} className="w-full p-3 rounded-xl border-none shadow-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-all shadow-md">加入</button>
          </form>

          <div className="space-y-4">
            {itinerary[activeDay]?.map(item => (
              <div key={item.id} className={`group p-5 rounded-2xl border flex justify-between items-start transition-all hover:shadow-lg ${item.type === 'flight' ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-slate-100'}`}>
                <div className="flex gap-4">
                  <span className="text-sm font-black text-slate-300 mt-1">{item.time}</span>
                  <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      {item.type === 'flight' && <Plane size={14} className="text-blue-500"/>}
                      {item.type === 'flight' ? `航班: ${item.flightNo}` : item.spot}
                    </h4>
                    {item.note && <p className="text-xs text-slate-500 mt-2 italic leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">“ {item.note} ”</p>}
                  </div>
                </div>
                <button onClick={() => deleteEntry(item.id)} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                  <Trash2 size={18}/>
                </button>
              </div>
            ))}
            {(!itinerary[activeDay] || itinerary[activeDay].length === 0) && (
              <div className="text-center py-24 border-2 border-dashed border-slate-100 rounded-[2rem]">
                <Wind className="mx-auto mb-3 opacity-10" size={48} />
                <p className="text-slate-300 font-bold">這天還沒有行程，試試 AI 推薦吧！</p>
              </div>
            )}
          </div>
        </div>

        {/* 右側：地圖視覺化 */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden sticky top-24">
            <div className="p-5 border-b font-bold flex items-center justify-between text-slate-700 bg-slate-50/50">
              <div className="flex items-center gap-2"><MapIcon size={18}/> 地圖概覽</div>
              <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded uppercase">Live</span>
            </div>
            <div className="h-[500px] bg-slate-100 relative">
              <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
              
              {itinerary[activeDay]?.filter(i => i.type === 'spot').map((item, idx) => (
                <div 
                  key={item.id} 
                  className="absolute flex flex-col items-center animate-bounce" 
                  style={{
                    top: `${20 + (idx * 15) % 60}%`, 
                    left: `${20 + (idx * 20) % 60}%`,
                    animationDelay: `${idx * 0.2}s`
                  }}
                >
                  <div className="bg-white px-3 py-1 rounded-full shadow-xl text-[10px] font-bold mb-1 border border-slate-100 whitespace-nowrap">
                    {item.spot}
                  </div>
                  <div className="w-5 h-5 bg-orange-500 rounded-full border-4 border-white shadow-lg"></div>
                </div>
              ))}

              {itinerary[activeDay]?.some(i => i.type === 'flight') && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <div className="w-4/5 h-[2px] border-b-2 border-dashed border-blue-400/30 relative">
                      <Plane size={24} className="text-blue-500 absolute -top-3 left-0 animate-[fly_5s_linear_infinite]" />
                   </div>
                 </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 分享彈窗 */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black flex items-center gap-2"><Share2 className="text-blue-600" /> 分享行程</h3>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X /></button>
            </div>
            <p className="text-slate-500 mb-6 font-medium">複製下方專屬連結傳給旅伴，他們就能在線上即時同步查看行程！</p>
            <div className="flex gap-2">
              <input readOnly value={window.location.href} className="flex-1 bg-slate-50 p-4 rounded-2xl text-xs font-mono text-slate-400 border border-slate-100 focus:ring-0 outline-none" />
              <button onClick={copyUrl} className={`px-6 rounded-2xl font-bold transition-all shadow-md ${copySuccess ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                {copySuccess ? <CheckCircle size={20}/> : <Copy size={20}/>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fly {
          0% { left: -10%; opacity: 0; transform: rotate(45deg); }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 110%; opacity: 0; transform: rotate(45deg); }
        }
      `}</style>
    </div>
  );
};

export default App;