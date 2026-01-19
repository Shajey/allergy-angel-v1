import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useViewMode } from '@/context/ViewModeContext';
import { isClinician, getHeaderCopy, getCardClassName } from '@/lib/viewMode';
import { getSession } from '@/lib/sessionStore';
import { getDocuments, addDocument } from '@/lib/storage';
import { getServiceLine, getRequiredDocsForServiceLine } from '@/lib/serviceLines';
import type { RequiredDocRule, RequiredDocKey } from '@/types/serviceLines';
import type { DocumentRecord, DocumentType } from '@/types/documents';
import { showToast } from '@/lib/toast';
import { CheckCircle2, XCircle, Clock, AlertCircle, MessageSquare, Send } from 'lucide-react';
import {
  createDocumentRequestThread,
  findThreadByDocKey,
  addVNSDocumentAcknowledgment,
} from '@/lib/messageStore';
import {
  createDocumentRequestNotification,
  createDocumentReceivedNotification,
} from '@/lib/notificationStore';
import type { MessageSender } from '@/types/messages';
import {
  addDocumentUploadedEvent,
  addDocRequestedEvent,
  addChecklistItemMetEvent,
} from '@/lib/timelineStore';

type DocStatus = 'Met' | 'Missing' | 'Pending' | 'Requested';

interface DocRequirementStatus {
  rule: RequiredDocRule;
  status: DocStatus;
  matchingDocs: DocumentRecord[];
  threadId?: string; // Track if there's an active request thread
}

function CarePlanPage() {
  const { viewMode } = useViewMode();
  const navigate = useNavigate();
  const [session, setSession] = useState(getSession());
  const [requirements, setRequirements] = useState<DocRequirementStatus[]>([]);
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<RequiredDocRule | null>(null);
  
  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<DocumentType>('Other');
  const [uploadNotes, setUploadNotes] = useState('');

  // Load session and documents
  useEffect(() => {
    const loadData = () => {
      const currentSession = getSession();
      setSession(currentSession);
      
      const activePatient = currentSession.patients.find((p) => p.id === currentSession.activePatientId);
      if (!activePatient) return;

      const allDocs = getDocuments();
      const patientDocs = allDocs.filter((doc) => doc.patientId === currentSession.activePatientId);

      // Get service line requirements
      const requiredRules = getRequiredDocsForServiceLine(activePatient.serviceLineId);
      
      // Match documents to requirements
      const requirementStatuses: DocRequirementStatus[] = requiredRules.map((rule) => {
        const matchingDocs = patientDocs.filter(
          (doc) => doc.requiredDocKey === rule.key
        );

        // Check for active request thread
        const activeThread = findThreadByDocKey(currentSession.activePatientId, rule.key);

        let status: DocStatus = 'Missing';
        let threadId: string | undefined = undefined;

        if (matchingDocs.length > 0) {
          const hasAvailable = matchingDocs.some(
            (doc) => doc.status === 'Available'
          );
          const hasPending = matchingDocs.some(
            (doc) => doc.status === 'Pending' || doc.status === 'Processing'
          );
          
          if (hasAvailable) {
            status = 'Met';
          } else if (hasPending) {
            status = 'Pending';
          } else {
            // All rejected or other statuses
            status = 'Missing';
          }
        } else if (activeThread) {
          // No docs but there's an active request
          status = 'Requested';
          threadId = activeThread.id;
        }

        return {
          rule,
          status,
          matchingDocs,
          threadId,
        };
      });

      setRequirements(requirementStatuses);
    };

    loadData();

    // Listen for changes
    const handleChange = () => {
      loadData();
    };
    window.addEventListener('session-changed', handleChange);
    window.addEventListener('messages-changed', handleChange);

    return () => {
      window.removeEventListener('session-changed', handleChange);
      window.removeEventListener('messages-changed', handleChange);
    };
  }, []);

  const activePatient = session.patients.find((p) => p.id === session.activePatientId);
  const serviceLine = activePatient
    ? getServiceLine(activePatient.serviceLineId)
    : undefined;

  const handleUploadForRequirement = (requirement: RequiredDocRule) => {
    setSelectedRequirement(requirement);
    // Suggest title based on requirement key
    setUploadTitle(requirement.key);
    // Suggest document type based on requirement
    const typeMap: Record<RequiredDocKey, DocumentType> = {
      'Insurance Card': 'Other',
      'ID': 'Other',
      'Physician Order': 'Plan of Care',
      'Plan of Care': 'Plan of Care',
      'Consent': 'Other',
      'Visit Summary': 'Visit Summary',
      'Discharge Summary': 'Visit Summary',
      'Medication List': 'Other',
      'Assessment': 'Other',
      'Other': 'Other',
    };
    setUploadType(typeMap[requirement.key] || 'Other');
    setUploadNotes('');
    setIsUploadOpen(true);
  };

  const handleRequestFromVNS = (requirement: RequiredDocRule) => {
    const senderRole = session.user.role as MessageSender;
    
    // Create the message thread
    createDocumentRequestThread(
      session.activePatientId,
      requirement.key,
      senderRole
    );
    
    // Create notification
    createDocumentRequestNotification(session.activePatientId, requirement.key);
    
    // Add timeline event
    addDocRequestedEvent(session.activePatientId, requirement.key);
    
    showToast(`Requested "${requirement.key}" from VNS Provider Services`, 'success');
  };

  const handleViewRequest = (threadId: string) => {
    navigate('/messages');
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequirement) return;

    const newDoc: DocumentRecord = {
      id: Date.now().toString(),
      title: uploadTitle || selectedRequirement.key,
      type: uploadType,
      date: new Date().toISOString().split('T')[0],
      status: 'Processing',
      source: 'User Upload',
      notes: uploadNotes || undefined,
      patientId: session.activePatientId,
      requiredDocKey: selectedRequirement.key,
      tags: [selectedRequirement.key],
    };
    
    addDocument(newDoc);

    // Add timeline event for document upload
    addDocumentUploadedEvent(
      session.activePatientId,
      uploadTitle || selectedRequirement.key,
      selectedRequirement.key
    );

    // Check if this was for a requested document - if so, add VNS acknowledgment
    const activeThread = findThreadByDocKey(session.activePatientId, selectedRequirement.key);
    if (activeThread) {
      // Add VNS acknowledgment message and close thread
      addVNSDocumentAcknowledgment(activeThread.id, selectedRequirement.key);
      // Create success notification
      createDocumentReceivedNotification(session.activePatientId, selectedRequirement.key);
      // Add checklist item met event (since VNS acknowledged receipt)
      addChecklistItemMetEvent(session.activePatientId, selectedRequirement.key);
    }
    
    // Reload data
    const allDocs = getDocuments();
    const patientDocs = allDocs.filter((doc) => doc.patientId === session.activePatientId);

    // Recalculate requirements
    const requiredRules = getRequiredDocsForServiceLine(activePatient!.serviceLineId);
    const requirementStatuses: DocRequirementStatus[] = requiredRules.map((rule) => {
      const matchingDocs = patientDocs.filter(
        (doc) => doc.requiredDocKey === rule.key
      );

      // Check for active request thread
      const thread = findThreadByDocKey(session.activePatientId, rule.key);

      let status: DocStatus = 'Missing';
      let threadId: string | undefined = undefined;

      if (matchingDocs.length > 0) {
        const hasAvailable = matchingDocs.some(
          (doc) => doc.status === 'Available'
        );
        const hasPending = matchingDocs.some(
          (doc) => doc.status === 'Pending' || doc.status === 'Processing'
        );
        
        if (hasAvailable) {
          status = 'Met';
        } else if (hasPending) {
          status = 'Pending';
        } else {
          status = 'Missing';
        }
      } else if (thread) {
        status = 'Requested';
        threadId = thread.id;
      }

      return {
        rule,
        status,
        matchingDocs,
        threadId,
      };
    });
    setRequirements(requirementStatuses);

    showToast('Document uploaded successfully', 'success');
    setIsUploadOpen(false);
    setSelectedRequirement(null);
    setUploadTitle('');
    setUploadType('Other');
    setUploadNotes('');
  };

  const getStatusIcon = (status: DocStatus) => {
    switch (status) {
      case 'Met':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'Pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'Requested':
        return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'Missing':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadgeClass = (status: DocStatus) => {
    switch (status) {
      case 'Met':
        return 'bg-green-100 text-green-700';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'Requested':
        return 'bg-blue-100 text-blue-700';
      case 'Missing':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredRequirements = showMissingOnly
    ? requirements.filter((req) => req.status === 'Missing')
    : requirements;

  const documentTypes: DocumentType[] = [
    'Visit Summary',
    'Plan of Care',
    'Lab Result',
    'Billing',
    'Other',
  ];

  const patientName = activePatient?.fullName || "patient";
  const isClinicianMode = isClinician(viewMode);
  const headerCopy = getHeaderCopy("carePlan", patientName, viewMode);
  const cardClass = getCardClassName(viewMode);

  if (!activePatient || !serviceLine) {
    return (
      <PageShell>
        <PageHeader
          title="Care Plan"
          eyebrow="Care Plan"
          viewMode={viewMode}
        />
        <PageShellContent>
          <Card className={cardClass}>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No active patient selected.</p>
            </CardContent>
          </Card>
        </PageShellContent>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={headerCopy.title}
        eyebrow={headerCopy.eyebrow}
        subtitle={headerCopy.subtitle}
        viewMode={viewMode}
      />

      <PageShellContent>
        {/* Service Line Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Service Configuration
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Your Care Plan</h2>
          </div>

          <Card className={`shadow-sm hover:shadow-md transition-shadow duration-200 ${cardClass}`}>
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-semibold text-gray-900">Service Line</CardTitle>
              <CardDescription>Current service line for this patient</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">{serviceLine.name}</h3>
                <p className="text-gray-600">{serviceLine.description}</p>
                {activePatient.startDate && (
                  <p className="text-sm text-gray-500">
                    Service Start Date: {new Date(activePatient.startDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Required Documents Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Document Checklist
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Required Documents</h2>
            <p className="text-sm text-gray-600 mt-1">
              Complete these documents to fulfill your care plan requirements
            </p>
          </div>

          <Card className={`shadow-sm hover:shadow-md transition-shadow duration-200 ${cardClass}`}>
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">Checklist</CardTitle>
                  <CardDescription>
                    Documents required for {serviceLine.name}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showMissingOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowMissingOnly(!showMissingOnly)}
                  >
                    {showMissingOnly ? 'Show All' : 'Missing Only'}
                  </Button>
                </div>
              </div>
            </CardHeader>
          <CardContent className="p-6 pt-0">
            {filteredRequirements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <CheckCircle2 className="w-12 h-12 mb-4 text-green-500" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {showMissingOnly
                    ? 'All documents submitted!'
                    : 'No requirements found'}
                </p>
                <p className="text-sm text-gray-500 max-w-sm">
                  {showMissingOnly
                    ? 'Great job! All required documents for your care plan have been submitted.'
                    : 'There are no document requirements for this service line.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequirements.map((reqStatus, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <div className="mt-0.5">{getStatusIcon(reqStatus.status)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{reqStatus.rule.key}</h4>
                        {reqStatus.rule.optional && (
                          <span className="text-xs text-muted-foreground">(Optional)</span>
                        )}
                        <span
                          className={`px-2 py-1 rounded text-xs ${getStatusBadgeClass(
                            reqStatus.status
                          )}`}
                        >
                          {reqStatus.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {reqStatus.rule.description}
                      </p>
                      {reqStatus.matchingDocs.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {reqStatus.matchingDocs.length} document(s) uploaded
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {reqStatus.status === 'Missing' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRequestFromVNS(reqStatus.rule)}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Request from VNS
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleUploadForRequirement(reqStatus.rule)}
                          >
                            Upload
                          </Button>
                        </>
                      )}
                      {reqStatus.status === 'Requested' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reqStatus.threadId && handleViewRequest(reqStatus.threadId)}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            View Request
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleUploadForRequirement(reqStatus.rule)}
                          >
                            Upload
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </section>

      {/* Upload Modal */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Required Document</DialogTitle>
            <DialogDescription>
              Upload {selectedRequirement?.key} for {activePatient.fullName}
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
                onClick={() => {
                  setIsUploadOpen(false);
                  setSelectedRequirement(null);
                  setUploadTitle('');
                  setUploadType('Other');
                  setUploadNotes('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Upload Document</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </PageShellContent>
    </PageShell>
  );
}

export default CarePlanPage;
