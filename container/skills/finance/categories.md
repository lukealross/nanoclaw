# Finance Categories & Merchants

Source-of-truth for transaction classification. Edit this file to add merchants, fix mismatches, or expand pattern coverage. Changes take effect on the next `finance ingest` or `finance recategorise --all`.

## Format

Each H2 (`##`) is a top-level category. Each list item is a subcategory followed by comma-separated case-insensitive substring patterns matched against `description_raw`:

```
- **Subcategory Name**: PATTERN1, PATTERN2, PATTERN3
```

A txn matches if any pattern is a case-insensitive substring of the raw description. Order matters only for tie-breaking — first matching subcategory wins. Multi-category matches downgrade `confidence` to `medium`.

`Inter-account Transfer` is handled by the transfer-pairing logic, not pattern match — leave it without subcategories.

---

## Groceries
- **Checkers**: CHECKERS, SHOPRITE CHECKERS, CHECKERS HYPER, CHECKERS LIQUOR, CHECKERS SIXTY60
- **Pick n Pay**: PICK N PAY, PICKNPAY, PNP, PICK-N-PAY
- **Woolworths Food**: WOOLWORTHS FOOD, WW FOOD, WOOLIES FOOD, WOOLWORTHS DASH
- **Spar**: SPAR, SUPERSPAR, KWIKSPAR, TOPS AT SPAR
- **Shoprite**: SHOPRITE, SHOPRITE LIQUORS
- **Food Lover's Market**: FOOD LOVERS, FOODLOVERS, FRUIT N VEG MARKET
- **Fruit & Veg City**: FRUIT AND VEG CITY, FRUIT & VEG CITY

## Dining
- **Nando's**: NANDOS, NANDO'S
- **Steers**: STEERS
- **KFC**: KFC, KENTUCKY FRIED
- **McDonald's**: MCDONALDS, MCD
- **Spur**: SPUR
- **Mugg & Bean**: MUGG AND BEAN, MUGG & BEAN, M&B
- **Ocean Basket**: OCEAN BASKET
- **Wimpy**: WIMPY
- **Uber Eats**: UBER EATS, UBEREATS
- **Mr D**: MRDFOOD, MR D FOOD, MR DELIVERY
- **Restaurants (generic)**: RESTAURANT, BISTRO, CAFE, COFFEE, KITCHEN, GRILL, BAR &, EATERY, DINER, PIZZERIA

## Transport
- **Uber**: UBER TRIP, UBER *, UBER BV, UBER ZA
- **Bolt**: BOLT.EU, BOLT EU, BOLT TECHNOLOGY
- **Gautrain**: GAUTRAIN
- **MyCiti**: MYCITI, MY CITI
- **Engen**: ENGEN
- **BP**: BP SOUTH, BP SA, BP CONVENIENCE
- **Shell**: SHELL SA, SHELL ULTRA
- **Sasol**: SASOL
- **Caltex**: CALTEX
- **Parking**: PARKING, PARKADE, PAY & DISPLAY, PARKMATE

## Shopping
- **Woolworths Fashion**: WOOLWORTHS FASHION, WOOLWORTHS CLOTHING, WW CLOTHING
- **Mr Price**: MR PRICE, MRP, MR-PRICE
- **Edgars**: EDGARS
- **Truworths**: TRUWORTHS
- **Zara**: ZARA
- **Cotton On**: COTTON ON, COTTONON
- **H&M**: H&M, HENNES MAURITZ
- **Takealot**: TAKEALOT, TAKE-A-LOT
- **Amazon**: AMAZON, AMZN
- **Yuppiechef**: YUPPIECHEF

## Health
- **Clicks**: CLICKS
- **Dischem**: DIS-CHEM, DISCHEM
- **Medirite**: MEDIRITE
- **Doctor**: DR ., DOCTOR, MEDICAL PRAC, GP CONSULT
- **Specialist**: SPECIALIST, RADIOLOG, PATHCARE, AMPATH, LANCET LABORATORIES
- **Dental**: DENTAL, DENTIST, ORTHODONT
- **Pharmacy (generic)**: PHARMACY, APTEEK

## Entertainment
- **Netflix**: NETFLIX
- **Showmax**: SHOWMAX
- **DStv**: DSTV, MULTICHOICE
- **Spotify**: SPOTIFY
- **Apple Music**: APPLE.COM/BILL, APPLE MUSIC
- **Steam**: STEAMGAMES, STEAM PURCHASE
- **YouTube Premium**: YOUTUBEPREMIUM, GOOGLE *YOUTUBE
- **Cinema**: STER-KINEKOR, NU METRO, CINEMA, MOVIES@

## Insurance
- **Discovery Health**: DISCOVERY HEALTH, DISCOVERY HMS
- **Discovery Life**: DISCOVERY LIFE
- **OUTsurance**: OUTSURANCE, OUT-SURANCE
- **Sanlam**: SANLAM
- **Momentum**: MOMENTUM
- **Old Mutual**: OLD MUTUAL, OLDMUTUAL
- **King Price**: KING PRICE
- **MiWay**: MIWAY

## Banking Fees
- **Monthly Fee**: MONTHLY FEE, ACCOUNT FEE, SERVICE FEE
- **ATM Fee**: ATM FEE, CASH WITHDRAWAL FEE, ATM CHARGE
- **Overdraft**: OVERDRAFT, OD INTEREST
- **Service Charge**: SERVICE CHARGE, BANK CHARGE, TRANSACTION FEE
- **Card Fee**: CARD REPLACE, CARD FEE
- **International Fee**: INTERNATIONAL FEE, FOREX FEE, CONVERSION FEE

## Utilities
- **Eskom**: ESKOM
- **Prepaid Electricity**: PREPAID ELEC, FNB PREPAID, ABSA PREPAID, ELEC TOKEN
- **Municipal Rates**: CITY OF CAPE, CITY OF JOHANNES, CITY OF TSHWANE, MUNICIPAL, JHB METRO, EKURHULENI
- **Water**: WATER ACC, JOBURG WATER, RAND WATER

## Subscriptions
- **Cloud/Tech**: AWS, GOOGLE CLOUD, AZURE, GCP, DIGITALOCEAN, LINODE, VULTR, CLOUDFLARE
- **Software**: GITHUB, JETBRAINS, FIGMA, NOTION, LINEAR.APP, OPENAI, ANTHROPIC, ADOBE, MICROSOFT 365, OFFICE365
- **Other Digital**: PATREON, SUBSTACK, MEDIUM, DROPBOX, ICLOUD, GOOGLE STORAGE

## Travel
- **FlySafair**: FLYSAFAIR, SAFAIR
- **Kulula**: KULULA, COMAIR
- **SAA**: SAA, SOUTH AFRICAN AIRWAYS
- **Airbnb**: AIRBNB
- **Booking.com**: BOOKING.COM, BOOKING.YE
- **Hotels**: HOTEL, LODGE, GUEST HOUSE, B&B
- **Car Rental**: AVIS, BUDGET RENT, EUROPCAR, HERTZ, FIRST CAR, BIDVEST CAR

## Education
- **Schools**: SCHOOL FEES, SCHOOL ACC
- **University**: UNIVERSITY, UCT, WITS, STELLENBOSCH, UJ FEES
- **Online Courses**: UDEMY, COURSERA, EDX, PLURALSIGHT, MASTERCLASS

## Income
- **Salary**: SALARY, PAYROLL, WAGES, SAL CR
- **Freelance/Rate**: COMMISSION, FREELANCE, INVOICE PAID
- **Interest**: INTEREST CREDIT, ACCRUED INT, CR INTEREST
- **Rental**: RENT RECEIVED, RENTAL INCOME

## Inter-account Transfer
<!-- Handled by transfer-pairing logic. No patterns needed here. -->
