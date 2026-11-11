# Google Business Profile pe staging

Adaptorul este separat de Google Calendar și de Meta. Capability-ul `marketing.publish.google_business` rămâne oprit. Ruta de publicare live răspunde `live_off` și nu apelează Google.

După aprobarea accesului la Google Business Profile API, configurarea se face manual:

1. Nu adăuga scope-ul `business.manage` în clientul OAuth verificat pentru Calendar.
2. Creează un client OAuth nou, de preferință într-un proiect Google Cloud separat.
3. Activează Account Management API, Business Information API și Google My Business API v4.
4. Redirect autorizat: `https://staging.frizeo.ro/api/integrations/google-business/callback`.
5. Consent screen doar cu `https://www.googleapis.com/auth/business.manage`, în Testing, cu utilizatorii de test care dețin profilul.
6. Setează pe staging `GOOGLE_BUSINESS_CLIENT_ID` și `GOOGLE_BUSINESS_CLIENT_SECRET`. Nu reutiliza `GOOGLE_CLIENT_ID`.
7. Activează `marketing.publish.google_business` doar pentru salonul de test, după ce locațiile reale pot fi citite.
8. Nu seta `GOOGLE_BUSINESS_PUBLISH_LIVE`. Publicarea reală rămâne oprită.
