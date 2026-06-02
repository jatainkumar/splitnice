import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import ProfileSetup from './ProfileSetup';

const ProtectedRoute = () => {
  const { user, firebaseUser, loading } = useAuth();

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

  // If Firebase user is not logged in, go to landing page
  if (!firebaseUser) {
    return <Navigate to="/" replace />;
  }

  // If Firebase user is logged in, but backend user is not loaded or missing
  // we wait for it. If it fails completely, they might need to logout.
  // We can let the AuthContext handle the DB creation.
  if (firebaseUser && !user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4"
        />
        <p className="text-gray-400 font-medium">Setting up your premium account...</p>
      </div>
    );
  }

  // Enforce profile setup (mobile number)
  if (user && !user.mobile_number) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <ProfileSetup onComplete={() => {}} />
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
