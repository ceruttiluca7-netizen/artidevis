const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    artisanEmail,
    artisanNom,
    services = [],
    typeProjet,
    description,
    prospectPrenom,
    prospectTel,
    prospectEmail,
  } = req.body;

  if (!artisanEmail || !prospectPrenom || !prospectEmail || !services.length) {
    return res.status(422).json({ error: 'Champs requis manquants' });
  }

  const servicesStr = services.join(', ');
  const descriptionStr = description || 'Non renseigné';

  try {
    await Promise.all([

      // Mail à l'artisan
      resend.emails.send({
        from: 'ArtiDevis <notifications@artivitrine.fr>',
        to: artisanEmail,
        replyTo: prospectEmail,
        subject: `Nouvelle demande de devis — ${servicesStr}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#1d4ed8;padding:24px 28px;border-radius:10px 10px 0 0">
              <h2 style="color:#fff;margin:0;font-size:18px">Nouvelle demande de devis</h2>
              <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Via votre vitrine ArtiVitrine</p>
            </div>
            <div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px;width:160px">Prénom</td>
                  <td style="padding:8px 0;color:#111;font-size:14px;font-weight:600">${prospectPrenom}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px">Email</td>
                  <td style="padding:8px 0;font-size:14px"><a href="mailto:${prospectEmail}" style="color:#1d4ed8">${prospectEmail}</a></td>
                </tr>
                ${prospectTel ? `<tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px">Téléphone</td>
                  <td style="padding:8px 0;color:#111;font-size:14px"><a href="tel:${prospectTel}" style="color:#EF3131">${prospectTel}</a></td>
                </tr>` : ''}
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px">Service(s)</td>
                  <td style="padding:8px 0;color:#111;font-size:14px;font-weight:600">${servicesStr}</td>
                </tr>
                ${typeProjet ? `
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px">Type de projet</td>
                  <td style="padding:8px 0;color:#111;font-size:14px">${typeProjet}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top">Description</td>
                  <td style="padding:8px 0;color:#111;font-size:14px">${descriptionStr}</td>
                </tr>
              </table>
              <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6">
                <a href="mailto:${prospectEmail}"
                   style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
                  Répondre à ${prospectPrenom}
                </a>
                ${prospectTel ? `<a href="tel:${prospectTel}"
                   style="display:inline-block;background:#16a34a;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-left:10px">
                  Appeler ${prospectPrenom}
                </a>` : ''}
              </div>
            </div>
            <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px">
              Propulsé par <a href="https://artivitrine.fr" style="color:#6b7280">ArtiDevis · ArtiVitrine</a>
            </p>
          </div>
        `,
      }),

      // Mail de confirmation au prospect
      resend.emails.send({
        from: `${artisanNom} via ArtiVitrine <notifications@artivitrine.fr>`,
        to: prospectEmail,
        subject: 'Votre demande a bien été reçue',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
            <div style="background:#1d4ed8;padding:24px 28px;border-radius:10px 10px 0 0">
              <h2 style="color:#fff;margin:0;font-size:18px">Demande bien reçue</h2>
            </div>
            <div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
              <p style="margin:0 0 16px;color:#111;font-size:15px">Bonjour ${prospectPrenom},</p>
              <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.7">
                <strong>${artisanNom}</strong> a bien reçu votre demande de devis pour : <strong>${servicesStr}</strong>.
                ${typeProjet ? `<br><em>Type de projet : ${typeProjet}</em>` : ''}
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.7">
                Il vous répondra dans les meilleurs délais directement par email.
              </p>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;font-size:13px;color:#6b7280">
                Vos informations ont été transmises directement à l'artisan et ne sont pas conservées.
              </div>
            </div>
            <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px">
              Propulsé par <a href="https://artivitrine.fr" style="color:#6b7280">ArtiDevis · ArtiVitrine</a>
            </p>
          </div>
        `,
      }),

    ]);

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Erreur envoi email' });
  }
};
