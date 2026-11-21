import { motion } from 'framer-motion';
import { BarChart3, Home as HomeIcon, Landmark, MoreHorizontal, Plus, List, CalendarClock, PiggyBank, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { AddExpenseSheet } from './components/AddExpense';
import { ExportSheet } from './components/ExportSheet';
import { Logo, ToastHost } from './components/ui';
import { go, openAdd, useRoute } from './lib/hooks';
import { startSync, useStore } from './lib/store';
import { Accounts } from './screens/Accounts';
import { Analysis } from './screens/Analysis';
import { Budgets } from './screens/Budgets';
import { Categories } from './screens/Categories';
import { Home } from './screens/Home';
import { More } from './screens/More';
import { Onboarding } from './screens/Onboarding';
import { ScheduledScreen } from './screens/Scheduled';
import { Settings } from './screens/Settings';
import { Transactions } from './screens/Transactions';

const TABS = [
  { name: 'home', label: 'Home', icon: HomeIcon },
  { name: 'analysis', label: 'Analysis', icon: BarChart3 },
  { name: 'accounts', label: 'Accounts', icon: Landmark },
  { name: 'more', label: 'More', icon: MoreHorizontal },
];
const SIDE = [
  ...TABS.slice(0, 3),
  { name: 'transactions', label: 'Transactions', icon: List },
  { name: 'budgets', label: 'Budgets', icon: PiggyBank },
  { name: 'scheduled', label: 'Scheduled', icon: CalendarClock },
];
const MORE_CHILDREN = ['more', 'transactions', 'budgets', 'scheduled', 'categories', 'settings'];

function useThemeEffect() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
  }, [theme]);
}

export default function App() {
  useThemeEffect();
  const conn = useStore((s) => s.conn);
  const route = useRoute();

  useEffect(() => {
    if (conn) startSync();
  }, [conn]);

  // keyboard shortcut: "n" for a new expense on desktop
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !document.querySelector('.sheet')) {
        e.preventDefault();
        openAdd();
      }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  if (!conn) return (
    <>
      <Onboarding />
      <ToastHost />
    </>
  );

  let screen: ReactNode;
  switch (route.name) {
    case 'analysis': screen = <Analysis />; break;
    case 'accounts': screen = <Accounts />; break;
    case 'more': screen = <More />; break;
    case 'transactions': screen = <Transactions />; break;
    case 'budgets': screen = <Budgets />; break;
    case 'scheduled': screen = <ScheduledScreen />; break;
    case 'categories': screen = <Categories />; break;
    case 'settings': screen = <Settings />; break;
    default: screen = <Home />;
  }
  const activeTab = MORE_CHILDREN.includes(route.name) ? 'more' : route.name === 'home' || !TABS.find((t) => t.name === route.name) ? 'home' : route.name;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Logo /> Unbroke
        </div>
        <button className="btn primary block add-btn" onClick={() => openAdd()}>
          <Plus size={18} /> New expense
        </button>
        {SIDE.map((t) => (
          <button key={t.name} className={`nav-item ${route.name === t.name || (t.name === 'home' && route.name === '') ? 'active' : ''}`} onClick={() => go(t.name)}>
            <t.icon size={19} /> {t.label}
          </button>
        ))}
        <div className="spacer" />
        <button className={`nav-item ${route.name === 'categories' ? 'active' : ''}`} onClick={() => go('categories')}>
          <MoreHorizontal size={19} /> Categories
        </button>
        <button className={`nav-item ${route.name === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}>
          <SettingsIcon size={19} /> Settings
        </button>
      </aside>

      <main className="main">
        {/* keyed mount: new screen fades in immediately, never blocked behind an exit animation */}
        <motion.div key={route.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }}>
          {screen}
        </motion.div>
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.slice(0, 2).map((t) => (
          <button key={t.name} className={`tab ${activeTab === t.name ? 'active' : ''}`} onClick={() => go(t.name)} aria-current={activeTab === t.name ? 'page' : undefined}>
            <t.icon size={22} strokeWidth={activeTab === t.name ? 2.4 : 2} /> {t.label}
          </button>
        ))}
        <button className="fab" onClick={() => openAdd()} aria-label="New expense">
          <Plus size={26} strokeWidth={2.4} />
        </button>
        {TABS.slice(2).map((t) => (
          <button key={t.name} className={`tab ${activeTab === t.name ? 'active' : ''}`} onClick={() => go(t.name)} aria-current={activeTab === t.name ? 'page' : undefined}>
            <t.icon size={22} strokeWidth={activeTab === t.name ? 2.4 : 2} /> {t.label}
          </button>
        ))}
      </nav>

      <AddExpenseSheet />
      <ExportSheet />
      <ToastHost />
    </div>
  );
}
