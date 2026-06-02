import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import api from '../../services/api';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  onSuccess: () => void;
}

const AddMemberModal = ({ isOpen, onClose, groupId, onSuccess }: AddMemberModalProps) => {
  const [inputType, setInputType] = useState<'email' | 'mobile'>('email');
  const [inputValue, setInputValue] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload: any = {};
      if (inputType === 'email') payload.email = inputValue;
      else payload.mobile_number = inputValue;
      
      if (name) payload.name = name;

      await api.post(`/api/groups/${groupId}/members`, payload);
      onSuccess();
      onClose();
      setInputValue('');
      setName('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-surface-dark border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white">Add Member</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={inputType === 'email'} 
                      onChange={() => setInputType('email')} 
                      className="text-primary focus:ring-primary"
                    />
                    By Email
                  </label>
                  <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={inputType === 'mobile'} 
                      onChange={() => setInputType('mobile')}
                      className="text-primary focus:ring-primary" 
                    />
                    By Mobile Number
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {inputType === 'email' ? 'Email Address' : 'Mobile Number'}
                  </label>
                  <input
                    type={inputType === 'email' ? 'email' : 'tel'}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                    placeholder={inputType === 'email' ? 'friend@example.com' : '+91 9876543210'}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Name (If they don't have an account)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                    placeholder="e.g. John Doe"
                  />
                  <p className="text-xs text-gray-500 mt-1">We'll create a placeholder account until they claim it.</p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 bg-gray-800 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !inputValue.trim()}
                    className="flex-1 bg-primary text-black font-bold py-3 rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Adding...' : 'Add to Group'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddMemberModal;
