from datetime import datetime, timedelta
from decimal import Decimal
import os

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .auth import hash_password
from .models import Category, Offer, PageContent, Salon, Service, ServiceBranchPrice, Staff, User
from .timeutils import utc_now


# Branch details transcribed from the official Tamil Nadu locator.
# PIN codes and landmarks are stored in the address string because the salon
# schema intentionally exposes a single free-form address field to the apps.
CHENNAI_BRANCHES = [
    ("Triplicane / Spencer Plaza", "No. F37A, 1st Floor, Spencer Plaza, Phase 2, Anna Salai", "600002", "9994399399", "Opp. Zudio"),
    ("Santhome", "No. 28/10, Venkataswamy Street", "600004", "8072975707", "Opp. Apollo Pharmacy"),
    ("Mylapore", "No. 36, 2nd Floor, Dr. Radhakrishnan Salai, Sullivan Garden", "600004", "8939215533", ""),
    ("Bharathi Salai", "No. 16/33, KNR Building, Pycrofts Road, Narayana Krishnaraja Puram", "600005", "8610508043", "Near Triplicane"),
    ("Chetpet", "No. 73, Casa Major Road, Sulaiman Zackria Avenue", "600008", "044-42145285", "Sulaiman Zackria Avenue"),
    ("Egmore", "No. 149, Ground Floor, Alsa Mall Shopping Complex, Red Cross Road", "600008", "044-45588588", "Opp. Atlantic Residences"),
    ("Saidapet", "No. 39/17, 2nd Floor, Seshachalam Street, Periyapet", "600015", "8428968888", ""),
    ("T. Nagar - Bazullah Road", "No. 76, Bazullah Road, Parthasarathi Puram", "600017", "044-28344664", "Opp. Vivek Signal"),
    ("T. Nagar - SW Boag Road", "Old No. 56, 1st Floor, No. 25, Bus Stop, SW Boag Road", "600017", "6385337633", "Near CIT Nagar"),
    ("T. Nagar - Pondy Bazaar", "No. 29, Dr. Nair Road, Pondy Bazaar", "600017", "9941730333", "Above Federal Bank"),
    ("Alwarpet", "No. 220, Mowbrays Flats, TT Krishnamachari Road", "600018", "044-31352838", "Next to Dr. Agarwal's Eye Hospital"),
    ("Indira Nagar, Adyar", "Old No. 29, New No. 63, FF, Kasturba Nagar, Kamaraj Avenue 2nd Street", "600020", "9080569144", "Near Pappet Jammal"),
    ("Adyar", "No. 1/1, 1st Floor, 7th Lane, Shastri Nagar", "600020", "9500488778", ""),
    ("Old Washermanpet", "No. 570, Thiruvottiyur High Road", "600021", "7299930250", "Near Union Bank"),
    ("Ayanavaram", "No. 328, 1st Floor, Adarsh Tower, Konnur High Road", "600023", "9344066689", "Near Noor Hotel"),
    ("Kodambakkam", "No. 32, Arcot Road", "600024", "9500063607", "Above McRennett"),
    ("Nelson Manickam Road", "No. 115 & 1A, 1st Floor, Khandhas Chamber, E Block", "600029", "9884946996", "Above Federal Bank"),
    ("Ekkatuthangal", "No. 2 & 3, 100 Feet Road", "600032", "9710623334", ""),
    ("West Mambalam", "New Door No. 88, Navin's Brindavan Street", "600033", "9500111717", ""),
    ("Valluvarkottam", "No. 167, 2nd Floor, Yesde House, Nungambakkam, Ponnangipuram", "600034", "044-47611783", "Near Valluvar Kottam High Road"),
    ("Paneer Nagar", "No. 113, Vellalar Street, Mogappair", "600037", "7200775414", "Next to SBI Bank"),
    ("Mogappair", "No. 4/750, AGP Saantham Building, 4th Block, Thiruvallur", "600037", "9884663355", "Near Ambattur Industrial Estate"),
    ("Mogappair East", "No. B20, 1st Floor, Mogappair Industrial Estate, Church Road, ERI Scheme", "600037", "9944860166", "Opp. Ellahi Super Market"),
    ("JJ Nagar", "1/C8, Kamaraj Square, Valaiyapathi Salai, Mogappair East", "600037", "8939770088", "Near Padi Pudur Nagar"),
    ("Vyasarpadi", "No. 339, Main Road, MKB Nagar, Mahakavi Bharathiyar Nagar", "600039", "7358711996", ""),
    ("Anna Nagar West (13th Main Road)", "No. 1425, 13th Main Road", "600040", "9077626262", ""),
    ("Anna Nagar West (6th Avenue)", "6th Avenue, I Block", "600040", "9884731888", ""),
    ("Palavakkam", "No. 4/31, ECR Road", "600041", "7540051400", "Opp. Fashion Factory"),
    ("Neelankarai", "No. 4, 2nd Floor, Manjula Complex, SH 49, Saraswathy Nagar", "600041", "9566105069", "Near PNB & YES Bank"),
    ("Thiruvanmiyur", "E Mada Street, Lalitha Nagar", "600041", "044-48590310", ""),
    ("Seshadripuram, Velachery", "No. 1, 1st Cross Street, Baby Nagar, Velachery", "600042", "044-45510003", ""),
    ("Dhadeswaram Nagar", "No. 52, Velachery Road", "600042", "044-45014001", ""),
    ("Velachery", "No. 38, Velachery Bypass Road, Vijaya Nagar", "600042", "044-42022995", "Above Dindukkal"),
    ("Chrompet", "No. 89, 1st Floor, Radhanagar Main Road", "600044", "8939693555", "Above TMB Bank ATM"),
    ("West Tambaram", "Plot No. 12/9, Sakthi Foundation, Ezhumalai Street", "600045", "9500445929", "Opp. MedPlus"),
    ("Tambaram West", "Amaanath Tower, 8th Street Corner, Krishna Nagar", "600045", "9884017616", "Near Mudichur Road"),
    ("Krishna Nagar", "Amaanath Tower, Mudichur Road, West Tambaram", "600045", "9884017616", "Near 8th Street Corner"),
    ("Manimangalam", "Plot No. 26, 1st Floor, Mudichur Road, Nawab Habibulla Nagar", "600048", "9042828174", "Next to City Union Bank"),
    ("Mannivakkam", "Door No. 2/40, 1st Floor, Mudichur, Lakshmi Nagar", "600048", "8939420555", ""),
]

MADURAI_BRANCHES = [
    ("Thiru Nagar", "No. 112, 1st Floor, Naga Tower, 2nd Bus Stop", "625006", "9943902333", "Above Bank of India"),
    ("Theppakulam", "No. 137/1/4, 2nd Floor, SMT Square, Kamarajar Salai", "625009", "7418181846", "Opp. Nirmala School"),
    ("Narayanapuram", "No. 20, Iyer Bungalow, Natham Road, Mahalakshmi Nagar", "625014", "0452-4373777", ""),
    ("Ponmeni", "No. 184/2, 3rd Floor, KPS Arcade, Bypass Road", "625016", "0452-4502234", "Near Lakshmi Bhavan Hotel"),
    ("Andalpuram", "No. 78, 1st Floor, Ramalinga Radiance Building, Tirupparankunram Road", "625016", "9600282366", "Near Agrini Apartments"),
    ("P&T Nagar", "Plot No. A, Abhijit Plaza, 6th Street, Park Town", "625017", "8111021102", ""),
]

SALEM_BRANCHES = [
    ("Mullai Nagar", "No. 30 & 1, 1st Floor, Sai SG Arcade, Main Road, Suramangalam", "636005", "0427-2335599", ""),
    ("Hasthampatti", "Flat No. 21, Yercaud Main Road, Periyapodhu", "636007", "9150047794", "Opp. Central Jail"),
    ("Chinna Pudur", "No. 20, Gopal Building, Ramakrishna Road", "636007", "9150111660", "Opp. Om Sakti Temple"),
    ("Attur / Vinayagapuram", "1st Floor, KRM Complex, Salem Main Road, Attur", "636108", "9043797952", "Opp. Court, Attur"),
    ("Seelanaickenpatty", "No. 22, Rasi Plaza, Trichy Main Road, PM Nagar", "636201", "9047444060", "Opp. Ramani Honda Showroom"),
    ("Elampillai", "No. 254/5, 1st Floor, JT Complex", "637502", "8190009800", "Behind Sri Kandhan Theatre"),
]

KUMBAKONAM_BRANCHES = [
    ("Sri Nagar Colony", "No. 38/252, Thirunarayanapuram Street, Naal Road", "612001", "7448447776", "Above Baskin Robbins"),
]

VERIFIED_BRANCHES = {
    "Chennai": CHENNAI_BRANCHES,
    "Madurai": MADURAI_BRANCHES,
    "Salem": SALEM_BRANCHES,
    "Kumbakonam": KUMBAKONAM_BRANCHES,
}

# The official locator currently marks this branch as temporarily closed. New
# records are seeded inactive so it stays hidden from public booking until an
# administrator reopens it.
TEMPORARILY_CLOSED_BRANCHES = {("Salem", "Seelanaickenpatty")}


# Service prices transcribed from the published Naturals Men's and Women's
# service pages. The numeric price is the listed or starting/lower-bound value;
# ranges, "starting" caveats and member prices are kept in the description so the
# existing single-price schema stays intact.
#
# Tuple: (audience, category, name, price, duration, price note, member note, summary)
OFFICIAL_SERVICES = [
    # Men
    ("Men", "Men's grooming", "Men's haircut", "300.00", 30, "Starting price: ₹300.", None,
     "A consultation-led cut and finish; final price depends on hair length and style."),
    ("Men", "Men's grooming", "Shave", "120.00", 20, "Published price: ₹120.", "₹100",
     "A classic hot-towel shave with a clean finish."),
    ("Men", "Men's grooming", "Beard trim", "180.00", 20, "Published price: ₹180.", "₹150",
     "Beard shaping and trimming to suit your face and style."),
    ("Men", "Hair", "Root touch-up", "1000.00", 30, "Published price: ₹1,000.", "₹900",
     "Targeted colour refresh at the roots."),
    ("Men", "Hair", "Moisturising hair spa", "800.00", 45, "Price range: ₹800–₹900.", "₹700–₹800",
     "A deep-conditioning spa ritual for soft, moisturised hair."),
    ("Men", "Hair", "Head massage", "600.00", 30, "Published price: ₹600.", None,
     "A relaxing head and scalp massage."),
    ("Men", "Hair", "Hair straightening", "5000.00", 120, "Starting price: ₹5,000.", None,
     "Straightening with a smooth finish; final price depends on hair length and density."),
    ("Men", "Hair", "Keratin treatment", "5000.00", 120, "Starting price: ₹5,000.", None,
     "A keratin smoothing treatment; final price depends on hair length and density."),
    ("Men", "Hair", "Smoothening", "4000.00", 120, "Starting price: ₹4,000.", None,
     "A smoothing treatment; final price depends on hair length and density."),
    ("Men", "Skin", "Men's facial", "700.00", 45, "Starting price: ₹700.", None,
     "A facial tailored to men's skin; final price depends on the treatment chosen."),
    ("Men", "Skin", "Face clean-up", "700.00", 30, "Starting price: ₹700.", "₹600",
     "A quick cleanse and refresh; final price depends on the variant chosen."),
    ("Men", "Skin", "De-tan", "450.00", 30, "Starting price: ₹450.", None,
     "A de-tanning treatment for sun-exposed skin; final price depends on the area treated."),
    # Women
    ("Women", "Hair", "Classic haircut", "450.00", 45, "Published price: ₹450.", "₹400",
     "A consultation-led classic cut and finish."),
    ("Women", "Hair", "Root touch-up", "1000.00", 30, "Published price: ₹1,000.", "₹900",
     "Targeted colour refresh at the roots."),
    ("Women", "Hair", "Moisturising hair spa", "800.00", 60, "Price range: ₹800–₹900.", "₹700–₹800",
     "A deep-conditioning spa ritual for soft, moisturised hair."),
    ("Women", "Skin", "Face clean-up", "700.00", 30, "Starting price: ₹700.", "₹600",
     "A quick cleanse and refresh; final price depends on the variant chosen."),
    ("Women", "Skin", "Fruit facial", "900.00", 45, "Published price: ₹900.", "₹800",
     "A fruit-based facial for a fresh, bright finish."),
    ("Women", "Skin", "Face and neck de-tan", "450.00", 30, "Published price: ₹450.", "₹400",
     "De-tanning for the face and neck."),
    ("Women", "Skin", "Threading", "40.00", 15, "Starting price: ₹40.", None,
     "Eyebrow and face threading; final price depends on the areas treated."),
    ("Women", "Body", "Waxing", "350.00", 30, "Starting price: ₹350.", None,
     "Waxing for the area of your choice; final price depends on the area treated."),
    ("Women", "Skin", "Black facial", "1700.00", 45, "Starting price: ₹1,700.", "₹1,500",
     "A deep-cleansing black facial; final price depends on the variant chosen."),
    ("Women", "Hair", "Hair straightening", "5000.00", 150, "Starting price: ₹5,000.", None,
     "Straightening with a smooth finish; final price depends on hair length and density."),
    ("Women", "Hair", "Keratin treatment", "5000.00", 150, "Starting price: ₹5,000.", None,
     "A keratin smoothing treatment; final price depends on hair length and density."),
    ("Women", "Hair", "Smoothening", "4000.00", 150, "Starting price: ₹4,000.", None,
     "A smoothing treatment; final price depends on hair length and density."),
    ("Women", "Body", "Cocoa butter manicure", "450.00", 45, "Published price: ₹450.", "₹400",
     "A nourishing cocoa butter manicure."),
    # Bharathi Salai starting prices published on the branch locator. These are
    # seeded into the shared catalogue and pinned to the branch below.
    ("Everyone", "Skin", "Facial", "900.00", 45, "Starting price: ₹900. Bharathi Salai branch price.", None,
     "A facial tailored to your skin; final price depends on the treatment chosen."),
    ("Women", "Hair", "Layer cut", "1100.00", 45, "Starting price: ₹1,100. Bharathi Salai branch price.", None,
     "A layered cut and finish; final price depends on hair length and style."),
    ("Everyone", "Hair", "Hair colouring", "1000.00", 90, "Starting price: ₹1,000. Bharathi Salai branch price.", None,
     "Hair colouring; final price depends on hair length and the colour chosen."),
    ("Everyone", "Hair", "Hair wash and blow dry", "1000.00", 30, "Starting price: ₹1,000. Bharathi Salai branch price.", None,
     "A wash followed by a blow-dry finish."),
    ("Everyone", "Skin", "Skin brightening", "3000.00", 45, "Starting price: ₹3,000. Bharathi Salai branch price.", None,
     "A brightening treatment; final price depends on the area and variant chosen."),
    ("Women", "Bridal", "Bridal makeup package", "7999.00", 120, "Starting price: ₹7,999. Bharathi Salai branch price.", None,
     "A bridal makeup package; final price depends on the look and add-ons chosen."),
    ("Everyone", "Body", "Pedicure", "700.00", 45, "Starting price: ₹700. Bharathi Salai branch price.", None,
     "A foot-care and pedicure ritual."),
    ("Everyone", "Membership", "Membership card", "100.00", 15, "Published price: ₹100. Bharathi Salai branch price.", None,
     "A one-time membership card; ask the branch team about current member benefits and terms."),
]

BHARATHI_SALAI_PRICES = {
    "Facial": "900.00",
    "Layer cut": "1100.00",
    "Hair colouring": "1000.00",
    "Waxing": "650.00",
    "Hair wash and blow dry": "1000.00",
    "Skin brightening": "3000.00",
    "Bridal makeup package": "7999.00",
    "Pedicure": "700.00",
    "Membership card": "100.00",
}

OFFICIAL_SERVICE_CATEGORIES = [
    ("Hair", "hair"),
    ("Skin", "skin"),
    ("Body", "body"),
    ("Bridal", "bridal"),
    ("Men's grooming", "mens-grooming"),
    ("Membership", "membership"),
]


def _phone_digits(value: str) -> str:
    digits = "".join(character for character in value if character.isdigit())
    return digits[-10:]


def _branch_tokens(value: str) -> set[str]:
    stop_words = {"naturals", "salon", "studio", "chennai", "madurai", "salem", "kumbakonam", "branch"}
    return {
        token
        for token in "".join(character.lower() if character.isalnum() else " " for character in value).split()
        if token not in stop_words
    }


def _branch_address(city: str, address: str, pin: str, landmark: str) -> str:
    full_address = f"{address}, {city} - {pin}."
    if landmark:
        full_address += f" Landmark: {landmark}."
    return full_address


def seed_verified_branches(db: Session) -> None:
    """Add official Tamil Nadu branches without duplicating admin-created rows."""
    services = list(db.scalars(select(Service).where(Service.is_active.is_(True))).all())
    if not services:
        return

    existing = list(db.scalars(select(Salon).where(Salon.city.in_(list(VERIFIED_BRANCHES)))).all())
    # One query replaces a "does this salon have staff?" lookup per branch on
    # every process start.
    staffed_salon_ids = set(db.scalars(select(Staff.salon_id).distinct()).all())
    for city, branches in VERIFIED_BRANCHES.items():
        city_branches = [salon for salon in existing if salon.city == city]
        for branch_name, address, pin, phone, landmark in branches:
            name = f"Naturals - {branch_name}"
            full_address = _branch_address(city, address, pin, landmark)
            match = next((salon for salon in city_branches if salon.name == name), None)
            if match is None:
                # Adopt an earlier manually-entered version of the same branch once,
                # then leave canonical rows and later administrator edits untouched.
                wanted_tokens = _branch_tokens(branch_name)
                phone_matches = [salon for salon in city_branches if _phone_digits(salon.phone) == _phone_digits(phone)]
                match = next(
                    (
                        salon
                        for salon in phone_matches
                        if len(wanted_tokens & _branch_tokens(salon.name)) >= 2
                    ),
                    None,
                )
                if match is None:
                    match = Salon(
                        name=name,
                        city=city,
                        address=full_address,
                        phone=phone,
                        is_demo=False,
                        is_active=(city, branch_name) not in TEMPORARILY_CLOSED_BRANCHES,
                    )
                    db.add(match)
                    db.flush()
                    city_branches.append(match)
                else:
                    match.name = name
                    match.address = full_address
                    match.phone = phone
                    match.is_demo = False

            if match.id not in staffed_salon_ids:
                for index in range(1, 4):
                    db.add(
                        Staff(
                            salon_id=match.id,
                            name=f"Salon team member {index}",
                            title="Stylist - Sample profile",
                            services=services,
                        )
                    )
                staffed_salon_ids.add(match.id)

    db.commit()


def _service_description(price_note: str, member_note: str | None, summary: str) -> str:
    parts = [price_note]
    if member_note:
        parts.append(f"Member price: {member_note}.")
    parts.append(summary)
    return " ".join(parts)[:600]


def seed_official_services(db: Session) -> None:
    """Add the published Men's, Women's and Bharathi Salai services once.

    Existing rows are never overwritten, so later administrator edits survive
    application restarts. New services are linked to the sample teams so the
    booking flow and availability endpoint keep working.
    """
    existing_categories = {category.name: category for category in db.scalars(select(Category)).all()}
    categories: dict[str, Category] = {}
    for name, slug in OFFICIAL_SERVICE_CATEGORIES:
        category = existing_categories.get(name)
        if category is None:
            category = Category(name=name, slug=slug)
            db.add(category)
            db.flush()
            existing_categories[name] = category
        categories[name] = category

    existing_services = {(service.name, service.audience): service for service in db.scalars(select(Service)).all()}
    official_rows: list[Service] = []
    for audience, category_name, name, price, duration, price_note, member_note, summary in OFFICIAL_SERVICES:
        key = (name, audience)
        service = existing_services.get(key)
        if service is None:
            service = Service(
                category_id=categories[category_name].id,
                name=name,
                description=_service_description(price_note, member_note, summary),
                duration_minutes=duration,
                price=Decimal(price),
                audience=audience,
                is_active=True,
                is_demo=False,
            )
            db.add(service)
            existing_services[key] = service
        official_rows.append(service)

    db.flush()

    sample_staff = [
        staff
        for staff in db.scalars(select(Staff).options(selectinload(Staff.services))).all()
        if "sample profile" in staff.title.lower() or "demo profile" in staff.title.lower()
    ]
    for staff in sample_staff:
        assigned = {service.id for service in staff.services}
        missing = [service for service in official_rows if service.id not in assigned]
        if missing:
            staff.services.extend(missing)

    db.commit()


def seed_official_branch_prices(db: Session) -> None:
    """Pin the published Bharathi Salai starting prices to that branch."""
    branch = db.scalar(select(Salon).where(Salon.name == "Naturals - Bharathi Salai"))
    if branch is None:
        return

    services = list(
        db.scalars(select(Service).where(Service.name.in_(list(BHARATHI_SALAI_PRICES)))).all()
    )
    existing = {
        row.service_id: row
        for row in db.scalars(
            select(ServiceBranchPrice).where(ServiceBranchPrice.salon_id == branch.id)
        ).all()
    }
    for service in services:
        if service.id in existing:
            # Preserve a branch price edited by an administrator after seeding.
            continue
        db.add(
            ServiceBranchPrice(
                service_id=service.id,
                salon_id=branch.id,
                price=Decimal(BHARATHI_SALAI_PRICES[service.name]),
            )
        )
    db.commit()


DEFAULT_CONTENT = {
    "home.hero.eyebrow.women": "Naturals for women",
    "home.hero.title.women": "Salon care,\nin your own rhythm.",
    "home.hero.copy.women": "Thoughtful hair, skin and bridal rituals in a light, unhurried setting — booked around your life, not the other way around.",
    "home.hero.cta.women": "Book an appointment",
    "home.hero.secondary.women": "Explore treatments",
    "home.hero.image.women": "",
    "home.edit.title.women": "The Naturals edit",
    "home.edit.subtitle.women": "Signature rituals chosen from the live service catalogue. Every price and duration below comes from the salon API.",
    "home.categories.title.women": "Find your ritual",
    "home.categories.subtitle.women": "Start with a category, then narrow the services to exactly what you need.",
    "home.salons.title.women": "Find your Naturals",
    "home.salons.subtitle.women": "Explore every Naturals studio, each with real opening hours, contact details and a sample team.",
    "home.team.title.women": "Your specialists",
    "home.team.subtitle.women": "A preview of the team. Choose your specialist in the booking flow — availability is checked by the salon server.",
    "home.promise.title.women": "An easier kind of care",
    "home.promise.subtitle.women": "The details that make a salon visit feel considered, from the first question to the final finish.",
    "home.cta.title.women": "Your chair is waiting.",
    "home.cta.copy.women": "Choose a service, pick a real available time and let the salon team take it from there.",
    "home.hero.eyebrow.men": "Naturals for men",
    "home.hero.title.men": "Grooming,\nwith quiet confidence.",
    "home.hero.copy.men": "Precision cuts, beard-friendly grooming and restorative treatments in a deep, considered atelier. No noise — just a good chair and proper craft.",
    "home.hero.cta.men": "Book a grooming session",
    "home.hero.secondary.men": "View disciplines",
    "home.hero.image.men": "",
    "home.edit.title.men": "The grooming edit",
    "home.edit.subtitle.men": "Signature disciplines chosen from the live service catalogue. Durations and prices are pulled from the salon API.",
    "home.categories.title.men": "Choose your discipline",
    "home.categories.subtitle.men": "Hair, beard-friendly grooming, skin and body — each with its own set of rituals.",
    "home.salons.title.men": "Find your atelier",
    "home.salons.subtitle.men": "Explore every Naturals studio with real opening hours, contact details and a sample team.",
    "home.team.title.men": "The atelier team",
    "home.team.subtitle.men": "A preview of the team. Pick your barber or stylist during booking, subject to the server's real availability.",
    "home.promise.title.men": "Built around the chair",
    "home.promise.subtitle.men": "A quieter kind of grooming appointment, with the details that matter left in plain sight.",
    "home.cta.title.men": "Take the chair.",
    "home.cta.copy.men": "Pick a discipline, choose a real open slot and let the team handle the rest.",
    "site.footer.tagline": "Care that feels like you.",
    "site.footer.description": "A calmer way to book salon care. One Naturals, two atmospheres — soft light for women, deep noir for men.",
}


def seed_content(db: Session) -> None:
    """Create any missing CMS defaults without overwriting administrator edits."""
    existing = set(db.scalars(select(PageContent.key)).all())
    for key, value in DEFAULT_CONTENT.items():
        if key not in existing:
            db.add(PageContent(key=key, value=value, content_type="image" if key.endswith(".image.women") or key.endswith(".image.men") else "text"))
    db.commit()


def _seed_staff_account(db: Session, prefix: str, role: str) -> None:
    email = os.getenv(f"{prefix}_EMAIL", "").strip().lower()
    password = os.getenv(f"{prefix}_PASSWORD", "")
    if bool(email) != bool(password):
        raise RuntimeError(f"Set both {prefix}_EMAIL and {prefix}_PASSWORD to seed a {role} account.")
    if not email:
        return
    if len(password) < 12:
        raise RuntimeError(f"{prefix}_PASSWORD must contain at least 12 characters.")
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        return
    name = "Naturals Admin" if role == "admin" else "Naturals Developer"
    db.add(User(name=name, email=email, password_hash=hash_password(password), role=role))


def seed_data(db: Session) -> None:
    has_catalog = db.scalar(select(Category.id).limit(1)) is not None
    _seed_staff_account(db, "ADMIN", "admin")
    _seed_staff_account(db, "DEVELOPER", "developer")
    if has_catalog:
        db.commit()
        return
    db.flush()

    categories = [
        Category(name="Hair", slug="hair"),
        Category(name="Skin", slug="skin"),
        Category(name="Body", slug="body"),
        Category(name="Bridal", slug="bridal"),
        Category(name="Men's grooming", slug="mens-grooming"),
    ]
    db.add_all(categories)
    db.flush()

    category_by_name = {item.name: item for item in categories}
    service_specs = [
        ("Hair", "Signature haircut", "A consultation-led cut and finish tailored to your style.", 45, "699.00", "Everyone"),
        ("Hair", "Nourishing hair spa", "A relaxing wash and conditioning ritual for soft, refreshed hair.", 60, "1499.00", "Everyone"),
        ("Skin", "Radiance facial", "A cleansing and hydrating facial experience.", 60, "1299.00", "Everyone"),
        ("Body", "Relaxing body massage", "A restorative massage designed to help you unwind.", 60, "1999.00", "Everyone"),
        ("Bridal", "Bridal beauty consultation", "A one-to-one consultation to discuss your wedding-day look.", 45, "0.00", "Women"),
        ("Men's grooming", "Classic men's grooming", "A tailored haircut and grooming finish.", 30, "499.00", "Men"),
    ]
    services = []
    for category, name, description, duration, price, audience in service_specs:
        services.append(
            Service(
                category_id=category_by_name[category].id,
                name=name,
                description=description,
                duration_minutes=duration,
                price=Decimal(price),
                audience=audience,
                is_demo=True,
            )
        )
    db.add_all(services)
    db.flush()

    salons = [
        Salon(
            name="Naturals Demo Studio — Adyar",
            city="Chennai",
            address="Demo address — update before launch",
            phone="+91 00000 00000",
            is_demo=True,
        ),
        Salon(
            name="Naturals Demo Studio — Indiranagar",
            city="Bengaluru",
            address="Demo address — update before launch",
            phone="+91 00000 00000",
            is_demo=True,
        ),
    ]
    db.add_all(salons)
    db.flush()

    for salon in salons:
        for index in range(1, 4):
            stylist = Staff(
                salon_id=salon.id,
                name=f"Demo stylist {index}",
                title="Stylist · Demo profile",
                services=services,
            )
            db.add(stylist)

    db.add(
        Offer(
            code="WELCOME10",
            title="Welcome offer",
            description="10% off one demo booking. Development offer, not an official Naturals promotion.",
            discount_percent=10,
            active=True,
            is_demo=True,
            starts_at=utc_now() - timedelta(days=1),
            ends_at=utc_now() + timedelta(days=180),
            max_uses=500,
            uses=0,
        )
    )
    db.commit()
