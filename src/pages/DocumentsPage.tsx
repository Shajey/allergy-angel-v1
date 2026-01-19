import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PageShell, { PageShellContent } from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import ClinicalDocumentViewer from '@/components/documents/ClinicalDocumentViewer';
import { useViewMode, type ViewMode } from '@/context/ViewModeContext';
import { Info } from 'lucide-react';
import { getHeaderCopy, getCardClassName } from '@/lib/viewMode';
import type {
  DocumentRecord,
  DocumentType,
  DocumentStatus,
} from '@/types/documents';
import {
  getDocuments,
  addDocument,
  updateDocument,
  deleteDocument,
} from '@/lib/storage';
import type { ClinicalDocument } from '@/data/clinicalDocuments';
import {
  getClinicalDocuments,
  markClinicalDocumentOpened,
  markClinicalDocumentReviewed,
  getClinicalTypeBadgeClass,
  getClinicalStatusBadgeClass,
  getClinicalTypeLabel,
} from '@/data/clinicalDocuments';
import { getSession } from '@/lib/sessionStore';
import { showToast } from '@/lib/toast';

type TabType = 'administrative' | 'clinical';

function DocumentsPage() {
  const { viewMode } = useViewMode();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Tab state - default to clinical if ?tab=clinical is present
  const initialTab = (searchParams.get('tab') as TabType) || 'administrative';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [clinicalDocs, setClinicalDocs] = useState<ClinicalDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [selectedClinicalDoc, setSelectedClinicalDoc] = useState<ClinicalDocument | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isClinicalViewerOpen, setIsClinicalViewerOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  
  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<DocumentType>('Other');
  const [uploadNotes, setUploadNotes] = useState('');

  // Handle tab changes via URL params
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType;
    if (tabParam && (tabParam === 'administrative' || tabParam === 'clinical')) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Load documents on mount and when session changes
  useEffect(() => {
    const loadDocuments = () => {
      const session = getSession();
      const allDocs = getDocuments();
      // Filter documents by active patient
      const patientDocs = allDocs.filter((doc) => doc.patientId === session.activePatientId);
      setDocuments(patientDocs);
      
      // Load clinical documents
      setClinicalDocs(getClinicalDocuments());
    };

    loadDocuments();

    // Listen for session changes
    const handleSessionChange = () => {
      loadDocuments();
    };
    
    const handleClinicalDocsChange = () => {
      setClinicalDocs(getClinicalDocuments());
    };
    
    window.addEventListener('session-changed', handleSessionChange);
    window.addEventListener('clinical-documents-changed', handleClinicalDocsChange);

    return () => {
      window.removeEventListener('session-changed', handleSessionChange);
      window.removeEventListener('clinical-documents-changed', handleClinicalDocsChange);
    };
  }, []);

  // Get new clinical docs count
  const newClinicalDocsCount = clinicalDocs.filter((doc) => doc.reviewedAt === null).length;

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleViewDocument = (doc: DocumentRecord) => {
    setSelectedDoc(doc);
    setIsDetailOpen(true);
  };

  const handleViewClinicalDocument = (doc: ClinicalDocument) => {
    // Mark as opened if not already
    markClinicalDocumentOpened(doc.id);
    setSelectedClinicalDoc(doc);
    setIsClinicalViewerOpen(true);
  };

  const handleMarkClinicalReviewed = (id: string) => {
    markClinicalDocumentReviewed(id);
    setClinicalDocs(getClinicalDocuments());
    // Update the selected doc if it's still open
    if (selectedClinicalDoc?.id === id) {
      const updated = getClinicalDocuments().find((d) => d.id === id);
      if (updated) setSelectedClinicalDoc(updated);
    }
  };

  const handleDownloadDocument = (doc: DocumentRecord) => {
    // Fake download - just show toast
    showToast(`Downloading ${doc.title}...`, 'success');
  };

  const handleDeleteClick = (id: string) => {
    setDocToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (docToDelete) {
      deleteDocument(docToDelete);
      const session = getSession();
      const allDocs = getDocuments();
      const patientDocs = allDocs.filter((doc) => doc.patientId === session.activePatientId);
      setDocuments(patientDocs);
      showToast('Document deleted successfully', 'success');
      setIsDeleteConfirmOpen(false);
      setDocToDelete(null);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const session = getSession();
    const newDoc: DocumentRecord = {
      id: Date.now().toString(),
      title: uploadTitle || 'Untitled Document',
      type: uploadType,
      date: new Date().toISOString().split('T')[0],
      status: 'Processing',
      source: 'User Upload',
      notes: uploadNotes || undefined,
      patientId: session.activePatientId,
    };
    addDocument(newDoc);
    const allDocs = getDocuments();
    const patientDocs = allDocs.filter((doc) => doc.patientId === session.activePatientId);
    setDocuments(patientDocs);
    showToast('Document uploaded successfully', 'success');
    setIsUploadOpen(false);
    setUploadTitle('');
    setUploadType('Other');
    setUploadNotes('');
  };

  const handleSimulateProcessing = (doc: DocumentRecord) => {
    updateDocument(doc.id, { status: 'Available' });
    const session = getSession();
    const allDocs = getDocuments();
    const patientDocs = allDocs.filter((d) => d.patientId === session.activePatientId);
    setDocuments(patientDocs);
    if (selectedDoc?.id === doc.id) {
      setSelectedDoc({ ...doc, status: 'Available' });
    }
    showToast('Document processing complete', 'success');
  };

  const getStatusBadgeClass = (status: DocumentStatus) => {
    switch (status) {
      case 'Available':
        return 'bg-success-bg text-success-text';
      case 'Pending':
        return 'bg-warn-bg text-warn-text';
      case 'Processing':
        return 'bg-info-bg text-info-text';
      case 'Rejected':
        return 'bg-error-bg text-error-text';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const documentTypes: DocumentType[] = [
    'Visit Summary',
    'Plan of Care',
    'Lab Result',
    'Billing',
    'Other',
  ];

  // Get persona-aware border color for context banner
  const getContextBannerBorderClass = (mode: ViewMode): string => {
    switch (mode) {
      case 'patient':
        return 'border-emerald-400';
      case 'caregiver':
        return 'border-blue-400';
      case 'clinician':
        return 'border-purple-400';
    }
  };

  const documentStatuses: DocumentStatus[] = [
    'Available',
    'Pending',
    'Processing',
    'Rejected',
  ];

  // Get active patient name for header
  const session = getSession();
  const activePatient = session.patients.find((p) => p.id === session.activePatientId);
  const patientName = activePatient?.fullName || "patient";
  const headerCopy = getHeaderCopy("documents", patientName, viewMode);
  const cardClass = getCardClassName(viewMode);

  // Format date for clinical docs
  const formatClinicalDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <PageShell>
      <PageHeader
        title={headerCopy.title}
        eyebrow={headerCopy.eyebrow}
        subtitle={headerCopy.subtitle}
        viewMode={viewMode}
      />

      <PageShellContent>
        {/* Section Header */}
        <section>
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Document Management
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Your Documents</h2>
            <p className="text-sm text-gray-600 mt-1">
              View administrative and clinical documents related to your care
            </p>
          </div>
        </section>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex gap-8" aria-label="Tabs">
            <button
              onClick={() => handleTabChange('administrative')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'administrative'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Administrative
            </button>
            <button
              onClick={() => handleTabChange('clinical')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'clinical'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Clinical
              {newClinicalDocsCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-600 text-white">
                  {newClinicalDocsCount} New
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Administrative Tab Content */}
        {activeTab === 'administrative' && (
          <section className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                placeholder="Search documents by title or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Select
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as DocumentType | 'all')}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {documentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as DocumentStatus | 'all')}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {documentStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setIsUploadOpen(true)}>
                Upload Document
              </Button>
            </div>

            {/* Documents Table */}
            <Card className={`shadow-sm hover:shadow-md transition-shadow duration-200 ${cardClass}`}>
              <CardContent className="p-0">
                {filteredDocuments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                    <svg
                      className="w-12 h-12 mb-4 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      {documents.length === 0 ? 'No documents yet' : 'No documents match your filters'}
                    </p>
                    <p className="text-sm text-gray-500 max-w-sm">
                      {documents.length === 0
                        ? 'Upload your first document to get started with your care plan.'
                        : 'Try adjusting your search or filter criteria.'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">{doc.title}</TableCell>
                          <TableCell>{doc.type}</TableCell>
                          <TableCell>{doc.date}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded text-xs ${getStatusBadgeClass(
                                doc.status
                              )}`}
                            >
                              {doc.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => handleViewDocument(doc)}
                              >
                                View
                              </Button>
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => handleDownloadDocument(doc)}
                              >
                                Download
                              </Button>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-destructive"
                                onClick={() => handleDeleteClick(doc.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Clinical Tab Content */}
        {activeTab === 'clinical' && (
          <section className="space-y-6">
            {/* Section Header */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Care Team Documents
              </span>
              <h2 className="text-xl font-semibold text-gray-900 mt-1">
                Clinical Documents
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Care plans, assessments, and visit summaries from your care team at VNS Health
              </p>
            </div>

            {/* Context Banner - explains the purpose of Clinical Documents */}
            <div
              className={`bg-slate-50 border-l-4 ${getContextBannerBorderClass(viewMode)} rounded-lg p-4 flex items-start gap-3`}
            >
              <Info className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-slate-700">
                  These documents are shared between your VNS care team and your health plan to help coordinate your care.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Your care team may review these documents together to ensure services align with your care plan.
                </p>
              </div>
            </div>

            {/* New Count Banner */}
            {newClinicalDocsCount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    You have {newClinicalDocsCount} new clinical document{newClinicalDocsCount !== 1 ? 's' : ''} to review
                  </p>
                  <p className="text-xs text-blue-700">
                    Review documents to stay informed about your care plan
                  </p>
                </div>
              </div>
            )}

            {/* Clinical Documents Table */}
            <Card className={`shadow-sm hover:shadow-md transition-shadow duration-200 ${cardClass}`}>
              <CardContent className="p-0">
                {clinicalDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                    <svg
                      className="w-12 h-12 mb-4 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      No clinical documents yet
                    </p>
                    <p className="text-sm text-gray-500 max-w-sm">
                      Your care team will share care plans, assessments, and visit summaries here.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clinicalDocs.map((doc) => {
                        const isNew = doc.reviewedAt === null;
                        return (
                          <TableRow
                            key={doc.id}
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => handleViewClinicalDocument(doc)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{doc.title}</span>
                                {isNew && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-600 text-white">
                                    New
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${getClinicalTypeBadgeClass(
                                  doc.type
                                )}`}
                              >
                                {getClinicalTypeLabel(doc.type)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${getClinicalStatusBadgeClass(
                                  doc.status
                                )}`}
                              >
                                {doc.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {doc.authorRole}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {formatClinicalDate(doc.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewClinicalDocument(doc);
                                }}
                              >
                                View →
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Clinical Document Viewer Modal */}
        <ClinicalDocumentViewer
          document={selectedClinicalDoc}
          isOpen={isClinicalViewerOpen}
          onClose={() => {
            setIsClinicalViewerOpen(false);
            setSelectedClinicalDoc(null);
          }}
          onMarkReviewed={handleMarkClinicalReviewed}
        />

        {/* Administrative Document Detail Modal */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedDoc?.title}</DialogTitle>
              <DialogDescription>
                Document details and metadata
              </DialogDescription>
            </DialogHeader>
            {selectedDoc && (() => {
              const session = getSession();
              const patient = session.patients.find((p) => p.id === selectedDoc.patientId);
              return (
                <div className="space-y-4 py-4">
                  {patient && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Patient
                      </label>
                      <p>{patient.fullName}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Type
                    </label>
                    <p>{selectedDoc.type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Date
                    </label>
                    <p>{selectedDoc.date}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Status
                    </label>
                    <p>
                      <span
                        className={`px-2 py-1 rounded text-xs ${getStatusBadgeClass(
                          selectedDoc.status
                        )}`}
                      >
                        {selectedDoc.status}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Source
                    </label>
                    <p>{selectedDoc.source}</p>
                  </div>
                  {selectedDoc.fileName && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        File Name
                      </label>
                      <p>{selectedDoc.fileName}</p>
                    </div>
                  )}
                  {selectedDoc.notes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Notes
                      </label>
                      <p className="text-sm">{selectedDoc.notes}</p>
                    </div>
                  )}
                  {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Tags
                      </label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedDoc.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            <DialogFooter>
              {selectedDoc?.status === 'Processing' && (
                <Button
                  variant="outline"
                  onClick={() => selectedDoc && handleSimulateProcessing(selectedDoc)}
                >
                  Simulate Processing Complete
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => selectedDoc && handleDownloadDocument(selectedDoc)}
              >
                Download
              </Button>
              <Button onClick={() => setIsDetailOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Modal */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Add a new document to your collection
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUploadSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <label htmlFor="title" className="text-sm font-medium mb-2 block">
                    Title *
                  </label>
                  <Input
                    id="title"
                    placeholder="Enter document title"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="type" className="text-sm font-medium mb-2 block">
                    Type *
                  </label>
                  <Select
                    value={uploadType}
                    onValueChange={(value) => setUploadType(value as DocumentType)}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="notes" className="text-sm font-medium mb-2 block">
                    Notes (optional)
                  </label>
                  <Input
                    id="notes"
                    placeholder="Add any notes about this document"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                  />
                </div>
                <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    File upload will be handled in a future release
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Upload Document</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this document? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setDocToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageShellContent>
    </PageShell>
  );
}

export default DocumentsPage;
