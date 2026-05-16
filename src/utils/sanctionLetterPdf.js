import api from '../services/api';
import { toast } from '../services/toastService';

/**
 * Download sanction letter for a lead. Always regenerates first so logo/template changes apply.
 * @param {object} lead
 * @param {{ onMetaUpdate?: (leadId: string, pdfMeta: object) => void }} options
 */
export async function downloadSanctionLetterForLead(lead, { onMetaUpdate } = {}) {
  const id = lead?._id || lead?.id;
  if (!id) {
    throw new Error('Lead ID is missing');
  }

  const res = await api.leads.generateSanctionLetterPdf(id);
  const pdfMeta = res?.data?.sanctionLetterPdf;
  if (pdfMeta && onMetaUpdate) {
    onMetaUpdate(String(id), pdfMeta);
  }

  await api.leads.downloadSanctionLetterPdf(id);
}

/**
 * @param {object} lead
 * @param {string|null} loadingLeadId
 * @param {(id: string|null) => void} setLoadingLeadId
 * @param {(leadId: string, pdfMeta: object) => void} onMetaUpdate
 */
export async function handleSanctionLetterDownloadClick(
  lead,
  loadingLeadId,
  setLoadingLeadId,
  onMetaUpdate
) {
  const id = lead?._id || lead?.id;
  if (!id || loadingLeadId) return;

  setLoadingLeadId(String(id));
  try {
    await downloadSanctionLetterForLead(lead, { onMetaUpdate });
    toast.success('Downloaded', 'Sanction letter PDF downloaded.');
  } catch (e) {
    if (!e._toastShown) {
      toast.error('Error', e.message || 'Could not download sanction letter');
    }
  } finally {
    setLoadingLeadId(null);
  }
}
