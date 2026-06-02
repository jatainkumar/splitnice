import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ChevronLeft, Receipt, Settings, Send, MessageSquare, Sun, Moon, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import AddMemberModal from '../components/group/AddMemberModal';
import AddExpenseModal from '../components/expense/AddExpenseModal';
import EditExpenseModal from '../components/expense/EditExpenseModal';
import SettleUpModal from '../components/expense/SettleUpModal';
import GroupSettingsModal from '../components/group/GroupSettingsModal';
import GroupInfoModal from '../components/group/GroupInfoModal';
import ExpenseDetailsModal from '../components/expense/ExpenseDetailsModal';

const GroupDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState<any>(null);
  const [balances, setBalances] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false);
  const [isSettleUpOpen, setIsSettleUpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

  // Chat & Feed State
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchGroupData = async () => {
    try {
      setLoading(true);
      const [groupRes, balancesRes, chatRes] = await Promise.all([
        api.get(`/api/groups/${id}`),
        api.get(`/api/balances/group/${id}`),
        api.get(`/api/chat/group/${id}`)
      ]);
      setGroup(groupRes.data);
      setBalances(balancesRes.data);
      setMessages(chatRes.data);
    } catch (error) {
      console.error("Error fetching group data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupData();
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    
    // Connect to WebSocket - dynamic URL for dev and production
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_API_BASE_URL 
      ? new URL(import.meta.env.VITE_API_BASE_URL).host 
      : window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/chat/ws/${id}?user_id=${user.id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        setMessages((prev) => [...prev, data.data]);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener('open', () => ws.close());
      }
    };
  }, [id, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        user_id: user.id,
        message: newMessage.trim(),
        expense_id: null
      }));
      setNewMessage('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!group) return null;

  const isAdmin = group.members.find((m: any) => m.user_id === user?.id)?.role === 'admin';

  return (
    <div className="min-h-screen bg-background-dark text-white flex flex-col h-screen">
      <header className="border-b border-gray-800 p-4 flex items-center justify-between bg-surface-dark shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </button>
          
          <button 
            onClick={() => setIsInfoOpen(true)}
            className="text-left hover:bg-gray-800/50 px-3 py-1 rounded-lg transition-colors cursor-pointer"
          >
            <h1 className="text-xl font-bold text-white leading-tight">{group.name}</h1>
            <p className="text-xs text-gray-500">Tap here for group info</p>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors" 
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-0 md:p-6 flex flex-col overflow-hidden h-full">
        
        {/* Full Screen Activity Feed */}
        <div className="flex-1 flex flex-col bg-surface-dark md:border md:border-gray-800 md:rounded-2xl overflow-hidden h-full">
          <div className="border-b border-gray-800 p-4 flex items-center justify-between shrink-0 bg-surface-dark z-10 hidden md:flex">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare size={20} className="text-primary" />
              Activity Feed
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
              {messages.map((msg: any) => {
                const isSystem = msg.is_system;
                const isMe = msg.user_id === user?.id;

                if (isSystem && msg.expense_data) {
                  const ed = msg.expense_data;
                  return (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-center my-4"
                    >
                      <div className="w-full max-w-sm bg-gray-900 border border-gray-700/60 rounded-2xl shadow-xl overflow-hidden">
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Receipt size={16} className="text-primary" />
                            <span className="font-bold text-white text-sm">{ed.description || 'Untitled'}</span>
                          </div>
                          <span className="text-xs text-gray-500 capitalize">{ed.split_type} split</span>
                        </div>
                        
                        {/* Total Amount */}
                        <div className="px-4 py-3 text-center border-b border-gray-800/50">
                          <p className="text-2xl font-black text-primary">{ed.currency} {ed.total_amount.toFixed(2)}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">Added by {ed.creator_name}</p>
                        </div>

                        {/* Paid By Section */}
                        <div className="px-4 pt-3 pb-1">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Paid by</p>
                          {ed.payers.map((p: any, i: number) => (
                            <div key={i} className="flex justify-between items-center py-1">
                              <span className="text-sm text-gray-300">{p.user_name}</span>
                              <span className="text-sm font-semibold text-green-400">{ed.currency} {p.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Split Between Section */}
                        <div className="px-4 pt-2 pb-3">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Split between</p>
                          {ed.splits.map((s: any, i: number) => (
                            <div key={i} className="flex justify-between items-center py-1">
                              <span className="text-sm text-gray-300">{s.user_name}</span>
                              <span className="text-sm font-semibold text-red-400">{ed.currency} {s.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2 bg-gray-950/50 border-t border-gray-800/50 flex items-center justify-between">
                          <span className="text-[10px] text-gray-600">
                            {new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="flex gap-3">
                            {ed.can_edit && msg.expense_id && (
                              <button 
                                onClick={() => {
                                  setSelectedExpenseId(msg.expense_id);
                                  setIsEditExpenseOpen(true);
                                }}
                                className="text-gray-400 font-bold text-[10px] uppercase tracking-wide hover:text-white"
                              >
                                Edit
                              </button>
                            )}
                            {msg.expense_id && (
                              <button 
                                onClick={() => setSelectedExpenseId(msg.expense_id)}
                                className="text-primary font-bold text-[10px] uppercase tracking-wide hover:underline"
                              >
                                Full Details
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                if (isSystem) {
                  return (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-center my-4"
                    >
                      <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 text-gray-300 text-xs py-2 px-4 rounded-full text-center max-w-md shadow-sm flex flex-col items-center gap-1">
                        <span>{msg.message}</span>
                        {msg.expense_id && (
                          <button 
                            onClick={() => setSelectedExpenseId(msg.expense_id)}
                            className="text-primary font-bold hover:underline text-[10px] uppercase tracking-wide mt-1"
                          >
                            View Details
                          </button>
                        )}
                        <span className="block text-[10px] text-gray-500 mt-0.5">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {!isMe && (
                      <span className="text-xs text-gray-500 ml-1 mb-1">{msg.user_name}</span>
                    )}
                    <div className={`px-4 py-2 rounded-2xl max-w-[85%] md:max-w-[70%] shadow-sm ${isMe ? 'bg-primary text-black rounded-tr-sm' : 'bg-gray-800 text-white rounded-tl-sm'}`}>
                      <p className="text-sm font-medium whitespace-pre-wrap">{msg.message}</p>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 mx-1">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input with Expense and Settle Up buttons */}
          <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-gray-800 bg-surface-dark shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(true)}
                className="p-3 text-primary hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                title="Add Expense"
              >
                <Receipt size={22} />
              </button>
              
              <button
                type="button"
                onClick={() => setIsSettleUpOpen(true)}
                className="p-3 text-success hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                title="Settle Up"
              >
                <CreditCard size={22} />
              </button>

              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 min-w-0 bg-gray-900 border border-gray-700 text-white rounded-full px-4 py-3 focus:outline-none focus:border-primary transition-colors"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-primary text-black p-3 rounded-full hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
        </div>

      </main>

      <AddMemberModal isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} groupId={id as string} onSuccess={fetchGroupData} />
      <AddExpenseModal isOpen={isAddExpenseOpen} onClose={() => setIsAddExpenseOpen(false)} group={group} onSuccess={fetchGroupData} />
      <SettleUpModal isOpen={isSettleUpOpen} onClose={() => setIsSettleUpOpen(false)} groupId={id as string} balances={balances} onSuccess={fetchGroupData} />
      <GroupSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} group={group} onSuccess={fetchGroupData} />
      <GroupInfoModal 
        isOpen={isInfoOpen} 
        onClose={() => setIsInfoOpen(false)} 
        group={group} 
        balances={balances} 
        isAdmin={isAdmin}
        onAddMemberClick={() => setIsAddMemberOpen(true)}
        onSuccess={fetchGroupData}
      />
      <ExpenseDetailsModal 
        isOpen={selectedExpenseId !== null && !isEditExpenseOpen} 
        onClose={() => setSelectedExpenseId(null)} 
        expenseId={selectedExpenseId} 
        onEdit={() => setIsEditExpenseOpen(true)}
        onDelete={async (expenseId) => {
          try {
            await api.delete(`/api/expenses/${expenseId}`);
            setSelectedExpenseId(null);
            fetchGroupData();
          } catch (error: any) {
            alert(error.response?.data?.detail || 'Failed to delete expense');
          }
        }}
      />
      <EditExpenseModal
        isOpen={isEditExpenseOpen}
        onClose={() => {
          setIsEditExpenseOpen(false);
          setSelectedExpenseId(null);
        }}
        group={group}
        expenseId={selectedExpenseId}
        onSuccess={() => {
          fetchGroupData();
          setIsEditExpenseOpen(false);
          setSelectedExpenseId(null);
        }}
      />
    </div>
  );
};

export default GroupDetails;
