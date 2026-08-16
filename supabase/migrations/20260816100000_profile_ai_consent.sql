-- Trace le consentement explicite à l'envoi de photos vers Google Gemini
-- (fonctionnalité de scan IA multi-objets) — nullable, jamais rempli tant
-- que l'utilisateur n'a pas validé la boîte de dialogue dédiée. Sert de
-- preuve/horodatage de consentement RGPD pour ce traitement tiers précis,
-- distinct de l'acceptation générale de la politique de confidentialité.
alter table public.profiles add column ai_photo_consent_at timestamptz;
