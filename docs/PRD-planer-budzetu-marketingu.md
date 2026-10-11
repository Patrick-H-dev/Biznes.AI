# PRD – Planer rocznego budżetu marketingu

Wersja: 2026-10-11 · Autor: Patryk

## 1. Kontekst i problem

Budujemy wewnętrzną aplikację webową, w której Head of Marketing układa roczny plan budżetu działu, widzi udział % każdej kategorii (social media, strona www, radio itd.) i planowany zwrot (ROI) per kategoria oraz łącznie.

Dziś plan powstaje zwykle w Excelu. Typowe problemy:

- **Brak spójnej metodologii ROI** – każda kategoria liczona inaczej (przychód vs marża, różne okna atrybucji), więc kategorii nie da się porównać.
- **Ręczne sumowanie i błędy formuł** – udziały % nie sumują się do 100%, budżet przekracza limit bez ostrzeżenia.
- **Brak rozróżnienia kanałów performance i brand** – radio czy PR dostają fikcyjne ROI albo są pomijane w rachunku.
- **Trudna prezentacja dla zarządu/CFO** – plan trzeba za każdym razem przepisywać do slajdów.

**Teza produktu:** jedno źródło prawdy dla planu rocznego, ze sztywną metodologią liczenia udziałów i ROI oraz eksportem gotowym do prezentacji.

## 2. Cele produktu i miary sukcesu

Cel MVP: Head of Marketing przygotowuje kompletny plan roczny z udziałami % i planowanym ROI w jednej sesji, bez Excela jako narzędzia pośredniego.

| Cel | Miara (KPI produktu) | Wartość docelowa |
| --- | --- | --- |
| Szybsze planowanie | Czas od pustego planu do planu gotowego do zatwierdzenia | < 2 h (vs. typowo 1–2 dni w Excelu – do zweryfikowania na baseline) |
| Poprawność rachunku | Liczba błędów sumowania / udziałów w planie | 0 (walidacja systemowa) |
| Porównywalność kategorii | Odsetek kategorii performance z wyliczonym ROI wg jednej metodologii | 100% |
| Gotowość do prezentacji | Czas przygotowania materiału dla zarządu | < 15 min (eksport PDF/XLSX) |
| Adopcja | Plan na kolejny rok zrobiony w aplikacji, nie w Excelu | Tak (cykl budżetowy 2027) |

Otwarte pytanie: jaki jest dziś realny czas przygotowania planu – potrzebny jako baseline do KPI „szybsze planowanie”.

## 3. Użytkownik i scenariusze użycia

Jedyny użytkownik MVP to Head of Marketing (rola Administrator/Planista). Brak ról CFO, managerów kanałów i zarządu – plan jest udostępniany jako eksport.

**Persona:** Head of Marketing w średniej firmie; zarządza budżetem rocznym, broni go przed CFO i zarządem; rozumie ROI, ale nie chce budować modeli w Excelu.

**User stories (MVP):**

1. Jako HoM chcę utworzyć plan na dany rok z limitem budżetu całkowitego i walutą, aby mieć ramę do alokacji.
2. Jako HoM chcę dodać, edytować i usuwać kategorie (social media, strona www, radio, SEM, PR, eventy…) i oznaczyć je jako *performance* lub *brand*, aby ROI liczyło się tylko tam, gdzie ma sens.
3. Jako HoM chcę przypisać kwotę do kategorii (rocznie lub z rozbiciem miesięcznym) i od razu widzieć udział % w budżecie oraz kwotę nieprzydzieloną.
4. Jako HoM chcę wpisać oczekiwany przychód przypisany i marżę dla kategorii performance, aby zobaczyć planowane ROI i ROMI.
5. Jako HoM chcę zaimportować plan lub dane z poprzedniego roku z Excela/CSV, aby nie przepisywać ich ręcznie.
6. Jako HoM chcę zobaczyć dashboard: struktura budżetu, ROI per kategoria, ROI łączne, ostrzeżenia.
7. Jako HoM chcę skopiować plan z poprzedniego roku jako punkt startowy nowego planu.
8. Jako HoM chcę wyeksportować plan do XLSX i PDF, aby przedstawić go CFO i zarządowi.
9. Jako HoM chcę zablokować (zamrozić) zatwierdzoną wersję planu, aby mieć niezmienny punkt odniesienia.

## 4. Zakres MVP i poza zakresem

MVP to wyłącznie **plan roczny** (ex ante): alokacja, udziały % i planowane ROI. Wykonanie budżetu i realne ROI są poza zakresem.

| W zakresie MVP | Poza zakresem MVP (kandydaci do v2+) |
| --- | --- |
| Plan roczny z limitem i walutą | Rejestr faktycznych wydatków, plan vs. wykonanie |
| Kategorie i podkategorie, typ performance/brand | Reforecast w ciągu roku, scenariusze |
| Kwoty roczne lub miesięczne per kategoria | Integracje API (Google Ads, Meta, GA4, CRM) |
| Udział % w budżecie, kwota nieprzydzielona | Modele atrybucji, MMM |
| Planowany przychód, marża, ROI, ROMI | Wielu użytkowników, role, workflow akceptacji |
| Import/eksport XLSX/CSV, eksport PDF | Multi-tenancy, billing (SaaS) |
| Kopiowanie planu z poprzedniego roku, wersje (szkic/zatwierdzony) | Aplikacja mobilna |
| Dashboard z wykresami i ostrzeżeniami | Wielowalutowość w jednym planie |

## 5. Wymagania funkcjonalne

Priorytety wg MoSCoW: M = must (warunek wydania MVP), S = should, C = could.

| ID | Obszar | Wymaganie | Priorytet |
| --- | --- | --- | --- |
| FR-01 | Plan | Utworzenie planu: rok, nazwa, waluta (domyślnie PLN), budżet całkowity (limit), kwoty netto | M |
| FR-02 | Plan | Statusy planu: Szkic → Zatwierdzony (zamrożony, tylko odczyt); możliwość utworzenia nowej wersji z zatwierdzonego | M |
| FR-03 | Plan | Kopiowanie planu z poprzedniego roku z opcjonalnym współczynnikiem korekty (np. +5%) | S |
| FR-04 | Kategorie | CRUD kategorii; słownik startowy: Social media, Strona www/SEO, SEM/Google Ads, Radio, TV, Outdoor, PR, Eventy, Content, E-mail/CRM, Influencer, Rezerwa | M |
| FR-05 | Kategorie | Typ kategorii: Performance (ROI liczone) lub Brand (ROI nie liczone, KPI zastępcze) | M |
| FR-06 | Kategorie | Podkategorie (np. Social media → Meta, LinkedIn, TikTok); kategoria = suma podkategorii | S |
| FR-07 | Alokacja | Kwota roczna per kategoria albo rozbicie na 12 miesięcy; tryb roczny rozkłada kwotę równo lub wg wybranego profilu sezonowości | M |
| FR-08 | Alokacja | Alternatywny tryb wprowadzania: % budżetu → system wylicza kwotę (i odwrotnie) | S |
| FR-09 | Alokacja | Na bieżąco: suma przydzielona, kwota nieprzydzielona, udział % każdej kategorii; suma udziałów = 100% przydzielonej kwoty | M |
| FR-10 | Alokacja | Ostrzeżenie (nie blokada) przy przekroczeniu limitu budżetu; blokada zatwierdzenia planu, gdy suma > limit | M |
| FR-11 | Zwrot | Dla kategorii Performance: planowany przychód przypisany, marża brutto % (domyślna dla planu, nadpisywalna per kategoria) | M |
| FR-12 | Zwrot | Wyliczenie ROI, ROMI, ROAS per kategoria i łącznie (metodologia w sekcji 6) | M |
| FR-13 | Zwrot | Dla kategorii Brand: pola KPI zastępczych (zasięg, CPM, liczba odsłon, wzrost świadomości %) – bez ROI | S |
| FR-14 | Zwrot | Pole „założenie” (tekst) przy każdej kategorii – źródło prognozy przychodu | M |
| FR-15 | Dashboard | Wykres struktury budżetu (udział %), ranking ROI per kategoria, KPI łączne, lista ostrzeżeń | M |
| FR-16 | Dashboard | Wykres miesięcznego rozkładu wydatków (gdy użyto rozbicia miesięcznego) | S |
| FR-17 | Porównanie | Porównanie z planem poprzedniego roku: zmiana kwoty, udziału p.p. i ROI per kategoria | S |
| FR-18 | Import | Import XLSX/CSV wg szablonu z walidacją i podglądem (sekcja 8) | M |
| FR-19 | Eksport | Eksport XLSX (dane + formuły) i PDF (podsumowanie dla zarządu) | M |
| FR-20 | Historia | Dziennik zmian (kto/kiedy/co) i przywracanie wersji | C |

## 6. Metodologia: udział %, ROI, ROMI

Aplikacja wymusza jedną metodologię dla wszystkich kategorii. Główną miarą zwrotu jest **ROMI na marży**, bo ROI liczone na przychodzie zawyża zwrot o koszt sprzedanych towarów.

Oznaczenia: K_i = planowany koszt kategorii i, P_i = planowany przychód przypisany (inkrementalny), m_i = marża brutto % (ułamek), L = limit budżetu.

| Miara | Wzór |
| --- | --- |
| Udział kategorii | Udział_i = K_i / Σ K_j × 100% |
| Wykorzystanie limitu | Σ K_j / L × 100% |
| ROI przychodowe (pomocnicze) | ROI_i = (P_i − K_i) / K_i × 100% |
| **ROMI na marży (główne)** | ROMI_i = (P_i × m_i − K_i) / K_i × 100% |
| ROAS (pomocnicze, digital) | ROAS_i = P_i / K_i |
| ROMI części performance | ROMI_perf = Σ_perf (P_i × m_i − K_i) / Σ_perf K_i |
| ROMI całego budżetu | ROMI_total = (Σ_perf P_i × m_i − Σ_all K_i) / Σ_all K_i |
| Próg rentowności kategorii | P_min_i = K_i / m_i (ROMI = 0%) |

Reguły biznesowe:

- ROI łączne liczone wyłącznie z sum, nigdy jako średnia z ROI kategorii.
- Kategorie Brand wchodzą do mianownika ROMI_total (koszt), ale nie mają własnego ROI – aplikacja pokazuje „n/d – kategoria wizerunkowa”, nie 0% ani −100%.
- Przychód przypisany = przychód **inkrementalny** oczekiwany dzięki kategorii; pole „założenie” jest obowiązkowe, gdy P_i > 0.
- Kwoty netto (bez VAT); waluta jedna na plan.
- Ostrzeżenia (progi konfigurowalne): ROMI < 0% w kategorii performance; ROAS > 20 (prawdopodobnie zawyżona prognoza); kategoria > 40% budżetu (ryzyko koncentracji); suma P_i > opcjonalny cel sprzedaży firmy (podwójne liczenie).

## 7. Model danych

Cztery encje wystarczą dla MVP; wartości pochodne (udziały, ROI, ROMI, ROAS) są wyliczane, nie przechowywane.

| Encja | Kluczowe pola | Relacje / uwagi |
| --- | --- | --- |
| BudgetPlan | id, rok, nazwa, waluta, limit_budzetu, marza_domyslna_proc, cel_sprzedazy (opcjonalny), status (szkic/zatwierdzony), wersja, utworzono, zatwierdzono | 1 plan → N pozycji; nowa wersja = kopia planu |
| Category | id, nazwa, typ (performance/brand), parent_id, kolor, aktywna | Słownik współdzielony między planami; parent_id dla podkategorii |
| BudgetLine | id, plan_id, category_id, kwota_roczna, kwoty_miesieczne[12], przychod_planowany, marza_proc (nullable = domyślna planu), zalozenie (tekst), kpi_zastepcze (JSON) | Unikalne (plan_id, category_id); suma miesięcy = kwota roczna |
| AuditLog | id, plan_id, encja, pole, wartosc_przed, wartosc_po, timestamp | Tylko dla FR-20 (C) |

Reguły integralności: kwoty ≥ 0, marża w zakresie 0–100%, rok w zakresie bieżący −2 … +2; plan zatwierdzony jest tylko do odczytu.

## 8. Import Excel/CSV

Import działa tylko na szablonie pobieranym z aplikacji; dowolne arkusze nie są obsługiwane w MVP.

Szablon (jeden wiersz = jedna kategoria; kolumny miesięczne opcjonalne):

```csv
kategoria,podkategoria,typ,kwota_roczna,sty,lut,mar,kwi,maj,cze,lip,sie,wrz,paz,lis,gru,przychod_planowany,marza_proc,zalozenie
Social media,Meta,performance,120000,,,,,,,,,,,,,480000,35,Prognoza na bazie ROAS 2026
Radio,,brand,90000,,,,,,,,,,,,,,,Kampania wizerunkowa Q2 i Q4
```

Przebieg importu:

1. Upload pliku XLSX lub CSV (UTF-8, separator `,` lub `;`, max 5 MB).
2. Mapowanie kolumn – automatyczne po nagłówkach, z możliwością ręcznej korekty.
3. Walidacja i podgląd: błędy blokujące (brak kategorii, kwota ujemna, nieznany typ, suma miesięcy ≠ kwota roczna) oraz ostrzeżenia (nowa kategoria spoza słownika, przekroczenie limitu).
4. Wybór trybu: zastąp plan / scal (aktualizuj istniejące kategorie, dodaj nowe).
5. Zatwierdzenie importu; raport: ile wierszy zaimportowano, pominięto, z jakiego powodu.

Formaty liczb: akceptowane `120000`, `120 000`, `120000,50`; procent jako `35` lub `35%`.

## 9. Ekrany i UX

Pięć ekranów; główną pracę wykonuje się w jednej tabeli planu z podsumowaniem przypiętym na górze.

1. **Lista planów** – plany wg roku, status, budżet, ROMI łączne; akcje: nowy plan, kopiuj z poprzedniego roku, importuj.
2. **Edytor planu (ekran główny)**
   - Pasek podsumowania (sticky): limit, przydzielono, nieprzydzielono, wykorzystanie limitu %, ROMI_perf, ROMI_total.
   - Tabela kategorii: nazwa, typ, kwota, udział %, przychód planowany, marża %, ROI, ROMI, ROAS, próg rentowności, założenie; edycja inline, sortowanie, rozwijane podkategorie.
   - Przełącznik widoku: roczny / miesięczny (siatka 12 miesięcy).
   - Panel ostrzeżeń z odnośnikami do wierszy.
3. **Dashboard** – wykres struktury budżetu (słupki poziome z udziałem %, czytelniejsze niż wykres kołowy przy > 5 kategoriach), wykres ROMI per kategoria z linią 0%, macierz koszt × ROMI (duży koszt / niski zwrot), porównanie z poprzednim rokiem.
4. **Import** – kreator 3-krokowy (upload → mapowanie i walidacja → potwierdzenie).
5. **Ustawienia** – słownik kategorii, waluta i marża domyślna, progi ostrzeżeń.

Zasady UX: wszystkie przeliczenia natychmiast (< 200 ms) bez przycisku „Przelicz”; czerwony tylko dla ROMI < 0 i przekroczeń; kategorie Brand oznaczone etykietą, nie kolorem błędu; liczby w formacie polskim (spacja tysięcy, przecinek dziesiętny).

## 10. Wymagania niefunkcjonalne

| Obszar | Wymaganie |
| --- | --- |
| Dostęp | Aplikacja wewnętrzna; logowanie przez firmowe SSO (Microsoft Entra ID / Google Workspace) lub, jeśli niedostępne, login + 2FA |
| Bezpieczeństwo | HTTPS, szyfrowanie danych w spoczynku, hosting w UE (RODO), backup dzienny z retencją 30 dni |
| Wydajność | Przeliczenie planu do 100 kategorii × 12 miesięcy < 200 ms; ładowanie ekranu < 2 s |
| Dokładność | Arytmetyka dziesiętna (nie float) dla kwot; zaokrąglenia tylko w prezentacji, do 2 miejsc; udziały % sumują się do 100,0% |
| Przeglądarki | Ostatnie 2 wersje Chrome, Edge, Safari, Firefox; desktop jako priorytet, tablet do odczytu |
| Język i formaty | Interfejs PL (EN w v2); format liczb i dat pl-PL |
| Dostępność | WCAG 2.1 AA dla kluczowych ekranów |
| Utrzymanie | Brak zależności od zewnętrznych API w MVP; eksport pełnych danych w każdej chwili |

## 11. Kryteria akceptacji

- [ ] Utworzenie planu 2027 z limitem 1 000 000 PLN i 10 kategoriami zajmuje < 30 min użytkownikowi bez szkolenia.
- [ ] Zmiana kwoty kategorii natychmiast aktualizuje jej udział %, udziały pozostałych, kwotę nieprzydzieloną i ROMI łączne.
- [ ] Suma udziałów % zawsze wynosi 100,0% przydzielonej kwoty (test na 50 losowych planach).
- [ ] Przekroczenie limitu wyświetla ostrzeżenie; próba zatwierdzenia planu jest zablokowana z komunikatem o kwocie przekroczenia.
- [ ] Kategoria Brand nie ma ROI/ROMI/ROAS („n/d”), ale jej koszt obniża ROMI_total.
- [ ] Brak założenia przy przychodzie > 0 blokuje zatwierdzenie planu.
- [ ] Import szablonu z 1 błędnym wierszem (kwota ujemna) pokazuje błąd z numerem wiersza i nie importuje niczego, dopóki błąd nie zostanie poprawiony lub wiersz pominięty.
- [ ] Eksport XLSX zawiera działające formuły udziału i ROMI; eksport PDF mieści podsumowanie na 1–2 stronach A4.
- [ ] Plan zatwierdzony jest tylko do odczytu; „nowa wersja” tworzy edytowalną kopię.
- [ ] Przykład kontrolny: Social media, koszt 120 000 PLN, przychód 480 000 PLN, marża 35% → ROI = 300%, ROMI = 40%, ROAS = 4,0, próg rentowności = 342 857 PLN.

## 12. Ryzyka, założenia, roadmapa

Największe ryzyko nie jest techniczne: planowane ROI jest tak dobre jak prognoza przychodu, którą wpisuje użytkownik.

| Ryzyko | Wpływ | Mitygacja |
| --- | --- | --- |
| Zawyżone prognozy przychodu („optymistyczne ROI”) | Wysoki – błędna alokacja budżetu | Obowiązkowe pole założenia, ostrzeżenie przy ROAS > 20, porównanie z rokiem poprzednim |
| Brak danych historycznych do prognoz | Średni | Import planu/wyników z poprzedniego roku jako punkt odniesienia |
| Podwójne liczenie przychodu przez kilka kanałów | Wysoki – suma przypisań > realny przychód | Ostrzeżenie, gdy suma P_i przekracza zadany cel sprzedaży firmy |
| Aplikacja „gorsza od Excela” w elastyczności | Średni – brak adopcji | Eksport XLSX z formułami, import szablonu, edycja inline |
| Kategorie brand niedoszacowane, bo „nie mają ROI” | Średni | Osobne KPI zastępcze, ROMI_total pokazuje pełny koszt |

Założenia: jeden użytkownik, jedna firma, jedna waluta na plan, kwoty netto, rok kalendarzowy = rok budżetowy (do potwierdzenia).

Roadmapa (każdy etap startuje po spełnieniu warunku wyjścia poprzedniego):

| Etap | Zakres | Warunek wyjścia |
| --- | --- | --- |
| MVP – plan roczny | Kategorie i udziały %, planowane ROI/ROMI/ROAS, import/eksport XLSX, CSV, PDF | Plan 2027 zrobiony w aplikacji |
| v2 – wykonanie | Rejestr wydatków, plan vs. wykonanie, ROI realne, reforecast i scenariusze | 3 miesiące danych wykonania |
| v3 – integracje i role | API Google Ads, Meta, GA4; role CFO i managerów; workflow akceptacji | Opcja: produkt SaaS |
