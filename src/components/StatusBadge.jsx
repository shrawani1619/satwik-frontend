const StatusBadge = ({ status }) => {
  const statusConfig = {
    logged: { color: 'bg-blue-100 text-blue-800', label: 'Logged' },
    inquiry: { color: 'bg-sky-100 text-sky-900', label: 'Inquiry' },
    legal_valuation_property_done: {
      color: 'bg-lime-100 text-lime-900',
      label: 'Legal Valuation / Property Done',
    },
    sanctioned_branch_appointment_fixed: {
      color: 'bg-purple-100 text-purple-800',
      label: 'Sanction and branch appointment are fixed',
    },
    partial_disbursed: { color: 'bg-orange-100 text-orange-800', label: 'Partial Disbursed' },
    disbursed: { color: 'bg-indigo-100 text-indigo-800', label: 'Disbursed' },
    completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
    complete: { color: 'bg-green-100 text-green-800', label: 'Complete' },
    rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
    active: { color: 'bg-green-100 text-green-800', label: 'Active' },
    inactive: { color: 'bg-gray-100 text-gray-800', label: 'Inactive' },
    paid: { color: 'bg-green-100 text-green-800', label: 'Paid' },
    regular_paid: { color: 'bg-emerald-100 text-emerald-800', label: 'Regular Paid' },
    gst_paid: { color: 'bg-teal-100 text-teal-800', label: 'GST Paid' },
    pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
    approved: { color: 'bg-green-100 text-green-800', label: 'Approved' },
    gst_pending: { color: 'bg-amber-100 text-amber-800', label: 'GST Pending' },
    gst_received: { color: 'bg-teal-100 text-teal-800', label: 'GST received' },
    payment_received: { color: 'bg-green-100 text-green-800', label: 'Payment received' },
    payment_pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Payment Pending' },
    recovery_pending: { color: 'bg-orange-100 text-orange-800', label: 'Recovery Pending' },
    recovery_received: { color: 'bg-emerald-100 text-emerald-800', label: 'Recovery Received' },
    processing: { color: 'bg-blue-100 text-blue-800', label: 'Processing' },
    failed: { color: 'bg-red-100 text-red-800', label: 'Failed' },
    recovery: { color: 'bg-orange-100 text-orange-800', label: 'Recovery' },
    overdue: { color: 'bg-red-100 text-red-800', label: 'Overdue' },
    cancelled: { color: 'bg-gray-100 text-gray-800', label: 'Cancelled' },
  }

  const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}

export default StatusBadge
