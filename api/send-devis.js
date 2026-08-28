const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// --- Sécurité ---------------------------------------------------------------
// Cet endpoint envoie des e-mails depuis notifications@luca-crtt.com. Sans
// garde-fou, c'est un relais ouvert (spam/phishing depuis le domaine, blacklist).
// Protections :
//  1) Le destinataire artisan DOIT être dans une allowlist (pas d'adresse libre).
//  2) Le nom d'expéditeur est mappé côté serveur (pas de nom arbitraire dans le From).
//  3) Toutes les valeurs sont échappées en HTML.
//  4) Rate-limit mémoire par IP (anti-flood du mail de confirmation vers un tiers).

// Clients actifs connus. Étendre via l'env ALLOWED_ARTISAN_EMAILS (emails séparés
// par des virgules) sans redéployer le code à chaque nouveau client.
const ARTISANS = {
  'asdebatiment33@outlook.fr': 'AS de Bâtiment',
  'technibois.agencement@gmail.com': 'Technibois',
  'lespaysagesdemandin@gmail.com': 'Les Paysages de Mandin',
  'contact@craiestudioarchi.fr': 'Craie Studio',
};

const EXTRA_ALLOWED = (process.env.ALLOWED_ARTISAN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedArtisan(email) {
  const e = String(email || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(ARTISANS, e) || EXTRA_ALLOWED.includes(e);
}

function artisanDisplayName(email, fallback) {
  const e = String(email || '').toLowerCase();
  return ARTISANS[e] || sanitizeHeader(fallback, 'Votre artisan');
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Nettoie une valeur destinée à un en-tête d'e-mail (retire CRLF + < > ").
function sanitizeHeader(value, fallback = '', maxLen = 80) {
  const clean = String(value || '').replace(/[\r\n<>"]/g, ' ').trim().slice(0, maxLen);
  return clean || fallback;
}

function isValidEmail(value) {
  return typeof value === 'string'
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    && value.length <= 254;
}

// --- Journal des demandes ------------------------------------------------
// Resend ne garde ses logs que ~30 jours. Ce journal envoie une ligne par
// demande vers une adresse dédiée : Gmail la conserve sans limite de durée et
// reste comptable par site.
// IMPORTANT : métadonnées SEULEMENT (client, date, service, statut). Aucune
// donnée personnelle du prospect, parce que le formulaire promet au visiteur
// que ses informations ne sont pas conservées.
const LEDGER_TO = process.env.LEDGER_EMAIL || 'cerutti.luca7+leads@gmail.com';

async function journaliser(nomArtisan, services, statut) {
  try {
    const quand = new Date().toISOString();
    const r = await resend.emails.send({
      from: 'Journal CRTT <notifications@luca-crtt.com>',
      to: LEDGER_TO,
      subject: `[LEAD] ${nomArtisan} · ${statut}`,
      text: [
        `Client   : ${nomArtisan}`,
        `Date     : ${quand}`,
        `Service  : ${services}`,
        `Statut   : ${statut}`,
        '',
        'Journal automatique. Aucune donnee personnelle du prospect n\'est conservee ici.',
      ].join('\n'),
    });
    if (r?.error) console.error('Ledger error:', JSON.stringify(r.error));
  } catch (e) {
    // Le journal ne doit JAMAIS faire échouer une demande client.
    console.error('Ledger exception:', e);
  }
}

// Rate-limit mémoire (best-effort par instance serverless chaude).
const RL = new Map();
function rateLimited(ip, max = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const hits = (RL.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  RL.set(ip, hits);
  return hits.length > max;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Trop de demandes. Réessayez plus tard.' });
  }

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

  // Destinataire artisan : uniquement un client connu (anti-relais).
  if (!isAllowedArtisan(artisanEmail)) {
    return res.status(403).json({ error: 'Destinataire non autorisé' });
  }
  // Le mail de confirmation part vers prospectEmail : refuser tout format invalide.
  if (!isValidEmail(prospectEmail)) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  // Nom d'expéditeur : mappé côté serveur, jamais la valeur brute du body.
  const nomArtisan = artisanDisplayName(artisanEmail, artisanNom);

  // Valeurs échappées pour insertion HTML sûre.
  const safePrenom = escapeHtml(prospectPrenom);
  const safeProspectEmail = escapeHtml(prospectEmail);
  const safeTel = escapeHtml(prospectTel);
  const safeTelHref = escapeHtml(String(prospectTel || '').replace(/[^0-9+]/g, ''));
  const safeServices = escapeHtml(Array.isArray(services) ? services.join(', ') : String(services));
  const safeType = escapeHtml(typeProjet);
  const safeDescription = escapeHtml(description || 'Non renseigné');
  const safeNom = escapeHtml(nomArtisan);

  try {
    const [resArtisan, resProspect] = await Promise.all([

      // Mail à l'artisan
      resend.emails.send({
        from: 'CRTT <notifications@luca-crtt.com>',
        to: artisanEmail,
        replyTo: prospectEmail,
        subject: sanitizeHeader(`Nouvelle demande — ${safeServices}`, 'Nouvelle demande', 150),
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#1d4ed8;padding:24px 28px;border-radius:10px 10px 0 0">
              <h2 style="color:#fff;margin:0;font-size:18px">Nouvelle demande de contact</h2>
              <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Via votre vitrine en ligne</p>
            </div>
            <div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px;width:160px">Prénom</td>
                  <td style="padding:8px 0;color:#111;font-size:14px;font-weight:600">${safePrenom}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px">Email</td>
                  <td style="padding:8px 0;font-size:14px"><a href="mailto:${safeProspectEmail}" style="color:#1d4ed8">${safeProspectEmail}</a></td>
                </tr>
                ${prospectTel ? `<tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px">Téléphone</td>
                  <td style="padding:8px 0;color:#111;font-size:14px"><a href="tel:${safeTelHref}" style="color:#EF3131">${safeTel}</a></td>
                </tr>` : ''}
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px">Service(s)</td>
                  <td style="padding:8px 0;color:#111;font-size:14px;font-weight:600">${safeServices}</td>
                </tr>
                ${typeProjet ? `
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px">Type de projet</td>
                  <td style="padding:8px 0;color:#111;font-size:14px">${safeType}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top">Description</td>
                  <td style="padding:8px 0;color:#111;font-size:14px">${safeDescription}</td>
                </tr>
              </table>
              <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6">
                <a href="mailto:${safeProspectEmail}"
                   style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
                  Répondre à ${safePrenom}
                </a>
                ${prospectTel ? `<a href="tel:${safeTelHref}"
                   style="display:inline-block;background:#16a34a;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-left:10px">
                  Appeler ${safePrenom}
                </a>` : ''}
              </div>
            </div>
            <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px">
              Propulsé par <a href="https://luca-crtt.com" style="color:#6b7280">CRTT</a>
            </p>
          </div>
        `,
      }),

      // Mail de confirmation au prospect
      resend.emails.send({
        from: `${nomArtisan} <notifications@luca-crtt.com>`,
        to: prospectEmail,
        subject: 'Votre message a bien été reçu',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
            <div style="background:#1d4ed8;padding:24px 28px;border-radius:10px 10px 0 0">
              <h2 style="color:#fff;margin:0;font-size:18px">Message bien reçu</h2>
            </div>
            <div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
              <p style="margin:0 0 16px;color:#111;font-size:15px">Bonjour ${safePrenom},</p>
              <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.7">
                <strong>${safeNom}</strong> a bien reçu votre message concernant : <strong>${safeServices}</strong>.
                ${typeProjet ? `<br><em>Type de projet : ${safeType}</em>` : ''}
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.7">
                Il vous répondra dans les meilleurs délais directement par email.
              </p>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;font-size:13px;color:#6b7280">
                Vos informations ont été transmises directement à l'artisan et ne sont pas conservées.
              </div>
            </div>
            <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px">
              Propulsé par <a href="https://luca-crtt.com" style="color:#6b7280">CRTT</a>
            </p>
          </div>
        `,
      }),

    ]);

    // Le SDK Resend ne lève PAS d'exception sur erreur d'API : il renvoie
    // { data: null, error: {...} }. Sans ce contrôle, l'endpoint répondait 200
    // même quand aucun mail ne partait, et le visiteur voyait « message envoyé ».
    if (resArtisan?.error) {
      console.error('Resend error (artisan):', JSON.stringify(resArtisan.error));
    }
    if (resProspect?.error) {
      console.error('Resend error (confirmation prospect):', JSON.stringify(resProspect.error));
    }
    // Seul le mail vers l'artisan est critique : sans lui la demande est perdue.
    if (resArtisan?.error) {
      await journaliser(nomArtisan, safeServices, 'ECHEC');
      return res.status(500).json({ error: 'Erreur envoi email' });
    }

    await journaliser(nomArtisan, safeServices, 'OK');
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Erreur envoi email' });
  }
};
