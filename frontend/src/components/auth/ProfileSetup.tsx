import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { motion } from 'framer-motion';

const ProfileSetup = ({ onComplete }: { onComplete: () => void }) => {
  const { user, refreshUser } = useAuth();
  const [mobile, setMobile] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.put('/api/auth/profile', {
        mobile_number: mobile,
        currency_preference: currency
      });
      await refreshUser();
      onComplete();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-surface-dark border border-gray-800 rounded-2xl p-8 max-w-md w-full mx-auto shadow-2xl"
    >
      <h2 className="text-2xl font-bold text-white mb-2">Complete Your Profile</h2>
      <p className="text-gray-400 mb-6">Just a few more details before we get started.</p>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Mobile Number</label>
          <input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
            placeholder="+91 9876543210"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Required for friends to easily find you.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Default Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors appearance-none"
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-black font-bold py-3 rounded-lg hover:bg-primary-light transition-colors mt-6 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save & Continue'}
        </button>
      </form>
    </motion.div>
  );
};

export default ProfileSetup;
