export type KnowledgeArticle = {
  id: string;
  title: string;
  tags: string[];
  admin_path: string;
  body: string;
};

export const ASSISTANT_KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    tags: ["dashboard", "acasă", "checklist", "link"],
    admin_path: "/admin/dashboard",
    body: `Dashboard-ul e prima pagină din admin (/admin/dashboard). Vezi programările de azi, următoarele clienți, planul/trial-ul și checklist-ul de setup (servicii + program) dacă ești frizer activ. De aici copiezi și link-ul public de programare. Owner-ul doar-administrator vede tot salonul, nu un loc propriu de programări.`,
  },
  {
    id: "bookings",
    title: "Programări",
    tags: ["programări", "calendar", "booking", "client", "anulare", "reprogramare"],
    admin_path: "/admin/bookings",
    body: `Pagina Programări (/admin/bookings) e calendarul intern: vezi, creezi, muți și anulezi programări. Clienții se programează și de pe link-ul public. La creare/mutare/anulare, email-ul (și SMS-ul, după plan și setări) pleacă automat. Sync-ul Google Calendar merge dacă frizerul e conectat din Profil. Assistant-ul poate lista, crea, muta (reschedule_booking) și anula programări, cu Confirmă/Renunță. Căutare după telefon sau nume: list_bookings / client_history. Nu raportează încasări.`,
  },
  {
    id: "booking-link",
    title: "Link public de programare",
    tags: ["link", "pagină publică", "instagram", "whatsapp", "bio", "slug"],
    admin_path: "/admin/dashboard",
    body: `Fiecare salon are un link de forma /booking/salon/{slug-salon}. Fiecare frizer activ are și un link propriu /booking/salon/{slug-salon}/{slug-frizer} (sau /booking/{id} ca variantă stabilă). Clienții aleg serviciul, ziua și ora. Pune-l în Instagram bio, Google, WhatsApp. Link-ul salonului e și în /admin/salon. Cere booking_link pentru URL-ul exact, gata de copiat.`,
  },
  {
    id: "services",
    title: "Servicii",
    tags: ["servicii", "preț", "durată", "tuns", "inactiv"],
    admin_path: "/admin/services",
    body: `Serviciile se editează în /admin/services (doar dacă apari ca frizer). Fiecare frizer are lista lui: nume, durată (15–120 min), preț opțional, activ/inactiv, featured. Prețul poate lipsi — nu e obligatoriu. Dezactivarea scoate serviciul de pe pagina publică; programările vechi rămân. Assistant: list_services, create_service, update_service, deactivate_service (cu confirmare).`,
  },
  {
    id: "weekly-schedule",
    title: "Program de lucru (săptămânal și selectiv)",
    tags: ["program", "orar", "luni", "sâmbătă", "pauză", "selectiv", "settings"],
    admin_path: "/admin/settings",
    body: `Programul se setează în /admin/settings. Implicit: program săptămânal Luni=1 … Duminică=7, cu ore și pauză opțională (ex. 09:00–18:00, pauză 13–14). Program selectiv: orarul L–D NU mai deschide sloturi; deschizi doar zilele pe care le setezi tu în calendar. Zile libere / concedii rămân excepții. Assistant: list_weekly_schedule, update_weekly_schedule (o zi pe rând, cu confirmare). close_day / open_day / concediu = o dată anume, nu orarul L–D. Preaviz minim la programări online: implicit 2 ore, tot în /admin/settings.`,
  },
  {
    id: "google-calendar",
    title: "Google Calendar",
    tags: ["google", "calendar", "sync", "busy", "gmail"],
    admin_path: "/admin/profile",
    body: `Google Calendar se conectează din Profil frizer (/admin/profile), nu din Dashboard. Fiecare frizer își leagă propriul Gmail. După conectare: evenimentele ocupate din Google blochează orele în Frizeo; programările noi din Frizeo apar în Google. Deconectare tot din Profil. Dacă lipsește refresh token: revocă Frizeo din myaccount.google.com/permissions și reconectează. Assistant-ul respectă busy-ul Google la find_slots; nu poate conecta Google în locul tău — te trimite la /admin/profile.`,
  },
  {
    id: "profile",
    title: "Profil frizer",
    tags: ["profil", "avatar", "temă", "locație", "instagram"],
    admin_path: "/admin/profile",
    body: `Profilul (/admin/profile) e pentru frizerul activ: nume afișat, poză, locație, rețele, temă interfață, Google Calendar. Owner-ul care nu e frizer nu are această pagină până activează „apari și ca frizer” din /admin/barbers#owner-role.`,
  },
  {
    id: "notifications-sms",
    title: "Notificări email și SMS",
    tags: ["sms", "notificări", "reminder", "email", "confirmare", "anulare", "mesaj", "mesaje"],
    admin_path: "/admin/notifications",
    body: `Notificările se configurează în /admin/notifications (doar owner). Email: pe toate planurile (confirmare, reminder, reprogramare, anulare). SMS reminder: inclus pe trial, Pro, Pro+ și Custom — fără credite/reîncărcări. SMS confirmare / anulare / reprogramare: doar plan Custom. Pe Pro/Pro+/trial, evenimentele astea merg pe email. Toggle-urile din pagină trebuie să fie pornite ca mesajele să plece. Setările sunt la nivel de salon, nu per frizer.`,
  },
  {
    id: "barbers-invites",
    title: "Frizeri, invitații și rol owner",
    tags: ["frizeri", "invitație", "echipă", "owner", "locuri", "pro+"],
    admin_path: "/admin/barbers",
    body: `Pagina Frizeri (/admin/barbers): listă, invitații, activ/inactiv, rol owner. Invitații: doar Pro+ (inclusiv trial salon) și Custom. Free și Pro = 1 frizer, fără echipă. Locuri = frizeri activi + invitații pending. Owner doar-admin pe Pro+/trial: 0 locuri ocupate, poate invita până la 3. Owner+frizer: ocupă 1 loc. După trial → Pro doar dacă ai ≤1 frizer activ; altfel dezactivezi până la 1. Rolul „apari și ca frizer” se schimbă DOAR jos pe pagina Frizeri (/admin/barbers#owner-role), nu pe Dashboard. Assistant: list_barbers, invite_barber (owner/manager, cu confirmare). Frizerul invitat nu schimbă planul.`,
  },
  {
    id: "salon",
    title: "Date salon",
    tags: ["salon", "logo", "galerie", "adresă", "slug"],
    admin_path: "/admin/salon",
    body: `Pagina Salon (/admin/salon, doar owner): nume, slug public, adresă/locație, logo, galerie. De aici copiezi link-ul public al salonului. Fără slug, pagina de programare a salonului nu e publică.`,
  },
  {
    id: "client-access",
    title: "Acces clienți",
    tags: ["acces", "aprobare", "clienți noi", "blocare", "open"],
    admin_path: "/admin/client-access",
    body: `Acces clienți (/admin/client-access): cine se poate programa online. Moduri: Programări deschise (oricine); Clienți noi pe bază de aprobare (cerere, apoi accept/refuz); Doar clienți acceptați. Poți aproba, respinge, bloca. E control pe frizer. Assistant-ul NU schimbă aceste setări — te trimite la /admin/client-access.`,
  },
  {
    id: "reports",
    title: "Rapoarte",
    tags: ["rapoarte", "ocupare", "statistici"],
    admin_path: "/admin/reports",
    body: `Rapoartele (/admin/reports) arată volum de programări, anulate, ocupare, breakdown pe frizer/serviciu. Assistant-ul nu raportează încasări/venituri. Pentru popularitate fără bani: popular_services. Pentru numere detaliate, deschide /admin/reports.`,
  },
  {
    id: "marketing-ai",
    title: "Marketing AI",
    tags: ["marketing", "instagram", "postări", "reel", "hashtag"],
    admin_path: "/admin/marketing-ai",
    body: `Marketing AI (/admin/marketing-ai) generează postări Instagram, story, scripturi Reel și oferte, cu link-ul tău de programare. Limite zilnice: Free 3, Pro 20, Pro+ 50 (pe trial până la 50). Nu e un pachet social media separat. Frizeo Assistant NU generează postări — te trimite la pagina Marketing AI.`,
  },
  {
    id: "billing",
    title: "Abonament, trial și planuri",
    tags: ["abonament", "billing", "trial", "pro", "pro+", "free", "custom", "preț"],
    admin_path: "/admin/billing",
    body: `Abonamentul se gestionează în /admin/billing. Free: 0 lei, 1 frizer, 80 programări/lună, email, fără SMS reminder. Pro: 79 lei/lună, 1 frizer, programări nelimitate, SMS reminder, fără invitații. Pro+: 199 lei/lună, până la 3 frizeri + invitații, SMS reminder. Custom: la cerere, SMS extins (confirmare/anulare/reprogramare), mai mulți frizeri. Trial ~30 zile: independent → Pro; salon → Pro+. După trial fără plată rămâi pe Free; datele nu se șterg. Folosește subscription_status pentru statusul REAL al salonului. Contact: info@frizeo.ro / office@frizeo.ro.`,
  },
  {
    id: "assistant",
    title: "Frizeo Assistant",
    tags: ["assistant", "chat", "confirmă", "ajutor"],
    admin_path: "/admin/assistant",
    body: `Frizeo Assistant e chat-ul din admin (pagina Assistant + butonul flotant). Face operațiuni: briefing, programări, servicii, program, concediu, link, invitații, istoric client, explicații despre app. Acțiunile care modifică date cer Confirmă / Renunță. Nu calculează încasări. Nu e Growth AI (asta e doar pentru creatorul platformei). Marketing AI e altă pagină.`,
  },
  {
    id: "frizeo-email",
    title: "Frizeo Email",
    tags: ["email", "inbox", "sso"],
    admin_path: "/api/email/sso",
    body: `Frizeo Email e un inbox separat, vizibil doar când e activat pentru salon. Nu e același lucru cu email-urile automate de programare (confirmare/reminder). Dacă nu vezi item-ul în meniu, funcția nu e activă pe acest cont.`,
  },
  {
    id: "testimonials",
    title: "Recenzii (doar creator)",
    tags: ["recenzii", "testimoniale", "review"],
    admin_path: "/admin/testimonials",
    body: `Pagina Recenzii din admin e pentru recenziile de pe site-ul Frizeo (marketing), nu recenziile Google ale salonului. E vizibilă doar creatorului platformei. Clienții salonului nu lasă recenzii de produs de aici.`,
  },
];
