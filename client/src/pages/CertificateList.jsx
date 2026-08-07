import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, FileText, XCircle, FileSpreadsheet } from 'lucide-react';
import api, { getBackendUrl } from '../services/api';
import toast from 'react-hot-toast';
import BulkUploadModal from '../components/BulkUploadModal';

export default function CertificateList() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchCertificates = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await api.get(`/certificates?search=${search}&page=${pageNum}&limit=15`);
      const newCerts = res.data.data;
      
      if (append) {
        setCertificates(prev => [...prev, ...newCerts]);
      } else {
        setCertificates(newCerts);
      }
      
      setHasMore(pageNum < res.data.totalPages);
    } catch {
      toast.error('Failed to load certificates');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search]);

  useEffect(() => {
    setPage(1);
    const delayDebounce = setTimeout(() => {
      fetchCertificates(1, false);
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [search, fetchCertificates]);

  useEffect(() => {
    if (page > 1) {
      fetchCertificates(page, true);
    }
  }, [page, fetchCertificates]);

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    // Check if we are near the bottom of the scroll container
    if (scrollHeight - scrollTop <= clientHeight + 50 && hasMore && !loadingMore && !loading) {
      setPage(prev => prev + 1);
    }
  };

  const handleRevoke = async (id) => {
    if (window.confirm('Are you sure you want to revoke this certificate?')) {
      try {
        await api.post(`/certificates/${id}/revoke`);
        toast.success('Certificate revoked');
        fetchCertificates(1, false);
      } catch {
        toast.error('Failed to revoke');
      }
    }
  };

  const handleViewPdf = async (pdfPath) => {
    try {
      const loadingToast = toast.loading('Opening certificate...');
      
      const response = await fetch(getBackendUrl(pdfPath));
      if (!response.ok) throw new Error('Network response was not ok');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      toast.dismiss(loadingToast);
      
      window.open(url, '_blank');
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 10000);
    } catch (error) {
      toast.error('Failed to load PDF');
      toast.dismiss();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Certificates</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage all generated internship certificates</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <FileSpreadsheet size={20} className="text-primary-600 dark:text-primary-400" /> Bulk Generate
          </button>
          <Link 
            to="/admin/certificates/new"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-primary-500/30"
          >
            <Plus size={20} /> Generate New
          </Link>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by name, ID or college..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }} onScroll={handleScroll}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 text-sm">
                <th className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 px-6 py-4 font-medium border-b border-slate-200 dark:border-slate-700 shadow-sm before:content-[''] before:absolute before:bottom-0 before:left-0 before:right-0 before:border-b before:border-slate-200 dark:before:border-slate-700">Certificate ID</th>
                <th className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider shadow-sm">Regd No</th>
                <th className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider shadow-sm">College</th>
                <th className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider shadow-sm">Program</th>
                <th className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 px-6 py-4 font-medium shadow-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading && page === 1 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">Loading certificates...</td>
                </tr>
              ) : certificates.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">No certificates found.</td>
                </tr>
              ) : (
                <>
                  {certificates.map((cert) => (
                    <tr key={cert._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300">{cert.certificateId}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{cert.regdNo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{cert.college}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{cert.programName}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleViewPdf(cert.pdfPath)} className="text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors" title="View PDF">
                            <FileText size={20} />
                          </button>
                          {cert.status === 'Verified' && (
                            <button onClick={() => handleRevoke(cert._id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Revoke">
                              <XCircle size={20} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {loadingMore && (
                    <tr>
                      <td colSpan="5" className="text-center py-4 text-slate-500 text-sm">Loading more...</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <BulkUploadModal 
        isOpen={isBulkModalOpen} 
        onClose={() => setIsBulkModalOpen(false)} 
        onComplete={() => {
          fetchCertificates(1, false);
        }}
      />
    </div>
  );
}
