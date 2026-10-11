# PRD: Biznes.AI — aplikacja webowa

| Pole | Wartość |
|---|---|
| Wersja | 0.1 (draft do dyskusji) |
| Data | 2026-10-11 |
| Status | Do przeglądu |
| Właściciel produktu | Patrick H. |
| Zakres | MVP (wersja 1.0) + kierunek rozwoju na 12 miesięcy |

> **Uwaga:** repozytorium nie zawiera jeszcze kodu ani opisu produktu. Ten dokument przyjmuje roboczą tezę produktową opisaną w sekcji 1. Założenia oznaczone **[ZAŁ]** trzeba potwierdzić przed rozpoczęciem developmentu.

---

## 1. Streszczenie

**Biznes.AI** to aplikacja webowa, która pomaga właścicielom małych i średnich firm, founderom startupów i ich doradcom w trzech rzeczach:

1. **Model finansowy** — 3–5-letnia prognoza P&L, bilansu i przepływów pieniężnych (3-statement model), zbudowana z danych historycznych i założeń biznesowych, a nie od pustego arkusza.
2. **Wycena** — wycena przedsiębiorstwa metodą DCF (FCFF) i metodą porównawczą (mnożniki), z analizą scenariuszy i wrażliwości.
3. **Strategia** — diagnoza kondycji firmy, wskazanie czynników wartości (value drivers) i porównanie scenariuszy strategicznych pod kątem ich wpływu na wartość.

AI (LLM) pełni rolę **analityka-asystenta**: importuje i porządkuje dane, proponuje założenia z uzasadnieniem, wyjaśnia wyniki i pisze raporty. **Obliczenia finansowe wykonuje deterministyczny silnik**, nie model językowy — każda liczba w raporcie musi być odtwarzalna i audytowalna.

**Teza wartości:** to, na co doradca transakcyjny lub analityk poświęca dziś 2–5 dni pracy w Excelu (model + wycena + memo), Biznes.AI ma pozwolić zrobić w 1–2 godziny, przy jakości wystarczającej do rozmowy z bankiem, inwestorem lub wspólnikiem.

## 2. Problem i kontekst rynkowy

### 2.1 Problem

| Segment | Ból | Jak radzi sobie dziś |
|---|---|---|
| Właściciel MŚP | Nie wie, ile jest warta jego firma; nie ma modelu do rozmowy z bankiem/inwestorem; decyzje strategiczne podejmuje „na czucie” | Księgowa (patrzy wstecz, nie prognozuje), doradca za 15–60 tys. zł, lub nic |
| Founder startupu | Musi pokazać model i wycenę przed rundą; nie ma kompetencji finansowych | Szablony z internetu, które nie trzymają się kupy (bilans się nie bilansuje) |
| Doradca / biuro rachunkowe / boutique M&A | Powtarzalna, ręczna praca w Excelu; trudno skalować usługę na mniejszych klientów | Własne szablony Excel, czas juniora |

### 2.2 Dlaczego teraz

- Dostępność publicznych sprawozdań finansowych (e-sprawozdania w eKRS) pozwala automatycznie zasilić model danymi historycznymi.
- LLM-y są wystarczająco dobre do ekstrakcji danych z PDF/XLSX i do pisania komentarza analitycznego — ale wciąż niewiarygodne w arytmetyce, co uzasadnia architekturę „AI + deterministyczny silnik”.
- Fala sukcesji w polskich firmach rodzinnych (pokolenie założycieli z lat 90.) zwiększa popyt na wyceny.

### 2.3 Konkurencja (do pogłębienia)

| Kategoria | Przykłady | Luka, którą wypełniamy |
|---|---|---|
| Arkusze i szablony | Excel, szablony od doradców | Brak automatyzacji, błędy, brak wyjaśnień |
| Narzędzia FP&A | Narzędzia do budżetowania dla średnich i dużych firm | Za drogie i za złożone dla MŚP; brak wyceny |
| Kalkulatory wyceny online | Proste kalkulatory mnożnikowe | Brak modelu, brak DCF, wynik „czarna skrzynka” |
| Doradcy | Big4, boutique, niezależni | Cena i czas; my jesteśmy dla nich narzędziem, nie tylko konkurencją |

## 3. Cele i metryki sukcesu

### 3.1 Cele biznesowe (12 miesięcy od startu MVP) [ZAŁ]

| Cel | Metryka | Cel liczbowy |
|---|---|---|
| Walidacja popytu | Płacący klienci | 300 |
| Przychód | MRR | 100 tys. zł |
| Ekonomika jednostkowa | LTV / CAC | ≥ 3,0 |
| | Okres zwrotu CAC | ≤ 12 mies. |
| | Marża brutto (po kosztach LLM i infrastruktury) | ≥ 75% |
| Retencja | Churn logo (miesięczny, plany płatne) | ≤ 4% |

### 3.2 Metryki produktowe

- **Aktywacja:** % nowych kont, które w ciągu 7 dni wygenerują pierwszą wycenę z kompletnym modelem. Cel: ≥ 35%.
- **Time-to-value:** mediana czasu od rejestracji do pierwszego raportu. Cel: ≤ 45 min.
- **Zaufanie do założeń AI:** % propozycji założeń AI zaakceptowanych bez zmian lub z niewielką korektą (±20%). Sygnał jakości, nie cel sam w sobie.
- **Konwersja trial → płatny:** cel ≥ 8% (self-serve), ≥ 25% (doradcy po demo).
- **Jakość obliczeń:** 0 znanych błędów rachunkowych w produkcji (bilans się bilansuje, przepływy uzgadniają się ze zmianą gotówki).

### 3.3 Poza celami (non-goals) w MVP

- Księgowość, fakturowanie, integracja z systemami ERP w czasie rzeczywistym.
- Wyceny regulowane (np. na potrzeby sądu, aportu, KSH) — produkt **nie zastępuje** biegłego rewidenta ani rzeczoznawcy.
- Modele dla banków i ubezpieczycieli (specyfika sprawozdawczości wymaga osobnych szablonów).
- Wycena spółek giełdowych na potrzeby inwestycyjne (rekomendacje).
- Aplikacja mobilna natywna (wystarczy responsywny web do przeglądania).

## 4. Użytkownicy i persony

| Persona | Opis | Najważniejsze zadanie (JTBD) | Plan |
|---|---|---|---|
| **Marek — właściciel MŚP** | 52 lata, firma produkcyjna, 25 mln zł przychodu, rozważa sprzedaż lub sukcesję | „Chcę wiedzieć, ile jest warta moja firma i co mogę zrobić, żeby była warta więcej” | Pro |
| **Ola — founderka SaaS** | 31 lat, przed rundą seed, przychód 80 tys. zł MRR | „Potrzebuję wiarygodnego modelu i wyceny do data roomu w tydzień” | Starter / Pro |
| **Tomasz — doradca** | Niezależny doradca transakcyjny lub partner biura rachunkowego, 10–30 klientów rocznie | „Chcę robić wyceny dla mniejszych klientów rentownie, w mojej marce” | Advisor |
| **Inwestor / bank (odbiorca)** | Otrzymuje raport, nie loguje się regularnie | „Chcę szybko sprawdzić założenia i wrażliwość wyniku” | Link do udostępnienia (bez konta) |

## 5. Zakres MVP — kluczowe przepływy

```
Rejestracja → Utworzenie firmy → Import danych historycznych → Założenia (AI proponuje, użytkownik zatwierdza)
→ Model 3-statement → Wycena (DCF + mnożniki) → Scenariusze i wrażliwość → Raport (PDF/XLSX/link)
```

### 5.1 Epik A — Konto, organizacja, uprawnienia

| ID | Historia użytkownika | Priorytet |
|---|---|---|
| A1 | Jako użytkownik mogę założyć konto e-mailem lub przez Google/Microsoft | Must |
| A2 | Jako właściciel konta mogę zaprosić członków zespołu z rolą: Właściciel, Edytor, Przeglądający | Must |
| A3 | Jako doradca mogę prowadzić wiele firm-klientów w jednym workspace i nadawać klientowi dostęp tylko do jego projektu | Must (Advisor) |
| A4 | Jako użytkownik mogę włączyć 2FA | Should |
| A5 | SSO (SAML) dla większych kancelarii doradczych | Won't (MVP) |

### 5.2 Epik B — Import i normalizacja danych

| ID | Wymaganie | Priorytet |
|---|---|---|
| B1 | Wyszukanie firmy po NIP/KRS/nazwie i pobranie danych rejestrowych (nazwa, PKD, forma prawna) | Must |
| B2 | Import historycznych sprawozdań finansowych (3–5 lat) z pliku e-sprawozdania (XML) | Must |
| B3 | Import z PDF/XLSX (bilans, RZiS, zestawienie obrotów i sald) z ekstrakcją przez AI | Must |
| B4 | Ekran weryfikacji importu: każda pozycja pokazuje źródło (plik, strona, komórka) i poziom pewności; użytkownik zatwierdza lub poprawia | Must |
| B5 | Mapowanie pozycji na standardowy plan modelu (np. przychody, koszty wg rodzaju, EBITDA, kapitał obrotowy, CAPEX, dług netto) | Must |
| B6 | Normalizacje (korekty jednorazowe, wynagrodzenie właściciela vs. rynkowe, transakcje z podmiotami powiązanymi) z sugestiami AI | Should |
| B7 | Ręczne wprowadzenie danych dla firm bez historii (startupy) | Must |
| B8 | Integracje z programami księgowymi / bankowością (API) | Could (po MVP) |

**Kryteria akceptacji B2–B4:** po imporcie suma aktywów = suma pasywów dla każdego roku; różnice > 1 zł blokują przejście dalej z jasnym komunikatem, którą pozycję sprawdzić.

### 5.3 Epik C — Model finansowy (3-statement)

| ID | Wymaganie | Priorytet |
|---|---|---|
| C1 | Prognoza 3–10 lat, okresy roczne; dla startupów opcjonalnie miesięcznie w roku 1–2 | Must |
| C2 | Sterowniki przychodów: (a) wzrost % r/r, (b) cena × wolumen, (c) dla SaaS: nowi klienci, churn, ARPA | Must |
| C3 | Koszty: % przychodu, wartość stała + indeksacja, plan zatrudnienia (etaty × koszt) | Must |
| C4 | Kapitał obrotowy w dniach (DSO, DIO, DPO); CAPEX i amortyzacja; dług z harmonogramem spłat i odsetkami | Must |
| C5 | Automatycznie powiązane P&L, bilans i cash flow; kontrole integralności (bilans się bilansuje, gotówka się uzgadnia) widoczne cały czas | Must |
| C6 | Podatek CIT z uwzględnieniem stawki 9%/19% i strat podatkowych do rozliczenia | Should |
| C7 | Dowolna liczba scenariuszy (bazowy, optymistyczny, pesymistyczny + własne) na wspólnej strukturze modelu | Must |
| C8 | Historia wersji modelu z porównaniem zmian (kto, co, kiedy) | Should |
| C9 | Eksport do XLSX **z działającymi formułami** (nie tylko wartości) | Must |

### 5.4 Epik D — Asystent AI do założeń

| ID | Wymaganie | Priorytet |
|---|---|---|
| D1 | AI proponuje założenia (wzrost, marże, dni kapitału obrotowego, CAPEX/przychód) na podstawie historii firmy i benchmarków branżowych | Must |
| D2 | Każda propozycja ma **uzasadnienie i źródło** (np. „średnia z 3 lat historycznych”, „mediana dla PKD 25.xx”), a użytkownik akceptuje ją jawnie | Must |
| D3 | Wywiad strategiczny: AI zadaje 8–12 pytań (rynek, przewaga konkurencyjna, plany inwestycyjne, ryzyka) i przekłada odpowiedzi na założenia | Should |
| D4 | Wykrywanie niespójności: np. wzrost przychodów 40% r/r bez wzrostu kapitału obrotowego i CAPEX; marża EBITDA powyżej górnego kwartyla branży | Must |
| D5 | Czat „zapytaj model”: pytania w języku naturalnym („co się stanie z wyceną, jeśli marża spadnie o 2 p.p.?”) — AI wywołuje silnik obliczeń, nie liczy samo | Should |

**Zasada nadrzędna:** LLM nie wykonuje obliczeń prezentowanych użytkownikowi. Każda liczba pochodzi z silnika; AI generuje założenia (wejście) i komentarz (wyjście).

### 5.5 Epik E — Wycena

| ID | Wymaganie | Priorytet |
|---|---|---|
| E1 | **DCF (FCFF)**: wolne przepływy z modelu, WACC, wartość rezydualna metodą Gordona i/lub mnożnika wyjścia; mid-year convention opcjonalnie | Must |
| E2 | **Kalkulator WACC**: stopa wolna od ryzyka (rentowność polskich obligacji 10-letnich), premia za ryzyko rynkowe, beta (unlevered z branży, relewarowana do struktury docelowej), premia za wielkość i ryzyko specyficzne, koszt długu po podatku. Wszystkie parametry z datą i źródłem, edytowalne | Must |
| E3 | **Metoda porównawcza**: EV/EBITDA, EV/Sprzedaż, P/E z bazy benchmarków; korekta dyskontem za brak płynności i wielkość | Must |
| E4 | Przejście od EV do wartości kapitału własnego (dług netto, pozycje dłużne i quasi-dłużne, aktywa nieoperacyjne) z jawnym mostem | Must |
| E5 | Wynik jako **przedział** (nie jedna liczba) + wykres „football field” zestawiający metody i scenariusze | Must |
| E6 | Analiza wrażliwości: tabele 2D (WACC × g, WACC × mnożnik wyjścia) i wykres tornado dla kluczowych założeń | Must |
| E7 | Dyskonta/premie: brak kontroli (DLOC), brak płynności (DLOM) — opcjonalne, z ostrzeżeniem o ich subiektywności | Should |
| E8 | Symulacja Monte Carlo rozkładu wartości | Could (po MVP) |
| E9 | Wycena startupów przed przychodami (VC method, scorecard) | Could |

**Kryteria akceptacji E1–E6:** wyniki silnika zgodne co do 0,01% z referencyjnym modelem Excel dla zestawu ≥ 20 przypadków testowych (golden files), w tym przypadków brzegowych (ujemne FCFF, g ≥ WACC → błąd walidacji, ujemny dług netto).

### 5.6 Epik F — Strategia i czynniki wartości

| ID | Wymaganie | Priorytet |
|---|---|---|
| F1 | Diagnoza: wskaźniki rentowności, płynności, zadłużenia, efektywności (ROIC vs WACC) z porównaniem do branży | Must |
| F2 | Drzewo czynników wartości: które założenia najbardziej zmieniają wartość (z analizy wrażliwości) | Must |
| F3 | Porównanie inicjatyw strategicznych (np. nowa linia produkcyjna, ekspansja zagraniczna, podwyżka cen) jako scenariuszy, z wpływem na wartość, NPV, IRR i okres zwrotu | Should |
| F4 | Generowany przez AI przegląd strategiczny (SWOT, ryzyka, rekomendacje) **powiązany z liczbami z modelu** | Should |
| F5 | Szacowanie TAM/SAM/SOM dla startupów | Could |

### 5.7 Epik G — Raporty i udostępnianie

| ID | Wymaganie | Priorytet |
|---|---|---|
| G1 | Raport z wyceny (PDF, PL; EN w planie Pro+): podsumowanie, opis firmy, analiza historyczna, założenia, model, wycena, wrażliwość, zastrzeżenia | Must |
| G2 | Edycja tekstów raportu przed eksportem; AI pisze pierwszą wersję komentarza | Must |
| G3 | White-label (logo, kolory, stopka doradcy) | Must (Advisor) |
| G4 | Link tylko do odczytu dla inwestora/banku, z wygaśnięciem i opcjonalnym hasłem; odbiorca może zmieniać założenia w trybie „sandbox” bez zapisu | Should |
| G5 | Eksport XLSX (patrz C9) i prezentacji (PPTX) | Must / Could |

### 5.8 Epik H — Płatności i plany

| ID | Wymaganie | Priorytet |
|---|---|---|
| H1 | Subskrypcje miesięczne/roczne, płatność kartą, BLIK, przelew; faktury VAT z automatu | Must |
| H2 | 14-dniowy trial planu Pro bez karty; limit 1 firmy, eksport ze znakiem wodnym | Must |
| H3 | Limity planu egzekwowane w aplikacji (liczba firm, użytkowników, eksportów, zapytań AI) | Must |

## 6. Model biznesowy i cennik [ZAŁ]

| Plan | Cena netto (miesięcznie, rozliczenie roczne) | Dla kogo | Zawartość |
|---|---|---|---|
| **Starter** | 149 zł | Founder, mała firma | 1 firma, 2 użytkowników, DCF + mnożniki, raport PDF |
| **Pro** | 449 zł | MŚP, firma przed transakcją | 3 firmy, 5 użytkowników, scenariusze bez limitu, strategia, XLSX z formułami, link dla inwestora |
| **Advisor** | od 1 490 zł | Doradcy, biura rachunkowe | 25 aktywnych firm, white-label, portal klienta, priorytetowe wsparcie |
| **Raport jednorazowy** | 1 990 zł | Właściciel, który potrzebuje jednej wyceny | Dostęp na 60 dni + raport |

**Logika cenowa:** kotwicą jest koszt doradcy (15–60 tys. zł za wycenę), a nie cena innych SaaS. Plan Advisor jest wyceniany tak, by doradca odzyskał koszt rocznej subskrypcji na jednym-dwóch zleceniach.

**Kontrola marży brutto:** koszt LLM na aktywną firmę miesięcznie musi być monitorowany od pierwszego dnia (cel: < 10% ceny planu). Stosujemy cache, mniejsze modele do ekstrakcji i klasyfikacji, większe tylko do analizy i raportów.

**Kanały pozyskania (do testu):** content SEO („ile jest warta moja firma”, „wycena spółki z o.o.”), partnerstwa z biurami rachunkowymi (plan Advisor jako kanał dystrybucji do ich klientów), społeczności founderów i akceleratory.

## 7. Wymagania niefunkcjonalne

| Obszar | Wymaganie |
|---|---|
| **Poprawność** | Silnik obliczeniowy pokryty testami jednostkowymi i golden files; każda zmiana silnika przechodzi regresję. Arytmetyka dziesiętna (nie float) dla kwot. |
| **Audytowalność** | Każda liczba w raporcie da się prześledzić do założenia lub pozycji źródłowej (klik → źródło). Log zmian założeń. |
| **Wydajność** | Przeliczenie modelu (10 lat × 3 scenariusze) < 500 ms; tabela wrażliwości 7×7 < 2 s; generowanie raportu PDF < 30 s. |
| **Dostępność** | 99,5% miesięcznie (MVP), 99,9% (rok 2). |
| **Bezpieczeństwo** | Szyfrowanie w spoczynku i w tranzycie (TLS 1.2+), izolacja danych między organizacjami (row-level security), 2FA, testy penetracyjne przed startem komercyjnym. |
| **Prywatność / RODO** | Hosting danych w UE; umowa powierzenia przetwarzania; dane klientów **nie są używane do trenowania modeli** (zapis w umowach z dostawcami LLM); możliwość usunięcia wszystkich danych firmy. |
| **AI Act** | Transparentność: użytkownik wie, które treści wygenerowało AI; oznaczenie w raporcie. Ocena, czy któreś zastosowanie mieści się w kategorii wysokiego ryzyka (np. ocena zdolności kredytowej osób fizycznych — poza zakresem). |
| **Lokalizacja** | Interfejs PL (MVP), EN (po MVP); format liczb i walut PL; waluta PLN z możliwością EUR/USD. |
| **Dostępność (a11y)** | WCAG 2.1 AA dla kluczowych ekranów. |
| **Przeglądarki** | Aktualne Chrome, Edge, Firefox, Safari; desktop jako główny kontekst (≥ 1280 px), tablet/telefon do przeglądania raportów. |

## 8. Architektura — kierunek (do decyzji zespołu technicznego)

```
[Frontend web (SPA)] ──► [API backend] ──► [Silnik finansowy (deterministyczny, wersjonowany)]
                               │
                               ├──► [Warstwa AI: ekstrakcja, założenia, komentarz — narzędzia wywołujące silnik]
                               ├──► [Baza danych (Postgres, RLS per organizacja)] + [Magazyn plików]
                               ├──► [Dane rynkowe: stopy, benchmarki branżowe, mnożniki — z datą i źródłem]
                               └──► [Generator raportów PDF/XLSX/PPTX]
```

Kluczowe decyzje architektoniczne:

1. **Silnik finansowy jako osobny, czysto funkcyjny moduł** (wejście: dane + założenia; wyjście: model + wycena). Łatwy do testowania i wersjonowania — raport zawsze zapisuje wersję silnika.
2. **AI przez wywołania narzędzi (tool use)**, nie przez generowanie liczb w tekście. Odpowiedzi AI walidowane schematem.
3. **Dane rynkowe z datą obowiązywania** — wycena „na dzień X” musi być odtwarzalna po latach.
4. **Eksport XLSX z formułami** generowany z tej samej definicji modelu co silnik (jedno źródło prawdy), aby uniknąć rozjazdów.

## 9. Doświadczenie użytkownika — kluczowe ekrany

1. **Pulpit** — lista firm/projektów, status (dane → model → wycena → raport), ostatnia wycena jako przedział.
2. **Kreator nowej firmy** — NIP/KRS → import → weryfikacja (widok podzielony: dokument źródłowy | rozpoznane pozycje).
3. **Założenia** — tabela założeń per rok i scenariusz; przy każdej propozycji AI ikonka „dlaczego?” i przycisk Akceptuj/Zmień; po prawej panel z podglądem wpływu na wartość w czasie rzeczywistym.
4. **Model** — trzy zakładki (P&L, Bilans, Cash flow) w układzie arkusza; stały pasek kontroli integralności.
5. **Wycena** — football field, most EV → equity, kalkulator WACC, tabele wrażliwości.
6. **Strategia** — diagnoza vs. branża, drzewo czynników wartości, porównanie inicjatyw.
7. **Raport** — edytor sekcji z podglądem PDF.

Zasada projektowa: **„pokaż pracę”** — użytkownik nie-finansista dostaje prosty język i wyjaśnienia, a doradca może zejść do każdej formuły.

## 10. Ryzyka i sposoby ich ograniczenia

| Ryzyko | Wpływ | Prawdopodobieństwo | Mitygacja |
|---|---|---|---|
| Błędy obliczeń podważają zaufanie | Krytyczny | Średnie | Silnik deterministyczny, golden files, przegląd metodologii przez zewnętrznego eksperta ds. wyceny przed startem |
| Halucynacje AI w założeniach lub komentarzu | Wysoki | Wysokie | Źródło przy każdej propozycji, jawna akceptacja, walidacja spójności (D4), AI nie podaje liczb spoza silnika |
| Użytkownik traktuje wynik jako wycenę „urzędową” | Wysoki (prawny) | Średnie | Zastrzeżenia w raporcie i regulaminie, jasny opis przeznaczenia, wynik jako przedział |
| Niska jakość lub brak benchmarków branżowych dla PL | Średni | Wysokie | Start od danych z e-sprawozdań (własna baza agregatów per PKD) + licencjonowane źródła; pokazanie wielkości próby |
| Koszt LLM zjada marżę | Średni | Średnie | Budżet tokenów per plan, routing modeli, cache, monitoring kosztu per klient |
| Wyciek danych finansowych klientów | Krytyczny | Niskie | RLS, szyfrowanie, pentesty, minimalny dostęp, logi audytowe |
| Doradcy postrzegają produkt jako konkurencję | Średni | Średnie | Plan Advisor i white-label: pozycjonowanie jako narzędzie, które zwiększa ich przepustowość |

## 11. Plan wydań [ZAŁ]

| Etap | Czas | Zakres | Kryterium wyjścia |
|---|---|---|---|
| **0. Discovery** | 4 tyg. | 20 wywiadów (10 właścicieli, 5 founderów, 5 doradców), prototyp klikalny, test cennika (van Westendorp) | ≥ 40% rozmówców deklaruje gotowość zapłaty w testowanym przedziale cenowym |
| **1. Alpha** | 8 tyg. | Silnik finansowy + DCF + import e-sprawozdań + ręczne założenia + eksport XLSX | 10 doradców przechodzi pełny przepływ; zgodność z modelami referencyjnymi |
| **2. Beta zamknięta** | 6 tyg. | Asystent AI (D1, D2, D4), mnożniki, wrażliwość, raport PDF, płatności | 50 aktywnych firm, aktywacja ≥ 25% |
| **3. MVP publiczne** | 4 tyg. | Plan Advisor/white-label, link dla inwestora, onboarding self-serve | Pierwszych 50 płacących klientów |
| **4. Po MVP** | kwartał 2–4 | Strategia (F3–F4), wywiad AI, Monte Carlo, integracje księgowe, wersja EN, PPTX | Wg celów z sekcji 3 |

## 12. Otwarte pytania

1. **Główny segment na start:** doradcy (B2B2C, krótszy cykl walidacji, wyższy ARPA) czy właściciele MŚP (większy rynek, droższe pozyskanie)? *Rekomendacja: zacząć od doradców — są w stanie ocenić jakość metodologii i stanowią kanał dystrybucji do MŚP.*
2. Skąd licencjonujemy dane o mnożnikach transakcyjnych i betach dla rynku polskiego/CEE i jaki jest ich koszt?
3. Czy oferujemy płatny „przegląd przez eksperta” (human-in-the-loop) jako dodatek do raportu?
4. Jaki zakres odpowiedzialności przyjmujemy w regulaminie i czy potrzebne jest ubezpieczenie OC zawodowe?
5. Czy wersja EN i waluty obce są potrzebne już w MVP (founderzy pozyskujący kapitał zagraniczny)?

## 13. Słownik

| Termin | Znaczenie |
|---|---|
| 3-statement model | Powiązany model rachunku zysków i strat, bilansu i przepływów pieniężnych |
| DCF / FCFF | Wycena metodą zdyskontowanych przepływów pieniężnych; wolne przepływy dla firmy (przed obsługą długu) |
| WACC | Średni ważony koszt kapitału — stopa dyskontowa dla FCFF |
| EV | Wartość przedsiębiorstwa (kapitał własny + dług netto) |
| DLOM / DLOC | Dyskonto za brak płynności / za brak kontroli |
| Football field | Wykres porównujący przedziały wartości z różnych metod |
| ROIC | Zwrot z zainwestowanego kapitału; firma tworzy wartość, gdy ROIC > WACC |
| Golden files | Referencyjne przypadki testowe z oczekiwanymi wynikami |
