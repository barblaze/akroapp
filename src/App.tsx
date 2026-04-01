import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dumbbell, 
  Calendar, 
  User, 
  Shield, 
  Plus, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  X, 
  Instagram, 
  MessageCircle,
  Menu,
  ChevronRight,
  LogOut,
  Zap,
  Copy
} from 'lucide-react';
import { auth, db, googleProvider, handleFirestoreError, OperationType, signInWithEmailAndPassword } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

// --- Types ---
type Role = 'admin' | 'trainer' | 'client';

interface Booking {
  id: string;
  type: 'sala' | 'pt' | 'group';
  day: string;
  time: string;
  nombre: string;
  apellido: string;
  role: Role;
  userId: string;
}

interface UserProfile {
  id: string;
  nombre: string;
  apellido: string;
  role: Role;
}

interface Notification {
  id: string;
  type: 'new-booking' | 'cancel-booking';
  message: string;
  timestamp: number;
}

// --- Constants ---
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const TIMES = [
  '07:00', '08:00', '09:00', '10:00', '11:00', 
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
];

const CAPACITIES = {
  sala: 8,
  pt: 1,
  group: 3
};

const PLANES = [
  { id: 'pl0', name: '2 Días Semanales', price: '$35.000', icon: '⚡', tag: 'Clases grupales · Sala máquinas', feats: ['Acceso 2 días a la semana', 'Clases grupales incluidas', 'Uso de sala de musculación', 'Casillero disponible'] },
  { id: 'pl1', name: '3 Días Semanales', price: '$45.000', icon: '🔥', tag: 'Clases grupales · Sala máquinas', featured: true, feats: ['Acceso 3 días a la semana', 'Todas las clases grupales', 'Sala de máquinas libre', 'Seguimiento mensual', 'Plan nutricional base'] },
  { id: 'pl2', name: '5 Días Semanales', price: '$60.000', icon: '🏆', tag: 'Lunes a viernes · Acceso total', feats: ['Acceso completo lun–vie', 'Prioridad en reserva clases', 'Sala máquinas ilimitada', 'Seguimiento quincenal', 'Descuento en PT'] },
];

const PT_PLANS = [
  { id: 'pt0', name: 'PT 2 Días / Semana', price: '$130.000', icon: '🎯', tag: 'Entrenamiento 1 a 1', feats: ['2 sesiones semanales 1 a 1', 'Programa a medida', 'Control técnico y postural', 'App de seguimiento'] },
  { id: 'pt1', name: 'PT 3 Días / Semana', price: '$170.000', icon: '🚀', tag: 'Resultados acelerados', feats: ['3 sesiones semanales 1 a 1', 'Plan nutricional personalizado', 'Medición composición corporal', 'Chat directo con tu PT', 'Rutinas complementarias'] },
  { id: 'pt2', name: 'PT 5 Días / Semana', price: '$220.000', icon: '👑', tag: 'Transformación absoluta', feats: ['5 sesiones semanales 1 a 1', 'Periodización avanzada', 'Nutrición + suplementación', 'Evaluaciones semanales', 'Acceso prioritario al gym', 'Soporte 24/7 por app'] },
];

// --- Socket Initialization ---
// Socket.io is replaced by Firebase Firestore real-time listeners

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [agenda, setAgenda] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'sala' | 'pt' | 'group'>('sala');
  const [selectedDay, setSelectedDay] = useState('Lun');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);
  
  // New States
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState(false);
  const [staffRole, setStaffRole] = useState<Role>('trainer');
  const [staffUser, setStaffUser] = useState('');
  const [staffPass, setStaffPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedPlanForBank, setSelectedPlanForBank] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [supportMsg, setSupportMsg] = useState('');
  const [view, setView] = useState<'agenda' | 'planes' | 'history'>('agenda');

  const BANK_DETAILS = {
    titular: "Melfig SpA",
    rut: "77.447.603-2",
    banco: "Itaú Chile",
    tipo: "Cuenta Corriente",
    numero: "212532700",
    email: "pagos@akrosport.cl"
  };

  // --- Firebase Auth & Data Sync ---
  useEffect(() => {
    // Local auth persistence
    const savedUser = localStorage.getItem('akro_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsLoggedIn(true);
    }
    setIsAuthReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthReady || !isLoggedIn) return;

    const q = query(collection(db, 'agenda'));
    const unsubscribeAgenda = onSnapshot(q, (snapshot) => {
      const bookings: Booking[] = [];
      snapshot.forEach((doc) => {
        bookings.push({ id: doc.id, ...doc.data() } as Booking);
      });
      setAgenda(bookings);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'agenda');
    });

    return () => unsubscribeAgenda();
  }, [isAuthReady, isLoggedIn]);

  // Notifications logic (simulated with Firestore changes if needed, but keeping it simple for now)
  useEffect(() => {
    if (!isAuthReady || !isLoggedIn || !user) return;
    if (user.role !== 'admin' && user.role !== 'trainer') return;

    // Listen for recent bookings to show notifications
    const q = query(collection(db, 'agenda'), orderBy('timestamp', 'desc'));
    const unsubscribeNotifs = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Only show if it's not the initial load (approximate check)
          if (data.timestamp && (Date.now() - (data.timestamp?.seconds * 1000 || Date.now())) < 10000) {
            const notification: Notification = {
              id: change.doc.id,
              type: 'new-booking',
              message: `Nueva reserva: ${data.nombre} ${data.apellido} en ${data.type} (${data.day} ${data.time})`,
              timestamp: Date.now()
            };
            setNotifications(prev => [notification, ...prev].slice(0, 5));
            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== notification.id));
            }, 5000);
          }
        }
      });
    });

    return () => unsubscribeNotifs();
  }, [isAuthReady, isLoggedIn, user?.role]);

  // --- Handlers ---
  const handleLogin = (role: Role) => {
    const guestUser: UserProfile = {
      id: 'guest_' + Math.random().toString(36).substr(2, 9),
      nombre: 'Cliente',
      apellido: 'Invitado',
      role: 'client'
    };
    setUser(guestUser);
    setIsLoggedIn(true);
    localStorage.setItem('akro_user', JSON.stringify(guestUser));
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const cleanUser = staffUser.trim().toLowerCase();
    const isTrainerCreds = (cleanUser === 'training' || cleanUser === 'traninig') && staffPass === 'akrosport';
    const isAdminCreds = cleanUser === 'admin' && staffPass === 'barblaze';
    
    if (isTrainerCreds || isAdminCreds) {
      const staffProfile: UserProfile = {
        id: isAdminCreds ? 'admin_root' : 'trainer_root',
        nombre: isAdminCreds ? 'Administrador' : 'Entrenador',
        apellido: 'AKRO',
        role: isAdminCreds ? 'admin' : 'trainer'
      };
      setUser(staffProfile);
      setIsLoggedIn(true);
      setIsStaffLoginOpen(false);
      localStorage.setItem('akro_user', JSON.stringify(staffProfile));
    } else {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
    setView('agenda');
    localStorage.removeItem('akro_user');
  };

  const handleBook = (time: string) => {
    if (!user) return;
    setSelectedSlot(time);
    setIsBookingModalOpen(true);
  };

  const confirmBooking = async () => {
    if (!user || !selectedSlot) return;
    
    const newBooking = {
      type: activeTab,
      day: selectedDay,
      time: selectedSlot,
      nombre: user.nombre,
      apellido: user.apellido,
      userId: user.id,
      role: user.role,
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'agenda'), newBooking);
      setIsBookingModalOpen(false);
      setSelectedSlot(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'agenda');
    }
  };

  const handleCancel = async (bookingId: string) => {
    try {
      await deleteDoc(doc(db, 'agenda', bookingId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `agenda/${bookingId}`);
    }
  };

  const handleSupportSubmit = () => {
    const whatsappUrl = `https://wa.me/56956802641?text=${encodeURIComponent(`Soporte AKROSPORT: ${supportMsg}`)}`;
    window.open(whatsappUrl, '_blank');
    setIsSupportOpen(false);
    setSupportMsg('');
  };

  const handlePlanInterest = (planName: string) => {
    setSelectedPlanForBank(planName);
    setIsBankModalOpen(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // --- Helpers ---
  const getBookingsForSlot = (day: string, time: string, type: string) => {
    return agenda.filter(b => b.day === day && b.time === time && b.type === type);
  };

  const myHistory = useMemo(() => {
    return agenda.filter(b => b.userId === user?.id).sort((a, b) => b.id.localeCompare(a.id));
  }, [agenda, user?.id]);

  const canManage = user?.role === 'admin' || user?.role === 'trainer';

  // --- Render ---
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-lime/20 border-t-lime rounded-full animate-spin mb-6" />
        {authTimeout && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xs"
          >
            <p className="text-white/40 text-xs font-mono uppercase tracking-widest mb-4">La conexión está tardando más de lo esperado</p>
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-6 py-3 bg-white/5 border border-white/10 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-white/10 transition-all rounded-xl"
            >
              Abrir en nueva pestaña
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-hidden">
        {/* Atmospheric Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-lime/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-lime/5 blur-[120px] rounded-full" />
          <div className="absolute inset-0 bg-grain opacity-[0.03]" />
        </div>
        
        {/* Admin Login Corner Button */}
        <button 
          onClick={() => {
            setStaffRole('admin');
            setIsStaffLoginOpen(true);
          }}
          className="absolute top-8 right-8 w-12 h-12 bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center rounded-full hover:border-lime/50 hover:bg-white/10 transition-all group z-50"
          title="Acceso Administración"
        >
          <Shield className="text-white/30 group-hover:text-lime group-hover:scale-110 transition-all" size={20} />
        </button>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md z-10"
        >
          <div className="text-center mb-16">
            <motion.div 
              initial={{ rotate: -45, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-lime rounded-2xl mb-8 shadow-[0_0_40px_rgba(200,255,0,0.3)]"
            >
              <Dumbbell className="text-void w-10 h-10" />
            </motion.div>
            <h1 className="text-6xl font-bold font-sans tracking-tighter mb-3">
              AKRO<span className="text-lime text-glow">SPORT</span>
            </h1>
            <div className="flex items-center justify-center gap-3">
              <div className="h-[1px] w-8 bg-white/10" />
              <p className="text-white/40 font-mono text-[10px] uppercase tracking-[0.4em]">Performance Lab</p>
              <div className="h-[1px] w-8 bg-white/10" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="mb-8 p-4 bg-lime/5 border border-lime/20 rounded-2xl text-center">
              <p className="text-[10px] text-lime font-mono uppercase tracking-widest">¿Problemas para iniciar sesión?</p>
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="mt-2 text-[10px] text-white/60 hover:text-white underline underline-offset-4 font-mono uppercase tracking-widest"
              >
                Abrir app en nueva pestaña
              </button>
            </div>

            <button 
              onClick={() => {
                handleLogin('client');
                setView('planes');
              }}
              className="w-full bg-white/[0.02] backdrop-blur-md border border-white/10 p-8 flex items-center gap-6 hover:border-lime/40 hover:bg-white/[0.05] transition-all group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-lime/0 via-lime/[0.02] to-lime/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <div className="w-14 h-14 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-lime/20 transition-colors border border-white/5">
                <Zap className="text-white/60 group-hover:text-lime transition-colors" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-xl tracking-tight">Ver Planes y Precios</h3>
                <p className="text-white/30 text-xs font-mono uppercase tracking-wider mt-1">Membresías y PT</p>
              </div>
              <ChevronRight className="ml-auto text-white/20 group-hover:text-lime group-hover:translate-x-1 transition-all" />
            </button>

            <button 
              onClick={() => handleLogin('client')}
              className="w-full bg-white/[0.02] backdrop-blur-md border border-white/10 p-8 flex items-center gap-6 hover:border-lime/40 hover:bg-white/[0.05] transition-all group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-lime/0 via-lime/[0.02] to-lime/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <div className="w-14 h-14 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-lime/20 transition-colors border border-white/5">
                <User className="text-white/60 group-hover:text-lime transition-colors" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-xl tracking-tight">Acceso Cliente</h3>
                <p className="text-white/30 text-xs font-mono uppercase tracking-wider mt-1">Entrar a la Agenda</p>
              </div>
              <ChevronRight className="ml-auto text-white/20 group-hover:text-lime group-hover:translate-x-1 transition-all" />
            </button>

            <button 
              onClick={() => {
                setStaffRole('trainer');
                setIsStaffLoginOpen(true);
              }}
              className="w-full bg-white/[0.02] backdrop-blur-md border border-white/10 p-8 flex items-center gap-6 hover:border-lime/40 hover:bg-white/[0.05] transition-all group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-lime/0 via-lime/[0.02] to-lime/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <div className="w-14 h-14 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-lime/20 transition-colors border border-white/5">
                <Zap className="text-white/60 group-hover:text-lime transition-colors" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-xl tracking-tight">Entrenadores</h3>
                <p className="text-white/30 text-xs font-mono uppercase tracking-wider mt-1">Acceso Staff</p>
              </div>
              <ChevronRight className="ml-auto text-white/20 group-hover:text-lime group-hover:translate-x-1 transition-all" />
            </button>

            <div className="flex items-center justify-center gap-4 pt-8">
              <a 
                href="https://www.instagram.com/akrosport_?" 
                target="_blank" 
                className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center rounded-2xl text-white/40 hover:border-pink-500 hover:text-pink-500 transition-all"
              >
                <Instagram size={20} />
              </a>
              <a 
                href="https://wa.me/56956802641" 
                target="_blank"
                className="w-12 h-12 bg-green-500/10 border border-green-500/20 flex items-center justify-center rounded-2xl text-green-500 hover:bg-green-500 hover:text-white transition-all shadow-lg shadow-green-500/10"
              >
                <MessageCircle size={20} />
              </a>
            </div>
          </div>
        </motion.div>

        {/* Staff Login Modal */}
        <AnimatePresence>
          {isStaffLoginOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsStaffLoginOpen(false)}
                className="absolute inset-0 bg-void/95 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-sm bg-surface border border-white/10 p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-3xl"
              >
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-16 h-16 bg-lime/10 rounded-full flex items-center justify-center mb-4 border border-lime/20">
                    {staffRole === 'admin' ? <Shield className="text-lime" size={32} /> : <Zap className="text-lime" size={32} />}
                  </div>
                  <h3 className="text-2xl font-bold uppercase tracking-tighter">Acceso {staffRole === 'admin' ? 'Admin' : 'Staff'}</h3>
                  <p className="text-white/30 text-[10px] font-mono uppercase tracking-[0.2em] mt-2">Ingresa tus credenciales</p>
                </div>
                <form onSubmit={handleStaffSubmit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-2 block">Nombre de Usuario</label>
                    <input 
                      type="text"
                      value={staffUser}
                      onChange={(e) => setStaffUser(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 p-4 text-white focus:border-lime outline-none transition-all rounded-xl"
                      placeholder="Ej: admin o training"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-2 block">Contraseña</label>
                    <input 
                      type="password"
                      value={staffPass}
                      onChange={(e) => setStaffPass(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 p-4 text-white focus:border-lime outline-none transition-all rounded-xl"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-lime text-void py-4 font-bold uppercase text-sm tracking-widest hover:brightness-110 transition-all shadow-[0_0_20px_rgba(200,255,0,0.2)] rounded-xl mt-4"
                  >
                    Acceder al Panel
                  </button>
                  {loginError && (
                    <motion.p 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-500 text-[10px] font-mono uppercase text-center mt-4 bg-red-500/10 p-3 rounded-lg border border-red-500/20"
                    >
                      {loginError}
                    </motion.p>
                  )}
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void pb-24 safe-area-inset-bottom">
      <div className="absolute inset-0 bg-grain pointer-events-none" />

      {/* --- Notifications --- */}
      <div className="fixed top-24 right-8 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9, transition: { duration: 0.2 } }}
              className={`p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border backdrop-blur-2xl pointer-events-auto max-w-sm rounded-2xl ${
                n.type === 'new-booking' 
                ? 'bg-lime/90 border-lime text-void' 
                : 'bg-red-500/90 border-red-500 text-white'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${n.type === 'new-booking' ? 'bg-void/10' : 'bg-white/10'}`}>
                  {n.type === 'new-booking' ? <CheckCircle2 size={16} /> : <X size={16} />}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black leading-tight uppercase tracking-tight">{n.message}</p>
                  <p className="text-[9px] font-mono mt-2 opacity-60 font-bold">
                    {new Date(n.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                  className="opacity-40 hover:opacity-100 transition-opacity p-1"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* --- Header --- */}
      <header className="sticky top-0 z-50 bg-void/60 backdrop-blur-2xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setView('agenda')}>
          <div className="w-10 h-10 bg-lime rounded-xl rotate-12 group-hover:rotate-0 transition-transform duration-500 flex items-center justify-center shadow-[0_0_20px_rgba(200,255,0,0.2)]">
            <span className="text-void font-black text-sm -rotate-12 group-hover:rotate-0 transition-transform duration-500">A</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold tracking-tighter leading-none">AKRO<span className="text-lime">SPORT</span></h2>
            <span className="text-[8px] font-mono text-white/20 uppercase tracking-[0.3em] mt-1">Performance Lab</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <button 
            onClick={() => setView('agenda')}
            className={`text-[10px] font-mono uppercase tracking-[0.3em] font-bold transition-all ${view === 'agenda' ? 'text-lime' : 'text-white/40 hover:text-white'}`}
          >
            Agenda
          </button>
          <button 
            onClick={() => setView('planes')}
            className={`text-[10px] font-mono uppercase tracking-[0.3em] font-bold transition-all ${view === 'planes' ? 'text-lime' : 'text-white/40 hover:text-white'}`}
          >
            Planes
          </button>
          <button 
            onClick={() => setView('history')}
            className={`text-[10px] font-mono uppercase tracking-[0.3em] font-bold transition-all ${view === 'history' ? 'text-lime' : 'text-white/40 hover:text-white'}`}
          >
            Historial
          </button>
        </nav>
        
        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex md:hidden items-center gap-2 mr-2">
            <a 
              href="https://www.instagram.com/akrosport_?" 
              target="_blank" 
              className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center rounded-xl text-white/40 hover:text-pink-500 transition-all"
            >
              <Instagram size={18} />
            </a>
            <a 
              href="https://wa.me/56956802641" 
              target="_blank"
              className="w-10 h-10 bg-green-500/20 border border-green-500/30 flex items-center justify-center rounded-xl text-green-500 hover:bg-green-500 hover:text-white transition-all"
            >
              <MessageCircle size={18} />
            </a>
          </div>
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-mono text-lime uppercase tracking-widest font-bold">{user?.role}</span>
            <span className="text-sm font-bold tracking-tight">{user?.nombre} {user?.apellido}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 border border-white/5 hover:border-red-500/20 transition-all group"
            title="Cerrar Sesión"
          >
            <LogOut size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="max-w-5xl mx-auto p-6 relative z-10">
        
        {view === 'agenda' && (
          <>
            <section className="mb-16">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.02] backdrop-blur-md border border-white/10 p-10 relative overflow-hidden rounded-3xl"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-lime/10 blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-2 bg-lime rounded-full shadow-[0_0_10px_#c8ff00]" />
                    <span className="text-[10px] font-mono text-lime uppercase tracking-[0.4em] font-bold">Elite Performance Lab</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-[0.9] uppercase tracking-tighter">
                    Lleva tu cuerpo <br /> <span className="text-lime text-glow italic">al siguiente nivel</span>
                  </h1>
                  <p className="text-white/40 max-w-lg text-sm leading-relaxed font-medium">
                    Sincronización en tiempo real para atletas que no aceptan excusas. Gestiona tus sesiones con precisión milimétrica.
                  </p>
                  <div className="mt-8 flex items-center gap-4">
                    <button 
                      onClick={() => setView('planes')}
                      className="px-8 py-4 bg-lime text-void font-bold uppercase text-xs tracking-[0.2em] rounded-xl hover:brightness-110 transition-all shadow-[0_10px_30px_rgba(200,255,0,0.2)]"
                    >
                      Ver Planes y Precios
                    </button>
                    <button 
                      onClick={() => {
                        const element = document.getElementById('agenda-grid');
                        element?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold uppercase text-xs tracking-[0.2em] rounded-xl hover:bg-white/10 transition-all"
                    >
                      Reservar Ahora
                    </button>
                  </div>
                </div>
              </motion.div>
            </section>

            <div id="agenda-grid" className="grid grid-cols-3 gap-3 mb-10">
              {(['sala', 'pt', 'group'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`p-6 flex flex-col items-center gap-3 border transition-all relative overflow-hidden group ${
                    activeTab === type 
                    ? 'bg-lime border-lime text-void shadow-[0_0_30px_rgba(200,255,0,0.15)]' 
                    : 'bg-white/[0.02] border-white/5 text-white/30 hover:border-white/20'
                  }`}
                >
                  <div className={`transition-transform duration-500 group-hover:scale-110 ${activeTab === type ? 'text-void' : 'text-white/40'}`}>
                    {type === 'sala' && <Dumbbell size={24} />}
                    {type === 'pt' && <Zap size={24} />}
                    {type === 'group' && <User size={24} />}
                  </div>
                  <span className="text-[10px] font-mono uppercase font-black tracking-widest">
                    {type === 'sala' ? 'Sala Máquinas' : type === 'pt' ? 'Personal' : 'Small Group'}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
              {DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-shrink-0 px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest border transition-all ${
                    selectedDay === day 
                    ? 'border-lime text-lime bg-lime/5' 
                    : 'border-white/5 text-white/40 hover:border-white/10'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {TIMES.map((time) => {
                const bookings = getBookingsForSlot(selectedDay, time, activeTab);
                const capacity = CAPACITIES[activeTab];
                const isFull = bookings.length >= capacity;
                const isBookedByMe = bookings.some(b => b.userId === user?.id);

                return (
                  <motion.div
                    key={time}
                    layout
                    className={`flex items-stretch border rounded-2xl transition-all overflow-hidden ${
                      isFull 
                      ? 'border-red-500/10 bg-red-500/[0.02] opacity-50' 
                      : isBookedByMe
                      ? 'border-lime/30 bg-lime/[0.03]'
                      : 'border-white/5 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="w-24 flex items-center justify-center border-r border-white/5 font-mono text-base font-black py-6 bg-white/[0.02]">
                      {time}
                    </div>
                    
                    <div className="flex-1 p-5 flex items-center justify-between">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono font-black uppercase px-2.5 py-1 rounded-md border ${
                            isFull ? 'border-red-500/30 text-red-500 bg-red-500/10' : 'border-white/10 text-white/30 bg-white/5'
                          }`}>
                            {isFull ? 'Completo' : `${capacity - bookings.length} Disponibles`}
                          </span>
                          {isBookedByMe && (
                            <span className="text-[9px] font-mono font-black uppercase px-2.5 py-1 bg-lime text-void rounded-md shadow-[0_0_15px_rgba(200,255,0,0.3)]">
                              Reservado
                            </span>
                          )}
                        </div>
                        
                        {canManage && bookings.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {bookings.map(b => (
                              <div key={b.id} className="group relative">
                                <span className="text-[9px] font-mono bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-white/60">
                                  {b.nombre} {b.apellido}
                                  {canManage && (
                                    <button 
                                      onClick={() => handleCancel(b.id)}
                                      className="text-red-500 hover:text-red-400 transition-colors"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {!isFull && !isBookedByMe && (
                        <button 
                          onClick={() => handleBook(time)}
                          className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-lime hover:text-void hover:border-lime transition-all group"
                        >
                          <Plus size={20} className="group-hover:scale-125 transition-transform" />
                        </button>
                      )}

                      {isBookedByMe && (
                        <button 
                          onClick={() => handleCancel(bookings.find(b => b.userId === user?.id)!.id)}
                          className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all group"
                        >
                          <X size={20} className="group-hover:scale-125 transition-transform" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {view === 'planes' && (
          <div className="space-y-20">
            <section>
              <div className="flex flex-col items-center text-center mb-12">
                <h2 className="text-4xl font-bold uppercase tracking-tighter mb-2">Membresías</h2>
                <p className="text-white/30 text-[10px] font-mono uppercase tracking-[0.3em]">Acceso Elite a nuestras instalaciones</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANES.map(p => (
                  <div key={p.id} className={`bg-white/[0.02] backdrop-blur-md border p-8 relative flex flex-col rounded-2xl transition-all hover:translate-y-[-4px] ${p.featured ? 'border-lime shadow-[0_0_40px_rgba(200,255,0,0.1)]' : 'border-white/5'}`}>
                    {p.featured && <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-lime text-void text-[10px] font-black px-4 py-1 uppercase tracking-widest rounded-full">Recomendado</span>}
                    <div className="text-4xl mb-6">{p.icon}</div>
                    <h3 className="text-2xl font-bold mb-1 tracking-tight">{p.name}</h3>
                    <p className="text-[10px] text-white/40 mb-6 font-mono uppercase tracking-widest">{p.tag}</p>
                    <div className="text-4xl font-bold text-lime mb-8 flex items-baseline gap-1">
                      {p.price}
                      <span className="text-xs text-white/20 font-mono uppercase">/mes</span>
                    </div>
                    <ul className="space-y-4 mb-10 flex-1">
                      {p.feats.map((f, i) => (
                        <li key={i} className="text-xs text-white/50 flex items-start gap-3 leading-tight">
                          <CheckCircle2 size={14} className="text-lime mt-0.5 shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                    <button 
                      onClick={() => handlePlanInterest(p.name)}
                      className={`w-full py-4 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${p.featured ? 'bg-lime text-void hover:brightness-110 shadow-[0_10px_20px_rgba(200,255,0,0.1)]' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'}`}
                    >
                      Contratar Plan
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex flex-col items-center text-center mb-12">
                <h2 className="text-4xl font-bold uppercase tracking-tighter mb-2">Personal Training</h2>
                <p className="text-white/30 text-[10px] font-mono uppercase tracking-[0.3em]">Entrenamiento personalizado de alto nivel</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PT_PLANS.map(p => (
                  <div key={p.id} className="bg-white/[0.02] backdrop-blur-md border border-white/5 p-8 flex flex-col rounded-2xl transition-all hover:translate-y-[-4px]">
                    <div className="text-4xl mb-6">{p.icon}</div>
                    <h3 className="text-2xl font-bold mb-1 tracking-tight">{p.name}</h3>
                    <p className="text-[10px] text-white/40 mb-6 font-mono uppercase tracking-widest">{p.tag}</p>
                    <div className="text-4xl font-bold text-lime mb-8 flex items-baseline gap-1">
                      {p.price}
                      <span className="text-xs text-white/20 font-mono uppercase">/mes</span>
                    </div>
                    <ul className="space-y-4 mb-10 flex-1">
                      {p.feats.map((f, i) => (
                        <li key={i} className="text-xs text-white/50 flex items-start gap-3 leading-tight">
                          <CheckCircle2 size={14} className="text-lime mt-0.5 shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                    <button 
                      onClick={() => handlePlanInterest(p.name)}
                      className="w-full bg-white/5 border border-white/10 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all rounded-xl"
                    >
                      Contratar PT
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === 'history' && (
          <section>
            <div className="flex flex-col items-center text-center mb-12">
              <h2 className="text-4xl font-bold uppercase tracking-tighter mb-2">Mi Historial</h2>
              <p className="text-white/30 text-[10px] font-mono uppercase tracking-[0.3em]">Tus sesiones y progreso</p>
            </div>
            <div className="space-y-3">
              {myHistory.length > 0 ? (
                myHistory.map(b => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={b.id} 
                    className="bg-white/[0.02] backdrop-blur-md border border-white/5 p-6 flex items-center justify-between rounded-2xl group hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-lime/10 rounded-xl flex items-center justify-center border border-lime/20">
                        {b.type === 'sala' ? <Dumbbell className="text-lime" size={20} /> : <Zap className="text-lime" size={20} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-mono text-lime uppercase tracking-[0.2em] font-bold mb-1">{b.type}</p>
                        <h4 className="text-xl font-bold tracking-tight">{b.day} · {b.time}</h4>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleCancel(b.id)}
                      className="text-white/20 hover:text-red-500 transition-colors p-2"
                      title="Cancelar Reserva"
                    >
                      <Trash2 size={20} />
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-24 border border-dashed border-white/10 rounded-3xl text-white/20 font-mono text-xs uppercase tracking-widest">
                  No tienes registros de actividad
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* --- Booking Modal --- */}
      <AnimatePresence>
        {isBookingModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBookingModalOpen(false)}
              className="absolute inset-0 bg-void/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-md bg-surface border border-white/10 p-8"
            >
              <h3 className="text-2xl font-bold mb-2 uppercase tracking-tight">Confirmar Reserva</h3>
              <p className="text-white/40 font-mono text-xs uppercase tracking-widest mb-8">
                {activeTab} · {selectedDay} · {selectedSlot}
              </p>

              <div className="space-y-6 mb-8">
                <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/5">
                  <div className="w-12 h-12 bg-lime/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="text-lime" />
                  </div>
                  <div>
                    <h4 className="font-bold">{user?.nombre} {user?.apellido}</h4>
                    <p className="text-xs text-white/40 uppercase font-mono">{user?.role}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsBookingModalOpen(false)}
                  className="py-4 font-bold uppercase text-sm border border-white/10 hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmBooking}
                  className="py-4 font-bold uppercase text-sm bg-lime text-void clip-path-slant hover:brightness-110 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Bank Modal --- */}
      <AnimatePresence>
        {isBankModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-void/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-card w-full max-w-md p-8 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lime to-emerald-500" />
              
              <button 
                onClick={() => setIsBankModalOpen(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <div className="mb-8">
                <div className="w-16 h-16 bg-lime/10 rounded-2xl flex items-center justify-center mb-4">
                  <Zap className="text-lime" size={32} />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tighter">Datos de Transferencia</h2>
                <p className="text-white/40 text-sm font-mono mt-1">Plan: <span className="text-lime">{selectedPlanForBank}</span></p>
              </div>

              <div className="space-y-3 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {[
                  { label: 'Titular', value: BANK_DETAILS.titular },
                  { label: 'RUT', value: BANK_DETAILS.rut },
                  { label: 'Banco', value: BANK_DETAILS.banco },
                  { label: 'Tipo', value: BANK_DETAILS.tipo },
                  { label: 'Número', value: BANK_DETAILS.numero },
                  { label: 'Email', value: BANK_DETAILS.email },
                ].map((item) => (
                  <div key={item.label} className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all">
                    <div>
                      <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">{item.label}</p>
                      <p className="font-bold text-sm tracking-tight">{item.value}</p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(item.value, item.label)}
                      className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-lime hover:bg-lime/10 transition-all group-hover:opacity-100 relative"
                      title="Copiar"
                    >
                      {copiedField === item.label ? (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-lime text-void text-[8px] font-black px-2 py-1 rounded uppercase tracking-tighter whitespace-nowrap">¡Copiado!</span>
                      ) : null}
                      <Copy size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => {
                  const msg = `Hola, ya realicé la transferencia para el plan: ${selectedPlanForBank}`;
                  window.open(`https://wa.me/56956190853?text=${encodeURIComponent(msg)}`, '_blank');
                  setIsBankModalOpen(false);
                }}
                className="w-full btn-primary flex items-center justify-center gap-3"
              >
                <MessageCircle size={20} />
                <span>Confirmar por WhatsApp</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Support Modal --- */}
      <AnimatePresence>
        {isSupportOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSupportOpen(false)}
              className="absolute inset-0 bg-void/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-surface border border-white/10 p-8"
            >
              <h3 className="text-2xl font-bold mb-6 uppercase tracking-tight">Soporte Técnico</h3>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-[10px] font-mono text-white/40 uppercase mb-1">Falla o Sugerencia</label>
                  <textarea 
                    value={supportMsg}
                    onChange={(e) => setSupportMsg(e.target.value)}
                    placeholder="Describe el problema o tu sugerencia aquí..."
                    className="w-full bg-white/5 border border-white/10 p-4 outline-none focus:border-lime transition-all min-h-[120px] text-sm"
                  />
                </div>
                
                <a 
                  href="https://wa.me/56956802641?text=Hola,%20necesito%20soporte%20con%20la%20app%20AKROSPORT"
                  target="_blank"
                  className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 text-green-500 hover:bg-green-500/20 transition-all"
                >
                  <MessageCircle size={18} />
                  <div className="text-left">
                    <p className="text-xs font-bold uppercase">WhatsApp Admin</p>
                    <p className="text-[10px] opacity-60">+56 9 5680 2641</p>
                  </div>
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsSupportOpen(false)}
                  className="py-4 font-bold uppercase text-sm border border-white/10 hover:bg-white/5 transition-all"
                >
                  Cerrar
                </button>
                <button 
                  onClick={handleSupportSubmit}
                  className="py-4 font-bold uppercase text-sm bg-lime text-void clip-path-slant hover:brightness-110 transition-all"
                >
                  Enviar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Bottom Navigation (Mobile) --- */}
      <nav className="fixed bottom-6 left-6 right-6 z-50 bg-void/80 backdrop-blur-2xl border border-white/10 px-8 py-5 flex items-center justify-between md:hidden rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] mb-[env(safe-area-inset-bottom)]">
        <button 
          onClick={() => setView('agenda')}
          className={`flex flex-col items-center gap-1.5 transition-all ${view === 'agenda' ? 'text-lime scale-110' : 'text-white/20'}`}
        >
          <Calendar size={22} />
          <span className="text-[8px] font-mono uppercase font-black tracking-widest">Agenda</span>
        </button>
        <button 
          onClick={() => setView('planes')}
          className={`flex flex-col items-center gap-1.5 transition-all ${view === 'planes' ? 'text-lime scale-110' : 'text-white/20'}`}
        >
          <Zap size={22} />
          <span className="text-[8px] font-mono uppercase font-black tracking-widest">Planes</span>
        </button>
        <button 
          onClick={() => setView('history')}
          className={`flex flex-col items-center gap-1.5 transition-all ${view === 'history' ? 'text-lime scale-110' : 'text-white/20'}`}
        >
          <Clock size={22} />
          <span className="text-[8px] font-mono uppercase font-black tracking-widest">Historial</span>
        </button>
        <button 
          onClick={() => setIsSupportOpen(true)}
          className="flex flex-col items-center gap-1.5 text-white/20 hover:text-lime transition-all"
        >
          <MessageCircle size={22} />
          <span className="text-[8px] font-mono uppercase font-black tracking-widest">Soporte</span>
        </button>
      </nav>

      {/* --- Floating Social (Desktop) --- */}
      <div className="fixed right-8 bottom-8 hidden md:flex flex-col gap-4 z-40 mb-[env(safe-area-inset-bottom)]">
        <button 
          onClick={() => setView('history')}
          className={`w-12 h-12 bg-surface-2 border flex items-center justify-center rounded-full transition-all ${view === 'history' ? 'border-lime text-lime' : 'border-white/10 text-white/40 hover:border-white/20'}`}
        >
          <Clock size={20} />
        </button>
        <button 
          onClick={() => setIsSupportOpen(true)}
          className="w-12 h-12 bg-surface-2 border border-white/10 flex items-center justify-center rounded-full text-white/40 hover:border-lime hover:text-lime transition-all"
        >
          <MessageCircle size={20} />
        </button>
        <a 
          href="https://www.instagram.com/akrosport_?" 
          target="_blank" 
          className="w-12 h-12 bg-surface-2 border border-white/10 flex items-center justify-center rounded-full text-white/40 hover:border-pink-500 hover:text-pink-500 transition-all"
        >
          <Instagram size={20} />
        </a>
        <a 
          href="https://wa.me/56956802641" 
          target="_blank"
          className="w-12 h-12 bg-green-500 flex items-center justify-center rounded-full text-white hover:brightness-110 transition-all shadow-lg shadow-green-500/20"
        >
          <MessageCircle size={20} />
        </a>
      </div>
    </div>
  );
}
