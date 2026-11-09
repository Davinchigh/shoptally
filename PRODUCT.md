# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: owners and attendants of small shops in Ghana (provisions, cosmetics, phone accessories and similar), using the app on a low to mid range Android phone, often standing at the counter, in bright daylight, while serving customers. Secondary: recruiters and hiring managers opening the public demo shop to judge Ben's work; they should see a believable product, not a showcase.

## Product Purpose

Help a small shop know, at the end of each day, what it sold, what stock is running low, and whether every mobile money (MoMo) payment that should have arrived actually did. Success is an owner finishing the day's check in a couple of minutes and catching a missing or short payment they would otherwise have lost.

## Positioning

Matches the shop's own sales against the MoMo statement it already exports, payment by payment: exact match on transaction ID first, then by amount and time, and lists every leftover as a plain flag (no payment, wrong amount, duplicate line, money with no sale). Most shop apps record sales; few check the money against them.

## Operating Context

Sales are recorded one at a time during the day, often in a hurry. Reconciliation happens once a day or less, after closing, from a CSV exported from the MoMo account. Cash and MoMo both used. Amounts are in Ghana cedis (GHS), stored as pesewas.

## Capabilities and Constraints

- Four sections, kept as the main navigation: Today, Sell, Stock, Reconcile. Plus sign in, create a shop, and a demo shop.
- Money is integer pesewas everywhere; the server prices every sale.
- Must work one-handed on a 360 to 412px wide phone and on a laptop.
- Must stay readable outdoors: a light theme is required; dark-only is not acceptable.

## Brand Commitments

- Name: ShopTally (logo and colours open to change).
- Voice: short and plain ("Needs a look", "Running low"); no jargon.
- The user explicitly rejects generic AI or template looks: the design must be distinct to this product, clean, neat and pleasing, neither busy nor plain.

## Evidence on Hand

Demo shop data in backend/app/seed.py and sample-data/momo_statement_sample.csv (synthetic, labelled as a demo). No real customers, testimonials or usage numbers exist; none may be invented.

## Product Principles

1. The counter comes first: recording a sale must be fast and impossible to get wrong.
2. Money questions get exact answers: every flag says what happened, how much, and what to do.
3. Plain words over finance jargon.
4. Readable in sunlight, usable with one thumb.

## Accessibility & Inclusion

High contrast for outdoor use; touch targets at least 44px; 16px minimum input text; not colour alone for payment status.
