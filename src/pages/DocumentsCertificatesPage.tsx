import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  EmptyState,
  FeedbackBanner,
  KpiMetricCard,
  PageHeader,
  StatusLabel,
} from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest, getStoredToken } from '../lib/api';
import type { DocumentCategory, VaultSection } from '../types/erp';

interface VaultDocumentRow {
  id: string;
  departmentId: string;
  section: VaultSection;
  ownerType: 'STUDENT' | 'STAFF';
  ownerId: string;
  ownerCode: string;
  ownerName: string;
  yearOfStudy?: number;
  category: DocumentCategory;
  title: string;
  documentNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  hasUploadedFile: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedByName?: string;
  verifiedAt?: string;
  verificationRemarks?: string;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;
}

interface StudentOption {
  id: string;
  registerNumber: string;
  fullName: string;
  yearOfStudy: number;
}

interface StaffOption {
  id: string;
  staffCode: string;
  fullName: string;
  designation: string;
}

interface VaultResponse {
  departmentId: string;
  isStudent: boolean;
  canVerify: boolean;
  summary: {
    totalCount: number;
    verifiedCount: number;
    pendingCount: number;
    rejectedCount: number;
    studentDocsCount: number;
    staffDocsCount: number;
  };
  documents: VaultDocumentRow[];
  students: StudentOption[];
  staff: StaffOption[];
}

const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'AADHAR', label: 'Aadhar Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'PAN_CARD', label: 'PAN Card' },
  { value: 'COMMUNITY_CERT', label: 'Community Certificate' },
  { value: 'INCOME_CERT', label: 'Income Certificate' },
  { value: 'BIRTH_CERT', label: 'Birth / Nativity Document' },
  { value: 'OTHER', label: 'Other Identity / KYC Document' },
];

const CERTIFICATE_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'MARKSHEET_10TH', label: '10th SSLC Marksheet' },
  { value: 'MARKSHEET_12TH', label: '12th HSC Marksheet' },
  { value: 'TRANSFER_CERT', label: 'Transfer Certificate (TC)' },
  { value: 'BONAFIDE_CERT', label: 'Bonafide Certificate' },
  { value: 'DEGREE_CERT', label: 'Degree / Provisional Certificate' },
  { value: 'INTERNSHIP_CERT', label: 'Internship Completion Certificate' },
  { value: 'COURSE_WORKSHOP_CERT', label: 'NPTEL / Course / Workshop Certificate' },
  { value: 'FDP_EXPERIENCE_CERT', label: 'FDP / Experience Certificate' },
  { value: 'OTHER', label: 'Other Certificate' },
];

const CATEGORY_LABEL_MAP: Record<DocumentCategory, string> = {
  AADHAR: 'Aadhar Card',
  PASSPORT: 'Passport',
  PAN_CARD: 'PAN Card',
  COMMUNITY_CERT: 'Community Certificate',
  INCOME_CERT: 'Income Certificate',
  BIRTH_CERT: 'Birth / Nativity',
  MARKSHEET_10TH: '10th Marksheet',
  MARKSHEET_12TH: '12th Marksheet',
  TRANSFER_CERT: 'Transfer Certificate',
  BONAFIDE_CERT: 'Bonafide Certificate',
  DEGREE_CERT: 'Degree / Provisional',
  INTERNSHIP_CERT: 'Internship Certificate',
  COURSE_WORKSHOP_CERT: 'Course / Workshop',
  FDP_EXPERIENCE_CERT: 'FDP / Experience',
  OTHER: 'Other',
};

function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsCertificatesPage({
  initialSection = 'DOCUMENT',
}: {
  initialSection?: VaultSection;
}) {
  const { user, selectedDepartmentId, departments } = useAuth();
  const [section, setSection] = useState<VaultSection>(initialSection);
  const [data, setData] = useState<VaultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<'ALL' | 'STUDENT' | 'STAFF'>('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Upload Drawer / Form
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadOwnerMode, setUploadOwnerMode] = useState<'SELF' | 'STUDENT' | 'STAFF'>('SELF');
  const [uploadStudentId, setUploadStudentId] = useState('');
  const [uploadStaffId, setUploadStaffId] = useState('');
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>(
    initialSection === 'DOCUMENT' ? 'AADHAR' : 'INTERNSHIP_CERT'
  );
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocNumber, setUploadDocNumber] = useState('');
  const [uploadAuthority, setUploadAuthority] = useState('');
  const [uploadIssueDate, setUploadIssueDate] = useState('2026-11-13');
  const [uploadExpiryDate, setUploadExpiryDate] = useState('');
  const [uploadFileMeta, setUploadFileMeta] = useState<{
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    fileDataUrl: string;
  } | null>(null);

  // Preview & Verification Modal
  const [previewDoc, setPreviewDoc] = useState<VaultDocumentRow | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [verifyRemarks, setVerifyRemarks] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    setSection(initialSection);
    setCategoryFilter('ALL');
    setUploadCategory(initialSection === 'DOCUMENT' ? 'AADHAR' : 'INTERNSHIP_CERT');
  }, [initialSection]);

  const activeDept = departments.find((d) => d.id === selectedDepartmentId);
  const isStudentUser = Boolean(user?.roles.includes('STUDENT') && !user?.staffId);

  const loadVault = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        departmentId: selectedDepartmentId,
        section,
      });
      if (ownerTypeFilter !== 'ALL') params.set('ownerType', ownerTypeFilter);
      if (selectedStudentId) params.set('ownerId', selectedStudentId);
      if (yearFilter !== 'ALL') params.set('yearOfStudy', yearFilter);
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (statusFilter !== 'ALL') params.set('verificationStatus', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiRequest<VaultResponse>(`/documents?${params.toString()}`);
      setData(res);
      if (res.students.length > 0 && !uploadStudentId) {
        setUploadStudentId(res.students[0].id);
      }
      if (res.staff.length > 0 && !uploadStaffId) {
        setUploadStaffId(user?.staffId || res.staff[0].id);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load document vault' });
    } finally {
      setLoading(false);
    }
  }, [
    selectedDepartmentId,
    section,
    ownerTypeFilter,
    selectedStudentId,
    yearFilter,
    categoryFilter,
    statusFilter,
    search,
    uploadStudentId,
    uploadStaffId,
    user?.staffId,
  ]);

  useEffect(() => {
    void loadVault();
  }, [loadVault]);

  // Clean up object URL on unmount or modal change
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUploadFileMeta(null);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Please select a file smaller than 4 MB.' });
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadFileMeta({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
        fileDataUrl: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setUploading(true);
    try {
      let ownerType: 'STUDENT' | 'STAFF' = 'STUDENT';
      let ownerId: string | undefined = user?.studentId;

      if (!isStudentUser) {
        if (uploadOwnerMode === 'SELF') {
          if (user?.staffId) {
            ownerType = 'STAFF';
            ownerId = user.staffId;
          } else {
            ownerType = 'STAFF';
            ownerId = uploadStaffId;
          }
        } else if (uploadOwnerMode === 'STUDENT') {
          ownerType = 'STUDENT';
          ownerId = uploadStudentId;
        } else {
          ownerType = 'STAFF';
          ownerId = uploadStaffId;
        }
      }

      await apiRequest('/documents', {
        method: 'POST',
        body: JSON.stringify({
          departmentId: selectedDepartmentId,
          section,
          ownerType,
          ownerId,
          category: uploadCategory,
          title: uploadTitle,
          documentNumber: uploadDocNumber || undefined,
          issuingAuthority: uploadAuthority || undefined,
          issueDate: uploadIssueDate || undefined,
          expiryDate: uploadExpiryDate || undefined,
          fileName: uploadFileMeta?.fileName,
          mimeType: uploadFileMeta?.mimeType,
          fileSizeBytes: uploadFileMeta?.fileSizeBytes,
          fileDataUrl: uploadFileMeta?.fileDataUrl,
        }),
      });

      setShowUploadForm(false);
      setUploadTitle('');
      setUploadDocNumber('');
      setUploadAuthority('');
      setUploadExpiryDate('');
      setUploadFileMeta(null);
      setFeedback({
        type: 'success',
        message: `${section === 'DOCUMENT' ? 'Document' : 'Certificate'} uploaded to vault and queued for verification.`,
      });
      await loadVault();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleOpenPreview = async (doc: VaultDocumentRow) => {
    setPreviewDoc(doc);
    setVerifyRemarks(doc.verificationRemarks || '');
    setPreviewLoading(true);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    try {
      const token = getStoredToken();
      const res = await fetch(`/api/v1/documents/${encodeURIComponent(doc.id)}/file`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Unable to load file preview');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to preview file' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadFile = async (doc: VaultDocumentRow) => {
    try {
      const token = getStoredToken();
      const res = await fetch(`/api/v1/documents/${encodeURIComponent(doc.id)}/file?download=1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fallbackName = doc.hasUploadedFile || doc.fileName.endsWith('.svg') ? doc.fileName : `${doc.fileName}.svg`;
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to download document' });
    }
  };

  const handleVerifyDecision = async (docId: string, status: 'VERIFIED' | 'REJECTED') => {
    setVerifyingId(docId);
    setFeedback(null);
    try {
      const res = await apiRequest<{ document: VaultDocumentRow }>(`/documents/${docId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ status, remarks: verifyRemarks }),
      });
      setFeedback({
        type: 'success',
        message: `Document marked as ${status === 'VERIFIED' ? 'Verified' : 'Rejected / Re-upload Requested'}.`,
      });
      if (previewDoc && previewDoc.id === docId) {
        setPreviewDoc(res.document);
        await handleOpenPreview(res.document);
      }
      await loadVault();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Verification failed' });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeleteDocument = async (doc: VaultDocumentRow) => {
    setFeedback(null);
    try {
      await apiRequest(`/documents/${doc.id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', message: `Removed "${doc.title}" from vault.` });
      if (previewDoc?.id === doc.id) {
        setPreviewDoc(null);
      }
      await loadVault();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to remove record' });
    }
  };

  const activeCategoryOptions = useMemo(
    () => (section === 'DOCUMENT' ? DOCUMENT_CATEGORIES : CERTIFICATE_CATEGORIES),
    [section]
  );

  const docs = data?.documents || [];
  const summary = data?.summary || {
    totalCount: 0,
    verifiedCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    studentDocsCount: 0,
    staffDocsCount: 0,
  };

  return (
    <div>
      <PageHeader
        title={
          section === 'DOCUMENT'
            ? isStudentUser
              ? 'My Identity & Personal Documents'
              : `Documents Vault (Aadhar, Passport & Records)${activeDept ? ` · ${activeDept.code}` : ''}`
            : isStudentUser
            ? 'My Academic & Achievement Certificates'
            : `Certificates Vault & Verification${activeDept ? ` · ${activeDept.code}` : ''}`
        }
        subtitle={
          isStudentUser
            ? 'Upload, view, and download your Aadhar, Passport, marksheets, and internship or course certificates'
            : 'Access, download, and verify individual student & staff identity documents (Aadhar, Passport) and uploaded certificates'
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setSection('DOCUMENT');
                  setCategoryFilter('ALL');
                  setUploadCategory('AADHAR');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  section === 'DOCUMENT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Documents (Aadhar &amp; Passport)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSection('CERTIFICATE');
                  setCategoryFilter('ALL');
                  setUploadCategory('INTERNSHIP_CERT');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  section === 'CERTIFICATE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                Certificates
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              {showUploadForm
                ? 'Close Upload Form'
                : section === 'DOCUMENT'
                ? 'Upload Document'
                : 'Upload Certificate'}
            </button>
          </div>
        }
      />

      {feedback && (
        <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiMetricCard
          label={section === 'DOCUMENT' ? 'Total Documents in Vault' : 'Total Certificates in Vault'}
          value={summary.totalCount}
          subtext={
            isStudentUser
              ? 'Stored securely for academic & placement access'
              : `${summary.studentDocsCount} student · ${summary.staffDocsCount} staff records`
          }
          tone="accent"
        />
        <KpiMetricCard
          label="Verified Records"
          value={summary.verifiedCount}
          subtext="Approved by Faculty Advisor / HOD / Admin"
          tone="positive"
        />
        <KpiMetricCard
          label="Pending Verification"
          value={summary.pendingCount}
          subtext={isStudentUser ? 'Awaiting staff verification' : 'Ready for staff review & verification'}
          tone={summary.pendingCount > 0 ? 'warning' : 'positive'}
        />
        <KpiMetricCard
          label="Action Required / Rejected"
          value={summary.rejectedCount}
          subtext="Records flagged for clear re-upload"
          tone={summary.rejectedCount > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <form
          onSubmit={handleUploadSubmit}
          className="bg-white border border-slate-200 rounded-lg p-5 mb-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Upload {section === 'DOCUMENT' ? 'Identity / Personal Document' : 'Academic / Achievement Certificate'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Attach a real PDF or image scan (up to 4 MB). Both students and staff can view and download anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {!isStudentUser && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Upload For</label>
                <select
                  value={uploadOwnerMode}
                  onChange={(e) => setUploadOwnerMode(e.target.value as 'SELF' | 'STUDENT' | 'STAFF')}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  {user?.staffId && <option value="SELF">My Own Profile ({user.fullName})</option>}
                  <option value="STUDENT">Individual Student</option>
                  <option value="STAFF">Department Staff Member</option>
                </select>
              </div>
            )}

            {!isStudentUser && uploadOwnerMode === 'STUDENT' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Student</label>
                <select
                  value={uploadStudentId}
                  onChange={(e) => setUploadStudentId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  {(data?.students || []).map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.registerNumber} — {st.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isStudentUser && uploadOwnerMode === 'STAFF' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Staff</label>
                <select
                  value={uploadStaffId}
                  onChange={(e) => setUploadStaffId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  {(data?.staff || []).map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.staffCode} — {st.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                {activeCategoryOptions.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Document / Certificate Title</label>
              <input
                type="text"
                required
                placeholder={
                  section === 'DOCUMENT'
                    ? 'e.g. Aadhar Card / Indian Passport'
                    : 'e.g. AWS Cloud Practitioner Certificate'
                }
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Document / Serial Number</label>
              <input
                type="text"
                placeholder="e.g. XXXX-XXXX-1234 or Cert No."
                value={uploadDocNumber}
                onChange={(e) => setUploadDocNumber(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Issuing Authority</label>
              <input
                type="text"
                placeholder="e.g. UIDAI / RPO Chennai / NPTEL"
                value={uploadAuthority}
                onChange={(e) => setUploadAuthority(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Issue Date</label>
              <input
                type="date"
                value={uploadIssueDate}
                onChange={(e) => setUploadIssueDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expiry Date (Optional)</label>
              <input
                type="date"
                value={uploadExpiryDate}
                onChange={(e) => setUploadExpiryDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Upload File (PDF, PNG, JPG, WEBP)
              </label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.txt"
                onChange={handleFilePick}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-blue-700 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-white"
              />
              {uploadFileMeta && (
                <p className="text-[11px] text-emerald-700 mt-1">
                  Attached: {uploadFileMeta.fileName} ({formatFileSize(uploadFileMeta.fileSizeBytes)})
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 hover:bg-blue-800 disabled:opacity-60 px-4 py-2 text-xs font-medium text-white cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Uploading...' : 'Save to Vault'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Individual Student / Staff Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search register no, name, Aadhar, passport, certificate..."
              className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {!isStudentUser && (
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              {(
                [
                  { value: 'ALL', label: 'All Records' },
                  { value: 'STUDENT', label: 'Student Records' },
                  { value: 'STAFF', label: 'Staff Records' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setOwnerTypeFilter(tab.value);
                    if (tab.value === 'STAFF') {
                      setSelectedStudentId('');
                      setYearFilter('ALL');
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    ownerTypeFilter === tab.value ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {!isStudentUser && ownerTypeFilter !== 'STAFF' && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Individual Student Lookup</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="">All Students ({data?.students.length || 0})</option>
                {(data?.students || []).map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.registerNumber} — {st.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isStudentUser && ownerTypeFilter !== 'STAFF' && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Year of Study</label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="ALL">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Document / Certificate Type</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
            >
              <option value="ALL">All Types</option>
              {activeCategoryOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Verification Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Verification</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected / Re-upload Needed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vault Table */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
          Loading vault records...
        </div>
      ) : docs.length === 0 ? (
        <EmptyState
          title={`No ${section === 'DOCUMENT' ? 'documents' : 'certificates'} match your filter`}
          description="Upload a new record or clear active student/category filters to inspect stored files."
          action={
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Now
            </button>
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Holder &amp; ID</th>
                  <th className="py-3 px-4">Category &amp; Title</th>
                  <th className="py-3 px-4">Reference No &amp; Authority</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4 text-right">View / Download / Verify</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {docs.map((doc) => {
                  const canDelete =
                    !isStudentUser || doc.verificationStatus !== 'VERIFIED';
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{doc.ownerName}</div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {doc.ownerCode} · {doc.ownerType === 'STUDENT' ? `Student${doc.yearOfStudy ? ` (Year ${doc.yearOfStudy})` : ''}` : 'Staff'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[11px] font-medium text-blue-700">
                          {CATEGORY_LABEL_MAP[doc.category] || doc.category}
                        </div>
                        <div className="font-medium text-slate-900 mt-0.5">{doc.title}</div>
                        <div className="text-[11px] text-slate-400">
                          {doc.fileName} · {formatFileSize(doc.fileSizeBytes)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 tabular-nums">
                          {doc.documentNumber || 'On File'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {doc.issuingAuthority || 'Institutional / Govt Record'}
                        </div>
                      </td>
                      <td className="py-3 px-4 tabular-nums text-slate-600">
                        <div>{doc.issueDate || doc.uploadedAt.slice(0, 10)}</div>
                        <div className="text-[11px] text-slate-400">by {doc.uploadedByName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel status={doc.verificationStatus} />
                        {doc.verifiedByName && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{doc.verifiedByName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleOpenPreview(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-700" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownloadFile(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-700" />
                            Download
                          </button>
                          {data?.canVerify && doc.verificationStatus !== 'VERIFIED' && (
                            <button
                              type="button"
                              disabled={verifyingId === doc.id}
                              onClick={() => void handleVerifyDecision(doc.id, 'VERIFIED')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-medium cursor-pointer"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              Verify
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              title="Delete document"
                              onClick={() => void handleDeleteDocument(doc)}
                              className="p-1.5 rounded border border-slate-200 text-slate-400 hover:text-red-700 hover:border-red-200 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Document Preview & Staff Verification Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-blue-700">
                    {CATEGORY_LABEL_MAP[previewDoc.category]}
                  </span>
                  <span className="text-slate-300">·</span>
                  <StatusLabel status={previewDoc.verificationStatus} />
                </div>
                <h3 className="text-base font-semibold text-slate-900 truncate mt-0.5">
                  {previewDoc.title} — {previewDoc.ownerName} ({previewDoc.ownerCode})
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleDownloadFile(previewDoc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  Download File
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-slate-50 space-y-4">
              {previewLoading ? (
                <div className="h-80 flex items-center justify-center text-xs text-slate-500">
                  Loading document preview...
                </div>
              ) : previewBlobUrl ? (
                previewDoc.mimeType === 'application/pdf' ? (
                  <iframe
                    src={previewBlobUrl}
                    title={previewDoc.title}
                    className="w-full h-[460px] rounded-lg border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="flex justify-center bg-white border border-slate-200 rounded-lg p-3">
                    <img
                      src={previewBlobUrl}
                      alt={previewDoc.title}
                      className="max-h-[460px] w-auto object-contain rounded"
                    />
                  </div>
                )
              ) : (
                <div className="h-60 flex items-center justify-center text-xs text-slate-500">
                  Preview unavailable — click Download File to inspect locally.
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Reference / Document No:</span>
                  <div className="font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {previewDoc.documentNumber || 'On File'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Issuing Authority:</span>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {previewDoc.issuingAuthority || 'Institutional / Govt Authority'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Verification Note:</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {previewDoc.verificationRemarks || (previewDoc.verifiedByName ? `Verified by ${previewDoc.verifiedByName}` : 'Pending staff review')}
                  </div>
                </div>
              </div>

              {data?.canVerify && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="text"
                    value={verifyRemarks}
                    onChange={(e) => setVerifyRemarks(e.target.value)}
                    placeholder="Add verification remark (e.g. Original Aadhar checked / Clear scan needed)..."
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={verifyingId === previewDoc.id}
                      onClick={() => void handleVerifyDecision(previewDoc.id, 'VERIFIED')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve &amp; Verify
                    </button>
                    <button
                      type="button"
                      disabled={verifyingId === previewDoc.id}
                      onClick={() => void handleVerifyDecision(previewDoc.id, 'REJECTED')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-red-300 bg-white hover:bg-red-50 text-red-700 text-xs font-medium cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject / Re-upload
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
