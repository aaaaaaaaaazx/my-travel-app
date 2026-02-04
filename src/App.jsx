import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
// 修正：驗證相關功能應從 firebase/auth 導入
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
// 修正：Firestore 相關功能應從 firebase/firestore 導入
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  query, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import { 
  MapPin, 
  Calendar, 
  Plus, 
  Trash2, 
  Plane, 
  CheckCircle2, 
  Circle,
  ChevronRight,
  User,
  Loader2,
  AlertCircle
} from 'lucide-react';

// --- Firebase 配置 ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'travel-planner-default';

export default function App() {
  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 表單狀態
  const [newTripDestination, setNewTripDestination] = useState('');
  const [newTripDate, setNewTripDate] = useState('');

  // 1. 驗證生命週期
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("驗證錯誤:", err);
        setError("無法進行驗證，請檢查您的網路連線。");
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. 資料同步（修正後的路徑結構）
  useEffect(() => {
    if (!user) return;

    // 規則 1：特定的路徑結構
    // 集合引用必須有奇數段：
    // 1: artifacts, 2: appId, 3: public, 4: data, 5: trips
    const tripsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'trips');

    const unsubscribe = onSnapshot(
      tripsCollection,
      (snapshot) => {
        const tripData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // 在記憶體中排序（規則 2：不使用複雜的伺服器端查詢）
        tripData.sort((a, b) => new Date(a.date) - new Date(b.date));
        setTrips(tripData);
      },
      (err) => {
        console.error("Firestore 錯誤:", err);
        setError("載入行程時出錯，請再試一次。");
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleAddTrip = async (e) => {
    e.preventDefault();
    if (!newTripDestination || !newTripDate || !user) return;

    try {
      const tripsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
      await addDoc(tripsCollection, {
        destination: newTripDestination,
        date: newTripDate,
        completed: false,
        createdAt: new Date().toISOString(),
        userId: user.uid
      });
      setNewTripDestination('');
      setNewTripDate('');
    } catch (err) {
      setError("新增行程失敗。");
    }
  };

  const toggleTrip = async (trip) => {
    if (!user) return;
    try {
      const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', trip.id);
      await updateDoc(tripRef, { completed: !trip.completed });
    } catch (err) {
      setError("更新行程失敗。");
    }
  };

  const deleteTrip = async (id) => {
    if (!user) return;
    try {
      const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', id);
      await deleteDoc(tripRef);
    } catch (err) {
      setError("刪除行程失敗。");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      {/* 頁首 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Travel Planner</h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            <User className="w-3 h-3" />
            <span className="font-mono">{user?.uid}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto hover:text-red-800">&times;</button>
          </div>
        )}

        {/* 表單 */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8 transition-all hover:shadow-md">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">新增探險</h2>
          <form onSubmit={handleAddTrip} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={newTripDestination}
                onChange={(e) => setNewTripDestination(e.target.value)}
                placeholder="下一個目的地？"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={newTripDate}
                onChange={(e) => setNewTripDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm shadow-blue-200"
            >
              <Plus className="w-4 h-4" />
              規劃行程
            </button>
          </form>
        </div>

        {/* 列表 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">您的行程</h2>
            <span className="text-xs font-medium text-slate-500 bg-slate-200/50 px-2 py-1 rounded-md">
              {trips.length} 個行程
            </span>
          </div>

          {trips.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed p-12 text-center">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">尚未規劃任何行程。</p>
              <p className="text-slate-400 text-sm mt-1">在上方輸入目的地開始您的旅程。</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {trips.map((trip) => (
                <div
                  key={trip.id}
                  className={`group bg-white rounded-xl border p-4 flex items-center gap-4 transition-all hover:border-blue-200 hover:shadow-sm ${
                    trip.completed ? 'opacity-75' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleTrip(trip)}
                    className={`flex-shrink-0 transition-colors ${
                      trip.completed ? 'text-green-500' : 'text-slate-300 hover:text-blue-500'
                    }`}
                  >
                    {trip.completed ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>

                  <div className="flex-grow min-w-0">
                    <h3 className={`font-bold text-slate-800 truncate ${trip.completed ? 'line-through text-slate-400' : ''}`}>
                      {trip.destination}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(trip.date).toLocaleDateString(undefined, {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteTrip(trip.id)}
                    className="flex-shrink-0 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  <ChevronRight className="w-4 h-4 text-slate-200 group-hover:translate-x-1 transition-transform" />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 背景裝飾 */}
      <div className="fixed bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-slate-100/50 to-transparent -z-10 pointer-events-none" />
    </div>
  );
}
