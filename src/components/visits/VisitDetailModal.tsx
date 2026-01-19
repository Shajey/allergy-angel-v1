import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Visit } from "@/types/visits";
import {
  getVisitTypeColor,
  getVisitStatusColor,
  getVisitStatusLabel,
} from "@/types/visits";
import { updateVisit } from "@/lib/visitStore";
import { addThread } from "@/lib/messageStore";
import { addNotification } from "@/lib/notificationStore";
import { addEvent } from "@/lib/timelineStore";
import { getSession } from "@/lib/sessionStore";
import { showToast } from "@/lib/toast";

interface VisitDetailModalProps {
  visit: Visit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVisitUpdated?: () => void;
}

/**
 * Format date for display.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format time range for display.
 */
function formatTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${startTime} - ${endTime}`;
}

/**
 * Format date for message subject.
 */
function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function VisitDetailModal({
  visit,
  open,
  onOpenChange,
  onVisitUpdated,
}: VisitDetailModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!visit) return null;

  const session = getSession();
  const patient = session.patients.find((p) => p.id === visit.patientId);
  const patientName = patient?.fullName || "the patient";
  const senderRole = session.user.role;

  const canRequestChange =
    visit.status === "Scheduled" || visit.status === "PendingChange";
  const canCancel = visit.status === "Scheduled";

  /**
   * Handle request change action.
   */
  const handleRequestChange = async () => {
    if (!visit) return;
    setIsProcessing(true);

    try {
      const shortDate = formatShortDate(visit.startAt);
      const subject = `Visit update request: ${visit.type} on ${shortDate}`;

      // Create message body based on role
      let messageBody: string;
      if (senderRole === "Caregiver") {
        messageBody = `Hello,\n\nI am the caregiver for ${patientName} and would like to request a change to the following visit:\n\n- Type: ${visit.type}\n- Date: ${shortDate}\n- Time: ${formatTimeRange(visit.startAt, visit.endAt)}\n- Location: ${visit.location}\n${visit.clinicianName ? `- Clinician: ${visit.clinicianName}` : ""}\n\nPlease contact me to discuss alternative arrangements.\n\nThank you.`;
      } else {
        messageBody = `Hello,\n\nI would like to request a change to my upcoming visit:\n\n- Type: ${visit.type}\n- Date: ${shortDate}\n- Time: ${formatTimeRange(visit.startAt, visit.endAt)}\n- Location: ${visit.location}\n${visit.clinicianName ? `- Clinician: ${visit.clinicianName}` : ""}\n\nPlease contact me to discuss alternative arrangements.\n\nThank you.`;
      }

      // Create message thread
      addThread({
        patientId: visit.patientId,
        subject,
        participants: [senderRole, "VNS"],
        status: "Open",
        messages: [
          {
            id: `msg-${Date.now()}`,
            sender: senderRole,
            body: messageBody,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      // Create notification
      addNotification({
        patientId: visit.patientId,
        title: "Visit Change Request Sent",
        message: "Your request to change the visit has been sent to VNS scheduling.",
        type: "Info",
        actionLink: "/messages",
      });

      // Create timeline event
      addEvent({
        patientId: visit.patientId,
        type: "VisitUpdateRequested",
        title: `Requested change: ${visit.type} visit`,
        description:
          senderRole === "Caregiver"
            ? `Caregiver requested a change to ${patientName}'s ${visit.type} visit scheduled for ${shortDate}.`
            : `Patient requested a change to their ${visit.type} visit scheduled for ${shortDate}.`,
        link: "/visits",
        meta: { visitId: visit.id, action: "change", senderRole },
      });

      // Update visit status
      updateVisit(visit.patientId, visit.id, { status: "PendingChange" });

      showToast("Your visit change request has been sent to VNS scheduling.", "success");

      onVisitUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error requesting change:", error);
      showToast("Failed to send the request. Please try again.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle cancel visit action.
   */
  const handleCancelVisit = async () => {
    if (!visit) return;
    setIsProcessing(true);

    try {
      const shortDate = formatShortDate(visit.startAt);
      const subject = `Visit cancellation request: ${visit.type} on ${shortDate}`;

      // Create message body based on role
      let messageBody: string;
      if (senderRole === "Caregiver") {
        messageBody = `Hello,\n\nI am the caregiver for ${patientName} and would like to request cancellation of the following visit:\n\n- Type: ${visit.type}\n- Date: ${shortDate}\n- Time: ${formatTimeRange(visit.startAt, visit.endAt)}\n- Location: ${visit.location}\n${visit.clinicianName ? `- Clinician: ${visit.clinicianName}` : ""}\n\nPlease confirm the cancellation.\n\nThank you.`;
      } else {
        messageBody = `Hello,\n\nI would like to request cancellation of my upcoming visit:\n\n- Type: ${visit.type}\n- Date: ${shortDate}\n- Time: ${formatTimeRange(visit.startAt, visit.endAt)}\n- Location: ${visit.location}\n${visit.clinicianName ? `- Clinician: ${visit.clinicianName}` : ""}\n\nPlease confirm the cancellation.\n\nThank you.`;
      }

      // Create message thread
      addThread({
        patientId: visit.patientId,
        subject,
        participants: [senderRole, "VNS"],
        status: "Open",
        messages: [
          {
            id: `msg-${Date.now()}`,
            sender: senderRole,
            body: messageBody,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      // Create notification
      addNotification({
        patientId: visit.patientId,
        title: "Visit Cancellation Request Sent",
        message:
          "Your request to cancel the visit has been sent to VNS scheduling.",
        type: "Info",
        actionLink: "/messages",
      });

      // Create timeline event
      addEvent({
        patientId: visit.patientId,
        type: "VisitUpdateRequested",
        title: `Requested cancellation: ${visit.type} visit`,
        description:
          senderRole === "Caregiver"
            ? `Caregiver requested cancellation of ${patientName}'s ${visit.type} visit scheduled for ${shortDate}.`
            : `Patient requested cancellation of their ${visit.type} visit scheduled for ${shortDate}.`,
        link: "/visits",
        meta: { visitId: visit.id, action: "cancel", senderRole },
      });

      // Update visit status to Cancelled
      updateVisit(visit.patientId, visit.id, { status: "Cancelled" });

      showToast("Your visit cancellation request has been sent to VNS scheduling.", "success");

      onVisitUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error cancelling visit:", error);
      showToast("Failed to send the cancellation request. Please try again.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${getVisitTypeColor(visit.type)}`}
            >
              {visit.type}
            </span>
            Visit Details
          </DialogTitle>
          <DialogDescription>
            {formatDate(visit.startAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500 w-24">Status:</span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${getVisitStatusColor(visit.status)}`}
            >
              {getVisitStatusLabel(visit.status)}
            </span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500 w-24">Time:</span>
            <span className="text-sm">
              {formatTimeRange(visit.startAt, visit.endAt)}
            </span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500 w-24">Location:</span>
            <span className="text-sm flex items-center gap-1">
              {visit.location === "Telehealth" ? (
                <>
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
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Telehealth
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  Home Visit
                </>
              )}
            </span>
          </div>

          {/* Clinician */}
          {visit.clinicianName && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500 w-24">
                Clinician:
              </span>
              <span className="text-sm">{visit.clinicianName}</span>
            </div>
          )}

          {/* Notes */}
          {visit.notes && (
            <div className="pt-2 border-t">
              <span className="text-sm font-medium text-gray-500 block mb-1">
                Notes:
              </span>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                {visit.notes}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 pt-4">
          {visit.status !== "Completed" && visit.status !== "Cancelled" && (
            <>
              <Button
                variant="outline"
                onClick={handleRequestChange}
                disabled={isProcessing || !canRequestChange}
              >
                {visit.status === "PendingChange"
                  ? "Change Requested"
                  : "Request Change"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelVisit}
                disabled={isProcessing || !canCancel}
              >
                Cancel Visit
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
