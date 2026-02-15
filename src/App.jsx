import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
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
  deleteDoc,
  collection,
  getDocs
} from 'firebase/firestore';
import { 
  Plane, Calendar, Plus, Trash2, Clock, Share2, 
  Copy, CheckCircle, AlertCircle, Loader2, Sparkles, X, Globe, ChevronRight,
  ArrowUp, ArrowDown, Edit3, Save, MapPin, Map as MapIcon,
  ArrowLeftRight, Settings2, RotateCcw, TrendingUp, DollarSign, CheckCircle2, Search, Circle, Coins, ListChecks,
  Sun, Cloud, CloudRain, CloudLightning, Snowflake, Smartphone, Shirt, Bath, Pill, FileText, Package,
  Calculator, Equal, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, StickyNote, Eye, EyeOff,
  Image as ImageIcon, ExternalLink, Wallet, Utensils, Home, Car, ShoppingBag, MoreHorizontal, Receipt, Check,
  Luggage, Lock, User, LogIn, UserCog, LogOut, UserPlus, ShieldCheck, ShieldAlert, Key, Shield
} from 'lucide-react';

/**
 * 🏆 Travel Planner - 彥麟製作最終黃金基準旗艦版 (2026.02.16)
 * ------------------------------------------------
 * V8.0 訪客模式與分享功能版：
 * 1. 訪客模式：支援透過 URL 參數 (?tripId=...&mode=view) 進入唯讀模式。
 * 2. 分享功能：導覽列新增「分享連結」按鈕，可複製唯讀網址給其他人。
 * 3. 唯讀鎖定：訪客模式下隱藏所有「新增、修改、刪除、勾選」按鈕。
 * 4. 忠於原稿：完全還原 0215a.txt 的天氣、匯率、清單與費用組件。
 * 5. 帳號同步：Admin 進入後台自動補齊 abc 帳號至雲端。
 */

const VERSION_INFO = "旗艦終極穩定版 V8.0 - 2026/02/16 01:25";

// --- 靜態配置與資料 ---
const currencyNames = {
  "TWD": "台灣 - 台幣", "USD": "美國 - 美金", "JPY": "日本 - 日圓", "KRW": "韓國 - 韓元",
  "THB": "泰國 - 泰銖", "VND": "越南 - 越南盾", "HKD": "香港 - 港幣", "EUR": "歐盟 - 歐元",
  "CNY": "中國 - 人民幣", "GBP": "英國 - 英鎊", "SGD": "新加坡 - 新加坡幣", "AUD": "澳洲 - 澳幣"
};

const EXPENSE_CATEGORIES = [
  { id: 'food', name: '餐飲', icon: Utensils, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'stay', name: '住宿', icon: Home, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'transport', name: '交通', icon: Car, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'shopping', name: '購物', icon: ShoppingBag, color: 'text-pink-500', bg: 'bg-pink-50' },
  { id: 'play', name: '娛樂', icon: Sparkles, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { id: 'other', name: '其他', icon: MoreHorizontal, color: 'text-slate-500', bg: 'bg-slate-50' }
];

const CHECKLIST_CATEGORIES = [
  { id: 'cat_3c', name: '3C 產品', icon: Smartphone, items: ['手機', '充電線', '行動電源'] },
  { id: 'cat_clothing', name: '衣物', icon: Shirt, items: ['上衣', '下著', '外套', '襪子'] },
  { id: 'cat_toiletries', name: '盥洗用品', icon: Bath, items: ['洗面乳', '牙刷牙膏', '毛巾'] },
  { id: 'cat_medicine', name: '個人藥品', icon: Pill, items: ['感冒藥', '腸胃藥', 'OK 繃'] },
  { id: 'cat_docs', name: '重要文件', icon: FileText, items: ['護照', '簽證', '住宿憑證'] },
  { id: 'cat_others', name: '其他用品', icon: Package, items: ['雨具', '墨鏡', '鑰匙'] }
];

// --- Firebase 初始化 ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDHfIqjgq0cJ0fCuKlIBQhof6BEJsaYLg0",
  authDomain: "travel-yeh.firebaseapp.com",
  projectId: "travel-yeh",
  storageBucket: "travel-yeh.firebasestorage.app",
  messagingSenderId: "62005891712",
  appId: "1:62005891712:web:4653c17db0c38f981d0c65"
};
const appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const fAuth = getAuth(appInstance);
const fDb = getFirestore(appInstance);
const fAppId = 'travel-yeh';

// --- 工具函數 ---
const getFormattedDate = (baseDate, dayOffset) => {
  if (!baseDate) return "";
  try {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + (dayOffset - 1));
    return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch (e) { return ""; }
};

const getDayOfWeek = (baseDate, dayOffset) => {
  if (!baseDate) return "";
  try {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + (dayOffset - 1));
    return d.toLocaleDateString('zh-TW', { weekday: 'long' });
  } catch (e) { return ""; }
};

const renderTextWithLinks = (text) => {
  if (!text || typeof text !== 'string') return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(/^https?:\/\//)) {
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1 break-all" onClick={e => e.stopPropagation()}>
          連結 <ExternalLink size={12} />
        </a>
      );
    }
    return part;
  });
};

const getWeatherAdvice = (code) => {
  if (code === 0) return { label: "晴天", tips: "紫外線強，建議防曬並補充水分。", icon: Sun, color: "text-orange-500" };
  if (code >= 1 && code <= 3) return { label: "多雲", tips: "天氣舒適，適合戶外活動。", icon: Cloud, color: "text-blue-400" };
  if (code >= 51 && code <= 67) return { label: "有雨", tips: "請隨身攜帶雨具防止淋雨。", icon: CloudRain, color: "text-blue-600" };
  if (code >= 71 && code <= 77) return { label: "下雪", tips: "氣溫極低，請做好充足保暖。", icon: Snowflake, color: "text-cyan-300" };
  if (code >= 95) return { label: "雷雨", tips: "天氣惡劣，建議調整至室內行程。", icon: CloudLightning, color: "text-purple-600" };
  return { label: "多雲時晴", tips: "查看預報調整您的行程規劃。", icon: Cloud, color: "text-blue-400" };
};

// --- 子組件：登入介面 ---
const LoginView = ({ authUser, onLoginSuccess, onAdminSuccess }) => {
  const [acct, setAcct] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [usersDb, setUsersDb] = useState([]);
  const [status, setStatus] = useState('loading');
  const [isAdminPortal, setIsAdminPortal] = useState(false);

  useEffect(() => {
    let active = true;
    const loadAccounts = async () => {
      if (!authUser) return;
      try {
        const snap = await getDocs(collection(fDb, 'artifacts', fAppId, 'public', 'data', 'users_db'));
        if (active) {
          setUsersDb(snap.docs.map(d => d.data()));
          setStatus('ready');
        }
      } catch (e) {
        if (active) setStatus('ready');
      }
    };
    loadAccounts();
    const timeout = setTimeout(() => { if (active) setStatus('ready'); }, 4000);
    return () => { active = false; clearTimeout(timeout); };
  }, [authUser]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (acct === 'yljh' && pwd === 'yljh8320873') {
      onAdminSuccess(); return;
    }
    const match = usersDb.find(u => u.username === acct && u.password === pwd) || (acct === 'abc' && pwd === 'abc');
    if (match) {
      onLoginSuccess();
    } else {
      setErr('帳號或密碼錯誤。');
      setPwd('');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans text-slate-700 overflow-x-hidden">
      <div className="max-w-md w-full animate-fade-in text-center">
        <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-12 shadow-blue-200">
          {isAdminPortal ? <UserCog size={40} /> : <Plane size={40} />}
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{isAdminPortal ? '管理者後台中心' : '歡迎回來'}</h2>
        <p className="text-slate-400 font-bold mt-2 mb-8 text-sm sm:text-base px-4">{isAdminPortal ? '管理帳號授權與系統設定' : '請登入以存取您的雲端旅程'}</p>

        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border border-slate-100 space-y-6 text-left mx-2">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">帳號</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input required type="text" value={acct} onChange={e => setAcct(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-700" placeholder="請輸入帳號" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">密碼</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input required type="password" value={pwd} onChange={e => setPwd(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-700" placeholder="請輸入密碼" />
            </div>
          </div>
          {err && <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl animate-pulse"><AlertCircle size={14} /> {err}</div>}
          <button type="submit" disabled={status === 'loading'} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50">
            {status === 'loading' ? <Loader2 className="animate-spin" /> : <><LogIn size={20} /> 立即進入系統</>}
          </button>
        </form>

        <button onClick={() => { setIsAdminPortal(!isAdminPortal); setErr(''); }} className="mt-8 flex items-center gap-2 text-xs font-black text-blue-600 bg-blue-50 px-8 py-3 rounded-full hover:bg-blue-100 transition-all mx-auto shadow-sm">
          {isAdminPortal ? <User size={14}/> : <Key size={14}/>}
          {isAdminPortal ? '返回一般使用者登入' : '進入管理者通道'}
        </button>
      </div>
    </div>
  );
};

// --- 子組件：管理者後台 ---
const AdminDashboard = ({ authUser, onLogout }) => {
  const [users, setUsers] = useState([]);
  const [newPwd, setNewPwd] = useState('');
  const [newAcct, setNewAcct] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser || !fDb) return;
    const usersRef = collection(fDb, 'artifacts', fAppId, 'public', 'data', 'users_db');
    return onSnapshot(usersRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(data);
      const hasAbc = data.some(u => u.username === 'abc');
      if (!hasAbc && !loading) {
        setDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'users_db', 'abc'), {
          username: 'abc', password: 'abc', createdAt: new Date().toISOString()
        });
      }
      setLoading(false);
    }, (err) => { setLoading(false); });
  }, [authUser]);

  const handleSave = async (e) => {
    e.preventDefault();
    const target = editingUser ? editingUser.username : newAcct;
    if (!target || !newPwd) return;
    await setDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'users_db', target), {
      username: target, password: newPwd, createdAt: editingUser?.createdAt || new Date().toISOString()
    });
    setEditingUser(null); setNewAcct(''); setNewPwd('');
  };

  if (loading) return <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-700"><Loader2 className="animate-spin text-blue-600 mb-4" size={48} /><p className="font-bold text-slate-400 italic">獲取管理權限中...</p></div>;

  return (
    <div className="w-full min-h-screen bg-slate-50 p-4 sm:p-6 md:p-12 animate-fade-in font-sans space-y-8 text-slate-700 overflow-x-hidden">
      <header className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center bg-slate-900 text-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] shadow-2xl gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg"><UserCog size={32} /></div>
          <div><h2 className="text-xl sm:text-2xl font-black tracking-tight text-center sm:text-left">帳號管理系統</h2><p className="text-slate-400 text-xs font-bold uppercase tracking-widest text-center sm:text-left">Admin: yljh</p></div>
        </div>
        <button onClick={onLogout} className="w-full sm:w-auto p-4 bg-white/10 hover:bg-red-500 transition-all rounded-2xl flex items-center justify-center gap-2 font-black text-sm"><LogOut size={20} /> 安全登出</button>
      </header>

      <div className="max-w-5xl mx-auto bg-white p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[4rem] shadow-xl border border-slate-100">
        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><UserPlus size={20} className="text-blue-600" /> {editingUser ? `更新帳號 ${editingUser.username}` : '建立新使用者'}</h3>
        <form onSubmit={handleSave} className="flex flex-col md:flex-row gap-4 items-end">
          {!editingUser && (<div className="w-full flex-1 space-y-1"><label className="text-[10px] font-black text-slate-300 uppercase ml-1">帳號</label><input required placeholder=" traveler_01" value={newAcct} onChange={e => setNewAcct(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none shadow-inner" /></div>)}
          <div className="w-full flex-1 space-y-1"><label className="text-[10px] font-black text-slate-300 uppercase ml-1">密碼</label><input required placeholder="輸入密碼" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none shadow-inner" /></div>
          <div className="flex gap-2 w-full md:w-auto">
            {editingUser && <button type="button" onClick={() => {setEditingUser(null); setNewPwd('');}} className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-400">取消</button>}
            <button type="submit" className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 active:scale-95 transition-all">儲存變更</button>
          </div>
        </form>
      </div>

      <div className="max-w-5xl mx-auto bg-white rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[10px]">
              <tr><th className="px-8 py-5">使用者帳號</th><th className="px-8 py-5">登入密碼</th><th className="px-8 py-5 text-center">操作</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-5 font-black text-slate-700">{u.username}</td>
                  <td className="px-8 py-5 font-mono text-blue-600 font-bold">{u.password}</td>
                  <td className="px-8 py-5 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => { setEditingUser(u); setNewPwd(u.password); }} className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><Edit3 size={18}/></button>
                      <button onClick={async () => { if(confirm('刪除帳號？')) await deleteDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'users_db', u.id)); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- 功能子組件 (還原 0215a.txt 並加上 isGuest 邏輯) ---
const ExpenseMaster = ({ itineraryData, updateItinField, isGuest }) => {
  const expenses = Array.isArray(itineraryData?.expenses) ? itineraryData.expenses : [];
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const totalAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const categoryTotals = useMemo(() => {
    const totals = {}; expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + (parseFloat(e.amount) || 0); });
    return totals;
  }, [expenses]);
  const handleAdd = async (e) => { e.preventDefault(); if(!item || !amount) return; await updateItinField('expenses', [...expenses, { id: Date.now().toString(), item, amount, category: 'food', date: new Date().toISOString() }]); setItem(''); setAmount(''); };
  return (
    <div className="animate-fade-in space-y-8 pb-10 px-4 text-slate-700 overflow-x-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
        <div className="md:col-span-2 bg-white p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] shadow-xl border border-slate-100 flex flex-col justify-center"><h3 className="text-slate-400 font-black text-xs uppercase mb-2 ml-1">旅程總花費</h3><div className="flex items-baseline gap-2 justify-center md:justify-start"><span className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tighter">${totalAmount.toLocaleString()}</span><span className="text-slate-300 font-bold uppercase text-xs">twd</span></div></div>
        <div className="bg-slate-900 p-8 rounded-[2rem] sm:rounded-[3rem] shadow-xl text-white"><h4 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest text-center sm:text-left">分類統計</h4><div className="space-y-3">{EXPENSE_CATEGORIES.map(cat => { const total = categoryTotals[cat.id] || 0; const percent = totalAmount > 0 ? Math.round((total / totalAmount) * 100) : 0; return (<div key={cat.id} className="flex items-center justify-between text-xs font-bold"><div className="flex items-center gap-2"><cat.icon size={14} className={cat.color} /><span>{cat.name}</span></div><span>${total.toLocaleString()} ({percent}%)</span></div>); })}</div></div>
      </div>
      {!isGuest && (
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[4rem] shadow-lg border border-slate-100 text-slate-700"><form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 items-end"><div className="w-full flex-1 space-y-1"><label className="text-[10px] font-black text-slate-400 ml-1">費用內容</label><input required placeholder="項目名稱" value={item} onChange={e => setItem(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none shadow-inner" /></div><div className="w-full sm:w-48 space-y-1"><label className="text-[10px] font-black text-slate-400 ml-1">支出金額</label><input required type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none shadow-inner" /></div><button type="submit" className="w-full sm:w-auto bg-blue-600 text-white p-4 rounded-2xl shadow-xl hover:bg-blue-700 active:scale-95 flex items-center justify-center shrink-0"><Plus size={28}/></button></form></div>
      )}
      <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden"><table className="w-full text-left text-sm text-slate-700"><thead><tr className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest"><th className="px-6 py-4">項目</th><th className="px-6 py-4 text-right">金額</th>{!isGuest && <th className="px-6 py-4 text-center">操作</th>}</tr></thead><tbody className="divide-y divide-slate-100">{expenses.length > 0 ? [...expenses].reverse().map(exp => (<tr key={exp.id} className="hover:bg-slate-50 group transition-colors"><td className="px-6 py-5 font-black text-slate-700">{exp.item}</td><td className="px-6 py-5 text-right font-mono font-black text-slate-800">${parseFloat(exp.amount).toLocaleString()}</td>{!isGuest && <td className="px-6 py-5 text-center"><button onClick={async () => await updateItinField('expenses', expenses.filter(e => e.id !== exp.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button></td>}</tr>)) : (<tr><td colSpan="4" className="px-8 py-20 text-center text-slate-300 font-bold italic tracking-widest">目前尚無費用記錄</td></tr>)}</tbody></table></div>
    </div>
  );
};

const WeatherMaster = ({ tripInfo }) => {
  const defaultEndDate = useMemo(() => {
    if (!tripInfo?.startDate || !tripInfo?.duration) return '';
    try { const d = new Date(tripInfo.startDate); d.setDate(d.getDate() + (parseInt(tripInfo.duration) - 1)); return d.toISOString().split('T')[0]; } catch (e) { return ''; }
  }, [tripInfo]);
  const [q, setQ] = useState({ dest: tripInfo?.city || '', start: tripInfo?.startDate || new Date().toISOString().split('T')[0], end: defaultEndDate });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const fetchWeather = async (e) => {
    if (e) e.preventDefault(); if (!q.dest) return; setLoading(true); setError(null);
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.dest)}&count=1&language=zh&format=json`);
      const geoData = await geoRes.json();
      if (!geoData.results?.length) throw new Error('找不到該地點。');
      const { latitude, longitude, name } = geoData.results[0];
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${q.start}&end_date=${q.end || q.start}`);
      const weatherData = await weatherRes.json();
      setResults({ location: name, daily: (weatherData.daily?.time || []).map((time, i) => ({ date: time, max: weatherData.daily.temperature_2m_max[i], min: weatherData.daily.temperature_2m_min[i], code: weatherData.daily.weather_code[i] })) });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return (
    <div className="animate-fade-in space-y-10 w-full max-w-5xl mx-auto pb-10 px-4 text-slate-700 overflow-x-hidden">
      <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[4rem] shadow-xl border border-slate-100"><h3 className="text-xl sm:text-2xl font-black text-slate-800 mb-8 flex items-center gap-3"><Sun className="text-orange-500" /> 全球精準氣象查詢</h3>
        <form onSubmit={fetchWeather} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end"><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-1">目的地</label><input required value={q.dest} onChange={e => setQ({...q, dest: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none font-bold shadow-inner" /></div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-1">開始日期</label><input required type="date" value={q.start} onChange={e => setQ({...q, start: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none shadow-inner" /></div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-1">結束日期</label><input required type="date" value={q.end} min={q.start} onChange={e => setQ({...q, end: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none shadow-inner" /></div><button type="submit" disabled={loading} className="bg-blue-600 text-white h-[60px] rounded-3xl font-black shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-blue-100">{loading ? <Loader2 className="animate-spin" /> : <Search size={20}/>} 查詢</button></form>
        {error && <p className="mt-4 text-red-500 text-xs font-bold animate-pulse">{error}</p>}
      </div>
      {results && (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{results.daily.map(day => { const advice = getWeatherAdvice(day.code); return (<div key={day.date} className="bg-white p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-lg group transition-transform hover:-translate-y-1"><p className="text-[10px] font-black text-slate-300 mb-4">{day.date}</p><div className="flex justify-between items-start mb-6"><advice.icon size={48} className={advice.color} /><div className="text-right"><p className="text-2xl sm:text-3xl font-black text-slate-800">{Math.round(day.max)}°</p><p className="text-sm font-bold text-slate-300">{Math.round(day.min)}°</p></div></div><div className="bg-slate-50 p-4 rounded-2xl"><p className={`font-black text-sm mb-1 ${advice.color}`}>{advice.label}</p><p className="text-[10px] text-slate-500 leading-relaxed font-bold">{advice.tips}</p></div></div>); })}</div>)}
    </div>
  );
};

const CurrencyMaster = ({ itineraryData, updateItinField }) => {
  const [rates, setRates] = useState({});
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('TWD');
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const customRates = itineraryData?.customRates || {};
  const useCustom = itineraryData?.useCustom || {};
  useEffect(() => { const fetchRates = async () => { setLoading(true); try { const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`); const data = await res.json(); if (data.result === 'success') setRates(data.rates || {}); } catch (err) { console.error(err); } finally { setLoading(false); } }; if (fAuth) fetchRates(); }, [baseCurrency]);
  const handleCalcInput = (val) => { if (val === 'C') setCalcDisplay('0'); else if (val === '=') { try { const cleanDisplay = calcDisplay.replace(/[^-+*/.0-9]/g, ''); if (!cleanDisplay) { setCalcDisplay('0'); return; } const result = new Function(`return ${cleanDisplay}`)(); setCalcDisplay(String(parseFloat(Number(result).toFixed(8)))); } catch (e) { setCalcDisplay('Error'); } } else setCalcDisplay(prev => (prev === '0' || prev === 'Error') ? val : prev + val); };
  const finalRate = (useCustom[targetCurrency] && customRates[targetCurrency]) ? customRates[targetCurrency] : (rates[targetCurrency] || 0);
  const convertedAmount = (amount * finalRate).toFixed(2);
  const filteredCurrencies = Object.keys(currencyNames).filter(c => currencyNames[c].includes(searchTerm) || c.includes(searchTerm.toUpperCase()));
  return (
    <div className="animate-fade-in space-y-8 w-full max-w-5xl mx-auto pb-10 px-4 text-slate-700 overflow-x-hidden">
      <div className="bg-white rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden p-6 sm:p-14 transition-all">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-8 items-center"><div className="lg:col-span-3 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1">輸入金額</label><div className="relative"><DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={24} /><input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} className="w-full pl-14 pr-4 py-6 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none transition-all text-2xl font-black shadow-inner" /><div className="absolute right-4 top-1/2 -translate-y-1/2"><select value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)} className="bg-white border shadow-sm rounded-xl px-2 py-1 text-xs font-black outline-none">{Object.keys(currencyNames).map(curr => <option key={curr} value={curr}>{currencyNames[curr]}</option>)}</select></div></div></div><div className="flex justify-center lg:col-span-1"><button onClick={() => { const t = baseCurrency; setBaseCurrency(targetCurrency); setTargetCurrency(t); }} className="bg-blue-50 p-4 rounded-full text-blue-600 shadow-inner group hover:bg-blue-600 hover:text-white transition-all active:scale-90 shadow-md"><ArrowLeftRight className="lg:rotate-0 rotate-90" size={28} /></button></div><div className="lg:col-span-3 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1">轉換結果</label><div className="w-full pl-8 pr-6 py-5 bg-blue-600 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-blue-100"><div><span className="text-2xl sm:text-3xl font-black tracking-tight">{convertedAmount}</span><p className="text-blue-100 text-[10px] mt-1 font-bold">{currencyNames[targetCurrency]}</p></div><select value={targetCurrency} onChange={e => setTargetCurrency(e.target.value)} className="bg-blue-700 text-white border-none rounded-xl px-3 py-1.5 text-xs font-black outline-none">{Object.keys(currencyNames).map(c => <option key={c} value={c}>{currencyNames[c]}</option>)}</select></div></div></div>
        <div className="mt-8 flex justify-between items-center px-2"><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><TrendingUp size={16} className="text-green-500" /> 匯率已同步</div><button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-black transition-all bg-white border text-slate-600 shadow-sm active:scale-95 shadow-md"><Settings2 size={16} /> 匯率管理</button></div>
      </div>
      {showSettings && (<div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl overflow-hidden animate-fade-in mx-2"><div className="p-6 border-b flex flex-col sm:flex-row justify-between items-center bg-slate-50/50 gap-4"><h3 className="font-black text-xl text-slate-800">自訂匯率</h3><div className="relative w-full sm:w-64"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" placeholder="搜尋..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3 border rounded-2xl text-sm font-bold outline-none shadow-inner" /></div></div><div className="max-h-[400px] overflow-y-auto"><table className="w-full text-left border-collapse text-xs sm:text-sm"><thead className="bg-slate-50 text-slate-400 font-black sticky top-0 uppercase tracking-widest text-[10px]"><tr><th className="px-6 py-4 text-[10px]">幣別</th><th className="px-6 py-4 text-center text-[10px]">模式</th><th className="px-6 py-4 text-right text-[10px]">自訂值</th></tr></thead><tbody className="divide-y divide-slate-50">{filteredCurrencies.map(curr => (<tr key={curr} className="hover:bg-blue-50/20 transition-colors"><td className="px-6 py-4 font-black text-slate-700">{currencyNames[curr]}</td><td className="px-6 py-4 text-center"><button onClick={() => updateItinField(`useCustom.${curr}`, !useCustom[curr])} className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${useCustom[curr] ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{useCustom[curr] ? '手動' : '自動'}</button></td><td className="px-6 py-4 text-right"><input type="number" step="0.0001" disabled={!useCustom[curr]} value={customRates[curr] || ''} onChange={e => updateItinField(`customRates.${curr}`, parseFloat(e.target.value) || 0)} className={`w-20 p-2 border rounded-xl text-right font-bold ${useCustom[curr] ? 'bg-white border-orange-300' : 'bg-slate-50 shadow-inner'}`} /></td></tr>))}</tbody></table></div></div>)}
      <div className="bg-slate-900 text-white p-6 sm:p-12 rounded-[2.5rem] sm:rounded-[4rem] shadow-2xl border border-slate-800 mx-2"><div className="flex items-center gap-3 mb-8 px-2"><div className="p-3 bg-blue-600 rounded-2xl shadow-blue-500/20 shadow-lg"><Calculator size={24} /></div><h4 className="font-black text-xl sm:text-2xl tracking-tight">旅程小計算機</h4></div><div className="bg-black/40 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] mb-10 text-right shadow-inner border border-white/5 overflow-hidden"><span className="text-4xl sm:text-6xl font-black font-mono tracking-tighter text-white block truncate leading-tight">{calcDisplay}</span></div><div className="grid grid-cols-4 gap-3 sm:gap-6">{['7','8','9','/','4','5','6','*','1','2','3','-','0','.','C','+'].map(btn => (<button key={btn} onClick={() => handleCalcInput(btn)} className={`py-5 sm:py-8 rounded-[1rem] sm:rounded-[1.5rem] font-black text-2xl sm:text-3xl transition-all shadow-sm active:scale-95 ${isNaN(btn) && btn !== '.' ? 'bg-blue-600 text-white' : 'bg-white/5 border border-white/5'}`}>{btn}</button>))}<button onClick={() => handleCalcInput('=')} className="col-span-2 py-6 sm:py-8 bg-green-600 text-white rounded-[1.5rem] font-black text-2xl active:scale-95 shadow-lg"><Equal size={32}/></button><button onClick={() => setAmount(parseFloat(calcDisplay) || 0)} className="col-span-2 py-6 sm:py-8 bg-white text-slate-900 rounded-[1.5rem] font-black text-base sm:text-xl active:scale-95 shadow-xl">套用金額</button></div></div>
    </div>
  );
};

const ChecklistMaster = ({ itineraryData, updateItinField, isGuest }) => {
  const checklist = Array.isArray(itineraryData?.checklist) ? itineraryData.checklist : [];
  const [newItemText, setNewItemText] = useState('');
  const [addingToCategory, setAddingToCategory] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemText, setEditItemText] = useState('');
  const groupedItems = useMemo(() => { const g = {}; CHECKLIST_CATEGORIES.forEach(c => g[c.id] = []); checklist.forEach(i => { const cId = i.categoryId || 'cat_others'; if (g[cId]) g[cId].push(i); }); return g; }, [checklist]);
  const progress = checklist.length > 0 ? Math.round((checklist.filter(i => i.completed).length / checklist.length) * 100) : 0;
  return (
    <div className="animate-fade-in space-y-8 w-full max-w-5xl mx-auto pb-10 px-4 text-slate-700 overflow-x-hidden">
      <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] shadow-xl border border-slate-100 text-center mx-2 md:mx-0"><div className="flex flex-col sm:flex-row justify-between items-center md:items-end mb-4 gap-4"><div><h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">行李進度中心</h3><p className="text-sm font-bold text-slate-400">已完成 {checklist.filter(i => i.completed).length} / {checklist.length} 項</p></div><span className="text-5xl sm:text-6xl font-black text-blue-600 italic">{progress}%</span></div><div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${progress}%` }}></div></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">{CHECKLIST_CATEGORIES.map(cat => (<div key={cat.id} className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] shadow-lg border border-slate-50 flex flex-col hover:shadow-xl transition-all mx-2 sm:mx-0"><div className="flex items-center justify-between mb-6"><div className="flex items-center gap-3"><div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><cat.icon size={24} /></div><h4 className="text-lg sm:text-xl font-black text-slate-800">{cat.name}</h4></div>{!isGuest && <button onClick={() => setAddingToCategory(cat.id === addingToCategory ? null : cat.id)} className="p-2 text-slate-300 hover:text-blue-500 transition-colors"><Plus size={20} /></button>}</div>{addingToCategory === cat.id && (<div className="mb-4 flex gap-2 animate-fade-in"><input autoFocus placeholder="新增項目..." value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={e => e.key === 'Enter' && (async () => { const newItem = { id: Date.now().toString(), text: newItemText.trim(), completed: false, categoryId: cat.id }; await updateItinField('checklist', [...checklist, newItem]); setNewItemText(''); setAddingToCategory(null); })()} className="flex-1 p-3 bg-slate-50 border-2 border-blue-100 rounded-xl text-sm font-bold outline-none shadow-inner" /><button onClick={async () => { const newItem = { id: Date.now().toString(), text: newItemText.trim(), completed: false, categoryId: cat.id }; await updateItinField('checklist', [...checklist, newItem]); setNewItemText(''); setAddingToCategory(null); }} className="bg-blue-600 text-white px-4 rounded-xl font-black shadow-md shadow-blue-100"><CheckCircle2 size={18}/></button></div>)}<div className="space-y-3">{(groupedItems[cat.id] || []).map(item => (<div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${item.completed ? 'bg-slate-50 opacity-60' : 'bg-white hover:border-blue-100 shadow-sm'}`}>{editingItemId === item.id ? (<div className="flex items-center gap-2 flex-1"><input autoFocus value={editItemText} onChange={(e) => setEditItemText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (async () => { if (!editItemText.trim()) return; await updateItinField('checklist', checklist.map(i => i.id === item.id ? { ...i, text: editItemText.trim() } : i)); setEditingItemId(null); })()} className="flex-1 p-1 bg-slate-50 border-b-2 border-blue-500 outline-none text-sm font-bold" /><button onClick={async () => { if (!editItemText.trim()) return; await updateItinField('checklist', checklist.map(i => i.id === item.id ? { ...i, text: editItemText.trim() } : i)); setEditingItemId(null); }} className="text-blue-600 hover:bg-blue-50 p-1 rounded-lg transition-colors"><Check size={16}/></button></div>) : (<div className="flex items-center gap-3 flex-1"><div onClick={async () => !isGuest && await updateItinField('checklist', checklist.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i))} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${!isGuest ? 'cursor-pointer' : ''} ${item.completed ? 'bg-green-500 border-green-500 text-white shadow-md' : 'border-slate-200'}`}>{item.completed && <CheckCircle size={14} />}</div><span onClick={() => !isGuest && (async () => await updateItinField('checklist', checklist.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i)))()} className={`text-sm font-bold flex-1 ${!isGuest ? 'cursor-pointer' : ''} ${item.completed ? 'line-through text-slate-400 italic' : 'text-slate-700'}`}>{item.text}</span>{!isGuest && <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => { setEditingItemId(item.id); setEditItemText(item.text); }} className="p-1.5 text-slate-300 hover:text-blue-600 transition-colors"><Edit3 size={14}/></button><button onClick={async () => await updateItinField('checklist', checklist.filter(i => i.id !== item.id))} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button></div>}</div>)}</div>))}</div></div>))}</div>
    </div>
  );
};

// --- 子組件：行程列表 ---
const MainItinerarySection = (props) => (
  <div className="space-y-12 text-slate-700 overflow-x-hidden">
    <div className="flex gap-4 overflow-x-auto pb-4 premium-slider flex-nowrap px-4 sm:px-2">{Object.keys(props.itineraryData?.days || {}).map(day => (<button key={day} onClick={() => { props.setActiveDay(parseInt(day)); props.setEditingId(null); }} className={`shrink-0 w-24 sm:w-28 h-24 sm:h-28 rounded-[1.5rem] sm:rounded-3xl font-black transition-all border flex flex-col items-center justify-center gap-1 shadow-sm ${props.activeDay === parseInt(day) ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-105' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}><span className="text-[10px] sm:text-xs uppercase opacity-60">Day</span><span className="text-2xl sm:text-3xl leading-none">{day}</span><span className="text-[9px] sm:text-[10px] mt-1 font-bold">{getFormattedDate(props.tripInfo.startDate, parseInt(day)).split('/').slice(1).join('/')}</span></button>))}</div>
    <div className="space-y-6 px-4"><div className="flex flex-col md:flex-row md:items-end gap-4"><div className="flex items-center gap-4"><h2 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tighter italic leading-none shrink-0">Day {props.activeDay}</h2><div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner"><button onClick={() => props.moveDay(-1)} disabled={props.activeDay === 1 || props.isGuest} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors"><ArrowLeft size={20}/></button><div className="w-px h-6 bg-slate-200 my-auto"></div><button onClick={() => props.moveDay(1)} disabled={props.activeDay === parseInt(props.tripInfo.duration || "0") || props.isGuest} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors"><ArrowRight size={20}/></button></div></div><div className="flex-1 w-full"><span className="text-base sm:text-lg text-slate-400 font-bold ml-1 mb-1 block tracking-tight">({getFormattedDate(props.tripInfo.startDate, props.activeDay)} {getDayOfWeek(props.tripInfo.startDate, props.activeDay)})</span><input disabled={props.isGuest} className="text-2xl sm:text-4xl font-black text-blue-600 bg-transparent outline-none border-b-2 border-transparent focus:border-blue-200 placeholder:text-slate-200 w-full transition-all disabled:text-slate-700" placeholder="主題..." value={props.itineraryData?.days?.[props.activeDay]?.title || ''} onChange={e => props.updateItinField(`days.${props.activeDay}.title`, e.target.value)} /></div></div><div className="flex justify-center md:justify-start px-4"><button onClick={() => props.setShowAllNotes(!props.showAllNotes)} className={`flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-black transition-all shadow-sm border ${props.showAllNotes ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}>{props.showAllNotes ? <EyeOff size={16} /> : <Eye size={16} />} {props.showAllNotes ? '隱藏備註' : '顯示備註'}</button></div></div>
    <div className="bg-white p-4 sm:p-6 md:p-12 rounded-[2rem] sm:rounded-[4rem] shadow-sm border border-slate-100 mx-2">
      {!props.isGuest && (
        <form onSubmit={async e => { e.preventDefault(); const current = props.itineraryData?.days?.[props.activeDay]?.spots || []; await props.updateItinField(`days.${props.activeDay}.spots`, [...current, { ...props.newSpot, id: Date.now().toString() }]); props.setNewSpot({ time: '09:00', spot: '', note: '', imageUrl: '' }); }} className="mb-12 space-y-4 bg-slate-50 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-100 shadow-inner"><div className="flex flex-col sm:flex-row gap-3"><div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full sm:w-auto shadow-sm shadow-inner"><Clock size={18} className="text-blue-500" /><input type="time" value={props.newSpot.time} onChange={e => props.setNewSpot({...props.newSpot, time: e.target.value})} className="bg-transparent font-black outline-none w-full sm:w-24 text-slate-700" /></div><input placeholder="想去哪裡？" required value={props.newSpot.spot} onChange={e => props.setNewSpot({...props.newSpot, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-bold outline-none shadow-sm shadow-inner text-slate-700" /></div><div className="flex flex-col sm:flex-row gap-3"><div className="w-full sm:w-1/3 flex items-center gap-2 bg-white px-4 py-2 rounded-xl border shadow-sm text-xs font-bold text-slate-400"><ImageIcon size={18} /><input placeholder="圖片網址" value={props.newSpot.imageUrl} onChange={e => props.setNewSpot({...props.newSpot, imageUrl: e.target.value})} className="bg-transparent outline-none w-full" /></div><textarea placeholder="細節備註..." value={props.newSpot.note} onChange={e => props.setNewSpot({...props.newSpot, note: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-medium h-20 resize-none text-sm shadow-sm" /><button type="submit" className="w-full sm:w-auto bg-slate-900 text-white px-8 py-3 sm:py-0 rounded-xl font-black active:scale-95 shadow-lg flex items-center justify-center shrink-0"><Plus size={24}/></button></div></form>
      )}
      <div className="space-y-12 relative before:content-[''] before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-1 before:bg-slate-50 before:rounded-full px-2">
        {(props.itineraryData?.days?.[props.activeDay]?.spots || []).map((item, idx) => {
          const isExpanded = props.showAllNotes || !!props.expandedItems[item.id];
          const isEditing = props.editingId === item.id;
          return (
            <div key={item.id} className="relative pl-14 sm:pl-20 group">
              <div className="absolute left-0 sm:left-[-15px] top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10 scale-90 sm:scale-100">{!props.isGuest && <button onClick={(e) => { e.stopPropagation(); const spots = [...props.itineraryData.days[props.activeDay].spots]; if (idx > 0) { [spots[idx], spots[idx-1]] = [spots[idx-1], spots[idx]]; props.updateItinField(`days.${props.activeDay}.spots`, spots); } }} className="text-slate-200 hover:text-blue-600 transition-colors"><ArrowUp size={20}/></button>}<div className="w-14 sm:w-16 h-14 sm:h-16 bg-white border-4 sm:border-8 border-slate-50 rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center text-[9px] sm:text-[11px] font-black text-blue-600 shadow-md transition-transform group-hover:scale-110">{item.time}</div>{!props.isGuest && <button onClick={(e) => { e.stopPropagation(); const spots = [...props.itineraryData.days[props.activeDay].spots]; if (idx < (props.itineraryData.days[props.activeDay].spots?.length - 1)) { [spots[idx], spots[idx+1]] = [spots[idx+1], spots[idx]]; props.updateItinField(`days.${props.activeDay}.spots`, spots); } }} className="text-slate-200 hover:text-blue-600 transition-colors"><ArrowDown size={20}/></button>}</div>
              <div onClick={() => !isEditing && props.setExpandedItems(prev => ({...prev, [item.id]: !prev[item.id]}))} className={`p-6 sm:p-10 bg-white border rounded-[2rem] sm:rounded-[3rem] transition-all cursor-pointer ${isEditing ? 'border-blue-600 shadow-2xl ring-8 ring-blue-50' : 'border-slate-100 hover:shadow-2xl shadow-sm'}`}>
                {isEditing ? ( 
                  <div className="space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}><div className="flex flex-col sm:flex-row gap-2"><input type="time" value={props.editData.time} onChange={e => props.setEditData({...props.editData, time: e.target.value})} className="p-3 border rounded-xl font-black w-full sm:w-32 bg-slate-50 outline-none" /><input value={props.editData.spot} onChange={e => props.setEditData({...props.editData, spot: e.target.value})} className="flex-1 p-3 border rounded-xl font-black bg-slate-50 outline-none" /></div><input placeholder="圖片網址..." value={props.editData.imageUrl || ''} onChange={e => props.setEditData({...props.editData, imageUrl: e.target.value})} className="w-full p-3 border rounded-xl bg-slate-50 outline-none text-xs font-bold" /><textarea value={props.editData.note} onChange={e => props.setEditData({...props.editData, note: e.target.value})} className="w-full p-3 border rounded-xl h-24 bg-slate-50 outline-none text-sm" /><div className="flex justify-end gap-3"><button onClick={(e) => { e.stopPropagation(); props.setEditingId(null); }} className="text-sm font-bold text-slate-400 px-4">取消</button><button onClick={async (e) => { e.stopPropagation(); const spots = props.itineraryData.days[props.activeDay].spots.map(s => s.id === props.editingId ? props.editData : s); await props.updateItinField(`days.${props.activeDay}.spots`, spots); props.setEditingId(null); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-black shadow-lg">儲存變更</button></div></div>
                ) : ( <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-4 flex-1 w-full text-center sm:text-left">
                      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4"><h4 className="text-xl sm:text-3xl font-black text-slate-800 leading-tight tracking-tight">{item.spot}</h4><div className="flex gap-2"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black shadow-sm shadow-blue-50"><MapPin size={14} /> 地圖</a>{(item.note || item.imageUrl) && <div className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400'}`}><StickyNote size={12}/> {isExpanded ? '展開' : '細節'}</div>}</div></div>
                      {isExpanded && (<div className="bg-slate-50/50 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 space-y-4 animate-fade-in text-left" onClick={e => e.stopPropagation()}>{item.imageUrl && (<div className="relative group/img overflow-hidden rounded-2xl border border-white shadow-sm max-w-md mx-auto sm:mx-0"><img src={item.imageUrl} alt={item.spot} className="w-full max-w-md h-auto rounded-2xl shadow-sm border border-white cursor-zoom-in" onError={e => e.target.style.display='none'} onClick={(e) => { e.stopPropagation(); window.open(item.imageUrl, '_blank'); }} /></div>)}<p className="text-slate-500 text-sm italic whitespace-pre-wrap leading-relaxed">{renderTextWithLinks(item.note) || "暫無說明內容"}</p></div>)}
                    </div>
                    {!props.isGuest && (
                      <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto justify-center"><button onClick={(e) => { e.stopPropagation(); props.setEditingId(item.id); props.setEditData({...item}); }} className="flex-1 sm:flex-none p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all shadow-sm bg-slate-50 sm:bg-transparent"><Edit3 size={20} className="mx-auto"/></button><button onClick={async (e) => { e.stopPropagation(); if(confirm('確定刪除？')) { const updated = props.itineraryData.days[props.activeDay].spots.filter(s => s.id !== item.id); await props.updateItinField(`days.${activeDay}.spots`, updated); } }} className="flex-1 sm:flex-none p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all shadow-sm bg-slate-50 sm:bg-transparent"><Trash2 size={20} className="mx-auto"/></button></div>
                    )}
                </div> )}
              </div>
            </div>
          );
        })}
        {(!props.itineraryData?.days?.[props.activeDay]?.spots?.length) && ( <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[2.5rem] sm:rounded-[3rem]"><Calendar className="text-slate-100 mx-auto mb-6 opacity-20" size={80} /><p className="text-slate-300 font-black text-xl italic text-center px-4">今天還沒有安排任何行程！</p></div> )}
      </div>
    </div>
  </div>
);

// --- 主 App 組件 ---
const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [view, setView] = useState('home');
  const [activeTab, setActiveTab] = useState('itinerary');
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(1);
  const [tripInfo, setTripInfo] = useState({ country: '', city: '', startDate: '', duration: 3 });
  const [itineraryData, setItineraryData] = useState({ days: {}, checklist: [], expenses: [], customRates: {}, useCustom: {} });
  const [newSpot, setNewSpot] = useState({ time: '09:00', spot: '', note: '', imageUrl: '' });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [aiStatus, setAiStatus] = useState({ type: '', message: '' });
  const [showAllNotes, setShowAllNotes] = useState(false); 
  const [expandedItems, setExpandedItems] = useState({}); 

  // 💡 訪客模式偵測：檢查 URL 是否帶有 tripId 與 view 模式
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const guestTripId = params.get('tripId');
    const mode = params.get('mode');
    if (guestTripId && mode === 'view') {
      setTripId(guestTripId);
      setIsLoggedIn(true);
      setIsGuestMode(true);
    }
  }, []);

  const handleShare = () => {
    if (!tripId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?tripId=${tripId}&mode=view`;
    const tempInput = document.createElement('input');
    tempInput.value = shareUrl;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    setAiStatus({ type: 'success', message: '已複製訪客唯讀連結！' });
  };

  useEffect(() => {
    const initAppAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(fAuth, __initial_auth_token);
        } else {
          await signInAnonymously(fAuth);
        }
      } catch (e) { console.error("Root Auth failed", e); }
      finally { setIsLoading(false); }
    };
    initAppAuth();
    const unsubscribe = onAuthStateChanged(fAuth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || (!isLoggedIn && !isAdmin) || isGuestMode) return;
    const tripsRef = collection(fDb, 'artifacts', fAppId, 'public', 'data', 'trips');
    return onSnapshot(tripsRef, (snapshot) => {
      setTrips(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, (err) => { if (err.code === 'permission-denied') console.error("Trips Snap Permission Denied"); });
  }, [user, isLoggedIn, isAdmin, isGuestMode]);

  useEffect(() => {
    if (!user || !tripId || !isLoggedIn) return;
    const itinRef = doc(fDb, 'artifacts', fAppId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, (snap) => {
      if (snap.exists()) {
          const d = snap.data();
          setItineraryData({ days: d.days || {}, checklist: d.checklist || [], expenses: d.expenses || [], customRates: d.customRates || {}, useCustom: d.useCustom || {} });
          setView('editor');
      }
    });
    const tripRef = doc(fDb, 'artifacts', fAppId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(tripRef, (snap) => { if (snap.exists()) setTripInfo(snap.data()); });
    return () => { unsubItin(); unsubTrip(); };
  }, [user, tripId, isLoggedIn]);

  const updateItinField = async (field, value) => {
    if (!user || !tripId || isGuestMode) return;
    try { await updateDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'itineraries', tripId), { [field]: value }); } catch (e) { console.error(e); }
  };

  const moveDay = async (dir) => {
    if (!user || !tripId || isGuestMode) return;
    const days = { ...itineraryData.days };
    const target = activeDay + dir;
    if (target < 1 || target > parseInt(tripInfo.duration || "0")) return;
    const currentData = days[activeDay]; const targetData = days[target];
    days[activeDay] = targetData; days[target] = currentData;
    await updateItinField('days', days);
    setActiveDay(target);
    setAiStatus({ type: 'success', message: '已調換行程順序' });
  };

  const handleCreate = async e => {
    e.preventDefault(); if (!user) return; setIsLoading(true);
    const newId = crypto.randomUUID(); const days = {};
    for (let i = 1; i <= Math.max(1, parseInt(tripInfo.duration)); i++) days[i] = { spots: [] };
    try {
      await setDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'trips', newId), { ...tripInfo, creator: user.uid, createdAt: new Date().toISOString() });
      await setDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'itineraries', newId), { days, checklist: [], expenses: [], customRates: {}, useCustom: {} });
      setTripId(newId);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script'); script.id = 'tailwind-cdn'; script.src = 'https://cdn.tailwindcss.com'; document.head.appendChild(script);
    }
    const style = document.createElement('style'); style.id = 'premium-ui-engine-v7.5';
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
      html, body, #root { min-height: 100vh !important; width: 100% !important; background-color: #f8fafc !important; font-family: 'Noto Sans TC', sans-serif !important; margin: 0; padding: 0; }
      #root { display: flex !important; flex-direction: column !important; align-items: center !important; overflow-x: hidden !important; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .premium-slider { scrollbar-width: thin; scrollbar-color: #2563eb #f1f5f9; }
      @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
    `; 
    document.head.appendChild(style);
  }, []);

  if (!isLoggedIn && !isAdmin) return <LoginView authUser={user} onLoginSuccess={() => setIsLoggedIn(true)} onAdminSuccess={() => setIsAdmin(true)} />;
  if (isAdmin) return <AdminDashboard authUser={user} onLogout={() => setIsAdmin(false)} />;
  if (isLoading) return <div className="flex flex-col items-center justify-center h-screen bg-slate-50"><Loader2 className="animate-spin text-blue-600 mb-2" size={48} /><p className="text-slate-500 font-bold italic tracking-widest leading-none">正在啟動彥麟的冒險引擎...</p></div>;

  return (
    <div className="w-full flex flex-col items-center min-h-screen text-slate-700">
      {aiStatus.message && ( <div className={`fixed top-4 z-[200] px-6 py-3 rounded-2xl shadow-2xl animate-fade-in flex items-center gap-3 border bg-white text-green-600 border-green-100 shadow-green-100`}> <span className="font-bold text-sm">{aiStatus.message}</span><button onClick={() => setAiStatus({ type: '', message: '' })}><X size={14}/></button> </div> )}

      {view === 'home' ? (
        <div className="w-full max-w-5xl px-4 sm:px-6 py-10 sm:py-20 flex flex-col items-center animate-fade-in">
          <div className="text-center mb-10 sm:mb-16"><div className="w-20 sm:w-24 h-20 sm:h-24 bg-blue-600 text-white rounded-[2rem] sm:rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0 shadow-blue-200 shadow-lg"><Plane size={48} /></div><h1 className="text-4xl sm:text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase leading-none">Travel Planner</h1><p className="text-slate-400 font-bold tracking-widest text-xs sm:text-sm italic text-center uppercase">為您的冒險量身打造智能管家 - 彥麟製作</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 w-full items-start px-2 sm:px-4">
            <div className="space-y-6"><h3 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2"><Plus className="text-blue-600" /> 建立新旅程</h3>
              <form onSubmit={handleCreate} className="bg-white p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] shadow-xl space-y-8 border border-white shadow-slate-200">
                <div className="grid grid-cols-2 gap-4 sm:gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 text-[10px]">國家</label><input required placeholder="如: 日本" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm shadow-inner" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 text-[10px]">城市</label><input required placeholder="如: 東京" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm shadow-inner" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} /></div></div>
                <div className="grid grid-cols-2 gap-4 sm:gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 text-[10px]">出發日期</label><input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm shadow-inner" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 text-[10px]">天數</label><input required type="number" min="1" max="14" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm shadow-inner" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} /></div></div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2"><Plus size={24}/> 開始規劃冒險</button>
              </form>
            </div>
            <div className="space-y-6">
              <h3 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600" /> 旅程清單 ({trips.length})</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                {trips.map(trip => (<div key={trip.id} onClick={() => setTripId(trip.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between"><div className="flex items-center gap-4 sm:gap-5"><div className="w-12 sm:w-14 h-12 sm:h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm shadow-inner"><Globe size={24} /></div><div><h4 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">{trip.city} 之旅</h4><p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{trip.country} · {trip.startDate}</p></div></div><ChevronRight className="text-slate-200 group-hover:text-blue-600" /></div>))}
              </div>
            </div>
          </div>
          <div className="mt-12 text-slate-300 text-[10px] font-bold uppercase tracking-widest text-center">{VERSION_INFO}</div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center pb-24 animate-fade-in">
          <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-4 sm:px-10 sticky top-0 z-50 shadow-sm max-w-[100vw] overflow-x-hidden text-slate-700">
            <div className="font-black text-blue-600 text-xl sm:text-2xl flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => window.location.href = window.location.origin + window.location.pathname}><Plane size={24} className="rotate-45" /><span className="tracking-tighter uppercase font-black font-sans hidden xs:inline">Traveler</span></div>
            <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              {['itinerary', 'weather', 'expenses', 'checklist', 'currency'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm shadow-blue-50' : 'text-slate-400 hover:text-slate-600'}`}>{tab === 'itinerary' ? '行程' : tab === 'weather' ? '天氣' : tab === 'expenses' ? '費用' : tab === 'checklist' ? '清單' : '匯率'}</button>
              ))}
            </div>
            <div className="text-right flex items-center gap-3">
              <div className="text-right"><div className="font-black text-slate-800 tracking-tight truncate max-w-[120px] sm:max-w-[180px] leading-none text-sm sm:text-base">{tripInfo.city} 之旅</div><div className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{isGuestMode ? '訪客模式' : tripInfo.startDate}</div></div>
              {!isGuestMode && <button onClick={handleShare} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm bg-white" title="分享訪客連結"><Share2 size={20}/></button>}
              <button onClick={() => { setIsLoggedIn(false); setIsAdmin(false); setIsGuestMode(false); window.location.href = window.location.origin + window.location.pathname; }} className="p-2 text-slate-300 hover:text-red-500 transition-colors shadow-sm bg-white rounded-xl"><LogOut size={20}/></button>
            </div>
          </nav>
          
          <main className="w-full max-w-5xl p-2 sm:p-4 md:p-12 overflow-x-hidden">
            {activeTab === 'itinerary' ? (
              <MainItinerarySection isGuest={isGuestMode} tripInfo={tripInfo} itineraryData={itineraryData} activeDay={activeDay} setActiveDay={setActiveDay} moveDay={moveDay} updateItinField={updateItinField} showAllNotes={showAllNotes} setShowAllNotes={setShowAllNotes} expandedItems={expandedItems} setExpandedItems={setExpandedItems} editingId={editingId} setEditingId={setEditingId} editData={editData} setEditData={setEditData} newSpot={newSpot} setNewSpot={setNewSpot} />
            ) : activeTab === 'weather' ? <WeatherMaster tripInfo={tripInfo} /> : activeTab === 'expenses' ? <ExpenseMaster isGuest={isGuestMode} itineraryData={itineraryData} updateItinField={updateItinField} /> : activeTab === 'checklist' ? <ChecklistMaster isGuest={isGuestMode} itineraryData={itineraryData} updateItinField={updateItinField} /> : <CurrencyMaster itineraryData={itineraryData} updateItinField={updateItinField} /> }
          </main>

          <div className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] p-3 flex justify-around items-center z-[100] shadow-2xl">
            <button onClick={() => setActiveTab('itinerary')} className={`p-4 rounded-2xl transition-all ${activeTab === 'itinerary' ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/20' : 'text-slate-500'}`}><Calendar size={20} /></button>
            <button onClick={() => setActiveTab('weather')} className={`p-4 rounded-2xl transition-all ${activeTab === 'weather' ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/20' : 'text-slate-500'}`}><Sun size={20} /></button>
            <button onClick={() => setActiveTab('expenses')} className={`p-4 rounded-2xl transition-all ${activeTab === 'expenses' ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/20' : 'text-slate-500'}`}><Wallet size={20} /></button>
            <button onClick={() => setActiveTab('checklist')} className={`p-4 rounded-2xl transition-all ${activeTab === 'checklist' ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/20' : 'text-slate-500'}`}><ListChecks size={20} /></button>
            <button onClick={() => setActiveTab('currency')} className={`p-4 rounded-2xl transition-all ${activeTab === 'currency' ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/20' : 'text-slate-500'}`}><Coins size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
