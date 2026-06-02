import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Plus, Users, Menu, X, Sun, Moon, Wallet, TrendingDown, TrendingUp, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';
import CreateGroupModal from '../components/group/CreateGroupModal';
import EditProfileModal from '../components/auth/EditProfileModal';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [groups, setGroups] = useState<any[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<any>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      const [groupsRes, balancesRes] = await Promise.all([
        api.get('/api/groups'),
        api.get('/api/balances/me')
      ]);
      setGroups(groupsRes.data);
      setBalanceSummary(balancesRes.data);
    } catch (error) {
      console.error("Error fetching dashboard data", error);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-gray-800 p-4 grid grid-cols-3 items-center bg-surface-dark sticky top-0 z-10">
        <div className="flex items-center justify-start">
          <button 
            className="md:hidden p-1 -ml-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
        </div>

        <div className="flex items-center justify-center">
          <h1 className="text-2xl font-cursive text-primary tracking-wider">Splitnice</h1>
        </div>
        
        <div className="flex items-center justify-end gap-2 md:gap-4">
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="hidden md:flex items-center gap-3 hover:bg-gray-800 p-2 rounded-xl transition-colors cursor-pointer"
            title="Edit Profile"
          >
            <span className="text-gray-300 text-sm font-medium">{user?.name}</span>
            {user?.profile_picture_url ? (
              <img src={user.profile_picture_url} alt="Profile" className="w-8 h-8 rounded-full border border-gray-700" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-primary font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
          
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button 
            onClick={logout}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
            title="Sign Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto overflow-hidden">
        
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-surface-dark border-r border-gray-800 p-6 overflow-y-auto transform transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex justify-between items-center mb-6 md:hidden">
            <h1 className="text-xl font-cursive text-primary">Splitnice</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
          <nav className="space-y-6">
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Menu</h2>
              <ul className="space-y-1">
                <li>
                  <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800 text-white font-medium">
                    Dashboard
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Groups</h2>
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="text-primary hover:text-primary-light transition-colors p-1"
                >
                  <Plus size={16} />
                </button>
              </div>
              <ul className="space-y-1 text-sm">
                {loadingGroups ? (
                  <li className="px-3 py-2 text-gray-500">Loading...</li>
                ) : groups.length === 0 ? (
                  <li className="px-3 py-2 text-gray-500 italic">No groups yet.</li>
                ) : (
                  groups.map(group => (
                    <li key={group.id}>
                      <a href={`/groups/${group.id}`} className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-900 hover:text-white transition-colors truncate">
                        <Users size={14} className="text-gray-500 flex-shrink-0" />
                        <span className="truncate">{group.name}</span>
                      </a>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </nav>
        </aside>

        {/* Dashboard Center */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-dark p-6 rounded-2xl border border-gray-800 relative overflow-hidden hover:border-gray-700 transition-colors shadow-lg group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[30px] group-hover:bg-primary/10 transition-colors" />
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-gray-900 rounded-xl text-primary border border-gray-800">
                  <Wallet size={20} />
                </div>
                <h3 className="text-gray-400 text-sm font-medium">Total Balance</h3>
              </div>
              <p className={`text-3xl font-bold ${balanceSummary?.net_balance < 0 ? 'text-danger' : balanceSummary?.net_balance > 0 ? 'text-success' : 'text-white'}`}>
                INR {Math.abs(balanceSummary?.net_balance || 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {balanceSummary?.net_balance < 0 ? 'You owe overall' : balanceSummary?.net_balance > 0 ? 'You are owed overall' : 'Settled up'}
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-surface-dark p-6 rounded-2xl border border-gray-800 relative overflow-hidden hover:border-gray-700 transition-colors shadow-lg group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-danger/5 rounded-full blur-[30px] group-hover:bg-danger/10 transition-colors" />
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-gray-900 rounded-xl text-danger border border-gray-800">
                  <TrendingDown size={20} />
                </div>
                <h3 className="text-gray-400 text-sm font-medium">You Owe</h3>
              </div>
              <p className="text-3xl font-bold text-danger">INR {(balanceSummary?.total_owing || 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-2">To be paid to others</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-surface-dark p-6 rounded-2xl border border-gray-800 relative overflow-hidden hover:border-gray-700 transition-colors shadow-lg group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full blur-[30px] group-hover:bg-success/10 transition-colors" />
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-gray-900 rounded-xl text-success border border-gray-800">
                  <TrendingUp size={20} />
                </div>
                <h3 className="text-gray-400 text-sm font-medium">You are Owed</h3>
              </div>
              <p className="text-3xl font-bold text-success">INR {(balanceSummary?.total_owed || 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-2">To be received</p>
            </motion.div>
          </div>

          {groups.length === 0 ? (
            <div className="bg-surface-dark border border-gray-800 rounded-2xl p-6 min-h-[300px] flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4 text-primary">
                <Plus size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">You're all settled up!</h3>
              <p className="text-gray-400 max-w-sm mb-6">Create a group or add a friend to start tracking your expenses together.</p>
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-primary text-black font-bold py-2 px-6 rounded-lg hover:bg-primary-light transition-colors"
              >
                Create Group
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {groups.map((group, i) => (
                <motion.div 
                  key={group.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * i }}
                  className="bg-surface-dark border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors cursor-pointer flex flex-col"
                  onClick={() => window.location.href = `/groups/${group.id}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-900/80 rounded-xl flex items-center justify-center text-primary border border-gray-800 group-hover:scale-110 transition-transform shadow-inner">
                        <Users size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white leading-tight group-hover:text-primary transition-colors">{group.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{group.members.length} members</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto pt-4 border-t border-gray-800/50 flex justify-between items-center text-sm">
                    <span className="text-gray-400">View details</span>
                    <ArrowRight size={16} className="text-gray-600 group-hover:text-primary transition-colors" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>

      <CreateGroupModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSuccess={fetchGroups} 
      />
      <EditProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
