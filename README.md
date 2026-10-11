# Planer rocznego budżetu marketingu

Wewnętrzna aplikacja webowa, w której Head of Marketing układa roczny plan budżetu działu, widzi udział % każdej kategorii i planowany zwrot (ROI, ROMI, ROAS) per kategoria i łącznie. Specyfikacja: [`docs/PRD-planer-budzetu-marketingu.md`](docs/PRD-planer-budzetu-marketingu.md).

## Uruchomienie

```bash
npm install
npm run dev        # serwer deweloperski, http://localhost:5173
npm test           # testy jednostkowe (Vitest)
npm run build      # kontrola typów + build produkcyjny do dist/
```

Przy pierwszym uruchomieniu kliknij **Wczytaj dane przykładowe**: pojawi się zatwierdzony plan na bieżący rok i szkic na kolejny.

## Publikacja na GitHub Pages

Workflow `.github/workflows/pages.yml` po każdym pushu na `main` uruchamia testy, buduje aplikację i publikuje katalog `dist/` na GitHub Pages (https://patrick-h-dev.github.io/Biznes.AI/). Jednorazowo w repozytorium: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Uwaga: strona na GitHub Pages jest publiczna. Dane planów nie trafiają na serwer, bo zostają w przeglądarce użytkownika, ale sama aplikacja jest dostępna dla każdego, kto zna adres.

## Co jest zaimplementowane

| Obszar | Wymagania PRD | Gdzie |
| --- | --- | --- |
| Plan: rok, waluta, limit, marża domyślna, cel sprzedaży | FR-01 | `PlanFormModal` |
| Statusy szkic → zatwierdzony (tylko odczyt), nowa wersja | FR-02 | `store.approvePlan`, `createNewVersion` |
| Kopia z poprzedniego roku z korektą % | FR-03 | `planOps.copyPlanToYear` |
| Słownik kategorii, typ performance/brand, podkategorie | FR-04–06 | Ustawienia, edytor |
| Kwota roczna albo 12 miesięcy, profile sezonowości | FR-07 | edytor: widok roczny/miesięczny |
| Wprowadzanie jako % limitu → kwota | FR-08 | przełącznik „% limitu” |
| Udział %, kwota nieprzydzielona, ostrzeżenie i blokada przy przekroczeniu limitu | FR-09, FR-10 | `calc.ts`, pasek podsumowania |
| Przychód, marża, ROI/ROMI/ROAS, próg rentowności, założenie | FR-11, FR-12, FR-14 | `calc.ts` |
| KPI zastępcze dla kategorii brand | FR-13 | szczegóły wiersza |
| Dashboard: struktura, ROMI, macierz koszt × ROMI, rozkład miesięczny, porównanie r/r | FR-15–17 | `Dashboard.tsx` |
| Import XLSX/CSV wg szablonu: mapowanie, walidacja, podgląd, scal/zastąp, raport | FR-18 | `ImportWizard.tsx`, `io/importer.ts` |
| Eksport XLSX z działającymi formułami i PDF dla zarządu | FR-19 | `io/xlsx.ts`, `io/pdf.ts` |
| Dziennik zmian | FR-20 (częściowo) | karta „Dziennik zmian” |

### Metodologia (PRD, sekcja 6)

- **ROMI na marży** jest główną miarą: `(P × m − K) / K`. ROI przychodowe i ROAS są pomocnicze.
- Wynik łączny jest zawsze liczony z sum, nigdy jako średnia ROI kategorii.
- Kategorie brand nie mają własnego ROI (w aplikacji widać „n/d”), ale ich koszt jest w mianowniku ROMI całego budżetu.
- Kwoty liczone są na `decimal.js`, a nie na liczbach zmiennoprzecinkowych. Zaokrąglenie dzieje się tylko przy wyświetlaniu. Udziały są zaokrąglane metodą największych reszt, więc zawsze sumują się do 100,0%.
- Przykład kontrolny z PRD jest objęty testem: koszt 120 000, przychód 480 000, marża 35% daje ROI 300%, ROMI 40%, ROAS 4,0 i próg rentowności 342 857,14.

## Architektura

```
src/domain/   model danych, silnik obliczeń (czyste funkcje), operacje na planach, formaty pl-PL
src/io/       CSV, import (walidacja), XLSX (exceljs), PDF (jsPDF + DejaVu Sans dla polskich znaków)
src/store/    stan aplikacji w localStorage, akcje pilnujące reguł integralności
src/ui/       React: ekrany (lista planów, edytor, dashboard, import, ustawienia), wykresy SVG
```

Biblioteki do XLSX i PDF ładują się dopiero przy imporcie lub eksporcie.

## Ograniczenia tej wersji i kolejne kroki

- **Brak backendu i logowania SSO.** Dane są zapisywane w `localStorage` przeglądarki. W Ustawieniach można w każdej chwili pobrać pełną kopię JSON i ją przywrócić. Wymagania z PRD (sekcja 10) dotyczące SSO (Entra ID / Google Workspace), hostingu w UE, szyfrowania w spoczynku i dziennych backupów wymagają warstwy serwerowej. Magazyn (`src/store/store.ts`) jest jedynym miejscem zapisu, więc można go podmienić na API bez zmian w domenie i interfejsie.
- **Dziennik zmian (FR-20)** rejestruje kiedy i co się zmieniło (w MVP jest jeden użytkownik), ale nie przywraca wersji jednym kliknięciem. Nowa wersja zatwierdzonego planu to edytowalna kopia.
- Interfejs jest tylko po polsku (EN jest w planie na v2).
