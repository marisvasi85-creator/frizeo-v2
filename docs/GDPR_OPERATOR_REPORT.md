# Raport pentru operator — decizii neconfirmate

Data: 15 noiembrie 2026. Commitul de pornire: `65b8aca`. Documentul nu este pagină publică și nu este un aviz juridic.

Politica publică descrie doar comportamentul aplicației și mecanismele publicate de furnizori. Punctele de mai jos nu au fost transformate în afirmații publice.

## Retenție

- Tokenurile sunt șterse la deconectarea din Frizeo. Pentru Google Calendar, și la finalizarea ștergerii contului. Așa funcționează aplicația.
- Curățarea automată acceptă doar valoarea `90` și, doar atunci, poate șterge texte și imagini fără conexiune activă și fără istoric de publicare, mai vechi de 90 de zile. Variabila nu a fost setată. Cronul nu a fost programat. Pe staging, joburile de fundal rămân oprite. Public nu se promite ștergerea la 90 de zile, pentru că aplicația nu o face acum.
- Istoricul de publicare nu primește o ștergere la 12 luni. El este dovada a ceea ce s-a trimis și împiedică tratarea fișierului publicat ca rest nefolosit. Ștergerea lui ar putea, după aceea, face fișierul eligibil pentru curățare. Nu este justificată fără o decizie separată a operatorului.
- Programările nu sunt șterse după 24 de luni. Afirmația veche a fost scoasă, pentru că aplicația nu face această ștergere. Nu există export complet și nu există buton de închidere a salonului. Politica trimite cererea la info@frizeo.ro. Instrumentul intern de ștergere a unui salon poate șterge programări și facturi; nu este procedura publică și nu înlocuiește termenul legal al facturilor.
- Facturile Frizeo rămân. Termenul public este art. 25 din Legea contabilității nr. 82/1991, după Legea nr. 36/2023: 5 ani de la 1 iulie a anului următor, pentru registrele și documentele justificative. Aplicația nu le șterge la expirare. „În general 10 ani” nu mai este în politică. Categoria exactă a fiecărui document FGO nu a fost verificată în contract.
- Ștergerea contului are un răgaz de 7 zile, apoi se execută. Afirmația de „maximum 90 de zile” nu corespunde codului și a fost scoasă.

## Temeiuri

Politica folosește executarea contractului pentru cont și pentru integrarea cerută de salon, obligația legală pentru facturi, interesul legitim pentru securitate și consimțământul doar pentru cookie-urile neesențiale. Autorizarea OAuth nu este prezentată ca consimțământ GDPR.

`docs/GDPR_LIA.md` conține testul pentru jurnale și limitarea abuzurilor. Concluzia este potrivită pentru acel scop, dar nu este validată de operator. Nu autorizează statistici sau îmbunătățirea produsului pe interes legitim.

## Transferuri verificate la 15 noiembrie 2026

- Meta Platforms, Inc.: EU–US Data Privacy Framework, status activ, recertificare în revizuire, participantul 4452. Addendum: `https://www.facebook.com/legal/EU_data_transfer_addendum`.
- TikTok Technology Limited: politica SEE descrie stocare în SUA, Malaysia și Singapore, adecvare sau clauze contractuale standard. Comisia irlandeză a decis la 30 aprilie 2025 că accesul de la distanță din China a încălcat art. 46. Frizeo nu are un acord propriu care să acopere acest punct. Nu s-a afirmat public că transferul TikTok este garantat.
- Google LLC: EU–US Data Privacy Framework activ, participantul 5780, plus clauze standard unde adecvarea nu acoperă transferul.
- Microsoft Corporation: EU–US Data Privacy Framework activ, participantul 6474. FAQ Clarity: contract UE cu Microsoft Ireland Operations Limited și clauze standard către Microsoft Corporation.
- Stripe, LLC: Data Privacy Framework, cu clauze standard ca mecanism următor. `https://stripe.com/legal/dta`.
- Supabase Pte. Ltd.: clauze standard în DPA. Proiectul de staging este în Londra. Regiunea producției nu a fost interogată.
- Vercel Inc.: EU–US Data Privacy Framework activ, participantul 6847. DPA spune că prelucrarea principală este în Statele Unite.
- OpenAI Ireland Limited: adecvare sau clauze standard. Nu este prezentat ca participant DPF.
- NOOH MEDIA S.R.L.: furnizor SMS din România. Termenii lui spun că acționează sub autoritatea clientului. Un DPA semnat cu Frizeo nu a fost găsit în depozit.
- FGO și Notion: folosite când sunt configurate. Mecanismul lor de transfer nu a fost verificat și nu este afirmat în politica publică.
- Furnizorul de email este doar `EMAIL_HOST`. Entitatea lui nu a fost verificată. „Zoho” a fost scos din politica publică.

## Acord art. 28

`docs/DPA_PROIECT.md`, versiunea `dpa-proiect-2026-11-15`, este un proiect complet pentru verificare. Nu este semnat și nu este aprobat. Evidența furnizorilor este `docs/GDPR_TRANSFERS.md`.

Acceptarea electronică există în `app/api/salon/dpa/route.ts` și în tabelul `salon_dpa_acceptances`. Răspunde 404 cât timp `DPA_ACCEPTANCE_ENABLED` nu este exact `true`. Nu blochează utilizatorii și nu afișează proiectul ca acceptat. Variabila nu a fost setată.

## Decizii rămase

1. Aprobarea textului DPA, inclusiv legea română propusă, răspunderea, prețul și termenul de obiecție la un subîmputernicit nou. Recomandare: completați termenul și limita de răspundere înainte de orice semnare. Consecință: până atunci saloanele nu au acord art. 28.
2. Validarea `docs/GDPR_LIA.md` și un termen pentru jurnalele de server. Recomandare: confirmați scopul de securitate și fixați termenul. Consecință: fără termen, păstrarea IP-urilor rămâne neplafonată în cod.
3. Pornirea curățării de 90 de zile. Recomandare: rămâne oprită până la o decizie. Consecință: textele și imaginile orfane rămân.
4. Contractele lipsă din `docs/GDPR_TRANSFERS.md`, în special email, SMS, FGO, Notion și lipsa unei garanții proprii TikTok. Recomandare: nu porniți TikTok în producție pe baza politicii publice. Consecință: App Review poate vedea URL-urile, dar transferul TikTok nu este închis contractual.
5. Exportul programărilor și scoaterea facturilor din ștergerea internă de salon. Recomandare: implementare separată, fără ștergeri acum. Consecință: închiderea unui salon se face manual, pe email.

## App Review

Paginile `/privacy`, `/terms`, `/cookies`, `/stergere-date` și `/google-calendar-data` rămân publice. Callback-urile Meta sunt `POST /api/integrations/meta/deauthorize` și `POST /api/integrations/meta/data-deletion`. O semnătură invalidă nu șterge date. TikTok nu cere `video.publish`.
