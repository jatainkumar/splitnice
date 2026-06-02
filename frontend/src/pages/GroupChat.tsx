import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, Send } from 'lucide-react';
import api from '../services/api';

const GroupChat = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [group, setGroup] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Fetch group details and chat history
    const fetchData = async () => {
      try {
        const [groupRes, chatRes] = await Promise.all([
          api.get(`/api/groups/${id}`),
          api.get(`/api/chat/group/${id}`)
        ]);
        setGroup(groupRes.data);
        setMessages(chatRes.data);
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };
    fetchData();

    // Establish WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const wsUrl = baseUrl.replace(/^https?:/, protocol) + `/api/chat/ws/${id}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        setMessages((prev) => [...prev, data.data]);
      }
    };

    return () => {
      if (ws.readyState === 1) {
        ws.close();
      }
    };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    // Send via WebSocket
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

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 p-4 flex items-center gap-4 bg-surface-dark sticky top-0 z-10 shrink-0">
        <button onClick={() => navigate(`/groups/${id}`)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">{group?.name || 'Group Chat'}</h1>
          <p className="text-xs text-gray-500">Chat & Activity Feed</p>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg: any) => {
          const isMe = msg.user_id === user?.id;
          const isSystem = msg.message.startsWith('added an expense:') || msg.message.startsWith('paid INR');

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <span className="bg-gray-900 text-gray-400 text-xs px-4 py-2 rounded-full border border-gray-800 shadow-sm text-center">
                  <span className="font-bold text-gray-300">{msg.user_name}</span> {msg.message}
                </span>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isMe ? 'bg-primary text-black rounded-tr-sm' : 'bg-gray-900 text-gray-200 border border-gray-800 rounded-tl-sm'}`}>
                {!isMe && <p className="text-[10px] font-bold text-gray-400 mb-1">{msg.user_name}</p>}
                <p className="text-sm break-words">{msg.message}</p>
                <p className={`text-[10px] mt-1 ${isMe ? 'text-black/60 text-right' : 'text-gray-500 text-right'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface-dark border-t border-gray-800 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2 relative max-w-4xl mx-auto">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-black border border-gray-800 rounded-full pl-5 pr-12 py-3.5 text-white focus:outline-none focus:border-primary transition-colors text-sm"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square bg-primary text-black rounded-full flex items-center justify-center hover:bg-primary-light disabled:opacity-50 disabled:hover:bg-primary transition-colors"
          >
            <Send size={16} className="ml-[-2px]" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default GroupChat;
