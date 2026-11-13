import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, CreditCard, Plus, Receipt } from 'lucide-react';
import { FeedbackBanner, PageHeader, StatusLabel } from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { RequestType } from '../types/erp';

interface RequestRow {
  id: string;
  requestNumber: string;
  type: RequestType;
  requesterName: string;
  requesterRole: string;
  title: string;
  description: string;
  fromDate?: string;
  toDate?: string;
  status: string;
  createdAt: string;
  history: { timestamp: string; actorName: string; action: string; comment: string }[];
}

interface FeeLedgerRow {
  id: string;
  studentId: string;
  studentName: string;
  registerNumber: string;
  feeHead: string;
  totalAmount: number;
  concessionAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate: string;
  status: string;
  payments: {
    id: string;
    receiptNumber: string;
    transactionRef: string;
    amount: number;
    mode: string;
    paidAt: string;
  }[];
}

export function RequestsFeesPage({ initialTab = 'requests' }: { initialTab?: 'requests' | 'fees' }) {
  const { user, selectedDepartmentId, can } = useAuth();
  const [tab, setTab] = useState<'requests' | 'fees'>(initialTab);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [ledgers, setLedgers] = useState<FeeLedgerRow[]>([]);
  const [showNewReq, setShowNewReq] = useState(false);
  const [reqForm, setReqForm] = useState({
    type: 'STUDENT_OD' as RequestType,
    title: '',
    description: '',
    fromDate: '2026-11-22',
    toDate: '2026-11-22',
  });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canViewFees = can('fees', 'view');

  const loadData = useCallback(async () => {
    try {
      const reqRes = await apiRequest<{ requests: RequestRow[] }>(
        `/requests?departmentId=${encodeURIComponent(selectedDepartmentId)}`
      );
      setRequests(reqRes.requests);
      if (canViewFees) {
        const feeRes = await apiRequest<{ ledgers: FeeLedgerRow[] }>(
          `/fees?departmentId=${encodeURIComponent(selectedDepartmentId)}`
        );
        setLedgers(feeRes.ledgers);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load data' });
    }
  }, [selectedDepartmentId, canViewFees]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiRequest('/requests', {
        method: 'POST',
        body: JSON.stringify(reqForm),
      });
      setShowNewReq(false);
      setReqForm({ type: 'STUDENT_OD', title: '', description: '', fromDate: '2026-11-22', toDate: '2026-11-22' });
      setFeedback({ type: 'success', message: 'Request submitted and routed to assigned approver.' });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Submission failed' });
    }
  };

  const handleDecision = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setFeedback(null);
    try {
      await apiRequest(`/requests/${id}/decision`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          comment: `${decision} by ${user?.fullName || 'Approver'}.`,
        }),
      });
      setFeedback({ type: 'success', message: `Request ${decision.toLowerCase()} and logged in audit trail.` });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Approval action failed' });
    }
  };

  const handlePayBalance = async (ledger: FeeLedgerRow) => {
    setFeedback(null);
    try {
      const res = await apiRequest<{ payment: { receiptNumber: string; amount: number } }>(
        `/fees/${ledger.id}/pay`,
        {
          method: 'POST',
          body: JSON.stringify({ amount: ledger.balanceAmount, mode: 'UPI' }),
        }
      );
      setFeedback({
        type: 'success',
        message: `Payment of ₹${res.payment.amount.toLocaleString('en-IN')} recorded. Receipt #${res.payment.receiptNumber} generated.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Payment failed' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Approval Centre, Requests & Fee Ledger"
        subtitle="Configurable request workflows (Leave, OD, Bonafide, Helpdesk) and fee payment reconciliation"
        actions={
          <div className="flex items-center gap-3">
            {canViewFees && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTab('requests')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    tab === 'requests' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Requests ({requests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('fees')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    tab === 'fees' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Fees &amp; Receipts
                </button>
              </div>
            )}
            {tab === 'requests' && can('requests', 'create') && (
              <button
                type="button"
                onClick={() => setShowNewReq(!showNewReq)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Request
              </button>
            )}
          </div>
        }
      />

      {feedback && (
        <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />
      )}

      {tab === 'requests' ? (
        <div className="space-y-5">
          {showNewReq && (
            <form onSubmit={handleSubmitRequest} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Submit Institutional Request</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <select
                  value={reqForm.type}
                  onChange={(e) => setReqForm({ ...reqForm, type: e.target.value as RequestType })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                >
                  <option value="STUDENT_OD">Student On-Duty (OD)</option>
                  <option value="STUDENT_LEAVE">Student Leave</option>
                  <option value="STAFF_LEAVE">Staff / Duty Leave</option>
                  <option value="BONAFIDE_CERTIFICATE">Bonafide Certificate</option>
                  <option value="INTERNSHIP_PERMISSION">Internship Permission</option>
                  <option value="HELPDESK_TICKET">General Helpdesk Ticket</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Request Subject / Title"
                  value={reqForm.title}
                  onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs sm:col-span-2"
                />
                <input
                  type="date"
                  value={reqForm.fromDate}
                  onChange={(e) => setReqForm({ ...reqForm, fromDate: e.target.value, toDate: e.target.value })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  required
                  placeholder="Detailed justification / attachment reference..."
                  value={reqForm.description}
                  onChange={(e) => setReqForm({ ...reqForm, description: e.target.value })}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {requests.map((req) => {
              const actionable = req.status === 'SUBMITTED' || req.status === 'UNDER_REVIEW';
              return (
                <div key={req.id} className="bg-white border border-slate-200 rounded-lg p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-blue-700">{req.requestNumber}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">{req.type.replace(/_/g, ' ')}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{req.requesterName}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 mt-1">{req.title}</h3>
                      <p className="text-xs text-slate-600 mt-1">{req.description}</p>
                      {req.fromDate && (
                        <div className="text-[11px] font-mono text-slate-500 mt-1">
                          Dates: {req.fromDate} {req.toDate && req.toDate !== req.fromDate ? `→ ${req.toDate}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusLabel status={req.status} />
                      {actionable && can('requests', 'approve') && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDecision(req.id, 'APPROVED')}
                            className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecision(req.id, 'REJECTED')}
                            className="px-3 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Audit Timeline */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                    {req.history.map((h, i) => (
                      <div key={i} className="text-[11px] text-slate-500 flex flex-wrap gap-2">
                        <span className="font-mono text-slate-400">{h.timestamp.slice(0, 10)}</span>
                        <span className="font-medium text-slate-700">{h.actorName}</span>
                        <span>({h.action})</span>
                        <span>— {h.comment}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {ledgers.map((ledger) => (
            <div key={ledger.id} className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs font-mono text-blue-700">
                    {ledger.registerNumber} · {ledger.studentName}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{ledger.feeHead}</h3>
                  <div className="text-xs text-slate-500 mt-1">
                    Due Date: <span className="font-mono">{ledger.dueDate}</span> · Scholarship/Concession: ₹
                    {ledger.concessionAmount.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs text-slate-500">
                      Paid ₹{ledger.paidAmount.toLocaleString('en-IN')} / ₹
                      {(ledger.totalAmount - ledger.concessionAmount).toLocaleString('en-IN')}
                    </div>
                    <div className="text-base font-semibold text-slate-900">
                      Balance: ₹{ledger.balanceAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <StatusLabel status={ledger.status} />
                  {ledger.balanceAmount > 0 && can('fees', 'submit') && (
                    <button
                      type="button"
                      onClick={() => handlePayBalance(ledger)}
                      className="px-3.5 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
                    >
                      Pay Balance (UPI)
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  Payment Receipts
                </div>
                {ledger.payments.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 rounded px-3 py-2">
                    <div className="font-mono text-slate-700">
                      {p.receiptNumber} · Ref {p.transactionRef} · {p.mode}
                    </div>
                    <div className="font-mono font-medium text-emerald-700">
                      ₹{p.amount.toLocaleString('en-IN')} ({p.paidAt.slice(0, 10)})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
