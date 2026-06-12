type Props = {
  barberName: string;
  salonName: string;
  inviteUrl: string;
};

export function barberInvitationTemplate({
  barberName,
  salonName,
  inviteUrl,
}: Props) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      
      <h2>Bun venit în Frizeo ✂️</h2>

      <p>Salut <strong>${barberName}</strong>,</p>

      <p>
        Ai fost invitat să te alături salonului
        <strong>${salonName}</strong>.
      </p>

      <p>
        Pentru a-ți activa contul, apasă pe butonul de mai jos:
      </p>

      <p style="margin:30px 0;">
        <a
          href="${inviteUrl}"
          style="
            background:#000;
            color:#fff;
            padding:12px 24px;
            text-decoration:none;
            border-radius:8px;
            display:inline-block;
          "
        >
          Activează contul
        </a>
      </p>

      <p>
        Dacă butonul nu funcționează, folosește acest link:
      </p>

      <p>
        <a href="${inviteUrl}">
          ${inviteUrl}
        </a>
      </p>

      <hr />

      <p style="color:#666;font-size:12px;">
        Echipa Frizeo
      </p>

    </div>
  `;
}