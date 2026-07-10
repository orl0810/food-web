# Barcode scanning architecture

The Meal Plan barcode flow is layered as `BarcodeProductDialogComponent` → `BarcodeScannerPort` / `BarcodeProductService` → authenticated `lookup-barcode-product` Edge Function → Postgres product cache → Open Food Facts.

## Scanner

`BrowserBarcodeScannerService` uses the native `BarcodeDetector` API for EAN-13, EAN-8, UPC-A, and UPC-E and requests the rear camera. It pauses after the first new result, suppresses repeats, and stops every media track on close/destroy. Manual barcode entry is always available. Native detection is intentionally behind a port so a ZXing/WASM adapter can be added for browsers without `BarcodeDetector` without changing Meal Plan UI.

Camera access requires HTTPS or localhost. No image or video frame is uploaded or stored.

## Data and freshness

Nutrition is canonical per 100 g; sodium is stored in milligrams per 100 g. Missing values remain `null`. Consumed values are calculated with `per100g × grams / 100`; rounding is presentation-only. Complete provider products refresh after 90 days and incomplete products after 14 days. User-created and locally verified products are never automatically overwritten.

Shared Open Food Facts products have `owner_id = null`. User-created products require `owner_id = auth.uid()` and are private by default because PantryFlow has no moderation workflow. Meal Plan rows store product and nutrition snapshots so history does not change after catalog refreshes.

Open Food Facts data is displayed with source attribution. Review its database/content licensing and image attribution requirements before public release.

## Deployment

1. Apply `supabase/migrations/20260710122255_barcode_products.sql`.
2. Deploy `supabase functions deploy lookup-barcode-product` with JWT verification enabled.
3. The standard Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` function secrets are required. Never add the service key to Angular environment files.
4. Test without a camera by opening Scan barcode and entering `4006381333931` manually, or inject another `BarcodeScannerPort` in component tests.

To add another provider, implement server-side normalization to the internal `products` row/DTO and place it after the local-cache decision. Do not expose provider payloads or normalization rules to Angular.

## Current limitations

- The default Express/SQLite backend does not yet mirror the product catalog endpoint; local-mode lookup returns `temporarily_unavailable`.
- Native barcode detection is not available in every Safari version; manual entry is the fallback.
- Manual creation UI and an automated E2E harness remain follow-up work.
