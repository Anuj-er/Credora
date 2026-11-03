import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import UniversityDashboard from './pages/UniversityDashboard';
import StudentDashboard from './pages/StudentDashboard';
import VerifyCertificate from './pages/VerifyCertificate';
import CertificateDetail from './pages/CertificateDetail';
import NotFound from './pages/NotFound';
import Unauthorized from './pages/Unauthorized';

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<VerifyCertificate />} />
          <Route path="/verify/:certId" element={<VerifyCertificate />} />
          <Route path="/certificate/:certId" element={
            <ProtectedRoute roles={['student', 'university', 'admin']}>
              <CertificateDetail />
            </ProtectedRoute>
          } />
          <Route path="/admin/*" element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/university/*" element={
            <ProtectedRoute roles={['university']}>
              <UniversityDashboard />
            </ProtectedRoute>
          } />
          <Route path="/student/*" element={
            <ProtectedRoute roles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          } />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
