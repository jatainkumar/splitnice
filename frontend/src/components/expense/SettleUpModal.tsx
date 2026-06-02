import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface SettleUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  balances: any;
  onSuccess: () => void;
}

const SettleUpModal = ({ isOpen, onClose, groupId, balances, onSuccess }: SettleUpModalProps) => {
  const { user } = useAuth();
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Find all debts where the current user is the debtor
  const userDebts = balances?.simplified_balances?.filter(
    (b: any) => b.from_user_id === user?.id
  ) || [];

  // Find all debts where current user is creditor
  const userCredits = balances?.simplified_balances?.filter(
    (b: any) => b.to_user_id === user?.id
  ) || [];

  const allRelevantDebts = [...userDebts, ...userCredits];

  useEffect(() => {
    if (isOpen) {
      setSelectedDebt(null);
      setSettleAmount('');
      setError('');
    }
  }, [isOpen]);

  const handlePing = async (targetUserId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/api/notifications/ping/${targetUserId}`);
      alert('Ping sent successfully! A reminder has been sent.');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to send ping');
    }
  };

  const handleSettle = async () => {
    if (!selectedDebt) return;
    setLoading(true);
    setError('');

    try {
      const parsedAmount = parseFloat(settleAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError('Please enter a valid amount greater than 0');
        setLoading(false);
        return;
      }
      if (parsedAmount > selectedDebt.amount) {
        setError(`Cannot settle more than the owed amount (INR ${selectedDebt.amount.toFixed(2)})`);
        setLoading(false);
        return;
      }

      await api.post('/api/settlements', {
        group_id: groupId,
        payee_id: selectedDebt.to_user_id,
        amount: parsedAmount,
        payment_method: 'cash'
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to record settlement');
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
              <h2 className="text-xl font-bold text-white">Record a Payment</h2>
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

              {allRelevantDebts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                    <Check size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">You're all settled up!</h3>
                  <p className="text-gray-400">You don't owe anything, and nobody owes you in this group.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-400 mb-2">Select a balance to settle:</p>
                  
                  <div className="space-y-2">
                    {allRelevantDebts.map((debt: any, i: number) => {
                      const isOwer = debt.from_user_id === user?.id;
                      const isSelected = selectedDebt === debt;

                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedDebt(debt);
                            setSettleAmount(debt.amount.toString());
                          }}
                          className={`w-full text-left p-4 rounded-xl border transition-all ${
                            isSelected 
                              ? 'bg-gray-800 border-primary shadow-[0_0_15px_rgba(212,175,55,0.15)]' 
                              : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-white">
                                {isOwer ? 'You pay ' : `${debt.from_user_name} pays you `}
                                {isOwer ? debt.to_user_name : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              {!isOwer && (
                                <button
                                  onClick={(e) => handlePing(debt.from_user_id, e)}
                                  className="text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-2 py-1 rounded hover:bg-primary/30 transition-colors"
                                >
                                  Ping
                                </button>
                              )}
                              <span className={`font-bold ${isOwer ? 'text-danger' : 'text-success'}`}>
                                INR {debt.amount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-4">
                    {selectedDebt && selectedDebt.to_user_id !== user?.id && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Amount to Settle (INR)</label>
                        <input
                          type="number"
                          step="0.01"
                          max={selectedDebt.amount}
                          value={settleAmount}
                          onChange={(e) => setSettleAmount(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors text-xl font-bold"
                        />
                      </div>
                    )}
                    <button
                      onClick={handleSettle}
                      disabled={loading || !selectedDebt || selectedDebt.to_user_id === user?.id || !settleAmount || parseFloat(settleAmount) <= 0}
                      className="w-full bg-primary text-black font-bold py-3.5 rounded-xl hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                    >
                      {loading 
                        ? 'Processing...' 
                        : selectedDebt && selectedDebt.to_user_id !== user?.id
                          ? `Pay INR ${parseFloat(settleAmount || '0').toFixed(2)} to ${selectedDebt.to_user_name}`
                          : selectedDebt
                            ? `Only ${selectedDebt.from_user_name} can record this payment`
                            : 'Select a balance to settle'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SettleUpModal;
