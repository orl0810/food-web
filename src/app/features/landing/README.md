# Landing page integration notes

## Conversion

All primary CTAs navigate to `/auth/login?mode=signup`. Existing `utm_*` query parameters are preserved. The login page reads `mode=signup` and opens its existing password account-creation form.

## Analytics

`LandingAnalyticsService` is provider-agnostic. It dispatches browser events named `pantryflow:<event>` with the current route, referrer, UTM campaign values, and non-sensitive placement metadata. A future analytics provider can subscribe once at the application boundary.

| Event | Trigger |
| --- | --- |
| `landing_view` | Landing component initialization |
| `hero_primary_cta_clicked` | Hero signup CTA |
| `hero_secondary_cta_clicked` | “See how it works” |
| `header_cta_clicked` | Header or mobile-menu signup CTA |
| `feature_section_viewed` | Feature showcase enters the viewport |
| `how_it_works_viewed` | How-it-works section enters the viewport |
| `faq_opened` | A FAQ disclosure opens |
| `final_cta_clicked` | Benefits or final signup CTA |
| `signup_started` | Immediately before signup navigation |
| `login_clicked` | Public sign-in action |

No inventory, recipe, meal, email, or other personal data is included.

## Production integrations

- Replace the relative canonical URL with the final public production origin when it is known.
- Add reviewed Privacy Policy, Terms and Conditions, and Cookie Policy pages before public launch, then replace the footer launch note with real routes.
- Confirm `hello@pantryflow.app` is monitored before launch.
- Add a licensed Open Graph image and `og:image` metadata when a final social asset exists.
