import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings } from 'lucide-react';
import api from '../../services/api';

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: any;
  onSuccess: () => void;
}

const GroupSettingsModal = ({ isOpen, onClose, group, onSuccess }: GroupSettingsModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [simplifyDebts, setSimplifyDebts] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setDescription(group.description || '');
      setSimplifyDebts(group.simplify_debts || false);
    }
  }, [group, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await api.put(`/api/groups/${group.id}`, {
        name,
        description,
        simplify_debts: simplifyDebts
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to update group', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-surface-dark w-full max-w-md rounded-2xl border border-gray-800 shadow-2xl overflow-hidden"
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-surface-dark sticky top-0 z-10">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings size={20} className="text-primary" /> Group Settings
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Group Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  placeholder="E.g., Apartment, Trip to Goa"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  placeholder="What is this group for?"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-700 rounded-xl">
                <input
                  type="checkbox"
                  id="simplifyDebts"
                  checked={simplifyDebts}
                  onChange={(e) => setSimplifyDebts(e.target.checked)}
                  className="w-5 h-5 accent-primary rounded border-gray-700 bg-gray-800 focus:ring-primary focus:ring-offset-gray-900 cursor-pointer"
                />
                <label htmlFor="simplifyDebts" className="flex-1 text-sm font-medium text-gray-200 cursor-pointer">
                  Simplify Debts
                  <span className="block text-xs text-gray-500 font-normal mt-0.5">
                    Minimize the total number of payments needed.
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full mt-6 bg-primary text-black font-bold py-3 rounded-xl hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GroupSettingsModal;
