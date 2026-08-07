import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { getBackendUrl } from '../services/api';
import { CheckCircle, XCircle, AlertCircle, Building2, Calendar, User, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function VerificationPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyCertificate = async () => {
      try {
        const res = await api.get(`/verify/${id}`);
        setData(res.data);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          setError('Certificate Not Found');
        } else {
          setError('Network Error: Could not connect to verification server');
        }
      } finally {
        setLoading(false);
      }
    };
    verifyCertificate();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
        <p className="text-slate-500 dark:text-slate-400 animate-pulse">Verifying Certificate...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="text-red-500 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{error === 'Certificate Not Found' ? 'Certificate Not Found' : 'Verification Failed'}</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">{error === 'Certificate Not Found' ? 'The certificate ID you entered is invalid or the certificate has been removed.' : error}</p>
          <Link to="/" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium">Return Home</Link>
        </div>
      </div>
    );
  }

  const { certificate, verificationTime } = data;
  const isVerified = certificate.status === 'Verified';
  const isRevoked = certificate.status === 'Revoked';
  const isExpired = certificate.status === 'Expired';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="text-primary-500 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Certificate Verification</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Official verification portal for <span className="whitespace-nowrap">{certificate.companyName}</span>
          </p>
        </div>

        <div className="glass-card overflow-hidden">
          {/* Status Header */}
          <div className={`p-6 text-center ${
            isVerified ? 'bg-emerald-500/10' : 
            isRevoked ? 'bg-red-500/10' : 'bg-orange-500/10'
          }`}>
            {isVerified && <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-3" />}
            {isRevoked && <XCircle className="w-16 h-16 text-red-500 mx-auto mb-3" />}
            {isExpired && <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-3" />}
            
            <h2 className={`text-2xl font-bold ${
              isVerified ? 'text-emerald-700 dark:text-emerald-400' :
              isRevoked ? 'text-red-700 dark:text-red-400' : 'text-orange-700 dark:text-orange-400'
            }`}>
              {isVerified && 'CERTIFICATE VERIFIED'}
              {isRevoked && 'CERTIFICATE REVOKED'}
              {isExpired && 'CERTIFICATE EXPIRED'}
            </h2>
            <p className="text-sm mt-2 font-medium opacity-80 text-slate-700 dark:text-slate-300">
              Verified on {format(new Date(verificationTime), 'PPP p')}
            </p>
          </div>

          {/* Certificate Details */}
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <User size={16} /> Student Name
                </p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">{certificate.studentName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Registration Number</p>
                <p className="text-lg font-mono font-bold text-slate-800 dark:text-white">{certificate.regdNo}</p>
              </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-700" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Building2 size={16} /> College / University
                </p>
                <p className="font-medium text-slate-800 dark:text-white">{certificate.college}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <ShieldCheck size={16} /> Program
                </p>
                <p className="font-medium text-slate-800 dark:text-white">{certificate.programName}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Calendar size={16} /> Duration
                </p>
                <p className="font-medium text-slate-800 dark:text-white">
                  {certificate.startDate && format(new Date(certificate.startDate), 'dd MMM yyyy').toUpperCase()} to {certificate.endDate && format(new Date(certificate.endDate), 'dd MMM yyyy').toUpperCase()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Calendar size={16} /> Issue Date
                </p>
                <p className="font-medium text-slate-800 dark:text-white">
                  {format(new Date(certificate.issuedDate), 'dd MMM yyyy').toUpperCase()}
                </p>
              </div>
            </div>

            {isVerified && certificate.pdfPath && (
              <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                <a 
                  href={getBackendUrl(certificate.pdfPath)} 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-lg shadow-slate-900/20"
                >
                  View Original Certificate
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
