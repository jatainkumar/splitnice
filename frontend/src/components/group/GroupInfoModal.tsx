import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Info, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import api from '../../services/api';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: any;
  balances: any;
  onAddMemberClick: () => void;
  isAdmin: boolean;
  onSuccess: () => void;
}

const GroupInfoModal = ({ isOpen, onClose, group, balances, onAddMemberClick, isAdmin, onSuccess }: GroupInfoModalProps) => {
  const { user } = useAuth();
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!isOpen || !group) return null;

  const handleRemoveMember = async (memberUserId: string) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      setRemovingId(memberUserId);
      await api.delete(`/api/groups/${group.id}/members/${memberUserId}`);
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to remove member. Ensure they have zero balance.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-surface-dark w-full max-w-md max-h-[80vh] rounded-2xl border border-gray-800 shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-surface-dark shrink-0">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Info size={20} className="text-primary" /> Group Info
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="overflow-y-auto p-4 space-y-6">
            {balances?.simplified_balances && balances.simplified_balances.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="border-b border-gray-800 p-4">
                  <h3 className="font-bold text-white">Balances</h3>
                </div>
                <ul className="divide-y divide-gray-800 p-2">
                  {balances.simplified_balances.map((b: any, i: number) => {
                    const fromMember = group.members.find((m: any) => m.name === b.from_user_name);
                    const toMember = group.members.find((m: any) => m.name === b.to_user_name);
                    return (
                      <li key={i} className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {fromMember?.profile_picture_url ? (
                            <img src={fromMember.profile_picture_url} className="w-6 h-6 rounded-full" alt="" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-primary text-[10px] font-bold">
                              {b.from_user_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-gray-300 text-sm">{b.from_user_name}</span>
                          
                          <span className="text-gray-500 text-[10px] px-1">owes</span>
                          
                          {toMember?.profile_picture_url ? (
                            <img src={toMember.profile_picture_url} className="w-6 h-6 rounded-full" alt="" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-primary text-[10px] font-bold">
                              {b.to_user_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-gray-300 text-sm">{b.to_user_name}</span>
                        </div>
                        <span className="font-bold text-primary text-sm">
                          INR {b.amount.toFixed(2)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="border-b border-gray-800 p-4 flex justify-between items-center">
                <h3 className="font-bold text-white">Members</h3>
                <button onClick={() => {
                  onClose();
                  onAddMemberClick();
                }} className="text-primary hover:text-primary-light">
                  <UserPlus size={18} />
                </button>
              </div>
              <ul className="divide-y divide-gray-800">
                {group.members.map((member: any) => (
                  <li key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {member.profile_picture_url ? (
                        <img src={member.profile_picture_url} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-primary text-xs font-bold">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          {member.name} {member.user_id === user?.id && <span className="text-gray-500 text-xs ml-1">(You)</span>}
                        </p>
                        {member.invite_status === 'pending' && (
                          <p className="text-xs text-yellow-500">Pending Invite</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {member.role === 'admin' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/30 px-2 py-0.5 rounded-full">
                          Admin
                        </span>
                      )}
                      {isAdmin && member.user_id !== user?.id && (
                        <button 
                          onClick={() => handleRemoveMember(member.user_id)}
                          disabled={removingId === member.user_id}
                          className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remove member"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GroupInfoModal;
