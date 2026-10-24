# Shinrai 信頼: Research and Compliance Notes (Japan ← India B2B procurement)

Desk research for the trust-backed procurement upgrade. **All sources accessed 2026-10-25.** This is not legal, tax or customs advice. Every item marked for review must be confirmed by qualified professionals before a production launch.

**Confidence tags**
- **[OFF]**: read on, or quoted from, an official or primary source (government, regulator, treaty text, ISO maintenance agency, WTO).
- **[SEC]**: reputable secondary source, a vendor's own documentation, or an official document seen only through a search summary.
- **[UNV]**: not confirmed. Each one says how to validate it.

**Access limits.** rbi.org.in returned HTTP 418 and mofa.go.jp returned HTTP 403 to automated fetches. Some RBI and MOFA facts therefore come through RBI search snippets, Japan Customs links, or law-firm summaries, and are tagged accordingly. The pitch deck's market figures (1,434 Japanese companies in India, etc.) were cross-checked against the Embassy of India Tokyo page below.

---

## 1. What this research changes in the plan

| Finding | Effect on the plan |
|---|---|
| Japan's MFN tariff on non-electrical machinery and transport equipment averages **0.0%**, with **100% of lines duty-free**. Electrical machinery is 0.2%. Non-agricultural goods average 2.4% [OFF, WTO] | For likely demo categories (machined parts, fasteners, auto components), **CEPA duty savings are nil or negligible**. Pooling value must come from price tiers, MOQ access and freight, never from tax. |
| Import consumption tax (10%) is charged on CIF + duty [OFF]. It is normally creditable for taxable businesses (to be confirmed with a 税理士) | The landed-cost model shows it separately and never counts it as a saving. |
| A CEPA certificate of origin covers **one importation**, and direct consignment is required [OFF, treaty text] | Model A, where each buyer is its own importer with its own CoO, fits the rules. A central importer (Model C) or third-country repacking risks losing origin. |
| UPI has **no** Japan→India B2B product. The NIPL–NTT DATA MoU (Oct 2025) is for Indian tourists paying Japanese merchants [OFF/SEC] | Drop UPI from the payment design entirely. |
| Japan's amended Payment Services Act (in force **1 Jun 2026**) treats cross-border 収納代行 (collection agency) as funds-transfer business unless an exemption applies [OFF, FSA] | Shinrai must not collect buyer funds without a legal opinion. The MVP never holds funds. |
| India's FEMA (Export and Import of Goods and Services) Regulations, 2026 apply from **1 Oct 2026**. Realisation within **9 months**, or **12 months if INR-invoiced** [OFF, RBI] | The supplier-side payment checklist must use the 2026 regime. Pre-Oct-2026 guidance is out of date. |
| RBI PA-CB cap of **₹25 lakh per transaction** [OFF via snippet / SEC] | PA-CB providers suit small orders only. Larger POs go by bank transfer (SWIFT). |
| JFTC treats joint purchasing as lower antitrust risk than joint selling, and has cleared intermediary-led demand aggregation in consultation cases [OFF via summary] | Pooling is plausible, but pools must not restrict members' resale prices, quantities or customers. Needs counsel review. |
| CADDi ended its brokered parts-procurement service in July 2024. IndiaMART and Alibaba have no Japan-specific quality or document layer [SEC] | The opening is plausible but unproven. See the competitor matrix. |

---

## 2. Market context

### 2.1 Bilateral trade (India Ministry of Commerce data, via the Embassy of India Tokyo, page updated 2026-10-20) [OFF]
Source: https://www.indembassy-tokyo.gov.in/eoityo_pages/NjA,

| FY | India → Japan (US$ bn) | Japan → India (US$ bn) | Total |
|---|---|---|---|
| 2023-24 | 5.15 | 17.69 | 22.85 |
| 2024-25 | 6.25 | 18.90 | 25.15 |
| 2025-26 | 6.04 | 21.43 | 27.47 |

- Top Indian exports to Japan: organic chemicals, vehicles, HS 84 machinery, aluminium, fish. Top imports from Japan: HS 84, copper, electrical machinery, inorganic chemicals, iron and steel. [OFF, same source]
- About 1,434 Japanese companies (about 5,200 establishments) are in India. Japanese FDI was US$2.48 bn in FY2024-25, and about US$44.97 bn cumulative from 2000 to Jun 2025. [OFF, same source]
- Gap: calendar-year Japanese MOF trade statistics were not retrieved [UNV; validate at https://www.customs.go.jp/toukei/]. A secondary site's figure of US$4.72 bn for FY2024-25 conflicts with the Embassy figure; use the Embassy figure.

### 2.2 JETRO FY2025 Survey on Business Conditions of Japanese-Affiliated Companies Overseas (Asia & Oceania) [OFF]
Source: https://www.jetro.go.jp/ext_images/en/reports/survey/pdf/2025/EN_Asia_and_Oceania_2025_r.pdf (published Nov 2025, English Jan 2026)
- 81.5% of Japanese affiliates in India plan to expand, the highest in the region.
- Manufacturers in India source 48.5% locally and 29.4% from Japan. India is mainly a **destination** for Japanese inputs. Values were read from chart data; confirm visually.
- **No JETRO dataset was found on Japan-based SMEs buying goods from India.** The core demand hypothesis for this upgrade is **not** supported by an official survey, and interviews must establish it.

### 2.3 Sourcing barriers: evidence quality
| Claim | Source | Tag |
|---|---|---|
| Some Indian component suppliers show "low precision, variation in delivered product levels, sometimes leading to recalls" (one Japanese electronics firm in India) | JETRO area report, 25 Mar 2025, https://www.jetro.go.jp/biz/areareports/special/2025/0302/2ea26158222b5cc3.html | [OFF], but a single-firm anecdote |
| Tier-2-and-below quality control is immature in Indian auto supply chains; OEMs select on quality, stability, cost and localisation | LOGISTICS TODAY citing a JETRO survey, 9 Mar 2026, https://www.logi-today.com/920135 | [SEC] (original not located) |
| Japanese buyers need Japanese-language documents, JIS conformity, and reliable delivery | none found | [UNV]. Interview topic. |
| The pitch's "trust is the blocker" framing | Pitch p.2 cites Nikkei via Tuoi Tre (3 Aug 2026) and the Embassy/JETRO list | The pitch itself marks the "today" journey as "to be validated in SME interviews" |

### 2.4 Trade-support infrastructure
| Item | Status | Source | Tag |
|---|---|---|---|
| JETRO TTPP | **Closed**. Replaced on 14 Jan 2022 by **JETRO e-Venue** (free matching, 160+ countries) | https://www.jetro.go.jp/indonesia/_439068/e-Venue.html | [OFF] |
| J-Bridge | JETRO's start-up open-innovation platform; India is a focus. Not goods sourcing | https://www.jetro.go.jp/en/j-bridge | [OFF] |
| Japan Street | JETRO catalogue for overseas buyers of **Japanese** products (reverse direction) | https://www.jetro.go.jp/philippines/_472766.html | [OFF] |
| EEPC India | Buyer-seller meets, free overseas buyer services, IESS show | https://www.eepcindia.org/backend/brief-profile | [OFF] |
| JETRO India offices (Delhi, Mumbai, Chennai, Bengaluru, Ahmedabad) | Listed in `backend/app/advisor/kb/support_network.yaml` with `verified_by_team: false` | https://www.jetro.go.jp/india/ | [UNV] in repo; confirm |
| Invest India Japan Plus, FIEO, India Trade Portal | Not researched | — | [UNV] |

Official JETRO root URL: https://www.jetro.go.jp/ (the prompt's "jet ro" URL contained a stray space).

---

## 3. Competitor matrix

"—" means not found in public material [UNV]. Every row is based on the company's own pages or reputable press; nothing was confirmed with the vendor.

| Player | Target / geography | Discovery | Verification / trust | Pooling | MOQ / pricing | Payments / escrow | Shipping / customs | Japanese | Strength | Gap vs Shinrai |
|---|---|---|---|---|---|---|---|---|---|---|
| **IndiaMART export** (https://export.indiamart.com) | Global buyers; India→190+ countries (self-reported) | Directory, RFQ | TrustSEAL, Verified Exporter, GST and IEC checks [SEC] | — | RFQ | — on export page; "buyer protection" claim [UNV] | Links to logistics service providers | English only | Largest Indian supply base | No Japan focus, no quality or document layer |
| **TradeIndia** | Global | Directory | — | — | — | — | — | — | Breadth | Little trust layer confirmed |
| **Alibaba.com** | Global SMB | Search, RFQ | Verified Supplier (audit); **Trade Assurance for Indian suppliers since Jun 2025** [SEC, The Week 2025-06-30] | — | Listed MOQs | Escrow-style Trade Assurance | Add-ons [UNV for India→JP] | JP partner (Winner Soft, Jul 2026) [SEC]; UI [UNV] | Escrow, scale | Generic; Indian supply thin; no JP quality or document workflow |
| **Global Sources** | Importers; Asia→global | Online plus shows | Verified Supplier | — | — | — | — | — | Vetting, shows | Consumer and electronics focus |
| **CADDi** | JP manufacturers; JP/VN/TH/US | Drawing-data AI | — | Former parts service **ended Jul 2024** [SEC, MONOist] | — | — | — | Yes | Buyer drawing data | No India; exited brokering. Possible partner |
| **Mitsuri** | JP machining buyers | Coordinators, factory map | Coordinator screening | — | Quotes | — | — | Yes | JP machining network | Domestic only |
| **NC Network / EMIDAS** | JP plus ASEAN manufacturers | Factory search, fairs | Membership | — | — | — | — | Yes | About 22k members | No Indian supply side |
| **MonotaRO** | JP MRO buyers | Catalogue | Retailer-curated | Implicit (own volume) | Fixed | Standard | Domestic | Yes | 28m SKUs | Catalogue goods only |
| **Leaner** | JP procurement teams | Search, RFQ SaaS | — | **No** 共同購買 feature found [SEC] | Quote comparison | — | — | Yes | Workflow | No supply, no cross-border |
| **Sogo shosha** | Large corporates | Relationships | In-house QA | De facto (own volume) | Yes | Trade finance | Full | Yes | Credit, QA, logistics | SME service [UNV, hypothesis] |
| **Nippon Express** | Shippers | — | — | LCL consolidation | — | — | Forwarding, customs | Yes | India entity | Logistics only; India→JP LCL product [UNV] |
| **Flexport / Freightos** | SME shippers | Rate search | — | LCL | Instant quotes | [UNV] | Forwarding / marketplace | [UNV] | Price transparency | No supplier side |
| **Shippio** | JP importers | — | — | — | Quotes | — | Forwarding, in-house broker, NACCS, AI customs docs [SEC] | Yes | JP customs digitisation | No discovery. **Likely partner** |
| **JETRO e-Venue** | Any | Proposals, chat | Government-hosted | — | — | — | — | Yes | Free, trusted | Passive matching |
| **EEPC India** | Buyers of Indian engineering goods | BSMs | EPC membership | — | — | — | — | — | Free buyer services | Events, no transactions |

**Differentiation hypothesis [UNV]:** no player found combines evidence-backed verification of Indian manufacturers, Japanese-language quality and document handling, and demand pooling across Japanese SMEs. Shinrai already has the first. The second and third are unbuilt and unvalidated. "Nobody does X" is an absence finding from public material only.

**No B2B cross-company group-buying platform for industrial goods was found in Japan.** Pooling there appears to run through 協同組合 (business cooperatives), associations and JV purchasing companies [UNV absence; validate via 全国中小企業団体中央会 directories]. Cooperatives are a possible **channel** for pools.

---

## 4. Payments, FX and settlement

### 4.1 Indian export-side rules
| # | Claim | Source | Tag |
|---|---|---|---|
| P1 | FEMA (Export and Import of Goods and Services) Regulations, 2026, Notification FEMA 23(R)/2026-RB, 13 Jan 2026, in force **1 Oct 2026**, supersede the 2015 regulations | https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13277&Mode=0 | [OFF] |
| P2 | Amendment FEMA 23(R)/(1)/2026-RB (22 Sep 2026): realisation period **9 months** from shipment (goods). The INR-invoicing proviso is **12 months**. The AD bank can extend | https://m.rbi.org.in/scripts/BS_FemaNotifications.aspx?Id=13714 | [OFF] |
| P3 | A.P. (DIR Series) Circular No. 20 (16 Jan 2026), effective 1 Oct 2026, supersedes the Export and Import Master Directions and many circulars | https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13278&Mode=0 | [OFF] |
| P4 | Reg. 3 export declaration (EDF / shipping bill). Reg. 4(2): EDPMS entries ≤ ₹10 lakh can be closed on exporter declaration. Reg. 7: set-off. Reg. 8: third-party receipts if the AD bank is satisfied. Reg. 10: advance and realisation go through the same AD bank | RBI Id=13277 | [OFF] |
| P5 | Interim 15-month relief (Nov 2025) and a reported June 2026 reversal | taxmann / taxguru | [SEC] / reversal [UNV]. Matters for legacy shipments only |
| P6 | eBRC 2.0: banks send IRMs to DGFT and exporters self-certify | https://www.dgft.gov.in/CP/?opt=ebrc | [OFF] |
| P7 | Inward remittances need an RBI purpose code (goods exports are the P01xx series) | Stripe and Wise docs | [SEC]. Check the exact list in the RBI FETERS purpose-code annex |
| P8 | INR invoicing via Special Rupee Vostro Accounts (RBI/2022-23/90, 11 Jul 2022) | https://rbi.org.in/Scripts/NotificationUser.aspx?Id=12358 | [OFF]. No SRVA route for Japan found [UNV]. Post-Oct-2026 status [UNV] |
| P9 | RBI local-currency settlement MoUs exist with the UAE, Indonesia and Maldives; **none with Japan found** | secondary press | [SEC] / absence [UNV] |
| P10 | India–Japan Bilateral Swap Arrangement renewed 28 Feb 2026, up to USD 75 bn. A central-bank safety net, **not a trade-settlement rail** | https://www.mof.go.jp/english/policy/international_policy/financial_cooperation_in_asia/bsa/20260226181859.html | [OFF] |

### 4.2 UPI
| # | Claim | Source | Tag |
|---|---|---|---|
| U1 | `npci.org.in/product/upi-global-acceptance` now redirects to `/product/upi` | fetch, 2026-10-25 | [OFF] |
| U2 | UPI One World: a prepaid instrument for foreign visitors spending **inside India** | https://www.npci.org.in/blog/upi-one-world-your-digital-passport-to-seamless-payments-in-india | [OFF] |
| U3 | UPI–PayNow (Singapore): **personal** P2P remittances | https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=55260 | [OFF] |
| U4 | NIPL–NTT DATA MoU (7 Oct 2025): UPI acceptance for **Indian tourists at Japanese merchants**. Not confirmed live | https://www.nttdata.com/global/en/news/press-release/2025/october/100700 | [OFF]; live status [UNV] |
| U5 | **No product supports a Japanese company paying an Indian exporter via UPI** | Synthesis | Absence finding. Do not design for it |

### 4.3 Payment Aggregator – Cross Border (PA-CB)
- RBI (Regulation of Payment Aggregators) Directions, 2025 (RBI/DPSS/2025-26/141, 15 Sep 2025) repealed the Oct 2023 PA-CB circular [OFF via snippet / SEC: https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896].
- PA-CB limit: **₹25 lakh per transaction** [OFF via snippet]. Separate inward and outward collection accounts, no netting. Non-INR settlement only for directly onboarded Indian exporters. **PAs may not run marketplaces** [SEC, DRN Legal / indiacorplaw].
- Reported authorised entities include Cashfree, Razorpay, PayU, Skydo and others [SEC]. **Check against RBI's official authorised-PSO list before naming any as a partner.**

### 4.4 Japan side
| # | Claim | Source | Tag |
|---|---|---|---|
| J1 | FEFTA: payments over ¥30m need an after-the-fact report to MOF via the Bank of Japan | https://www.mof.go.jp/faq/international_policy/10ca.htm ; BOJ FAQ | [OFF] |
| J2 | Payments directly tied to goods imports or exports are excluded from that report | BOJ FAQ (summary) | [SEC]. Confirm the FAQ text |
| J3 | Banks file 国外送金等調書 to the tax office for overseas remittances over ¥1m | https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/hotei/23100064.htm | [OFF] |
| J4 | Funds-transfer business: Type I (authorisation, no cap), Type II (registration, ¥1m per remittance), Type III (¥50,000) | https://www.fsa.go.jp/common/law/guide/kaisya/e014.pdf | [OFF] |
| J5 | **PSA amendment (Act No. 66 of 2025), in force 1 Jun 2026**: cross-border 収納代行 is funds-transfer business unless exempt. Exemptions include escrow and platform structures, with carve-backs (e.g. debt not discharged on payment; provider not responsible to the payee) | https://www.fsa.go.jp/news/r7/sonota/20260522-3/20260522-3.html ; AMT bulletin https://www.amt-law.com/asset/pdf/bulletins2_pdf/260316.pdf | [OFF] / exemption detail [SEC] |
| J6 | 犯収法 (Act on Prevention of Transfer of Criminal Proceeds): banks and funds-transfer operators verify customers. A 2026 amendment exists (JAFIC summary, 7 Aug 2026) | https://www.npa.go.jp/sosikihanzai/jafic/hourei/data/hougaiyou20260807.pdf | [OFF] existence / content [UNV] |

### 4.5 Currency minor units [OFF]
ISO 4217 List One (SIX, published 2026-09-17): **JPY 0 decimals, INR 2 decimals**. https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml

### 4.6 Payment channels for a Japanese SME paying an Indian supplier

| Method | Status for JP→IN B2B | Who converts FX | Fee transparency | Refund / dispute | Docs | Shinrai builds vs partner |
|---|---|---|---|---|---|---|
| **SWIFT wire, JP bank → IN AD bank** | Standard route [SEC] | Payer, intermediary or payee bank, depending on currency [UNV per bank] | Low; intermediary fees often opaque [UNV] | Recall not guaranteed; contractual | Invoice, purpose code, shipping bill/EDF, IRM/eBRC | **Build:** payment instructions, proof upload, reconciliation, eBRC tracking. No partner needed |
| **L/C, D/P, D/A** | Standard (UCP 600 / URC 522) | Banks | Bank tariffs [UNV] | Document-based | Invoice, B/L, PL, CoO, insurance | **Build:** document checklist. Banks execute |
| **Wise Business** | JPY→INR from Japan **"not quite there yet"** per Wise's India page; USD wire supported [SEC] | Wise | High | Support | Purpose code; IN B2B ₹1.5m per invoice per day | Partner. **Not viable for JPY→INR today** |
| **Payoneer** (IN seller holds JPY receiving details) | Supported per vendor [SEC]; limits [UNV] | Payoneer | Medium [UNV] | Support | Digital FIRC | Partner |
| **Airwallex** | INR payout listed; Japan-entity eligibility [UNV] | Airwallex | Medium [UNV] | Support | [UNV] | Partner |
| **PA-CB** (Razorpay, Cashfree, Skydo…) | Exporter-side collection; **₹25 lakh per transaction cap** | PA-CB via AD bank | Vendor pricing | Card chargeback if card | IEC, purpose code, e-FIRC | Partner (supplier onboards) |
| **Stripe India** | **Invite-only**; IEC needed; ₹25 lakh per export transaction [SEC] | Stripe | Published | Chargebacks | Purpose code | Partner, low availability |
| **PayPal** | Cross-border only since Apr 2021 [SEC]; current limits [UNV] | PayPal | Medium | PayPal disputes | [UNV] | Partner |
| **UPI** | **Not available** | — | — | — | — | Not a rail |
| **Shinrai escrow** | Needs a licence or exemption analysis in both countries | — | — | — | — | **Do not build** without legal opinions |

Trade-credit protection: ECGC Shipments (Comprehensive Risks) policy for Indian exporters [OFF, ECGC]. NEXI prepayment import insurance for Japanese importers [SEC; SME terms UNV]. JETRO recommends refundment bonds for prepayments [SEC].

---

## 5. Customs, origin and landed cost (Japan import)

| # | Claim | Source | Tag |
|---|---|---|---|
| C1 | The importer, or a broker as proxy, files the import declaration. Permit after examination and payment. Docs: invoice, B/L/AWB, origin documents for preferential rates; others "when deemed necessary" | https://www.customs.go.jp/english/summary/import.htm | [OFF] |
| C2 | About 99% of declarations go through NACCS | Customs pamphlet (summary) | [SEC] |
| C3 | A non-resident importer needs a Japan-resident Customs Affairs Administrator (税関事務管理人). Brokerage as a business needs a licence | https://www.customs.go.jp/tetsuzuki/c-answer/sonota/9601_jr.htm | [OFF via summary] |
| C4 | Customs value = transaction price + freight + insurance to the Japanese port (effectively CIF) | https://www.customs.go.jp/english/summary/value.htm | [OFF] |
| C5 | Applied rate = lowest of general/temporary, WTO, EPA and GSP. Simplified tariff for commercial imports ≤ ¥200,000 | https://www.customs.go.jp/english/summary/tariff.htm | [OFF] |
| C6 | Written advance classification rulings (事前教示) are respected at examination and valid 3 years. Oral or email answers are not binding | same | [OFF] |
| C7 | Import consumption tax is 10% (7.8% + 2.2%), reduced 8% (food). Base = customs value + duty (+ certain excise) | https://www.customs.go.jp/english/c-answer_e/imtsukan/1111_e.htm | [OFF] |
| C8 | Goods ≤ ¥10,000 are exempt from duty and consumption tax, with exclusions. **Split declarations from one invoice are aggregated** | https://www.customs.go.jp/tetsuzuki/c-answer/imtsukan/1006_jr.htm | [OFF via summary] |
| C9 | FY2026 reform: low-value imports taxed via seller and platform liability from 1 Apr 2028 | https://www.mof.go.jp/tax_policy/tax_reform/outline/fy2026/explanation/PDF/p0823-0860.pdf | [OFF via summary]. Not material to B2B consignments |
| C10 | Japan non-ag MFN simple average 2.4% (2025). Non-electrical machinery 0.0% (100% duty-free lines); transport equipment 0.0% (100%); electrical machinery 0.2% (96.4%); metals 1.0% (69.6%); chemicals 2.2%; textiles 5.5%; clothing 9.2% | https://www.wto.org/english/res_e/statis_e/daily_update_e/tariff_profiles/jp_e.pdf | [OFF]. Product-group labels mapped from WTO order; confirm visually |
| C11 | Japan–India CEPA in force 1 Aug 2011 | https://www.customs.go.jp/english/epa/index.htm | [SEC] (MOFA page blocked) |
| C12 | CEPA general origin rule (Art. 29): **QVC ≥ 35% AND change in tariff subheading** for non-originating materials. Product-specific rules prevail | https://www.customs.go.jp/roo/english/text/india1.pdf | [OFF] |
| C13 | De minimis (Art. 32): 10% of value for HS Ch. 28–49 and 64–97 | same | [OFF] |
| C14 | Direct consignment (Art. 34): third-country handling is limited to transit, unloading, reloading or preservation | same; https://www.customs.go.jp/roo/english/text/india3.pdf | [OFF] |
| C15 | CoO issued by the exporting Party's authority or its designees (India: Department of Commerce; designee **EIC**; Textiles Committee for textiles). **One importation, valid 12 months** | india3.pdf; DGFT P.N. 2014 | [OFF] / designee [SEC]. Check the current eCoO portal coo.dgft.gov.in |
| C16 | Japan waives the EPA CoO for consignments ≤ ¥200,000 | https://www.customs.go.jp/english/c-answer_e/imtsukan/1524_e.htm | [OFF] |
| C17 | CEPA Joint Committee met 2 Mar 2026 and a review is under discussion | secondary press | [SEC]. Check PIB/MOFA |
| C18 | Indian exporter prerequisites: IEC (DGFT); GST LUT (RFD-11, Rule 96A) for zero-rated export; shipping bill via ICEGATE; RoDTEP extended to 31 Dec 2026 | DGFT; CBIC rule text; secondary | [OFF via summary] / RoDTEP [SEC] |

### 5.1 Does pooling change duty or tax? No.
- The tax base is per declaration (CIF + duty). Invoice-splitting is aggregated (C8). Pooling cannot lawfully lower the duty rate or the consumption-tax base. The only legitimate duty reductions are a correct classification (confirmed by a broker or an advance ruling) and a valid CEPA preference with a CoO per importation.
- **Lawful structures for shared logistics:**
  - (a) LCL consolidation where **each buyer is the importer of record** on its own house B/L, with its own declaration and CoO. This is compatible with Model A.
  - (b) A single importer (Shinrai or a partner) imports and resells domestically. That is Model C: domestic consumption tax on resale, input-tax recovery, product liability, working capital.
  - Both need confirmation by a 通関業者 and a 税理士.
- Shinrai will not build any workflow that splits consignments to stay under thresholds, misstates value or origin, or repacks in a third country to obscure origin.

### 5.2 India-side supplier readiness checklist (for the badge and onboarding)
IEC issued · GSTIN active · GST LUT filed for the current FY · AD bank designated · ICEGATE registration · CoO issuance capability (EIC) if a CEPA preference is claimed. Each item has status `verified` / `self-declared` / `unknown`.

---

## 6. Customer-discovery plan (10 interviews)

No interview has been conducted. Nothing below is a result.

| # | Who | Hypothesis | Key questions | Evidence sought | Decision it changes |
|---|---|---|---|---|---|
| 1 | Purchasing manager, Japanese SME machining or auto-parts maker (Aichi/Shizuoka), already imports from Asia | SMEs would source standardised parts from India if trust and documents were handled | What do you import, from where, at what annual volume per SKU? Have you considered India? What stopped you? | Volumes, current suppliers, stated blockers ranked | Go/no-go on India sourcing for this segment, and which category to demo |
| 2 | Purchasing manager, Japanese SME that **has** tried an Indian supplier | Quality and delivery variance, not price, is the main pain | What went wrong or right? How did you verify the supplier? What documents did you need in Japanese? | Incident stories, costs of failure, documents required | Priority of verification and inspection features vs pooling |
| 3 | Japanese SME owner in an industry 協同組合 (business cooperative) | Pools are easier to form inside existing associations | Does the cooperative already buy jointly? How are quantities, risk and payment split? | Existing pooling mechanics, governance, failure modes | Channel strategy: cooperatives as pool organisers |
| 4 | Japanese SME that needs small quantities below MOQ | MOQ is a binding constraint for SMEs | How often do MOQs block you? What do you do instead (trading company, domestic stock)? What premium do you pay? | MOQ gap sizes, premium paid to intermediaries | Whether MOQ-matching is valuable enough to build pooling |
| 5 | Indian manufacturer (MSME, engineering exports, EEPC member) | Indian suppliers will quote tiered prices to pooled demand from verified Japanese buyers | Would you price against aggregated demand with individual POs? Your MOQ and tier logic? Export docs readiness (IEC, LUT, CoO)? | Willingness, tier structure, document readiness | Whether supplier-side pooling works, and supplier onboarding requirements |
| 6 | Indian supplier already exporting to Japan | Japanese buyers impose specific QA and documentation | What did Japanese buyers require (PPAP-like, JIS, inspection)? Payment terms received? | Requirements list, payment terms (advance/LC/TT) | Document checklist, payment-term defaults |
| 7 | Japanese trading company (専門商社) handling India imports | Trading companies serve SMEs today and could partner or compete | What margin and services do you provide? Would verified pooled demand help you? | Margin ranges, service scope | Partner vs compete; Model C via a partner IOR |
| 8 | Licensed customs broker (通関業者) in Yokohama or Kobe | Each buyer as importer of record with a shared LCL is feasible and cost-effective | Cost per declaration? Can multiple house B/Ls in one container clear separately? CoO handling per importation? | Fee ranges, feasibility, pitfalls | Model B feasibility; landed-cost inputs |
| 9 | Freight forwarder on the India→Japan lane (e.g. Nhava Sheva/Chennai → Yokohama) | LCL consolidation lowers per-buyer freight enough to matter | LCL rate structure, minimums, transit time, consolidation constraints | Rate ranges by CBM, minimum charges | Whether shared logistics belongs in the MVP pitch |
| 10 | JETRO business-matching advisor (or Japan-India Economic Affairs Division contact) | Trade-support organisations would refer SMEs to pre-verified pools | How do you match SMEs today? Would pre-verified suppliers and pooled RFQs help? Data-sharing constraints? | Referral willingness, pilot appetite | Pilot partner and go-to-market |
| (11) | Japanese bank trade-finance desk (optional) | SMEs pay Indian suppliers by T/T with advance; L/C use is low for SMEs | Typical SME payment method to India, fees, lead time, KYC | Practical payment path | Default payment path in the pilot |
| (12) | Japanese tax accountant (税理士) (optional) | Import consumption tax is fully creditable for typical SME buyers | Treatment of import consumption tax, Model C implications | Confirmation | Landed-cost presentation, Model C viability |

**Interview hygiene:** ask about past behaviour, not hypotheticals. Record verbatim. Never cite a quote publicly without consent. Store notes outside the repo.

---

## 7. Hypotheses register

**A. Verified facts.** Items tagged [OFF] in §2, §4 and §5.

**B. Market hypotheses (test before building beyond the prototype)**
1. Japanese SMEs have unmet demand to source standardised industrial goods from India. *No official survey found.*
2. MOQs and the lack of volume pricing block SMEs often enough to justify pooling.
3. Pools can form on **standardised** specifications (grade, standard part numbers). Custom-drawing parts pool poorly.
4. Quality variance is a bigger barrier than price. Verification plus inspection may beat pooling as the first value.
5. Indian suppliers will quote tiered prices against aggregated, individually ordered demand.
6. Shared LCL freight saves materially per buyer only when buyers share origin port, destination port and timing.
7. Forwarders and digital brokers (Shippio), and trading companies, are more likely partners than competitors.

**C. Assumptions requiring interviews or professional confirmation.** Every line in §6, plus the open legal questions in §8.

**D. Attractive but unvalidated.** A global commercial relationship graph across Asia; Shinrai-held escrow; Shinrai as importer of record; automated HS classification; platform-negotiated FX; supplier financing.

---

## 8. Questions requiring qualified review before launch

**Payments and financial regulation**
1. Japan PSA (Act No. 66 of 2025, in force 1 Jun 2026): if Shinrai ever collects buyer funds, does an escrow or platform exemption apply and avoid the carve-backs, or is 資金移動業 registration (Type I/II) required?
2. 犯収法: in any design, is Shinrai a specified business operator? What changes with the 2026 amendment?
3. FEFTA: confirm the goods-trade exclusion from the over-¥30m report for Shinrai-facilitated orders. Does a cross-border Shinrai fee trigger any reporting?
4. India FEMA 2026: effect of Reg. 6 (reduction in value), Reg. 7 (set-off) and Reg. 8 (third-party receipts) on platform-facilitated orders. Can platform fees be netted from export proceeds, or must they be invoiced separately?
5. India PA Directions 2025: does any Shinrai entity that instructs or routes settlement need PA or PA-CB authorisation? Effect of the rule that PAs may not run marketplaces on partner choice.
6. Splitting orders to fit the ₹25 lakh PA-CB cap: assume impermissible until counsel says otherwise.
7. SRVA/INR invoicing status after 1 Oct 2026, and practicality for Japanese buyers.

**Customs and tax**

8. A multiple-importer LCL consolidation in Japan: procedure, cost and CoO handling (通関業者).
9. Import consumption-tax recovery for typical SME buyers, and Model C implications (税理士).
10. Use of advance rulings for classification and origin in the pilot categories.
11. Tax on Shinrai's own fees (Japanese consumption tax on platform fees; Indian GST and equalisation levy on fees from Indian suppliers).

**Commercial and competition**

12. Antimonopoly: pool rules must not restrict members' prices, output or customers (JFTC guidance and consultation cases). Information barriers between competing buyers.
13. Contract structure: Shinrai as facilitator only. Terms of use; limits of liability for supplier non-performance; dispute forum (arbitration seat) for buyer–supplier POs.
14. Marketplace obligations in Japan for B2B platforms (not researched).

**Data protection**

15. Cross-border transfer of supplier and buyer data under Japan's APPI and India's DPDP Act 2023. Director names and PAN handling. Retention and deletion periods for KYC and trade documents.

**Sanctions and AML**

16. Screening of suppliers and buyers against UN, Japanese and OFAC lists. Who performs it, and is Shinrai's onboarding check adequate without being a regulated entity?

---

## 9. What could not be verified

- Japanese SME demand for Indian-sourced goods (no official dataset found).
- Actual price-tier structures, MOQs and freight rates on the India→Japan lane (needs supplier and forwarder quotes).
- Bank fees, cut-offs and JPY/INR conversion practice at Japanese banks.
- Whether any Japanese correspondent bank operates an SRVA.
- Live status of UPI acceptance in Japan (MoU only).
- Alibaba.com Japanese buyer UI, IndiaMART buyer-protection terms, sogo shosha SME programmes.
- The exact content of the 2026 犯収法 amendment and the final text of the PSA ordinance exemptions.
- Whether individual repository KB entries are accurate: about 91 entries in `backend/app/advisor/kb/*.yaml` carry `verified_by_team: false` versus 9 marked true. They were not re-verified in this pass.
