# Raport pentru operator — decizii neconfirmate

Data: 15 noiembrie 2026. Commitul de pornire: `9d4bd80`. Documentul nu este pagină publică și nu este un aviz juridic.

Politica publică descrie doar comportamentul aplicației și mecanismele publicate de furnizori. Punctele de mai jos nu au fost transformate în afirmații publice.

## Retenție

- Tokenurile sunt șterse la deconectarea din Frizeo. Pentru Google Calendar, și la finalizarea ștergerii contului. Așa funcționează aplicația.
- Curățarea automată acceptă doar valoarea `90` și, doar atunci, poate șterge texte și imagini fără conexiune activă și fără istoric de publicare, mai vechi de 90 de zile. Variabila nu a fost setată. Cronul nu a fost programat. Pe staging, joburile de fundal rămân oprite. Public nu se promite ștergerea la 90 de zile, pentru că aplicația nu o face acum.
- Istoricul de publicare nu primește o ștergere la 12 luni. El este dovada a ceea ce s-a trimis și împiedică tratarea fișierului publicat ca rest nefolosit. Ștergerea lui ar putea, după aceea, face fișierul eligibil pentru curățare. Nu este justificată fără o decizie separată a operatorului.
- Programările nu sunt șterse după 24 de luni. Afirmația veche a fost scoasă, pentru că aplicația nu face această ștergere.
- Facturile rămân. Termenul public este art. 25 din Legea contabilității nr. 82/1991, după Legea nr. 36/2023: 5 ani de la 1 iulie a anului următor. Aplicația nu le șterge la expirare. „În general 10 ani” nu mai este în politică.
- Ștergerea contului are un răgaz de 7 zile, apoi se execută. Afirmația de „maximum 90 de zile” nu corespunde codului și a fost scoasă.

## Temeiuri

Politica folosește executarea contractului pentru cont și pentru integrarea cerută de salon, obligația legală pentru facturi, interesul legitim pentru securitate și consimțământul doar pentru cookie-urile neesențiale. Autorizarea OAuth nu este prezentată ca consimțământ GDPR.

Nu există în depozit un test de balansare scris pentru interesul legitim. Operatorul trebuie să confirme că îl menține.

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

`docs/DPA_PROIECT.md` este un proiect, nu un contract semnat. Termenii spun că nu țin locul acordului. Semnarea, răspunderea și legea formei finale rămân la operator.

## App Review

Paginile `/privacy`, `/terms`, `/cookies`, `/stergere-date` și `/google-calendar-data` rămân publice. Callback-urile Meta sunt `POST /api/integrations/meta/deauthorize` și `POST /api/integrations/meta/data-deletion`. O semnătură invalidă nu șterge date. TikTok nu cere `video.publish`.
