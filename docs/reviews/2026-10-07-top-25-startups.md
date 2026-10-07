# Top 25 startups for review

Snapshot date: **2026-10-07**. Scores and copy are stored values. Nothing here was rescored or rewritten.

## How this list was built

- Source: `startup_uploads` with `status = approved`, ordered by `total_god_score` descending.
- Gate: public leaderboard rule `isRankingsEligibleStartup` in `lib/rankingsEligibility.js` (junk entity gate, quarantine names, name ontology, publisher websites).
- Scan: first 120 approved rows. Three failed the gate and were left out: **Ultra** (100, `quarantine_name`), **Seven** (100, `quarantine_name`), **Zuora** (97, `quarantine_name`). The other 117 passed. These 25 are the first 25 that passed.
- Signals: `startup_signal_scores` joined on startup id. Carbon Health has no signal row.
- Stage labels follow `server/lib/stageTaxonomy.js`: 1 Pre-Seed, 2 Seed, 3 Series A, 4 Series B.

This file is a review queue. It does not change GOD weights, match clocks, or row status.

## What to look at first

Sixteen of these 25 have traction **100**. Market scores sit in a tight band (mostly 49–56); the exceptions are Cast (63), Catalio (56), Spangle (33), Crusoe (30), and Verkada (30). Team scores repeat a few exact values (42, 64, 69, 82, 87). News momentum is 0 on 20 of the 24 rows that have a signal. That shape is why several weak or mis-copied profiles still sit at 97–100.

| Decision | Count | Names |
|---|---|---|
| Profile is a press headline, essay, or fund announcement | 5 | Cast, Pomelo Care, Spangle, Catalio, Agentic |
| Tagline and product disagree, or copy is boilerplate | 5 | Alt-qq, Carbon Health, Hookdeck, Writer, Adaptive Security |
| Entity gate is already `review` | 4 | Alt-qq, Cast, Addi, PermitFlow |
| Own copy describes a scaled product while stage is early | 7 | Odoo, Addi, Crusoe Energy, Customer.io, Mews, Verkada, Writer |
| Clean enough to keep on a public top list | 8 | Powerapply, Shipshared, Jump, Nango, LatticeFlow, AheadComputing, Mendra, Inferact |

PermitFlow is in the `review` gate and also has the second-highest signal in this set (8.1). Crusoe has the highest signal (8.4) and a coherent product description, with stage still Pre-Seed.

## Roster

Components are team / traction / market / product / vision. Signal is `signals_total`.

| # | GOD | Name | Stage | Gate | Signal | Sectors | Website |
|---|---|---|---|---|---|---|---|
| 1 | 100 | Powerapply | Seed | qualified | 6.3 | AI/ML, SaaS | https://powerapply.ai/ |
| 2 | 100 | Odoo | Pre-Seed | qualified | 5.5 | SaaS | odoo.com |
| 3 | 100 | Alt-qq | Series A | review | 6.2 | Gaming, Consumer | https://alt-qq.com/ |
| 4 | 100 | Shipshared | Seed | qualified | 7.0 | Marketplace, SaaS | https://shipshared.link |
| 5 | 100 | Jump | Pre-Seed | qualified | 5.9 | SaaS, SportsTech | https://jump.com |
| 6 | 100 | Cast | Pre-Seed | review | 6.8 | Infrastructure, Developer Tools, AI/ML | https://cast.ai/ |
| 7 | 100 | Nango | Seed | qualified | 5.1 | Developer Tools, SaaS | https://nango.com |
| 8 | 99 | Pomelo Care | Pre-Seed | qualified | 4.5 | HealthTech, Climate, Developer Tools | https://pomelocare.com |
| 9 | 99 | Carbon Health | Pre-Seed | qualified | — | Climate, HealthTech | carbonhealth.com |
| 10 | 99 | Addi | Pre-Seed | review | 6.9 | Fintech | https://co.addi.com/ |
| 11 | 99 | LatticeFlow | Pre-Seed | qualified | 4.5 | AI/ML, SaaS | https://latticeflow.ai |
| 12 | 99 | Crusoe Energy | Pre-Seed | qualified | 8.4 | CleanTech | https://crusoe.ai |
| 13 | 98 | Spangle | Pre-Seed | qualified | 6.7 | Developer Tools | https://spangle.io |
| 14 | 98 | AheadComputing | Seed | qualified | 6.9 | AI/ML, Infrastructure, Edge Computing | https://aheadcomputing.com |
| 15 | 98 | Mendra | Pre-Seed | qualified | 4.5 | HealthTech, AI/ML | https://mendra.com |
| 16 | 98 | Customer.io | Pre-Seed | qualified | 4.5 | Customer Communication, Customer Engagement, Marketing Technology, SaaS | https://customer.io |
| 17 | 98 | Inferact | Pre-Seed | qualified | 5.4 | AI/ML, Developer Tools | https://inferact.ai |
| 18 | 98 | PermitFlow | Pre-Seed | review | 8.1 | PropTech, SaaS | https://permitflow.com/ |
| 19 | 98 | Hookdeck | Seed | qualified | 6.9 | Fintech | hookdeck.com |
| 20 | 98 | Mews | Series B | qualified | 5.5 | SaaS, Hospitality, AI/ML | https://mews.com |
| 21 | 98 | Verkada | Pre-Seed | qualified | 4.0 | Cybersecurity | https://www.verkada.com |
| 22 | 98 | Writer | Pre-Seed | qualified | 4.0 | AI/ML, Media, Enterprise, SaaS | writer.com |
| 23 | 97 | Catalio | Pre-Seed | qualified | 4.0 | Fintech, HealthTech, Developer Tools | https://catalio.ai |
| 24 | 97 | Adaptive Security | Seed | qualified | 7.7 | Fintech | adaptivesecurity.com |
| 25 | 97 | Agentic | Pre-Seed | qualified | 5.5 | AI/ML, SaaS, Climate | agentic.ai |

## Row notes

### 1. Powerapply — keep

- ID `e99d58f6-b1d9-41c7-b185-5011cdb8beb0`. Source `url`. Created 2026-01-21.
- Tagline: AI-powered CV tailoring for job seekers.
- Description matches the tagline. Components 64 / 87 / 54 / 90 / 62. Signal 6.3 (news 0).
- No review flag.

### 2. Odoo — scaled company in a Pre-Seed slot

- ID `137d269d-a058-4b68-97e2-af67f30ce57d`. Source `url`. Created 2026-01-23.
- Tagline: Integrated business software platform for SMEs.
- Description: Belgian suite for finance, sales, HR, and marketing, serving SMEs globally.
- Components 38 / **100** / 54 / 78 / 90. Signal 5.5. Website has no scheme (`odoo.com`).
- Flag: stage is Pre-Seed while the stored description is a global product suite, and team is 38 against traction 100.

### 3. Alt-qq — tagline disagrees with the product

- ID `e2137323-5a0a-47d0-9f33-d00c9092a62a`. Source `url`. Created 2026-01-25. Gate **review**.
- Tagline: Revolutionizing the film industry with AI-driven tools.
- Description: Alt-QQ publishes Reel Rogue, a browser-based roguelike deckbuilder with slot-machine combat.
- Sectors Gaming, Consumer fit the description. Components 80 / 96 / 54 / **100** / 62. Signal 6.2.
- Flag: film-AI tagline versus a game description, and the row is already in review.

### 4. Shipshared — keep

- ID `b002449f-73f7-41cb-8ad7-d3c96bcbb89a`. Source `url`. Created 2026-01-21.
- Tagline: Traffic Marketplace for Startups. Description matches.
- Components 82 / 91 / 54 / 96 / 60. Signal 7.0 (news 0). Sectors Marketplace, SaaS.
- No review flag. Copy is generic but consistent.

### 5. Jump — keep

- ID `2546372b-4dee-42ce-9f7b-a7e6a8baf446`. Source `url`. Created 2026-01-23.
- Tagline: More revenue for teams, less friction for fans.
- Description: unified fan platform for sports teams (ticketing, marketing, fan data).
- Components 47 / **100** / 54 / **100** / 81. Signal 5.9. Stage Pre-Seed.
- No copy conflict. Team 47 next to traction 100 is the only soft flag.

### 6. Cast — headline, not a tagline

- ID `c24a0f5e-5ffe-4b0b-aa28-4bc350731ff1`. Source `url`. Created 2026-01-15. Gate **review**.
- Tagline is truncated press: “Cast AI has reached a valuation above $1 billion following a strategic investment from Pacific Alliance Ventures, the U.”
- Description is a real product line: Kubernetes performance, rightsizing, GPU optimization, cloud cost control.
- Components 82 / 91 / 63 / 86 / 70. Signal 6.8, the only top-10 row with news momentum above 0 (1.1).
- Flag: replace the headline tagline before this stays on a public list. Stage is still Pre-Seed beside a stored billion-dollar valuation line. Website is cast.ai.

### 7. Nango — keep

- ID `43a0cb7e-3a25-4c54-86ba-7e837d8753fd`. Source `url`. Created 2026-01-25.
- Tagline: Simplifying API integrations for developers. Description matches.
- Components 82 / 81 / 54 / 96 / 62. Signal 5.1 (news 0, capital convergence 1.7).
- No review flag.

### 8. Pomelo Care — press blurb stored as the company

- ID `f3c32716-4d23-4a48-b59a-fefa66039867`. Source `url`. Created 2026-01-09.
- Tagline and description are the same truncated article: NYC women’s and children’s care, $92M Series C, $1.7B valuation, led by Stripes, with a “appeared first” cutoff in the description.
- Sectors: HealthTech, **Climate**, **Developer Tools**.
- Components 42 / **100** / 53 / 98 / 74. Signal 4.5 (news 0, execution 0). Stage Pre-Seed.
- Flag: headline copy, sectors that do not match maternity care, and a late-stage raise sitting in Pre-Seed.

### 9. Carbon Health — empty profile

- ID `9d19bb49-a13c-4538-8c5d-c5c8d82bad73`. Source `url`. Created 2025-12-22.
- Tagline and description are the same line: “Healthcare platform, Ayo Omojola CPO”.
- Sectors: **Climate**, HealthTech. Website `carbonhealth.com` (no scheme). **No signal row.**
- Components 69 / **100** / 49 / 96 / 50. Stage Pre-Seed.
- Flag: boilerplate identity line, Climate sector, missing signal, traction 100.

### 10. Addi — gate review, early stage on a credit platform

- ID `0824b2ac-df8f-4a61-bf8d-4e783dc9838a`. Source **manual**. Created 2025-12-14. Gate **review**.
- Tagline: Empowering your purchases with accessible credit solutions!
- Description: Colombian commerce and credit platform for consumers and merchants.
- Components 87 / **100** / 50 / 75 / 66. Signal 6.9 (news 0). Stage Pre-Seed. Sector Fintech.
- Flag: already in review. Marketing tagline, and the description is an operating credit platform at Pre-Seed.

### 11. LatticeFlow — keep, with a press sentence in the description

- ID `aecbb6f9-16e4-497a-9be2-c40125e87496`. Source `url`. Created 2026-01-22.
- Tagline: AI Governance. Done Right.
- Description adds an acquisition claim (AI Sonar) on top of the product line.
- Components 69 / **100** / 54 / 89 / 63. Signal 4.5 (news 0, execution 0).
- Soft flag only: description leans on a press claim, and signal is flat. Product and sectors agree.

### 12. Crusoe Energy — strongest signal, stage still Pre-Seed

- ID `2770a507-8546-426d-9866-17a77f9a3e5d`. Source **manual**. Created 2025-12-14.
- Tagline: The AI factory company — renewable-powered AI cloud infrastructure.
- Description: vertically integrated AI infrastructure, low-carbon energy, data centers, GPU cloud.
- Components 87 / **100** / **30** / 82 / 92. Signal **8.4** (news 1.5, receptivity 2.5, capital 2, execution 2). Sector CleanTech only. Stage Pre-Seed.
- Flag: coherent company, highest signal in the set, market component 30, and stage does not match a hyperscale infrastructure description. Worth keeping in a “real company” set and separately deciding whether Pre-Seed is right.

### 13. Spangle — Pulse 2.0 headline

- ID `919a653f-e76a-46dd-9586-32ec17a62681`. Source `url`. Created 2026-01-10.
- Tagline and description are a truncated Pulse 2.0 post: Spangle AI, $15M Series A led by NewRoad, total funding $21M. Description ends “appeared first on Pulse 2.0.”
- Sector stored as Developer Tools only. Market **33**. Components 69 / **100** / 33 / 92 / 75. Signal 6.7. Stage Pre-Seed.
- Flag: replace headline copy. Series A language versus Pre-Seed stage.

### 14. AheadComputing — keep

- ID `1f232c8a-f0c7-4150-9fff-c24abb5717eb`. Source `url`. Created 2026-01-22.
- Tagline: Building the world's fastest CPU for modern workloads.
- Description: high-performance application processors from former Intel CPU architects.
- Components 82 / 75 / 54 / 94 / 66. Signal 6.9. Sectors AI/ML, Infrastructure, Edge Computing. Stage Seed.
- No review flag. Traction 75 is one of the few scores in this list that is not pinned at 100.

### 15. Mendra — keep

- ID `69c5c137-beb6-4b91-b2f6-2ffac49d3218`. Source `url`. Created 2026-01-23.
- Tagline: AI-native biopharma for rare diseases. Description matches (license and commercialize rare-disease therapies).
- Components 82 / 94 / 54 / 65 / 57. Signal 4.5 (news 0, execution 0). Stage Pre-Seed.
- No copy conflict. Product score 65 is the low component.

### 16. Customer.io — established product at Pre-Seed

- ID `5b966dd6-dbac-4ac6-ad4c-5e0a934ec3c6`. Source **manual**. Created 2025-12-28.
- Tagline is product marketing: first-party data, personalized journeys, AI-powered customer engagement.
- Description matches. Sectors are specific (Customer Communication, Customer Engagement, Marketing Technology, SaaS).
- Components 42 / **100** / 51 / **100** / 83. Signal 4.5 (execution 0). Stage Pre-Seed.
- Flag: stage and team/traction split. Copy itself is consistent.

### 17. Inferact — keep

- ID `feda194d-bc8c-4f44-98af-739e9c1ea7db`. Source `url`. Created 2026-01-22.
- Tagline: Accelerating AI inference with open-source solutions.
- Description: vLLM creators, 500+ model architectures, 200+ accelerator types.
- Components 82 / 81 / 54 / 78 / 68. Signal 5.4. Stage Pre-Seed.
- No review flag.

### 18. PermitFlow — gate review, signal is real

- ID `06902b09-279f-4ea8-b4f5-ac0c32f3ba56`. Source **manual**. Created 2025-12-14. Gate **review**.
- Tagline: Revolutionizing construction with AI-driven permit management.
- Description is plainer and consistent: software for researching, preparing, submitting, and tracking construction permits.
- Components 87 / **100** / 50 / 74 / 60. Signal **8.1** (news 1.5, all other components at the top of their stored scale). Sectors PropTech, SaaS.
- Flag: entity gate is review, so do not treat GOD 98 as a cleared ranking. Copy and signal otherwise agree.

### 19. Hookdeck — boilerplate and wrong sector

- ID `e523d29b-b4eb-4f62-9c4d-3385c18eb423`. Source `url`. Created 2025-12-20.
- Tagline: A company focused on AI and infrastructure. Description repeats that sentence.
- Sector stored as **Fintech**. Website `hookdeck.com` (no scheme). Stage Seed.
- Components 69 / **100** / 50 / 94 / 62. Signal 6.9 with news 1.1.
- Flag: generic identity, sector does not match the tagline, bare website, traction 100.

### 20. Mews — large installed base, stage Series B

- ID `ecdf92ec-a1a3-4268-81a3-ea8384698c3a`. Source `url`. Created 2026-01-22.
- Tagline: The Hospitality Management Software of the Future.
- Description: cloud property-management system, “trusted by over 12,500 properties.”
- Components 42 / **100** / 54 / **100** / 93. Signal 5.5. Stage **Series B** (the only Series B in this 25).
- Flag: team 42 against traction and product at 100. The 12,500-property line is a scaled-company description. Copy and hospitality sector agree.

### 21. Verkada — enterprise platform at Pre-Seed

- ID `3807434b-cf02-4234-a6b3-588d5efa9e8e`. Source **manual**. Created 2025-12-14.
- Tagline: Cloud-managed enterprise physical security.
- Description lists cameras, access control, sensors, alarms, intercoms, visitor management.
- Components 87 / **100** / **30** / 82 / 89. Signal 4.0 (receptivity 0, capital 0, execution 2). Sector Cybersecurity. Stage Pre-Seed.
- Flag: market 30 and a flat signal under a GOD of 98. Description is an enterprise platform, stage is Pre-Seed.

### 22. Writer — boilerplate description

- ID `a920d147-5b78-44ae-85aa-bc43ba97b259`. Source **manual**. Created 2025-12-16.
- Tagline: Enterprise generative AI platform.
- Description: “Writer is a Enterprise generative AI platform. The company is focused on delivering innovative solutions in this space…”
- Website `writer.com` (no scheme). Sectors AI/ML, Media, Enterprise, SaaS.
- Components 64 / **100** / 50 / **100** / 81. Signal 4.0 (receptivity 0, capital 0). Stage Pre-Seed.
- Flag: template description, bare host, and Pre-Seed on an enterprise-platform tagline.

### 23. Catalio — fund announcement, not a startup profile

- ID `8ab3a7ec-6f59-42cf-a067-9c699c9ce3d6`. Source `url`. Created 2026-01-09.
- Tagline and description: Catalio Capital Management closed Structured Opportunities Fund II with more than $325 million. Description ends “appeared first on Pulse 2.0.”
- Sectors: Fintech, HealthTech, Developer Tools. Website https://catalio.ai. Stage Pre-Seed.
- Components 69 / **100** / 56 / 66 / 56. Signal 4.0 (receptivity 0, capital 0, execution 2).
- Flag: this row is a credit-fund close. It should not sit on a startup leaderboard until the profile is a company, not the article.

### 24. Adaptive Security — thin copy, high signal

- ID `98de0ffa-717d-48cc-bf31-6ae8053a4ac0`. Source `url`. Created 2025-12-20.
- Tagline and description: “Security solutions provider”.
- Sector stored as **Fintech**. Website `adaptivesecurity.com` (no scheme). Stage Seed.
- Components 69 / **100** / 49 / **100** / 42. Signal **7.7** (news 1.2, receptivity 2.5, capital 2, execution 2).
- Flag: one-line identity and a Fintech sector on a security name. Signal is the third highest in this set, so the company may be real and the profile is what is broken.

### 25. Agentic — article, not a company description

- ID `22e53e7f-69b9-4fa2-8d27-39b473cca1c7`. Source `url`. Created 2026-01-08.
- Tagline and description are an essay on agent memory. Description ends “The post Agentic AI scaling requires new memory architecture appeared first on AI News.”
- Sectors: AI/ML, SaaS, **Climate**. Website `agentic.ai` (no scheme). Stage Pre-Seed.
- Components 42 / **100** / 49 / 86 / 73. Signal 5.5.
- Flag: publisher essay stored as the startup. Same class of problem as Catalio.

## Suggested review order

1. Drop or rewrite the non-company rows before any public “top startups” use: **Catalio**, **Agentic**, **Pomelo Care** (until the article is replaced), **Spangle** (until the Pulse headline is replaced), **Cast** (tagline only; product line can stay).
2. Fix identity collisions: **Alt-qq** tagline, **Hookdeck** sector and boilerplate, **Carbon Health** empty line and Climate sector, **Adaptive Security** one-line profile and Fintech sector, **Writer** template sentence.
3. Decide whether scaled or late descriptions belong on this leaderboard at all: **Odoo**, **Customer.io**, **Mews**, **Verkada**, **Addi**, **Crusoe Energy**.
4. Rows with consistent copy and no gate hold: **Powerapply**, **Shipshared**, **Jump**, **Nango**, **LatticeFlow**, **AheadComputing**, **Mendra**, **Inferact**. **PermitFlow** belongs with that set only after the `review` gate is cleared.
