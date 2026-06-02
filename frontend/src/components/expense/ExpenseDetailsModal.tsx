import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../services/api';

interface ExpenseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseId: string | null;
  onEdit?: () => void;
  onDelete?: (expenseId: string) => void;
}

const ExpenseDetailsModal = ({ isOpen, onClose, expenseId, onEdit, onDelete }: ExpenseDetailsModalProps) => {
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && expenseId) {
      fetchExpenseDetails();
    }
  }, [isOpen, expenseId]);

  const fetchExpenseDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/expenses/${expenseId}`);
      setExpense(res.data);
    } catch (error) {
      console.error("Failed to load expense details", error);
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
          className="bg-surface-dark w-full max-w-md max-h-[85vh] rounded-2xl border border-gray-800 shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-surface-dark shrink-0">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Receipt size={20} className="text-primary" /> Expense Details
            </h2>
            <div className="flex items-center gap-4">
              {expense?.can_edit && onEdit && (
                <button 
                  onClick={onEdit} 
                  className="text-primary hover:text-primary-light text-sm font-bold uppercase tracking-wide transition-colors"
                >
                  Edit
                </button>
              )}
              {expense?.can_edit && onDelete && (
                <button 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this expense?')) {
                      onDelete(expense.id);
                    }
                  }}
                  className="text-red-500 hover:text-red-400 text-sm font-bold uppercase tracking-wide transition-colors"
                >
                  Delete
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-6 space-y-6">
            {loading || !expense ? (
              <div className="flex justify-center p-10">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                />
              </div>
            ) : (
              <>
                <div className="text-center pb-4 border-b border-gray-800">
                  <h3 className="text-2xl font-bold text-white mb-2">{expense.description || 'Untitled Expense'}</h3>
                  <p className="text-3xl font-black text-primary">
                    {expense.currency} {expense.total_amount.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Added by {expense.creator_name} on {new Date(expense.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 capitalize">
                    Split Type: {expense.split_type}
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-white mb-3 flex items-center justify-between">
                    <span>Who Paid</span>
                  </h4>
                  <ul className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
                    {expense.payers.map((p: any, i: number) => (
                      <li key={i} className="p-3 flex justify-between items-center">
                        <span className="font-medium text-gray-300">{p.user_name}</span>
                        <span className="font-bold text-white">{expense.currency} {p.amount_paid.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-white mb-3">Who Owes What</h4>
                  <ul className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
                    {expense.splits.map((s: any, i: number) => (
                      <li key={i} className="p-3 flex justify-between items-center">
                        <span className="font-medium text-gray-300">{s.user_name}</span>
                        <span className="font-bold text-red-400">{expense.currency} {s.owed_amount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {expense.receipt_image && (
                  <div>
                    <h4 className="font-bold text-white mb-3">Receipt</h4>
                    <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900">
                      <img src={expense.receipt_image} alt="Receipt" className="w-full h-auto" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ExpenseDetailsModal;
