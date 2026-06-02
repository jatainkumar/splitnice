import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { signInWithGoogle } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

const LandingPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      // OnAuthStateChanged in AuthContext will handle the redirect
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative flex flex-col">
      {/* Premium Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary opacity-10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary opacity-10 rounded-full blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav className="w-full p-6 flex justify-between items-center z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-3xl font-cursive text-primary">Splitnice</h1>
        </motion.div>
        
        <motion.button 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          onClick={handleLogin}
          className="flex items-center gap-2 text-sm font-semibold tracking-wider uppercase text-white hover:text-primary transition-colors duration-300"
        >
          <span>Sign In</span>
          <LogIn size={18} />
        </motion.button>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center p-6 z-10 mt-[-5vh]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-6">
            Share <span className="text-primary italic font-serif">Expenses</span><br/>
            Keep Friends.
          </h1>
        </motion.div>
        
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-gray-400 text-lg md:text-xl max-w-2xl mb-12"
        >
          The most elegant way to track balances, simplify debts, and settle up with your group. Experience premium bill splitting.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogin}
          className="bg-primary text-black font-bold py-4 px-10 rounded-full text-lg shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:shadow-[0_0_50px_rgba(212,175,55,0.6)] transition-all duration-300"
        >
          Get Started with Google
        </motion.button>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center z-10 border-t border-gray-800/30">
        <p className="text-gray-500 text-sm tracking-wide">
          &copy; {new Date().getFullYear()} All rights reserved. Project made by Jatain Kumar.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
