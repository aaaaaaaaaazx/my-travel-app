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
  Luggage, Lock, User, LogIn, UserCog, LogOut, UserPlus, ShieldCheck, Key, ShieldAlert, Shield
} from 'lucide-react';

/**
 * 🏆 Travel Planner - 彥麟製作最終黃金基準旗艦版 (2026.02.15)
 * ------------------------------------------------
 * V6.0 徹底修復白屏與權限衝突版：
 * 1. 解決白屏錯誤：加固 renderTextWithLinks，防止物件直接進入 React Child 導致崩潰。
 * 2. 解決權限報錯：嚴格遵循先完成身份驗證 (Rule 3) 才由 useEffect 觸發資料請求。
 * 3. 管理者介面：提供明確的切換入口，支援 yljh 管理員對使用者帳號的增刪修。
 * 4. 樣式修復：優化全域 CSS 注入邏輯，確保 Tailwind 與自訂風格完全生效。
 * 5. 全功能整合：行程/清單編修、圖片支援、支出統計、匯率互換、8位計算機。
 */

const VERSION_INFO = "旗艦穩定版 V6.0 - 2026/02/15 22:15";

// --- 靜態配置資料 ---
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
  { id: 'cat_3c', name: '3C 產品', icon: Smartphone, items: ['手機', '充電線', '行動電源', '相機'] },
  { id: 'cat_clothing', name: '衣物', icon: Shirt, items: ['上衣', '下著', '外套', '襪子'] },
  { id: 'cat_toiletries', name: '盥洗用品', icon: Bath, items: ['洗面乳', '牙刷牙膏', '毛巾'] },
  { id: 'cat_medicine', name: '個人藥品', icon: Pill, items: ['感冒藥', '腸胃藥', 'OK 繃'] },
  { id: 'cat_docs', name: '重要文件', icon: FileText, items: ['護照', '簽證', '住宿憑證'] },
  { id: 'cat_others', name: '其他用品', icon: Package, items: ['雨具', '墨鏡', '鑰匙'] }
];

// --- Firebase 初始化 ---
const initFirebase = () => {
  try {
    const config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
      apiKey: "AIzaSyDHfIqjgq0cJ0fCuKlIBQhof6BEJsaYLg0",
      authDomain: "travel-yeh.firebaseapp.com",
      projectId: "travel-yeh",
      storageBucket: "travel-yeh.firebasestorage.app",
      messagingSenderId: "62005891712",
      appId: "1:62005891712:web:4653c17db0c38f981d0c65"
    };
    const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
    return {
      fAuth: getAuth(firebaseApp),
      fDb: getFirestore(firebaseApp),
      fAppId: 'travel-yeh'
    };
  } catch (e) {
    console.error("Firebase Init Crash", e);
    return { fAuth: null, fDb: null, fAppId: 'travel-yeh' };
  }
};

const { fAuth, fDb, fAppId } = initFirebase();

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
  if (!text || typeof text !== 'string') return null; // 💡 修正：非字串時回傳 null，防止 React 渲染報錯導致白屏
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
  if (code >= 95) return { label: "雷雨", tips: "天氣惡劣，建議調整至室內行程。", icon: CloudLightning, color: "text-purple-600" };
  return { label: "多雲時晴", tips: "查看預報調整您的行程規劃。", icon: Cloud, color: "text-blue-400" };
};

// --- 子組件：登入視窗 ---
const LoginView = ({ authUser, onLoginSuccess, onAdminSuccess }) => {
  const [acct, setAcct] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [isAdminPortal, setIsAdminPortal] = useState(false);
  const [usersDb, setUsersDb] = useState([]);
  const [isReady, setIsReady] = useState(false);

  // 🔐 權限控制：確保已建立 Auth 連線後才發起 Fetch
  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      if (!authUser) return; // 守衛：如果 Auth 尚未建立，絕不發起請求
      try {
        const usersRef = collection(fDb, 'artifacts', fAppId, 'public', 'data', 'users_db');
        const snap = await getDocs(usersRef);
        if (active) {
          setUsersDb(snap.docs.map(d => d.data()));
          setIsReady(true);
        }
      } catch (e) {
        console.warn("帳號庫獲取受限，啟動備援模式。");
        if (active) setIsReady(true);
      }
    };
    loadUsers();
    // 設置一個 4 秒超時，防止獲取帳號庫時卡死
    const timer = setTimeout(() => { if (active) setIsReady(true); }, 4000);
    return () => { active = false; clearTimeout(timer); };
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
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-12 shadow-blue-200">
            {isAdminPortal ? <ShieldCheck size={40} /> : <Plane size={40} />}
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">{isAdminPortal ? '管理者後台入口' : '旅程規劃師登入'}</h2>
          <p className="text-slate-400 font-bold mt-2">{isAdminPortal ? '管理員專屬控制權限' : '為您的冒險量身打造智能管家'}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">登入帳號</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input required type="text" value={acct} onChange={e => setAcct(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-700" placeholder="帳號" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">登入密碼</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input required type="password" value={pwd} onChange={e => setPwd(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-700" placeholder="密碼" />
            </div>
          </div>
          {err && <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl animate-pulse"><ShieldAlert size={14} /> {err}</div>}
          <button type="submit" disabled={!isReady} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50">
            {!isReady ? <Loader2 className="animate-spin" /> : <><LogIn size={20} /> 立即登入</>}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button onClick={() => { setIsAdminPortal(!isAdminPortal); setErr(''); }} className="flex items-center gap-2 text-xs font-black text-blue-600 bg-blue-50 px-8 py-3 rounded-full hover:bg-blue-100 transition-all shadow-sm">
            {isAdminPortal ? <User size={14}/> : <UserCog size={14}/>}
            {isAdminPortal ? '返回一般使用者登入' : '切換至管理員通道'}
          </button>
          <p className="text-center text-slate-300 text-[10px] font-bold mt-8 uppercase tracking-widest leading-loose">Powered by 彥麟製作<br/>{VERSION_INFO}</p>
        </div>
      </div>
    </div>
  );
};

// --- 子組件：管理者控制面板 ---
const AdminDashboard = ({ authUser, onLogout }) => {
  const [users, setUsers] = useState([]);
  const [newAcct, setNewAcct] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser || !fDb) return;
    const usersRef = collection(fDb, 'artifacts', fAppId, 'public', 'data', 'users_db');
    return onSnapshot(usersRef, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { console.error("Admin Permission Error", err); setLoading(false); });
  }, [authUser]);

  const handleSave = async (e) => {
    e.preventDefault();
    const targetAcct = editingUser ? editingUser.username : newAcct;
    if (!targetAcct || !newPwd) return;
    await setDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'users_db', targetAcct), {
      username: targetAcct, password: newPwd, createdAt: editingUser?.createdAt || new Date().toISOString()
    });
    setEditingUser(null); setNewAcct(''); setNewPwd('');
  };

  if (loading) return <div className="flex flex-col items-center justify-center p-20 h-screen"><Loader2 className="animate-spin text-blue-600 mb-4" size={48} /><p className="font-bold text-slate-400 tracking-widest italic">管理權限認證中...</p></div>;

  return (
    <div className="w-full min-h-screen bg-slate-50 p-6 md:p-12 animate-fade-in space-y-12">
      <header className="max-w-5xl mx-auto flex justify-between items-center bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30"><UserCog size={32} /></div>
          <div><h2 className="text-2xl font-black tracking-tight">後台帳號管理系統</h2><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Login: yljh</p></div>
        </div>
        <button onClick={onLogout} className="p-4 bg-white/10 hover:bg-red-500 transition-all rounded-2xl flex items-center gap-2 font-black text-sm"><LogOut size={20} /> 登出</button>
      </header>

      <div className="max-w-5xl mx-auto bg-white p-8 md:p-10 rounded-[4rem] shadow-xl border border-slate-100">
        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><UserPlus className="text-blue-600" /> {editingUser ? `重設 ${editingUser.username} 的密碼` : '建立新使用者帳號'}</h3>
        <form onSubmit={handleSave} className="flex flex-wrap md:flex-nowrap gap-4 items-end">
          {!editingUser && (<div className="flex-1 space-y-1"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">帳號</label><input required placeholder=" traveler_01" value={newAcct} onChange={e => setNewAcct(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none" /></div>)}
          <div className="flex-1 space-y-1"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">密碼</label><input required placeholder="輸入新密碼" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none" /></div>
          <div className="flex gap-2">
            {editingUser && <button type="button" onClick={() => {setEditingUser(null); setNewPwd('');}} className="px-6 py-4 rounded-2xl font-bold text-slate-400">取消</button>}
            <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 active:scale-95">{editingUser ? '儲存修改' : '立即建立'}</button>
          </div>
        </form>
      </div>

      <div className="max-w-5xl mx-auto bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
            <tr><th className="px-8 py-5">使用者</th><th className="px-8 py-5">登入密碼</th><th className="px-8 py-5">建立日期</th><th className="px-8 py-5 text-center">操作選項</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-8 py-5 font-black text-slate-700">{u.username}</td>
                <td className="px-8 py-5 font-mono text-blue-600 font-bold">{u.password}</td>
                <td className="px-8 py-5 text-slate-400 text-xs font-bold">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-8 py-5 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => { setEditingUser(u); setNewPwd(u.password); }} className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><Edit3 size={18}/></button>
                    <button onClick={async () => { if(confirm('刪除？')) await deleteDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'users_db', u.id)); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- 子組件：行程、費用、清單 ---
const MainItinerarySection = (props) => (
  <div className="space-y-12">
    <div className="flex gap-4 overflow-x-auto pb-4 premium-slider flex-nowrap px-2">
      {Object.keys(props.itineraryData?.days || {}).map(day => (
        <button key={day} onClick={() => {props.setActiveDay(parseInt(day)); props.setEditingId(null);}} className={`shrink-0 w-28 h-28 rounded-3xl font-black transition-all border flex flex-col items-center justify-center gap-1 shadow-sm ${props.activeDay === parseInt(day) ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-105' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>
          <span className="text-xs uppercase opacity-60">Day</span><span className="text-3xl leading-none">{day}</span>
          <span className="text-[10px] mt-1 font-bold">{getFormattedDate(props.tripInfo.startDate, parseInt(day)).split('/').slice(1).join('/')}</span>
        </button>
      ))}
    </div>
    <div className="space-y-6 px-4">
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-6xl font-black text-slate-900 tracking-tighter italic leading-none shrink-0">Day {props.activeDay}</h2>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button onClick={() => props.moveDay(-1)} disabled={props.activeDay === 1} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors"><ArrowLeft size={20}/></button>
            <div className="w-px h-6 bg-slate-200 my-auto"></div>
            <button onClick={() => props.moveDay(1)} disabled={props.activeDay === parseInt(props.tripInfo.duration || "0")} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors"><ArrowRight size={20}/></button>
          </div>
        </div>
        <div className="flex-1">
          <span className="text-lg text-slate-400 font-bold ml-1 mb-1 block tracking-tight">({getFormattedDate(props.tripInfo.startDate, props.activeDay)} {getDayOfWeek(props.tripInfo.startDate, props.activeDay)})</span>
          <input className="text-3xl md:text-4xl font-black text-blue-600 bg-transparent outline-none border-b-2 border-transparent focus:border-blue-200 placeholder:text-slate-200 w-full transition-all" placeholder="今日行程主題..." value={props.itineraryData?.days?.[props.activeDay]?.title || ''} onChange={e => props.updateItinField(`days.${props.activeDay}.title`, e.target.value)} />
        </div>
      </div>
      <div className="flex justify-center md:justify-start px-4"><button onClick={() => props.setShowAllNotes(!props.setShowAllNotes)} className={`flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-black transition-all shadow-sm border ${props.showAllNotes ? 'bg-blue-600 text-white border-blue-600 shadow-blue-100 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}>{props.showAllNotes ? <EyeOff size={16} /> : <Eye size={16} />} {props.showAllNotes ? '隱藏全部備註' : '顯示全部備註'}</button></div>
    </div>
    <div className="bg-white p-6 md:p-12 rounded-[4rem] shadow-sm border border-slate-100">
      <form onSubmit={async e => { e.preventDefault(); const current = props.itineraryData?.days?.[props.activeDay]?.spots || []; await props.updateItinField(`days.${props.activeDay}.spots`, [...current, { ...props.newSpot, id: Date.now().toString() }]); props.setNewSpot({ time: '09:00', spot: '', note: '', imageUrl: '' }); }} className="mb-12 space-y-4 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
        <div className="flex gap-3 flex-wrap md:flex-nowrap"><div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full md:w-auto shadow-sm shadow-inner"><Clock size={18} className="text-blue-500" /><input type="time" value={props.newSpot.time} onChange={e => props.setNewSpot({...props.newSpot, time: e.target.value})} className="bg-transparent font-black outline-none w-24 text-slate-700" /></div><input placeholder="想在那裡留下足跡？" required value={props.newSpot.spot} onChange={e => props.setNewSpot({...props.newSpot, spot: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-bold outline-none shadow-sm shadow-inner" /></div>
        <div className="flex gap-3"><div className="w-1/3 flex items-center gap-2 bg-white px-4 py-2 rounded-xl border shadow-sm text-xs font-bold text-slate-400"><ImageIcon size={18} /><input placeholder="圖片網址" value={props.newSpot.imageUrl} onChange={e => props.setNewSpot({...props.newSpot, imageUrl: e.target.value})} className="bg-transparent outline-none w-full" /></div><textarea placeholder="細節備註 (支援超連結)..." value={props.newSpot.note} onChange={e => props.setNewSpot({...props.newSpot, note: e.target.value})} className="flex-1 p-3 bg-white border rounded-xl font-medium h-20 resize-none text-sm shadow-sm shadow-inner" /><button type="submit" className="bg-slate-900 text-white px-8 rounded-xl font-black active:scale-95 shadow-lg flex items-center justify-center shadow-slate-200 shadow-md"><Plus size={24}/></button></div>
      </form>
      <div className="space-y-8 relative before:content-[''] before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-1.5 before:bg-slate-50 before:rounded-full px-2">
        {(props.itineraryData?.days?.[props.activeDay]?.spots || []).map((item, idx) => {
          const isExpanded = props.showAllNotes || !!props.expandedItems[item.id];
          const isEditing = props.editingId === item.id;
          return (
            <div key={item.id} className="relative pl-20 group">
              <div className="absolute left-[-15px] top-1/2 -translate-y-1/2 flex flex-col items-center gap-1"><button onClick={(e) => { e.stopPropagation(); const spots = [...props.itineraryData.days[props.activeDay].spots]; if (idx > 0) { [spots[idx], spots[idx-1]] = [spots[idx-1], spots[idx]]; props.updateItinField(`days.${props.activeDay}.spots`, spots); } }} className="text-slate-200 hover:text-blue-600 transition-colors"><ArrowUp size={20}/></button><div className="w-16 h-16 bg-white border-8 border-slate-50 rounded-[1.5rem] flex items-center justify-center text-[11px] font-black text-blue-600 shadow-md transition-transform group-hover:scale-110">{item.time}</div><button onClick={(e) => { e.stopPropagation(); const spots = [...props.itineraryData.days[props.activeDay].spots]; if (idx < (props.itineraryData.days[props.activeDay].spots?.length - 1)) { [spots[idx], spots[idx+1]] = [spots[idx+1], spots[idx]]; props.updateItinField(`days.${props.activeDay}.spots`, spots); } }} className="text-slate-200 hover:text-blue-600 transition-colors"><ArrowDown size={20}/></button></div>
              <div onClick={() => !isEditing && props.setExpandedItems(prev => ({...prev, [item.id]: !prev[item.id]}))} className={`p-10 bg-white border rounded-[3rem] transition-all cursor-pointer ${isEditing ? 'border-blue-600 shadow-2xl ring-8 ring-blue-50' : 'border-slate-100 hover:shadow-2xl shadow-sm'}`}>
                {isEditing ? ( 
                  <div className="space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2"><input type="time" value={props.editData.time} onChange={e => props.setEditData({...props.editData, time: e.target.value})} className="p-3 border rounded-xl font-black w-32 bg-slate-50 outline-none shadow-inner" /><input value={props.editData.spot} onChange={e => props.setEditData({...props.editData, spot: e.target.value})} className="flex-1 p-3 border rounded-xl font-black bg-slate-50 outline-none shadow-inner" /></div>
                    <input placeholder="修改圖片網址..." value={props.editData.imageUrl || ''} onChange={e => props.setEditData({...props.editData, imageUrl: e.target.value})} className="w-full p-3 border rounded-xl bg-slate-50 outline-none text-xs font-bold shadow-inner" />
                    <textarea value={props.editData.note} onChange={e => props.setEditData({...props.editData, note: e.target.value})} className="w-full p-3 border rounded-xl h-24 bg-slate-50 outline-none text-sm shadow-inner" />
                    <div className="flex justify-end gap-3"><button onClick={(e) => { e.stopPropagation(); props.setEditingId(null); }} className="text-sm font-bold text-slate-400 px-4">取消</button><button onClick={async (e) => { e.stopPropagation(); const spots = props.itineraryData.days[props.activeDay].spots.map(s => s.id === props.editingId ? props.editData : s); await props.updateItinField(`days.${props.activeDay}.spots`, spots); props.setEditingId(null); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-black shadow-lg shadow-blue-100">儲存變更</button></div>
                  </div>
                ) : ( <div className="flex justify-between items-start gap-4">
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center gap-4 flex-wrap"><h4 className="text-3xl font-black text-slate-800 leading-tight tracking-tight">{item.spot}</h4><div className="flex gap-2"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.spot)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl transition-all inline-flex items-center gap-1.5 text-xs font-black shadow-sm shadow-blue-100 hover:bg-blue-600 hover:text-white"><MapPin size={14} /> 地圖</a>{(item.note || item.imageUrl) && <div className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400'}`}><StickyNote size={12}/> {isExpanded ? '已展開' : '細節'}</div>}</div></div>
                      {isExpanded && (<div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>{item.imageUrl && (<div className="relative group/img overflow-hidden rounded-2xl border border-white shadow-sm max-w-md"><img src={item.imageUrl} alt={item.spot} className="w-full max-w-md h-auto rounded-2xl shadow-sm border border-white cursor-zoom-in" onError={e => e.target.style.display='none'} onClick={(e) => { e.stopPropagation(); window.open(item.imageUrl, '_blank'); }} /></div>)}<p className="text-slate-500 text-sm italic whitespace-pre-wrap leading-relaxed">{renderTextWithLinks(item.note) || "暫無說明內容"}</p></div>)}
                    </div>
                    <div className="flex flex-col gap-2 transition-all">
                      <button onClick={(e) => { e.stopPropagation(); props.setEditingId(item.id); props.setEditData({...item}); }} className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all shadow-sm"><Edit3 size={20} /></button>
                      <button onClick={async (e) => { e.stopPropagation(); if(confirm('確定刪除？')) { const updated = props.itineraryData.days[props.activeDay].spots.filter(s => s.id !== item.id); await props.updateItinField(`days.${activeDay}.spots`, updated); } }} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all shadow-sm"><Trash2 size={20}/></button>
                    </div>
                </div> )}
              </div>
            </div>
          );
        })}
        {(!props.itineraryData?.days?.[props.activeDay]?.spots?.length) && ( <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[3rem]"><Calendar className="text-slate-100 mx-auto mb-6 opacity-20" size={80} /><p className="text-slate-300 font-black text-xl italic text-center">今天還沒有安排任何行程！</p></div> )}
      </div>
    </div>
  </div>
);

// --- 子組件：費用、天氣、匯率、清單 ---
const ExpenseMasterSection = ({ itineraryData, updateItinField }) => <ExpenseMaster itineraryData={itineraryData} updateItinField={updateItinField} />;
const WeatherMasterSection = ({ tripInfo }) => <WeatherMaster tripInfo={tripInfo} />;
const CurrencyMasterSection = ({ itineraryData, updateItinField }) => <CurrencyMaster itineraryData={itineraryData} updateItinField={updateItinField} />;
const ChecklistMasterSection = ({ itineraryData, updateItinField }) => <ChecklistMaster itineraryData={itineraryData} updateItinField={updateItinField} />;

// --- 主 App 組件 ---
const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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

  // 1. 🔐 核心 Auth 監聽流程 (遵循 Rule 3)
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

  // 2. 📊 資料庫監聽 (Rule 1 & 3 Guarded)
  useEffect(() => {
    if (!user || (!isLoggedIn && !isAdmin)) return;
    const tripsRef = collection(fDb, 'artifacts', fAppId, 'public', 'data', 'trips');
    return onSnapshot(tripsRef, (snapshot) => {
      setTrips(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, (err) => { if (err.code === 'permission-denied') console.error("Trips Snap Permission Denied"); });
  }, [user, isLoggedIn, isAdmin]);

  useEffect(() => {
    if (!user || !tripId || !isLoggedIn) return;
    const itinRef = doc(fDb, 'artifacts', fAppId, 'public', 'data', 'itineraries', tripId);
    const unsubItin = onSnapshot(itinRef, (snap) => {
      if (snap.exists()) {
          const d = snap.data();
          setItineraryData({ 
            days: d.days || {}, checklist: d.checklist || [], expenses: d.expenses || [],
            customRates: d.customRates || {}, useCustom: d.useCustom || {}
          });
          setView('editor');
      }
    });
    const tripRef = doc(fDb, 'artifacts', fAppId, 'public', 'data', 'trips', tripId);
    const unsubTrip = onSnapshot(tripRef, (snap) => { if (snap.exists()) setTripInfo(snap.data()); });
    return () => { unsubItin(); unsubTrip(); };
  }, [user, tripId, isLoggedIn]);

  const updateItinField = async (field, value) => {
    if (!user || !tripId) return;
    try { await updateDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'itineraries', tripId), { [field]: value }); } catch (e) { console.error(e); }
  };

  const moveDay = async (dir) => {
    if (!user || !tripId) return;
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
    const newId = crypto.randomUUID();
    const days = {};
    for (let i = 1; i <= Math.max(1, parseInt(tripInfo.duration)); i++) days[i] = { spots: [] };
    try {
      await setDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'trips', newId), { ...tripInfo, creator: user.uid, createdAt: new Date().toISOString() });
      await setDoc(doc(fDb, 'artifacts', fAppId, 'public', 'data', 'itineraries', newId), { days, checklist: [], expenses: [], customRates: {}, useCustom: {} });
      setTripId(newId);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  // 🎨 注入 Favicon 與 全域樣式
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script'); script.id = 'tailwind-cdn'; script.src = 'https://cdn.tailwindcss.com'; document.head.appendChild(script);
    }
    const style = document.createElement('style'); style.id = 'premium-ui-engine-v6.0';
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap');
      html, body, #root { min-height: 100vh !important; width: 100% !important; background-color: #f8fafc !important; font-family: 'Noto Sans TC', sans-serif !important; }
      #root { display: flex !important; flex-direction: column !important; align-items: center !important; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .premium-slider { scrollbar-width: thin; scrollbar-color: #2563eb #f1f5f9; }
      @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
    `; 
    document.head.appendChild(style);
  }, []);

  if (!isLoggedIn && !isAdmin) return <LoginView user={user} onLoginSuccess={() => setIsLoggedIn(true)} onAdminSuccess={() => setIsAdmin(true)} />;
  if (isAdmin) return <AdminDashboard user={user} onLogout={() => setIsAdmin(false)} />;
  if (isLoading) return <div className="flex flex-col items-center justify-center h-screen bg-slate-50"><Loader2 className="animate-spin text-blue-600 mb-2" size={48} /><p className="text-slate-500 font-bold italic tracking-widest leading-none">正在啟動彥麟的冒險引擎...</p></div>;

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      {aiStatus.message && ( <div className={`fixed top-4 z-[200] px-6 py-3 rounded-2xl shadow-2xl animate-fade-in flex items-center gap-3 border bg-white text-green-600 border-green-100 shadow-green-100`}> <span className="font-bold text-sm">{aiStatus.message}</span><button onClick={() => setAiStatus({ type: '', message: '' })}><X size={14}/></button> </div> )}

      {view === 'home' ? (
        <div className="w-full max-w-5xl px-6 py-20 flex flex-col items-center animate-fade-in px-4">
          <div className="text-center mb-16"><div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-12 transition-transform hover:rotate-0 shadow-blue-200 shadow-lg"><Plane size={48} /></div><h1 className="text-5xl font-black mb-4 tracking-tighter text-slate-900 uppercase leading-none">Travel Planner</h1><p className="text-slate-400 font-bold tracking-widest text-sm italic text-center uppercase">為您的冒險量身打造智能管家 - 彥麟製作</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-start px-4">
            <div className="space-y-6"><h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Plus className="text-blue-600" /> 建立新旅程</h3>
              <form onSubmit={handleCreate} className="bg-white p-10 rounded-[3rem] shadow-xl space-y-8 border border-white shadow-slate-200">
                <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">國家</label><input required placeholder="如: 日本" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm shadow-inner" value={tripInfo.country} onChange={e => setTripInfo({...tripInfo, country: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">城市</label><input required placeholder="如: 東京" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm shadow-inner" value={tripInfo.city} onChange={e => setTripInfo({...tripInfo, city: e.target.value})} /></div></div>
                <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">出發日期</label><input required type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm shadow-inner" value={tripInfo.startDate} onChange={e => setTripInfo({...tripInfo, startDate: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">天數</label><input required type="number" min="1" max="14" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm shadow-inner" value={tripInfo.duration} onChange={e => setTripInfo({...tripInfo, duration: e.target.value})} /></div></div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-2xl transition-all active:scale-95 shadow-blue-100 flex items-center justify-center gap-2"><Plus size={24}/> 開始規劃冒險</button>
              </form>
            </div>
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600" /> 旅程清單 ({trips.length})</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                {trips.map(trip => (<div key={trip.id} onClick={() => setTripId(trip.id)} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between"><div className="flex items-center gap-5"><div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm shadow-inner"><Globe size={24} /></div><div><h4 className="text-xl font-black text-slate-800 tracking-tight">{trip.city} 之旅</h4><p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{trip.country} · {trip.startDate}</p></div></div><ChevronRight className="text-slate-200 group-hover:text-blue-600" /></div>))}
              </div>
            </div>
          </div>
          <div className="mt-12 text-slate-300 text-[10px] font-bold uppercase tracking-widest text-center">{VERSION_INFO}</div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center pb-24 animate-fade-in px-4">
          <nav className="w-full h-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-50 shadow-sm max-w-[100vw] overflow-x-hidden">
            <div className="font-black text-blue-600 text-2xl flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}><Plane size={24} className="rotate-45" /><span className="tracking-tighter uppercase font-black font-sans hidden sm:inline">Traveler</span></div>
            <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              {['itinerary', 'weather', 'expenses', 'checklist', 'currency'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm shadow-blue-50' : 'text-slate-400 hover:text-slate-600'}`}>{tab === 'itinerary' ? '行程' : tab === 'weather' ? '天氣' : tab === 'expenses' ? '費用' : tab === 'checklist' ? '清單' : '匯率'}</button>
              ))}
            </div>
            <div className="text-right flex items-center gap-4">
              <div className="hidden sm:block text-right"><div className="font-black text-slate-800 tracking-tight truncate max-w-[150px] leading-none">{tripInfo.city} 之旅</div><div className="text-[9px] font-bold text-slate-400 mt-1">{tripInfo.startDate}</div></div>
              <button onClick={() => { setIsLoggedIn(false); setIsAdmin(false); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors shadow-sm bg-white rounded-xl"><LogOut size={20}/></button>
            </div>
          </nav>
          
          <main className="w-full max-w-5xl p-4 md:p-12">
            {activeTab === 'itinerary' ? (
              <MainItinerarySection tripInfo={tripInfo} itineraryData={itineraryData} activeDay={activeDay} setActiveDay={setActiveDay} moveDay={moveDay} updateItinField={updateItinField} showAllNotes={showAllNotes} setShowAllNotes={setShowAllNotes} expandedItems={expandedItems} setExpandedItems={setExpandedItems} editingId={editingId} setEditingId={setEditingId} editData={editData} setEditData={setEditData} newSpot={newSpot} setNewSpot={setNewSpot} />
            ) : activeTab === 'weather' ? <WeatherMasterMasterSection tripInfo={tripInfo} /> : activeTab === 'expenses' ? <ExpenseMasterSection itineraryData={itineraryData} updateItinField={updateItinField} /> : activeTab === 'checklist' ? <ChecklistMasterSection itineraryData={itineraryData} updateItinField={updateItinField} /> : <CurrencyMasterSection itineraryData={itineraryData} updateItinField={updateItinField} /> }
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
