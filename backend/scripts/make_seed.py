"""Generate the curated seed files in data/seed (TRD §9). Run: python -m scripts.make_seed"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.adapters.gstin import make_gstin  # noqa: E402
from app.config import SEED_DIR  # noqa: E402

DEMO_NEWS = "https://demo.shinrai.local/news"
MCA = "https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html"
GST = "https://services.gst.gov.in/services/searchtp"
ECOURTS = "https://services.ecourts.gov.in/ecourtindia_v6/"
IBBI = "https://ibbi.gov.in/en/public-announcement"


def co(cin, name, status, inc, state, address, paid_up, authorised=None, last_agm=None, last_bs=None,
       klass="Private", listed=False, activity="Manufacture of parts and accessories for motor vehicles",
       pan=None, email=None, roc=None, nic="29304"):
    return {
        "cin": cin, "name": name, "status": status, "date_of_incorporation": inc, "state": state,
        "roc": roc or {"Haryana": "RoC-Delhi", "Delhi": "RoC-Delhi", "Maharashtra": "RoC-Pune",
                       "Karnataka": "RoC-Bangalore", "Rajasthan": "RoC-Jaipur",
                       "Tamil Nadu": "RoC-Chennai"}.get(state, "RoC"),
        "company_class": klass, "category": "Company limited by Shares",
        "sub_category": "Non-govt company", "listed": listed,
        "authorized_capital": authorised or max(paid_up, 100000), "paid_up_capital": paid_up,
        "last_agm_date": last_agm, "last_bs_date": last_bs, "registered_address": address,
        "email": email, "pan": pan, "nic_code": nic, "activity": activity,
    }


def gst(gstin, legal_name, status, reg, state, cancelled=None, last_return=None, ttype="Regular"):
    return {"gstin": gstin, "legal_name": legal_name, "trade_name": legal_name.replace(" Private Limited", ""),
            "status": status, "registration_date": reg, "cancellation_date": cancelled, "state": state,
            "taxpayer_type": ttype, "filing_frequency": "Monthly", "last_return_filed": last_return}


SHARED = "Unit 4B, Khasra No. 112, Village Kherki Daula, Sector 76, Gurugram, Haryana 122004"
SUNRISE_GST_ADDR = "Shop 12, Naraina Industrial Area Phase I, New Delhi, Delhi 110028"
SUNRISE_SITE = "Plot G-14, Chakan Industrial Area Phase II, Pune, Maharashtra 410501"
MARUTI_PLANT = "Maruti Suzuki India Limited, Sector 3A, IMT Manesar, Gurugram, Haryana 122051"


def sunrise() -> dict:
    pan = "AAKCS4821M"
    cin = "U29304HR2023PTC110482"
    linked = {
        "U51909HR2021PTC097215": co("U51909HR2021PTC097215", "Sunrise Autotech Trading Private Limited",
                                    "Strike Off", "2021-02-18", "Haryana", SHARED, 100000, last_agm="2021-09-30",
                                    last_bs="2021-03-31", activity="Wholesale of motor vehicle parts", pan="AAKCS1093F", nic="45300"),
        "U63090HR2020PTC089904": co("U63090HR2020PTC089904", "Brightline Logistics Private Limited", "Strike Off",
                                    "2020-07-02", "Haryana", SHARED, 100000, last_agm="2020-12-31",
                                    last_bs="2020-03-31", activity="Freight forwarding and logistics", pan="AAKCB7720R", nic="52291"),
        "U27310HR2016PTC061177": co("U27310HR2016PTC061177", "Vardhan Castings Private Limited", "Under CIRP",
                                    "2016-05-23", "Haryana", "Plot 88, Sector 24, Faridabad, Haryana 121005", 2500000,
                                    last_agm="2022-09-29", last_bs="2022-03-31", activity="Casting of iron and steel", pan="AAKCV3318K", nic="24310"),
        "U29109HR2022PTC104662": co("U29109HR2022PTC104662", "Kestrel Engineering Private Limited", "Active",
                                    "2022-03-14", "Haryana", SHARED, 100000, last_agm="2023-09-30", last_bs="2023-03-31",
                                    activity="Manufacture of general purpose machinery", pan="AAKCK6650P", nic="28199"),
        "U25999HR2022PTC105871": co("U25999HR2022PTC105871", "Orbit Fasteners Private Limited", "Active",
                                    "2022-06-30", "Haryana", SHARED, 100000, last_agm="2024-09-30", last_bs="2024-03-31",
                                    activity="Manufacture of fasteners", pan="AAKCO2287L", nic="25940"),
        "U22209HR2023PTC109140": co("U22209HR2023PTC109140", "Nexa Polymers Private Limited", "Active",
                                    "2023-01-19", "Haryana", SHARED, 100000, activity="Manufacture of plastic products",
                                    pan="AAKCN5501A", nic="22209"),
        "U45201DL2019PTC351288": co("U45201DL2019PTC351288", "Saffron Infra Projects Private Limited", "Active",
                                    "2019-04-08", "Delhi", "B-212, Okhla Industrial Area Phase I, New Delhi 110020", 500000,
                                    last_agm="2025-09-29", last_bs="2025-03-31", activity="Construction of buildings",
                                    pan="AAKCS8834D", nic="41001"),
        "U01403RJ2018PTC060455": co("U01403RJ2018PTC060455", "Aravalli Agro Exports Private Limited", "Active",
                                    "2018-11-12", "Rajasthan", "E-41, RIICO Industrial Area, Sitapura, Jaipur, Rajasthan 302022",
                                    1000000, last_agm="2025-09-27", last_bs="2025-03-31",
                                    activity="Wholesale of agricultural raw materials", pan="AAKCA4410H", nic="46201"),
        "U28220MH2017PTC298813": co("U28220MH2017PTC298813", "Pinnacle Tooling Private Limited", "Active",
                                    "2017-08-21", "Maharashtra", "Gat No. 312, Chakan MIDC Phase II, Pune, Maharashtra 410501",
                                    1500000, last_agm="2025-09-30", last_bs="2025-03-31",
                                    activity="Manufacture of machine tools", pan="AAKCP9902B", nic="28220"),
    }
    gst_linked = {
        "U51909HR2021PTC097215": gst(make_gstin("06", "AAKCS1093F"), "Sunrise Autotech Trading Private Limited",
                                     "Cancelled", "2021-03-10", "Haryana", cancelled="2022-06-30"),
        "U29109HR2022PTC104662": gst(make_gstin("06", "AAKCK6650P"), "Kestrel Engineering Private Limited",
                                     "Active", "2022-04-02", "Haryana", last_return="2026-09"),
        "U25999HR2022PTC105871": gst(make_gstin("06", "AAKCO2287L"), "Orbit Fasteners Private Limited",
                                     "Suspended", "2022-08-11", "Haryana", last_return="2025-11"),
        "U27310HR2016PTC061177": gst(make_gstin("06", "AAKCV3318K"), "Vardhan Castings Private Limited",
                                     "Active", "2017-07-01", "Haryana", last_return="2026-08"),
        "U22209HR2023PTC109140": gst(make_gstin("06", "AAKCN5501A"), "Nexa Polymers Private Limited",
                                     "Active", "2023-03-02", "Haryana", last_return="2026-09"),
    }
    return {
        "id": "sunrise_auto", "demo": True, "mode": "seed",
        "aliases": ["Sunrise Auto Components", "Sunrise Auto", "Sunrise Auto Components Pvt Ltd"],
        "brochure": "sunrise_brochure.pdf",
        "company": co(cin, "Sunrise Auto Components Private Limited", "Active", "2023-04-11", "Haryana", SHARED,
                      100000, authorised=1000000, pan=pan, email="info@sunriseauto-demo.in"),
        "gst": [{**gst(make_gstin("07", pan), "Sunrise Auto Components Private Limited", "Cancelled", "2023-05-02",
                       "Delhi", cancelled="2024-08-19", last_return="2024-07"), "address": SUNRISE_GST_ADDR}],
        "directors": [
            {"din": "10234567", "name": "Director A", "designation": "Director", "appointed_on": "2023-04-11",
             "address": "Sector 57, Gurugram, Haryana", "companies": [cin, "U01403RJ2018PTC060455"]},
            {"din": "10345678", "name": "Director B", "designation": "Director", "appointed_on": "2023-04-11",
             "address": "DLF Phase IV, Gurugram, Haryana",
             "companies": [cin, "U51909HR2021PTC097215", "U63090HR2020PTC089904", "U27310HR2016PTC061177",
                           "U29109HR2022PTC104662", "U25999HR2022PTC105871", "U22209HR2023PTC109140",
                           "U45201DL2019PTC351288"]},
            {"din": "10456789", "name": "Director C", "designation": "Additional Director",
             "appointed_on": "2025-11-03", "address": "Kothrud, Pune, Maharashtra",
             "companies": [cin, "U28220MH2017PTC298813"]},
        ],
        "linked_companies": linked, "linked_gst": gst_linked,
        "cases": [
            {"case_no": "NACT/4412/2025", "court": "District Court, Gurugram", "nature": "Cheque dishonour (Sec 138 NI Act)",
             "party_key": "10345678", "party_role": "accused", "status": "Pending", "filed": "2025-03-17",
             "petitioner": "Supplier (name withheld)", "next_hearing": "2026-11-20"},
        ],
        "insolvency": [
            {"cin": "U27310HR2016PTC061177", "name": "Vardhan Castings Private Limited", "type": "CIRP",
             "announced": "2025-12-04", "authority": "NCLT Chandigarh Bench",
             "applicant": "Operational creditor (Sec 9 IBC)", "url": IBBI},
        ],
        "news": [
            {"title": "GST officers probe fake-invoice ring linked to Gurugram logistics firms",
             "source": "Demo Business Daily", "date": "2023-11-08", "about": "U63090HR2020PTC089904",
             "tone": "adverse", "snippet": "Brightline Logistics was among the entities named in a show-cause notice over input tax credit claims."},
            {"title": "IMT Manesar auto-component cluster sees order book recover",
             "source": "Demo Auto Wire", "date": "2026-07-02", "about": None, "tone": "neutral",
             "snippet": "Tier-2 suppliers in the cluster report improving demand from two-wheeler makers."},
            {"title": "Exhibitor list: Auto Components Expo North 2025", "source": "Demo Trade Fair Portal",
             "date": "2025-02-11", "about": cin, "tone": "neutral",
             "snippet": "Sunrise Auto Components listed among 412 exhibitors in Hall 3."},
            {"title": "Haryana unveils incentive scheme for MSME component makers", "source": "Demo State News",
             "date": "2026-03-19", "about": None, "tone": "neutral",
             "snippet": "The scheme covers capital subsidy for firms in Gurugram and Faridabad districts."},
            {"title": "Faridabad foundry admitted to insolvency over unpaid dues", "source": "Demo Legal Brief",
             "date": "2025-12-06", "about": "U27310HR2016PTC061177", "tone": "adverse",
             "snippet": "NCLT admitted an operational creditor's petition against Vardhan Castings."},
            {"title": "Sunrise Auto Components launches B2B parts catalogue", "source": "Demo PR Feed",
             "date": "2024-01-15", "about": cin, "tone": "neutral",
             "snippet": "The company says it serves OEM and aftermarket buyers across North India."},
        ],
        "sources": {"mca": MCA, "gst": GST, "courts": ECOURTS, "ibbi": IBBI, "news": DEMO_NEWS},
    }


def kaveri() -> dict:
    pan = "AAFCK7316E"
    cin = "U29253KA2014PTC074512"
    hub_companies = {}
    names = ["Kaveri Forgings", "Mysore Precision Castings", "Nandi Hydraulics", "Hosur Gear Works",
             "Tumkur Alloy Products", "Deccan Bearing Systems", "Malnad Machine Tools", "Coorg Agri Equipments",
             "Bidar Steel Fabricators", "Shimoga Pump Industries"]
    for i, n in enumerate(names):
        c = f"U29{120 + i:03d}KA{2008 + i % 9}PTC0{51000 + i * 731:05d}"
        hub_companies[c] = co(c, f"{n} Private Limited", "Active", f"{2008 + i % 9}-0{1 + i % 9}-15", "Karnataka",
                              f"{12 + i}, Peenya Industrial Area Phase {1 + i % 3}, Bengaluru, Karnataka 5600{58 + i % 3}",
                              500000 + i * 100000, last_agm="2025-09-28", last_bs="2025-03-31",
                              pan=f"AAFC{n[0]}{2100 + i}{'ABCDEFGHJK'[i]}")
    return {
        "id": "kaveri_precision", "demo": True, "mode": "seed",
        "aliases": ["Kaveri Precision", "Kaveri Precision Engineering"],
        "company": co(cin, "Kaveri Precision Engineering Private Limited", "Active", "2014-06-09", "Karnataka",
                      "No. 47, KIADB Industrial Area, Bommasandra, Bengaluru, Karnataka 560099", 5000000,
                      authorised=10000000, last_agm="2024-09-27", last_bs="2024-03-31", pan=pan,
                      email="contact@kaveriprecision-demo.in", nic="29301",
                      activity="Manufacture of engine parts for motor vehicles"),
        "gst": [gst(make_gstin("29", pan), "Kaveri Precision Engineering Private Limited", "Active", "2017-07-01",
                    "Karnataka", last_return="2026-09")],
        "directors": [
            {"din": "07112233", "name": "Director K1", "designation": "Managing Director", "appointed_on": "2014-06-09",
             "address": "Jayanagar, Bengaluru, Karnataka", "companies": [cin, *hub_companies.keys()]},
            {"din": "07223344", "name": "Director K2", "designation": "Director", "appointed_on": "2016-02-01",
             "address": "Whitefield, Bengaluru, Karnataka", "companies": [cin]},
        ],
        "linked_companies": hub_companies, "linked_gst": {},
        "cases": [
            {"case_no": "COM.OS/1187/2024", "court": "Commercial Court, Bengaluru", "nature": "Recovery suit (unpaid invoices)",
             "party_key": cin, "party_role": "respondent", "status": "Pending", "filed": "2024-08-22",
             "petitioner": "Steel supplier (name withheld)", "next_hearing": "2026-12-03"},
            {"case_no": "ID/226/2025", "court": "Industrial Tribunal, Bengaluru", "nature": "Industrial dispute (wages)",
             "party_key": cin, "party_role": "respondent", "status": "Pending", "filed": "2025-05-14",
             "petitioner": "Workers' union", "next_hearing": "2026-11-11"},
        ],
        "insolvency": [],
        "news": [
            {"title": "Bengaluru engine-parts makers expand capacity for EV transition", "source": "Demo Auto Wire",
             "date": "2026-05-12", "about": cin, "tone": "neutral",
             "snippet": "Kaveri Precision said it added two CNC lines at its Bommasandra plant."},
            {"title": "Karnataka MSME exporters rise 9% year on year", "source": "Demo State News",
             "date": "2026-02-01", "about": None, "tone": "neutral", "snippet": "Machined parts led the gains."},
        ],
        "sources": {"mca": MCA, "gst": GST, "courts": ECOURTS, "ibbi": IBBI, "news": DEMO_NEWS},
    }


def maruti() -> dict:
    """Real listed company, public facts only (annual report / MCA master data). Mode CACHED."""
    cin = "L34103DL1981PLC011375"
    pan = "AAACM0829Q"
    suzuki = co("JP-SMC", "Suzuki Motor Corporation", "Active", "1920-03-15", "Shizuoka, Japan",
                "300 Takatsuka-cho, Chuo-ku, Hamamatsu, Shizuoka, Japan", 0, klass="Public (foreign)", listed=True,
                activity="Manufacture of motor vehicles", roc="Foreign entity (not in MCA)")
    return {
        "id": "maruti_suzuki", "demo": False, "mode": "cached",
        "aliases": ["Maruti Suzuki", "Maruti Suzuki India", "Maruti Suzuki India Ltd", "Maruti"],
        "company": co(cin, "Maruti Suzuki India Limited", "Active", "1981-02-24", "Delhi",
                      "Plot No.1, Nelson Mandela Road, Vasant Kunj, New Delhi, Delhi 110070", 1572012870,
                      authorised=168755000000,
                      last_agm="2026-08-28", last_bs="2026-03-31", klass="Public", listed=True, pan=pan,
                      activity="Manufacture of motor vehicles", nic="34103"),
        "gst": [{**gst(make_gstin("06", pan), "Maruti Suzuki India Limited", "Active", "2017-07-01", "Haryana",
                       last_return="2026-09"), "address": MARUTI_PLANT,
                 "address_note": "Manesar plant (public OSM location) used for the ground check; the GST principal "
                                 "place of business is not part of this cached record."}],
        "directors": [
            {"din": None, "name": "R. C. Bhargava", "designation": "Chairman", "appointed_on": None,
             "address": None, "companies": [cin]},
            {"din": None, "name": "Hisashi Takeuchi", "designation": "Managing Director & CEO", "appointed_on": None,
             "address": None, "companies": [cin]},
        ],
        "parent": {"cin": "JP-SMC", "relation": "subsidiary_of", "holding": "Promoter, majority shareholder"},
        "linked_companies": {"JP-SMC": suzuki}, "linked_gst": {},
        "cases": [], "insolvency": [], "news": [],
        "sources": {"mca": MCA, "gst": GST, "annual_report": "https://www.marutisuzuki.com/corporate/investors",
                    "courts": ECOURTS, "ibbi": IBBI},
        "note": "Public facts recorded for offline demo. LIVE adapters override these when keys are configured.",
    }


def brochure(path: Path) -> None:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    c = canvas.Canvas(str(path), pagesize=A4)
    w, h = A4
    c.setFillColor(colors.HexColor("#0F2A4A"))
    c.rect(0, h - 210, w, 210, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#F2A900"))
    c.circle(w - 90, h - 100, 46, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 30)
    c.drawString(48, h - 92, "SUNRISE AUTO COMPONENTS")
    c.setFont("Helvetica", 13)
    c.drawString(48, h - 118, "Precision parts. Proven partners.")
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(48, h - 180, "Company profile  |  For prospective international partners")

    y = h - 260
    c.setFillColor(colors.HexColor("#0F2A4A"))
    c.setFont("Helvetica-Bold", 15)
    c.drawString(48, y, "Who we are")
    c.setFillColor(colors.HexColor("#222222"))
    c.setFont("Helvetica", 11)
    body = [
        "Sunrise Auto Components brings over 20 years of experience in precision auto components",
        "for passenger vehicles, two-wheelers and commercial vehicles.",
        "Our registered office is in Gurugram, Haryana, at the heart of India's automotive belt.",
        f"Our 50,000 sq ft factory at {SUNRISE_SITE} has been running since 2005.",
        "The plant runs 40 CNC machining centres across three shifts.",
    ]
    for line in body:
        y -= 18
        c.drawString(48, y, line)

    y -= 40
    c.setFillColor(colors.HexColor("#0F2A4A"))
    c.setFont("Helvetica-Bold", 15)
    c.drawString(48, y, "At a glance")
    facts = [
        ("Annual turnover", "Rs 50 crore (FY 2025-26)"),
        ("Quality", "ISO 9001:2015 certified"),
        ("Customers", "Trusted supplier to major OEMs in India"),
        ("Capacity", "1.2 million machined parts per year"),
        ("Team", "350+ skilled employees"),
    ]
    c.setFont("Helvetica", 11)
    for k, v in facts:
        y -= 22
        c.setFillColor(colors.HexColor("#F2A900"))
        c.rect(48, y - 2, 6, 12, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#555555"))
        c.drawString(64, y, k)
        c.setFillColor(colors.HexColor("#111111"))
        c.setFont("Helvetica-Bold", 11)
        c.drawString(210, y, v)
        c.setFont("Helvetica", 11)

    y -= 50
    c.setFillColor(colors.HexColor("#0F2A4A"))
    c.setFont("Helvetica-Bold", 15)
    c.drawString(48, y, "Why partner with us")
    c.setFillColor(colors.HexColor("#222222"))
    c.setFont("Helvetica", 11)
    for line in ["We are looking for a Japanese technology partner to expand exports to ASEAN.",
                 "Advance payment of 40% is standard for new international accounts."]:
        y -= 18
        c.drawString(48, y, line)

    c.setFillColor(colors.HexColor("#E3122B"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(48, 40, "DEMO DATA - synthetic company created for the Shinrai hackathon demo. Not a real business.")
    c.setFillColor(colors.HexColor("#777777"))
    c.setFont("Helvetica", 9)
    c.drawString(48, 28, "info@sunriseauto-demo.in   |   Gurugram, Haryana")
    c.showPage()
    c.save()


def lists(seeds: list[dict]) -> None:
    struck = []
    for s in seeds:
        for cin, c in s["linked_companies"].items():
            if c["status"] == "Strike Off":
                struck.append({"cin": cin, "name": c["name"], "section": "248(1)", "notice_date": "2024-03-28",
                               "roc": c["roc"], "source": "MCA Sec 248 strike-off notice (demo extract)"})
    (SEED_DIR / "strikeoff_list.json").write_text(json.dumps(struck, indent=2), encoding="utf-8")
    disq = [{"din": "10999001", "name": "Demo Director X", "section": "164(2)(a)", "from": "2022-11-01",
             "to": "2027-10-31", "company_cin": "U63090HR2020PTC089904",
             "source": "MCA Sec 164(2) disqualified directors list (demo extract)"}]
    (SEED_DIR / "disqualified_directors.json").write_text(json.dumps(disq, indent=2), encoding="utf-8")


def main() -> None:
    SEED_DIR.mkdir(parents=True, exist_ok=True)
    seeds = [sunrise(), kaveri(), maruti()]
    for s in seeds:
        (SEED_DIR / f"{s['id']}.json").write_text(json.dumps(s, indent=2, ensure_ascii=False), encoding="utf-8")
    lists(seeds)
    brochure(SEED_DIR / "sunrise_brochure.pdf")
    print(f"wrote {len(seeds)} companies, lists and brochure to {SEED_DIR}")


if __name__ == "__main__":
    main()
