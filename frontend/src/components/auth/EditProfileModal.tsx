import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EditProfileModal = ({ isOpen, onClose }: EditProfileModalProps) => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      // The auth endpoint uses PUT /api/auth/profile
      const res = await api.put('/api/auth/profile', { name });
      
      // We should ideally update the user context here, but since the auth context
      // doesn't have an easy "updateUser" method, we can trigger a re-auth or just reload
      // For now, let's just reload the page to get the fresh user data since MVP
      window.location.reload();
    } catch (error) {
      console.error('Failed to update profile', error);
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
          <div className="flex justify-between items-center p-6 border-b border-gray-800">
            <h2 className="text-xl font-bold text-white">Edit Profile</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                placeholder="Your name"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim() || name === user?.name}
              className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EditProfileModal;
