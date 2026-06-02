import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: any;
  onSuccess: () => void;
}

const AddExpenseModal = ({ isOpen, onClose, group, onSuccess }: AddExpenseModalProps) => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [splitType, setSplitType] = useState('equal');
  const [payerId, setPayerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Split state
  const [splits, setSplits] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);

  useEffect(() => {
    if (group && user) {
      setPayerId(user.id);
      // Initialize equal splits
      const initialSplits = group.members.map((m: any) => ({
        user_id: m.user_id,
        value: 1 // for equal, it doesn't matter. for share it's 1. for percentage it's 100/N
      }));
      setSplits(initialSplits);
      setPayers(group.members.map((m: any) => ({ user_id: m.user_id, amount: 0 })));
    }
  }, [group, user]);

  const handleSplitValueChange = (userId: string, value: string) => {
    setSplits(prev => prev.map(s => s.user_id === userId ? { ...s, value: parseFloat(value) || 0 } : s));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const totalAmount = parseFloat(amount);
    if (!totalAmount || totalAmount <= 0) {
      setError("Please enter a valid amount");
      setLoading(false);
      return;
    }

    let activePayers = [];
    if (payerId === 'multiple') {
      activePayers = payers.filter(p => p.amount > 0).map(p => ({ user_id: p.user_id, amount_paid: p.amount }));
      const sumPaid = activePayers.reduce((acc, curr) => acc + curr.amount_paid, 0);
      if (Math.abs(sumPaid - totalAmount) > 0.01) {
        setError(`Sum of amounts paid (${sumPaid.toFixed(2)}) does not equal total amount (${totalAmount.toFixed(2)})`);
        setLoading(false);
        return;
      }
      if (activePayers.length === 0) {
        setError('Please specify who paid');
        setLoading(false);
        return;
      }
    } else {
      activePayers = [{ user_id: payerId, amount_paid: totalAmount }];
    }

    try {
      const payload = {
        group_id: group.id,
        description,
        total_amount: totalAmount,
        currency,
        split_type: splitType,
        payers: activePayers,
        splits: splits.map(s => ({
          user_id: s.user_id,
          value: splitType === 'equal' ? 1 : s.value
        }))
      };

      await api.post('/api/expenses', payload);
      onSuccess();
      onClose();
      setDescription('');
      setAmount('');
      setSplitType('equal');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-surface-dark border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl my-8"
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white">Add an Expense</h2>
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
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors"
                    placeholder="e.g. Dinner at Joe's"
                    required
                  />
                </div>

                <div className="flex gap-4">
                  <div className="w-1/3">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors appearance-none"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors text-xl font-bold"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Paid by</label>
                  <select
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors appearance-none"
                  >
                    {group?.members.map((m: any) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user_id === user?.id ? 'You' : m.name}
                      </option>
                    ))}
                    <option value="multiple">Multiple people</option>
                  </select>
                </div>

                {payerId === 'multiple' && (
                  <div className="bg-gray-900/50 rounded-xl p-4 space-y-3 border border-gray-800">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2">Who Paid What?</p>
                    {group?.members.map((m: any) => (
                      <div key={m.user_id} className="flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-300 truncate w-1/2">
                          {m.user_id === user?.id ? 'You' : m.name}
                        </span>
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={payers.find(p => p.user_id === m.user_id)?.amount || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setPayers(prev => prev.map(p => p.user_id === m.user_id ? { ...p, amount: val } : p));
                            }}
                            className="w-full bg-black border border-gray-700 rounded p-1.5 text-white text-sm focus:outline-none focus:border-primary text-right"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-500 w-6">
                            {currency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Split Method</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['equal', 'unequal', 'percentage', 'share'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSplitType(type)}
                        className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border ${
                          splitType === type 
                            ? 'bg-primary text-black border-primary' 
                            : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        {type === 'share' ? 'Ratio' : type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Split Configuration */}
                {splitType !== 'equal' && (
                  <div className="bg-gray-900/50 rounded-xl p-4 space-y-3 border border-gray-800">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2">Configure Split</p>
                    {group?.members.map((m: any) => (
                      <div key={m.user_id} className="flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-300 truncate w-1/2">
                          {m.user_id === user?.id ? 'You' : m.name}
                        </span>
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={splits.find(s => s.user_id === m.user_id)?.value || ''}
                            onChange={(e) => handleSplitValueChange(m.user_id, e.target.value)}
                            className="w-full bg-black border border-gray-700 rounded p-1.5 text-white text-sm focus:outline-none focus:border-primary text-right"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-500 w-6">
                            {splitType === 'percentage' ? '%' : splitType === 'share' ? 'pts' : currency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={loading || !amount}
                    className="w-full bg-primary text-black font-bold py-3.5 rounded-xl hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                  >
                    {loading ? 'Adding Expense...' : `Save Expense: ${currency} ${amount || '0.00'}`}
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

export default AddExpenseModal;
