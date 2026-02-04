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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans text-slate-900">
      {view === 'home' ? (
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl rotate-12">
            <Plane size={40} />
          </div>
          <h1 className="text-4xl font-black mb-10">開始您的旅程</h1>
          <form onSubmit={handleCreate} className="bg-white p-10 rounded-[2.5rem] shadow-2xl space-y-5 text-left border">
            <div className="grid grid-cols-2 gap-4">
              <input required placeholder="國家" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} />
              <input required placeholder="城市" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} />
            </div>
            <input required type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} />
            <input required type="number" min="1" max="14" placeholder="天數" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} />
            <button disabled={isLoading || !user} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg">
              {isLoading ? "建立中..." : "建立雲端行程"}
            </button>
          </form>
        </div>
      ) : (
        <div className="w-full max-w-4xl">
          <nav className="flex justify-between items-center mb-10 bg-white p-6 rounded-3xl shadow-sm border">
            <div className="font-black text-blue-600 text-2xl flex items-center gap-2">
              <Plane size={24} className="rotate-45" /> TRAVELER
            </div>
            <div className="text-right">
              <div className="font-black text-slate-800">{tripInfo.city} 之旅</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{tripInfo.startDate}</div>
            </div>
          </nav>
          <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
             <h2 className="text-4xl font-black mb-10 italic">Day {activeDay}</h2>
             <p className="text-slate-400 font-bold italic">行程資料已連線至 Firebase</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
