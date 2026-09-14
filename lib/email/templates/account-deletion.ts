function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(body: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
      ${body}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="color:#666;font-size:12px;">Echipa Frizeo</p>
    </div>
  `;
}

export function accountDeletionRequestedTemplate(input: {
  scheduledLabel: string;
  cancelUrl: string;
}): string {
  const cancelUrl = escapeHtml(input.cancelUrl);
  return wrap(`
    <h2>Solicitarea de ștergere a contului Frizeo</h2>
    <p>Am primit solicitarea de ștergere a contului tău Frizeo.</p>
    <p>Contul este programat pentru ștergere la <strong>${escapeHtml(input.scheduledLabel)}</strong>.</p>
    <p>Dacă te răzgândești, poți anula solicitarea din contul tău înainte de această dată.</p>
    <p style="margin:30px 0;">
      <a href="${cancelUrl}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;">
        Anulează ștergerea
      </a>
    </p>
    <p>Dacă butonul nu funcționează, folosește acest link:</p>
    <p><a href="${cancelUrl}">${cancelUrl}</a></p>
  `);
}

export function accountDeletionCancelledTemplate(): string {
  return wrap(`
    <h2>Solicitarea de ștergere a fost anulată</h2>
    <p>Solicitarea de ștergere a fost anulată.</p>
    <p>Contul tău Frizeo rămâne activ și poți continua să lucrezi normal.</p>
  `);
}

export function accountDeletionCompletedTemplate(): string {
  return wrap(`
    <h2>Contul Frizeo a fost șters</h2>
    <p>Contul Frizeo a fost șters.</p>
    <p>Dacă nu ai solicitat această acțiune, scrie-ne la info@frizeo.ro.</p>
  `);
}
