#!/usr/bin/env python3
"""
Generates all test import CSV files for the SCM platform.
Run: python3 generate_csvs.py
Output: files 01_warehouses.csv through 09_shipments.csv in the same directory.
"""
import csv, datetime, os, random, string

OUT = os.path.dirname(os.path.abspath(__file__))

def w(name, rows):
    path = os.path.join(OUT, name)
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"  ✓  {name}  ({len(rows)} rows)")

# ──────────────────────────────────────────────
# 01  WAREHOUSES  (10)
# ──────────────────────────────────────────────
warehouses = [
    {"name":"Delhi Main Fulfillment Center","code":"WH-DEL-01","type":"fulfillment","capacity":10000,"street":"Plot 42, Sector 18, Noida","city":"Noida","state":"Uttar Pradesh","postal_code":"201301","country":"India","contact_email":"delhi.wh@croma.com","contact_phone":"+919810001001","status":"active"},
    {"name":"Mumbai Express Hub","code":"WH-MUM-01","type":"cross-dock","capacity":7500,"street":"Unit 7, Bhiwandi Logistics Park, NH-3","city":"Bhiwandi","state":"Maharashtra","postal_code":"421302","country":"India","contact_email":"mumbai.wh@croma.com","contact_phone":"+919820002002","status":"active"},
    {"name":"Bangalore Tech Warehouse","code":"WH-BLR-01","type":"fulfillment","capacity":8000,"street":"Survey No. 55, Hoskote Industrial Area","city":"Bangalore","state":"Karnataka","postal_code":"562114","country":"India","contact_email":"blr.wh@croma.com","contact_phone":"+919830003003","status":"active"},
    {"name":"Chennai Port Logistics","code":"WH-CHE-01","type":"staging","capacity":5000,"street":"No. 12, Harbour Estate, Ennore Road","city":"Chennai","state":"Tamil Nadu","postal_code":"600057","country":"India","contact_email":"chennai.wh@croma.com","contact_phone":"+919840004004","status":"active"},
    {"name":"Hyderabad Distribution Center","code":"WH-HYD-01","type":"fulfillment","capacity":9000,"street":"Gaddapotharam Industrial Area, IDA Phase 1","city":"Hyderabad","state":"Telangana","postal_code":"502319","country":"India","contact_email":"hyd.wh@croma.com","contact_phone":"+919850005005","status":"active"},
    {"name":"Pune Forward Warehouse","code":"WH-PNQ-01","type":"fulfillment","capacity":4000,"street":"Plot B-14, Chakan Industrial Area","city":"Pune","state":"Maharashtra","postal_code":"410501","country":"India","contact_email":"pune.wh@croma.com","contact_phone":"+919860006006","status":"active"},
    {"name":"Kolkata Regional Hub","code":"WH-CCU-01","type":"cross-dock","capacity":6000,"street":"Leather Complex, Bantala, EM Bypass","city":"Kolkata","state":"West Bengal","postal_code":"700159","country":"India","contact_email":"kolkata.wh@croma.com","contact_phone":"+919870007007","status":"active"},
    {"name":"Ahmedabad Textile Hub","code":"WH-AMD-01","type":"fulfillment","capacity":7000,"street":"Odhav Industrial Estate, Odhav Road","city":"Ahmedabad","state":"Gujarat","postal_code":"382415","country":"India","contact_email":"amd.wh@croma.com","contact_phone":"+919880008008","status":"active"},
    {"name":"Jaipur Returns Center","code":"WH-JAI-01","type":"returns","capacity":3000,"street":"Sitapura Industrial Area, Phase 2","city":"Jaipur","state":"Rajasthan","postal_code":"302022","country":"India","contact_email":"jaipur.wh@croma.com","contact_phone":"+919890009009","status":"active"},
    {"name":"Kochi Cold-Chain Warehouse","code":"WH-COK-01","type":"fulfillment","capacity":2500,"street":"Kinfra Export Promotion Zone, Kakkanad","city":"Kochi","state":"Kerala","postal_code":"682030","country":"India","contact_email":"kochi.wh@croma.com","contact_phone":"+919900010010","status":"active"},
]
w("01_warehouses.csv", warehouses)

# ──────────────────────────────────────────────
# 02  CARRIERS  (15)
# ──────────────────────────────────────────────
carriers = [
    {"name":"BlueDart Express","status":"active","contact_email":"ops@bluedart.com","contact_phone":"+918001234567","website":"https://www.bluedart.com","services":"standard|express|overnight","service_type":"express"},
    {"name":"Delhivery Logistics","status":"active","contact_email":"support@delhivery.com","contact_phone":"+918888888888","website":"https://www.delhivery.com","services":"standard|express|heavy_freight","service_type":"standard"},
    {"name":"Ecom Express","status":"active","contact_email":"care@ecomexpress.in","contact_phone":"+911800200555","website":"https://www.ecomexpress.in","services":"standard|express","service_type":"standard"},
    {"name":"DTDC Courier","status":"active","contact_email":"service@dtdc.com","contact_phone":"+916000555000","website":"https://www.dtdc.com","services":"standard|express|same_day","service_type":"standard"},
    {"name":"XpressBees","status":"active","contact_email":"cs@xpressbees.com","contact_phone":"+918880004444","website":"https://www.xpressbees.com","services":"standard|express","service_type":"standard"},
    {"name":"Shadowfax Technologies","status":"active","contact_email":"support@shadowfax.in","contact_phone":"+917899999999","website":"https://shadowfax.in","services":"same_day|express","service_type":"same_day"},
    {"name":"FedEx India","status":"active","contact_email":"custservice@fedex.com","contact_phone":"+911800209994","website":"https://www.fedex.com/in","services":"express|overnight|heavy_freight","service_type":"express"},
    {"name":"DHL Express India","status":"active","contact_email":"cs.in@dhl.com","contact_phone":"+912240484848","website":"https://www.dhl.com/in-en","services":"express|overnight","service_type":"express"},
    {"name":"India Post EMS","status":"active","contact_email":"pmg@indiapost.gov.in","contact_phone":"+1800112011","website":"https://www.indiapost.gov.in","services":"standard","service_type":"standard"},
    {"name":"Amazon Logistics","status":"active","contact_email":"logistics@amazon.in","contact_phone":"+911800110000","website":"https://logistics.amazon.in","services":"standard|same_day","service_type":"same_day"},
    {"name":"Rivigo Freight","status":"active","contact_email":"ops@rivigo.com","contact_phone":"+919999999001","website":"https://rivigo.com","services":"heavy_freight|standard","service_type":"heavy_freight"},
    {"name":"Gati Limited","status":"active","contact_email":"customercare@gati.com","contact_phone":"+914066700000","website":"https://www.gati.com","services":"standard|heavy_freight","service_type":"standard"},
    {"name":"Safexpress","status":"active","contact_email":"care@safexpress.com","contact_phone":"+911244015000","website":"https://safexpress.com","services":"standard|heavy_freight","service_type":"heavy_freight"},
    {"name":"Mahindra Logistics","status":"active","contact_email":"solutions@mahindralogistics.com","contact_phone":"+912261490000","website":"https://www.mahindralogistics.com","services":"heavy_freight|standard","service_type":"heavy_freight"},
    {"name":"TCI Express","status":"active","contact_email":"care@tciexpress.in","contact_phone":"+911244015100","website":"https://www.tciexpress.in","services":"standard|express","service_type":"standard"},
]
w("02_carriers.csv", carriers)

# ──────────────────────────────────────────────
# 03  SUPPLIERS  (25)
# ──────────────────────────────────────────────
suppliers = [
    {"name":"TechSource Electronics","contact_name":"Ramesh Gupta","contact_email":"ramesh@techsource.in","contact_phone":"+919812345001","website":"https://techsource.in","address":"B-44 Electronics City Phase 1","city":"Bangalore","state":"Karnataka","country":"India","postal_code":"560100","lead_time_days":7,"payment_terms":"Net 30","reliability_score":0.95},
    {"name":"FabriXcel Textiles","contact_name":"Priya Mehta","contact_email":"priya@fabrixcel.com","contact_phone":"+919812345002","website":"https://fabrixcel.com","address":"Plot 12 Jeans Hub Complex, Khatraj Rd","city":"Ahmedabad","state":"Gujarat","country":"India","postal_code":"382435","lead_time_days":14,"payment_terms":"Net 45","reliability_score":0.88},
    {"name":"Amrut Food Industries","contact_name":"Suresh Patel","contact_email":"suresh@amrutfoods.com","contact_phone":"+919812345003","website":"https://amrutfoods.com","address":"GIDC Food Park, Phase 3","city":"Anand","state":"Gujarat","country":"India","postal_code":"388001","lead_time_days":5,"payment_terms":"Net 15","reliability_score":0.92},
    {"name":"Woodcraft Furniture Co","contact_name":"Aarav Singh","contact_email":"aarav@woodcraft.in","contact_phone":"+919812345004","website":"https://woodcraft.in","address":"Furniture Park, Jodhpur Road","city":"Jodhpur","state":"Rajasthan","country":"India","postal_code":"342001","lead_time_days":21,"payment_terms":"Net 60","reliability_score":0.82},
    {"name":"HealthPlus Pharma Pvt","contact_name":"Dr. Kavya Reddy","contact_email":"kavya@healthplus.in","contact_phone":"+919812345005","website":"https://healthplus.in","address":"Pharma City, Turkapally","city":"Hyderabad","state":"Telangana","country":"India","postal_code":"500078","lead_time_days":10,"payment_terms":"Net 30","reliability_score":0.97},
    {"name":"IndusSteel Manufacturing","contact_name":"Vikram Joshi","contact_email":"vikram@indussteel.com","contact_phone":"+919812345006","website":"https://indussteel.com","address":"Industrial Area Phase 2, Peenya","city":"Bangalore","state":"Karnataka","country":"India","postal_code":"560058","lead_time_days":18,"payment_terms":"Net 45","reliability_score":0.85},
    {"name":"OfficePro Supplies","contact_name":"Neha Sharma","contact_email":"neha@officepro.in","contact_phone":"+919812345007","website":"https://officepro.in","address":"Laxmi Nagar Commercial Complex","city":"Delhi","state":"Delhi","country":"India","postal_code":"110092","lead_time_days":3,"payment_terms":"Net 15","reliability_score":0.93},
    {"name":"SportZone Gear Pvt","contact_name":"Arjun Kapoor","contact_email":"arjun@sportzone.in","contact_phone":"+919812345008","website":"https://sportzone.in","address":"Sector 7 Industrial Area, Noida","city":"Noida","state":"Uttar Pradesh","country":"India","postal_code":"201301","lead_time_days":12,"payment_terms":"Net 30","reliability_score":0.89},
    {"name":"ToyMagic Enterprises","contact_name":"Meera Iyer","contact_email":"meera@toymagic.in","contact_phone":"+919812345009","website":"https://toymagic.in","address":"Toy Park, MIDC Bhiwandi","city":"Bhiwandi","state":"Maharashtra","country":"India","postal_code":"421302","lead_time_days":15,"payment_terms":"Net 30","reliability_score":0.87},
    {"name":"AutoParts World","contact_name":"Rajan Verma","contact_email":"rajan@autopartsworld.in","contact_phone":"+919812345010","website":"https://autopartsworld.in","address":"Auto Nagar, Vivekananda Road","city":"Hyderabad","state":"Telangana","country":"India","postal_code":"500037","lead_time_days":9,"payment_terms":"Net 30","reliability_score":0.91},
    {"name":"PageTurner Books Pvt","contact_name":"Anita Bose","contact_email":"anita@pageturner.in","contact_phone":"+919812345011","website":"https://pageturner.in","address":"Book Market Lane, Gol Market","city":"Kolkata","state":"West Bengal","country":"India","postal_code":"700013","lead_time_days":6,"payment_terms":"Net 15","reliability_score":0.96},
    {"name":"BrightSpark Electronics","contact_name":"Kiran Nair","contact_email":"kiran@brightspark.in","contact_phone":"+919812345012","website":"https://brightspark.in","address":"SEZ Phase 2, Kakkanad","city":"Kochi","state":"Kerala","country":"India","postal_code":"682030","lead_time_days":8,"payment_terms":"Net 30","reliability_score":0.90},
    {"name":"SilkWeave Exports","contact_name":"Fatima Khan","contact_email":"fatima@silkweave.com","contact_phone":"+919812345013","website":"https://silkweave.com","address":"Export Hub, Surat Textile Market","city":"Surat","state":"Gujarat","country":"India","postal_code":"395002","lead_time_days":20,"payment_terms":"Net 45","reliability_score":0.84},
    {"name":"Pure Harvest Organics","contact_name":"Mohan Rao","contact_email":"mohan@pureharvest.in","contact_phone":"+919812345014","website":"https://pureharvest.in","address":"Organic Farm District, Tumkur Road","city":"Bangalore","state":"Karnataka","country":"India","postal_code":"572101","lead_time_days":4,"payment_terms":"Net 15","reliability_score":0.94},
    {"name":"MegaLift Industrial","contact_name":"Deepak Malhotra","contact_email":"deepak@megalift.in","contact_phone":"+919812345015","website":"https://megalift.in","address":"Heavy Industry Zone, Baddi","city":"Baddi","state":"Himachal Pradesh","country":"India","postal_code":"173205","lead_time_days":25,"payment_terms":"Net 60","reliability_score":0.80},
    {"name":"HomeCraft Decor","contact_name":"Sonal Trivedi","contact_email":"sonal@homecraft.in","contact_phone":"+919812345016","website":"https://homecraft.in","address":"Design District, FC Road","city":"Pune","state":"Maharashtra","country":"India","postal_code":"411004","lead_time_days":16,"payment_terms":"Net 30","reliability_score":0.86},
    {"name":"SwiftPack Packaging","contact_name":"Harsh Pandey","contact_email":"harsh@swiftpack.in","contact_phone":"+919812345017","website":"https://swiftpack.in","address":"Packaging Zone, Industrial Estate Sitapura","city":"Jaipur","state":"Rajasthan","country":"India","postal_code":"302022","lead_time_days":7,"payment_terms":"Net 30","reliability_score":0.92},
    {"name":"BioMed Supplies","contact_name":"Dr. Nandita Rao","contact_email":"nandita@biomed.in","contact_phone":"+919812345018","website":"https://biomed.in","address":"Biotech Park, Turkapally","city":"Hyderabad","state":"Telangana","country":"India","postal_code":"500078","lead_time_days":11,"payment_terms":"Net 30","reliability_score":0.98},
    {"name":"EcoGreen Plastics","contact_name":"Tarun Singh","contact_email":"tarun@ecogreen.in","contact_phone":"+919812345019","website":"https://ecogreen.in","address":"Green Industrial Hub, Vapi","city":"Vapi","state":"Gujarat","country":"India","postal_code":"396195","lead_time_days":13,"payment_terms":"Net 45","reliability_score":0.83},
    {"name":"CoolTech Refrigeration","contact_name":"Ganesh Kumar","contact_email":"ganesh@cooltech.in","contact_phone":"+919812345020","website":"https://cooltech.in","address":"Cold Chain Park, Hosur Road","city":"Bangalore","state":"Karnataka","country":"India","postal_code":"560099","lead_time_days":22,"payment_terms":"Net 60","reliability_score":0.79},
    {"name":"PrintMaster Solutions","contact_name":"Alok Bajaj","contact_email":"alok@printmaster.in","contact_phone":"+919812345021","website":"https://printmaster.in","address":"Print Colony, Okhla Phase 1","city":"Delhi","state":"Delhi","country":"India","postal_code":"110020","lead_time_days":5,"payment_terms":"Net 15","reliability_score":0.93},
    {"name":"ChemSafe Industries","contact_name":"Pooja Desai","contact_email":"pooja@chemsafe.in","contact_phone":"+919812345022","website":"https://chemsafe.in","address":"Chemical Zone, MIDC Tarapur","city":"Boisar","state":"Maharashtra","country":"India","postal_code":"401501","lead_time_days":17,"payment_terms":"Net 45","reliability_score":0.88},
    {"name":"GoldenHarvest Grains","contact_name":"Baldev Singh","contact_email":"baldev@goldenharvest.in","contact_phone":"+919812345023","website":"https://goldenharvest.in","address":"Grain Mandi, Khanna","city":"Khanna","state":"Punjab","country":"India","postal_code":"141401","lead_time_days":6,"payment_terms":"Net 15","reliability_score":0.91},
    {"name":"TerraFirm Construction","contact_name":"Rajiv Negi","contact_email":"rajiv@terrafirm.in","contact_phone":"+919812345024","website":"https://terrafirm.in","address":"Construction Materials Hub, IMT Manesar","city":"Gurugram","state":"Haryana","country":"India","postal_code":"122051","lead_time_days":30,"payment_terms":"Net 60","reliability_score":0.78},
    {"name":"FineTune Audio","contact_name":"Siddharth Rao","contact_email":"siddharth@finetune.in","contact_phone":"+919812345025","website":"https://finetune.in","address":"Electronics Park, T T Nagar","city":"Bhopal","state":"Madhya Pradesh","country":"India","postal_code":"462003","lead_time_days":10,"payment_terms":"Net 30","reliability_score":0.87},
]
w("03_suppliers.csv", suppliers)

# ──────────────────────────────────────────────
# 04  SALES CHANNELS  (15)
# ──────────────────────────────────────────────
channels = [
    {"name":"Croma Website D2C","platform_type":"d2c","api_endpoint":"https://api.croma.com/orders","contact_name":"Pradeep Nair","contact_email":"pradeep.nair@croma.com","contact_phone":"+919000001001","default_warehouse_id":""},
    {"name":"Croma App — iOS & Android","platform_type":"d2c","api_endpoint":"https://app-api.croma.com/orders","contact_name":"Smita Kulkarni","contact_email":"smita.kulkarni@croma.com","contact_phone":"+919000001002","default_warehouse_id":""},
    {"name":"Flipkart Marketplace","platform_type":"b2b","api_endpoint":"https://seller.flipkart.com/api","contact_name":"Flipkart Key Account","contact_email":"ka.flipkart@croma.com","contact_phone":"+919000001003","default_warehouse_id":""},
    {"name":"Amazon Seller Central","platform_type":"b2b","api_endpoint":"https://sellercentral.amazon.in/api","contact_name":"Amazon Key Account","contact_email":"ka.amazon@croma.com","contact_phone":"+919000001004","default_warehouse_id":""},
    {"name":"Meesho Wholesale","platform_type":"wholesale","api_endpoint":"","contact_name":"Ayesha Bhat","contact_email":"ayesha.bhat@croma.com","contact_phone":"+919000001005","default_warehouse_id":""},
    {"name":"Reliance Retail B2B","platform_type":"b2b","api_endpoint":"","contact_name":"Corporate Sales Team","contact_email":"b2b.reliance@croma.com","contact_phone":"+919000001006","default_warehouse_id":""},
    {"name":"Snapdeal Store","platform_type":"b2b","api_endpoint":"https://seller.snapdeal.com/api","contact_name":"Snapdeal KAM","contact_email":"ka.snapdeal@croma.com","contact_phone":"+919000001007","default_warehouse_id":""},
    {"name":"Myntra Fashion Channel","platform_type":"b2b","api_endpoint":"https://myntra-api.croma.com","contact_name":"Anisha Kapoor","contact_email":"myntra@croma.com","contact_phone":"+919000001008","default_warehouse_id":""},
    {"name":"BigBasket FMCG","platform_type":"wholesale","api_endpoint":"","contact_name":"FMCG Team","contact_email":"fmcg@croma.com","contact_phone":"+919000001009","default_warehouse_id":""},
    {"name":"Jiomart Partners","platform_type":"b2b","api_endpoint":"https://jiomart-b2b.croma.com","contact_name":"Jio Team","contact_email":"jiomart@croma.com","contact_phone":"+919000001010","default_warehouse_id":""},
    {"name":"Croma Corporate Sales","platform_type":"b2b","api_endpoint":"","contact_name":"Corporate Team","contact_email":"corporate@croma.com","contact_phone":"+919000001011","default_warehouse_id":""},
    {"name":"Distributor Network — West","platform_type":"wholesale","api_endpoint":"","contact_name":"West Dist Manager","contact_email":"dist.west@croma.com","contact_phone":"+919000001012","default_warehouse_id":""},
    {"name":"Distributor Network — East","platform_type":"wholesale","api_endpoint":"","contact_name":"East Dist Manager","contact_email":"dist.east@croma.com","contact_phone":"+919000001013","default_warehouse_id":""},
    {"name":"Retail Store Replenishment","platform_type":"internal","api_endpoint":"","contact_name":"Store Ops Team","contact_email":"store.ops@croma.com","contact_phone":"+919000001014","default_warehouse_id":""},
    {"name":"Internal Transfers","platform_type":"internal","api_endpoint":"","contact_name":"Logistics Ops","contact_email":"internal@croma.com","contact_phone":"+919000001015","default_warehouse_id":""},
]
w("04_sales_channels.csv", channels)

# ──────────────────────────────────────────────
# 05  TEAM MEMBERS  (15)
# ──────────────────────────────────────────────
team = [
    {"name":"Aditya Sharma","email":"aditya.sharma@croma.com","phone":"+919100001001","role":"operations_manager"},
    {"name":"Pooja Iyer","email":"pooja.iyer@croma.com","phone":"+919100001002","role":"warehouse_manager"},
    {"name":"Rahul Mehta","email":"rahul.mehta@croma.com","phone":"+919100001003","role":"finance"},
    {"name":"Divya Singh","email":"divya.singh@croma.com","phone":"+919100001004","role":"operations_manager"},
    {"name":"Manish Patel","email":"manish.patel@croma.com","phone":"+919100001005","role":"warehouse_manager"},
    {"name":"Sneha Gupta","email":"sneha.gupta@croma.com","phone":"+919100001006","role":"customer_support"},
    {"name":"Karthik Nair","email":"karthik.nair@croma.com","phone":"+919100001007","role":"carrier_partner"},
    {"name":"Ananya Reddy","email":"ananya.reddy@croma.com","phone":"+919100001008","role":"operations_manager"},
    {"name":"Saurabh Joshi","email":"saurabh.joshi@croma.com","phone":"+919100001009","role":"finance"},
    {"name":"Lakshmi Balan","email":"lakshmi.balan@croma.com","phone":"+919100001010","role":"warehouse_manager"},
    {"name":"Varun Kapoor","email":"varun.kapoor@croma.com","phone":"+919100001011","role":"customer_support"},
    {"name":"Nina Desai","email":"nina.desai@croma.com","phone":"+919100001012","role":"carrier_partner"},
    {"name":"Rohan Tiwari","email":"rohan.tiwari@croma.com","phone":"+919100001013","role":"operations_manager"},
    {"name":"Prachi Rao","email":"prachi.rao@croma.com","phone":"+919100001014","role":"customer_support"},
    {"name":"Sumit Banerjee","email":"sumit.banerjee@croma.com","phone":"+919100001015","role":"warehouse_manager"},
]
w("05_team_members.csv", team)

# ──────────────────────────────────────────────
# 06  PRODUCTS  (100)
# ──────────────────────────────────────────────
products_data = [
    # Electronics (20)
    ("Samsung 55\" 4K Smart TV", "ELEC-TV-001", "Electronics", "Samsung", 54990, 42000, 18.5, "INR"),
    ("LG 1.5 Ton 5-Star Inverter AC", "ELEC-AC-002", "Electronics", "LG", 45999, 34000, 36.0, "INR"),
    ("Sony WH-1000XM5 Headphones", "ELEC-HP-003", "Electronics", "Sony", 29990, 18000, 0.25, "INR"),
    ("Apple iPad Air 11\" WiFi 128GB", "ELEC-TAB-004", "Electronics", "Apple", 59900, 45000, 0.46, "INR"),
    ("Bosch 7kg Front Load Washing Machine", "ELEC-WM-005", "Electronics", "Bosch", 39999, 28000, 70.0, "INR"),
    ("HP Pavilion i5 Gaming Laptop", "ELEC-LT-006", "Electronics", "HP", 74999, 55000, 2.1, "INR"),
    ("Samsung Galaxy S24 128GB", "ELEC-PH-007", "Electronics", "Samsung", 64999, 48000, 0.17, "INR"),
    ("Whirlpool 340L Double Door Fridge", "ELEC-RF-008", "Electronics", "Whirlpool", 34999, 24000, 68.0, "INR"),
    ("Philips Air Purifier AC2887", "ELEC-AP-009", "Electronics", "Philips", 12999, 8500, 3.8, "INR"),
    ("Godrej 1.5 Ton Window AC", "ELEC-WAC-010", "Electronics", "Godrej", 29999, 20000, 30.0, "INR"),
    ('Dell 27" QHD Monitor S2722DC', "ELEC-MON-011", "Electronics", "Dell", 22999, 16000, 4.5, "INR"),
    ("JBL Charge 5 Bluetooth Speaker", "ELEC-SPK-012", "Electronics", "JBL", 14999, 9500, 0.96, "INR"),
    ("Panasonic 5.1 Home Theatre", "ELEC-HT-013", "Electronics", "Panasonic", 18999, 12000, 12.0, "INR"),
    ("Canon EOS R50 Mirrorless Camera", "ELEC-CAM-014", "Electronics", "Canon", 69990, 52000, 0.39, "INR"),
    ("Xiaomi Mi Robot Vacuum S10+", "ELEC-VAC-015", "Electronics", "Xiaomi", 21999, 14000, 3.8, "INR"),
    ("Haier 99L Personal Fridge", "ELEC-MF-016", "Electronics", "Haier", 10999, 7000, 22.0, "INR"),
    ("Toshiba 8kg Top Load Washer", "ELEC-WM-017", "Electronics", "Toshiba", 28999, 20000, 45.0, "INR"),
    ("Nest Hub Max Smart Display", "ELEC-SDH-018", "Electronics", "Google", 19999, 13000, 1.19, "INR"),
    ("Realme Narzo 70 Pro 5G", "ELEC-PH-019", "Electronics", "Realme", 22999, 15000, 0.21, "INR"),
    ("iRobot Roomba i3 Robot Cleaner", "ELEC-RC-020", "Electronics", "iRobot", 34999, 25000, 3.5, "INR"),
    # Clothing (15)
    ("Men's Slim Fit Chinos 32x30", "CLTH-MC-001", "Clothing", "Levis", 2499, 900, 0.4, "INR"),
    ("Women's Floral Kurta Set", "CLTH-WK-002", "Clothing", "W", 1799, 650, 0.35, "INR"),
    ("Kids Unisex Hoodie 8-9Y", "CLTH-KH-003", "Clothing", "H&M", 999, 350, 0.28, "INR"),
    ("Men's Formal Shirt White L", "CLTH-MS-004", "Clothing", "Van Heusen", 1499, 550, 0.3, "INR"),
    ("Women's Sports Leggings M", "CLTH-WL-005", "Clothing", "Adidas", 2299, 900, 0.25, "INR"),
    ("Men's Printed Round-Neck Tee XL", "CLTH-MT-006", "Clothing", "US Polo", 799, 250, 0.22, "INR"),
    ("Girls Embroidered Salwar Set 10Y", "CLTH-GS-007", "Clothing", "FabIndia", 1299, 500, 0.38, "INR"),
    ("Men's Denim Jacket 40", "CLTH-MJ-008", "Clothing", "Pepe Jeans", 3499, 1400, 0.65, "INR"),
    ("Women's Silk Saree", "CLTH-SS-009", "Clothing", "FabIndia", 4999, 2200, 0.8, "INR"),
    ("Men's Track Suit M", "CLTH-TS-010", "Clothing", "Puma", 2999, 1100, 0.55, "INR"),
    ("Women's Formal Blazer 38", "CLTH-BZ-011", "Clothing", "Allen Solly", 3999, 1700, 0.6, "INR"),
    ("Infant Romper Set 0-3M", "CLTH-IR-012", "Clothing", "FirstCry", 599, 200, 0.15, "INR"),
    ("Men's Woolen Sweater L", "CLTH-SW-013", "Clothing", "Monte Carlo", 1799, 700, 0.5, "INR"),
    ("Women's Casual Sneakers 7", "CLTH-CS-014", "Clothing", "Bata", 1499, 600, 0.55, "INR"),
    ("Men's Leather Belt 36", "CLTH-MB-015", "Clothing", "Woodland", 899, 300, 0.18, "INR"),
    # Food & Beverage (10)
    ("Tata Tea Premium 1kg", "FOOD-TEA-001", "Food & Beverage", "Tata", 349, 200, 1.05, "INR"),
    ("Amul Butter 500g (Pack of 4)", "FOOD-BTR-002", "Food & Beverage", "Amul", 499, 320, 2.0, "INR"),
    ("Quaker Oats Jumbo 2kg", "FOOD-OAT-003", "Food & Beverage", "Quaker", 599, 380, 2.1, "INR"),
    ("Nescafe Classic Coffee 200g", "FOOD-COF-004", "Food & Beverage", "Nestle", 499, 300, 0.22, "INR"),
    ("Basmati Rice Heritage 5kg", "FOOD-RIC-005", "Food & Beverage", "India Gate", 799, 550, 5.1, "INR"),
    ("Cold Pressed Coconut Oil 1L", "FOOD-OIL-006", "Food & Beverage", "Parachute", 449, 280, 1.1, "INR"),
    ("Protein Powder Whey Vanilla 1kg", "FOOD-PWD-007", "Food & Beverage", "Optimum Nutrition", 2999, 1800, 1.15, "INR"),
    ("Honey Raw Organic 500g", "FOOD-HON-008", "Food & Beverage", "Dabur", 449, 280, 0.55, "INR"),
    ("Energy Drink 4-Pack 250ml", "FOOD-ENG-009", "Food & Beverage", "Red Bull", 499, 280, 1.0, "INR"),
    ("Dark Chocolate 70% 200g", "FOOD-CHC-010", "Food & Beverage", "Lindt", 649, 400, 0.22, "INR"),
    # Furniture (8)
    ("Ergonomic Office Chair Lumbar", "FURN-CH-001", "Furniture", "Green Soul", 14999, 8000, 18.0, "INR"),
    ("6-Seater Dining Table Oak", "FURN-DT-002", "Furniture", "Godrej Interio", 39999, 22000, 90.0, "INR"),
    ("King-Size Platform Bed with Storage", "FURN-BD-003", "Furniture", "Pepperfry", 29999, 16000, 120.0, "INR"),
    ("3-Seater Fabric Sofa Grey", "FURN-SF-004", "Furniture", "Urban Ladder", 24999, 13000, 75.0, "INR"),
    ("Bookshelf 5-Tier White", "FURN-BS-005", "Furniture", "IKEA", 4999, 2500, 22.0, "INR"),
    ("L-Shape Corner Desk 160cm", "FURN-DS-006", "Furniture", "Durian", 18999, 10000, 55.0, "INR"),
    ("Wardrobe 3-Door Mirror Finish", "FURN-WD-007", "Furniture", "Spacewood", 22999, 12000, 85.0, "INR"),
    ("Bedside Table with Drawer Pair", "FURN-NW-008", "Furniture", "HomeTown", 5999, 3000, 12.0, "INR"),
    # Health & Beauty (10)
    ("Dove Deep Moisture Body Lotion 400ml", "HB-LT-001", "Health & Beauty", "Dove", 399, 210, 0.42, "INR"),
    ("Lakme 9to5 Foundation 30ml", "HB-FN-002", "Health & Beauty", "Lakme", 699, 380, 0.05, "INR"),
    ("Neutrogena Hydro Boost Face Gel 50g", "HB-FC-003", "Health & Beauty", "Neutrogena", 1099, 600, 0.06, "INR"),
    ("Himalaya Neem Foaming Face Wash 150ml", "HB-FW-004", "Health & Beauty", "Himalaya", 249, 120, 0.16, "INR"),
    ("Oral-B iO Series 5 Electric Toothbrush", "HB-TB-005", "Health & Beauty", "Oral-B", 4999, 2800, 0.34, "INR"),
    ("Gillette Fusion ProGlide Razor", "HBBR-006", "Health & Beauty", "Gillette", 799, 430, 0.12, "INR"),
    ("Lakme Eyeconic Kajal", "HB-KJ-007", "Health & Beauty", "Lakme", 349, 160, 0.03, "INR"),
    ("Sunscreen SPF 50+ PA+++ 60g", "HB-SS-008", "Health & Beauty", "Lotus", 499, 270, 0.065, "INR"),
    ("Vitamin C Serum 30ml", "HB-SR-009", "Health & Beauty", "Minimalist", 799, 400, 0.04, "INR"),
    ("Hair Dryer 2000W Professional", "HB-HD-010", "Health & Beauty", "Philips", 2499, 1400, 0.55, "INR"),
    # Office Supplies (8)
    ("A4 Paper Ream 500 Sheets 75gsm", "OFF-PP-001", "Office Supplies", "JK Copier", 499, 300, 2.5, "INR"),
    ("Stapler Heavy Duty 70-Sheet", "OFF-ST-002", "Office Supplies", "Kangaro", 799, 450, 0.38, "INR"),
    ("Whiteboard 4x3 ft Magnetic", "OFF-WB-003", "Office Supplies", "Bi-Silque", 3499, 1800, 4.2, "INR"),
    ("Gel Pen Blue Box 12", "OFF-PB-004", "Office Supplies", "Reynolds", 149, 60, 0.12, "INR"),
    ("Sticky Notes 3x3 100-Sheet 12-Pack", "OFF-SN-005", "Office Supplies", "3M Post-it", 599, 320, 0.4, "INR"),
    ("Lever Arch File A4 Pack of 6", "OFF-LF-006", "Office Supplies", "Camlin", 699, 380, 0.6, "INR"),
    ("Desk Organiser 5-Section", "OFF-DO-007", "Office Supplies", "Deli", 999, 550, 0.45, "INR"),
    ("Calculator Scientific FX-991EX", "OFF-CL-008", "Office Supplies", "Casio", 1499, 900, 0.14, "INR"),
    # Sports & Outdoors (8)
    ("Yoga Mat Anti-Slip 6mm TPE", "SPT-YM-001", "Sports & Outdoors", "Decathlon", 1499, 700, 1.0, "INR"),
    ("Dumbbell Pair 5kg Rubber Coated", "SPT-DB-002", "Sports & Outdoors", "Decathlon", 1299, 600, 10.1, "INR"),
    ("Badminton Racket Carbon Fiber", "SPT-BR-003", "Sports & Outdoors", "Yonex", 3499, 1800, 0.09, "INR"),
    ("Cycle Helmet Adult Adjustable", "SPT-CH-004", "Sports & Outdoors", "Trek", 2999, 1400, 0.38, "INR"),
    ("Swimming Goggles UV Protection", "SPT-SG-005", "Sports & Outdoors", "Speedo", 1099, 550, 0.05, "INR"),
    ("Running Shoes Men 42", "SPT-RS-006", "Sports & Outdoors", "Asics", 6999, 3800, 0.65, "INR"),
    ("Skipping Rope Adjustable Steel", "SPT-SR-007", "Sports & Outdoors", "Strauss", 499, 220, 0.22, "INR"),
    ("Water Bottle Insulated 750ml", "SPT-WB-008", "Sports & Outdoors", "Cirkul", 1299, 650, 0.3, "INR"),
    # Automotive (6)
    ("Car Dash Camera 4K Sony Sensor", "AUTO-DC-001", "Automotive", "70mai", 8999, 5500, 0.28, "INR"),
    ("Car Vacuum Cleaner 120W", "AUTO-VC-002", "Automotive", "Black & Decker", 3499, 1800, 0.95, "INR"),
    ("Tyre Pressure Gauge Digital", "AUTO-TG-003", "Automotive", "Bosch", 1299, 700, 0.18, "INR"),
    ("Seat Organiser Back Pocket Set", "AUTO-SO-004", "Automotive", "AmazonBasics", 899, 450, 0.5, "INR"),
    ("Car Wax Polish Kit 500ml", "AUTO-WX-005", "Automotive", "3M", 1499, 800, 0.55, "INR"),
    ("Phone Mount Dashboard Universal", "AUTO-PM-006", "Automotive", "Aukey", 799, 380, 0.12, "INR"),
    # Books & Media (5)
    ("Atomic Habits – James Clear", "BOOK-AH-001", "Books & Media", "Penguin", 599, 320, 0.33, "INR"),
    ("Rich Dad Poor Dad – Robert Kiyosaki", "BOOK-RD-002", "Books & Media", "Plata", 449, 240, 0.29, "INR"),
    ("Python Crash Course 3rd Ed", "BOOK-PY-003", "Books & Media", "No Starch Press", 1999, 1100, 0.65, "INR"),
    ("Harry Potter Boxset 7 Books", "BOOK-HP-004", "Books & Media", "Bloomsbury", 3499, 2000, 3.5, "INR"),
    ("Design of Everyday Things", "BOOK-DE-005", "Books & Media", "Basic Books", 899, 500, 0.38, "INR"),
    # Other (10)
    ("Stainless Steel Lunch Box 3 Tier", "OTH-LB-001", "Other", "Milton", 999, 520, 0.75, "INR"),
    ("Scented Candle Set Lavender 3-Pack", "OTH-SC-002", "Other", "Ikea", 799, 380, 0.45, "INR"),
    ("Bluetooth Tracker Tag 4-Pack", "OTH-BT-003", "Other", "Apple AirTag", 9999, 6500, 0.11, "INR"),
    ("Umbrella Auto-Open XL", "OTH-UM-004", "Other", "Stormking", 999, 480, 0.55, "INR"),
    ("Rain Poncho Reusable Adult", "OTH-RP-005", "Other", "Decathlon", 599, 280, 0.12, "INR"),
    ("Pet Feeder Automatic 4L", "OTH-PF-006", "Other", "PetSafe", 3999, 2200, 1.8, "INR"),
    ("Wall Clock Minimalist 30cm", "OTH-WC-007", "Other", "Ticking Classics", 1299, 650, 0.8, "INR"),
    ("Extension Cord 6-Socket 2m", "OTH-EX-008", "Other", "Wipro", 899, 450, 0.38, "INR"),
    ("Reusable Grocery Bag Set 5", "OTH-GB-009", "Other", "EcoHold", 449, 200, 0.3, "INR"),
    ("Gift Wrap Kit Ribbon and Tags", "OTH-GW-010", "Other", "Hallmark", 299, 130, 0.25, "INR"),
]

products_rows = [
    {
        "name": name, "sku": sku, "category": cat, "brand": brand,
        "selling_price": sp, "cost_price": cp, "weight": wt,
        "currency": cur, "is_active": "true"
    }
    for name, sku, cat, brand, sp, cp, wt, cur in products_data
]
w("06_products.csv", products_rows)

# ──────────────────────────────────────────────
# 07  INVENTORY  (100 rows — 10 warehouses × 10 products each, spread across all 100 SKUs)
# NOTE: warehouse_id must be replaced with real UUID after importing warehouses.
#       Get IDs from DB: SELECT id, code FROM warehouses ORDER BY code;
#       Replace WH-DEL-01, WH-MUM-01, etc. with the corresponding UUIDs.
# ──────────────────────────────────────────────
wh_codes = [
    "WH-DEL-01","WH-MUM-01","WH-BLR-01","WH-CHE-01","WH-HYD-01",
    "WH-PNQ-01","WH-CCU-01","WH-AMD-01","WH-JAI-01","WH-COK-01",
]
inv_rows = []
random.seed(42)
chunks = [products_data[i:i+10] for i in range(0, 100, 10)]
for wh_idx, chunk in enumerate(chunks):
    wh_code = wh_codes[wh_idx]
    for name, sku, cat, brand, sp, cp, wt, cur in chunk:
        qty       = random.randint(20, 500)
        reserved  = random.randint(0, max(1, qty // 10))
        available = qty - reserved
        reorder   = random.randint(10, 50)
        inv_rows.append({
            "product_id": "",
            "sku": sku,
            "product_name": name,
            "warehouse_id": f"REPLACE_WITH_UUID_FOR_{wh_code}",
            "quantity": qty,
            "available_quantity": available,
            "reserved_quantity": reserved,
            "reorder_point": reorder,
            "unit_cost": cp,
        })
w("07_inventory.csv", inv_rows)

# ──────────────────────────────────────────────
# 08  ORDERS  (100 orders, 1 item each)
# ──────────────────────────────────────────────
first_names = ["Rahul","Priya","Amit","Sunita","Rohit","Kavya","Arun","Divya","Nikhil","Meera","Sandeep","Pooja","Vijay","Nisha","Rajesh"]
last_names  = ["Sharma","Verma","Patel","Singh","Kumar","Gupta","Joshi","Nair","Reddy","Mehta","Shah","Rao","Das","Misra","Tiwari"]
cities_states = [
    ("Mumbai","Maharashtra","400001"),("Delhi","Delhi","110001"),("Bangalore","Karnataka","560001"),
    ("Chennai","Tamil Nadu","600001"),("Hyderabad","Telangana","500001"),("Pune","Maharashtra","411001"),
    ("Kolkata","West Bengal","700001"),("Ahmedabad","Gujarat","380001"),("Jaipur","Rajasthan","302001"),
    ("Kochi","Kerala","682001"),("Lucknow","Uttar Pradesh","226001"),("Surat","Gujarat","395001"),
    ("Nagpur","Maharashtra","440001"),("Patna","Bihar","800001"),("Indore","Madhya Pradesh","452001"),
]
priorities = ["standard","standard","standard","express","express","urgent"]
order_rows = []
random.seed(99)
for i in range(100):
    fn, ln = random.choice(first_names), random.choice(last_names)
    city, state, pin = random.choice(cities_states)
    name, sku, cat, brand, sp, cp, wt, cur = random.choice(products_data)
    qty = random.randint(1, 5)
    order_number = f"IMP-ORD-{i + 1:05d}"
    order_rows.append({
        "order_number": order_number,
        "customer_name": f"{fn} {ln}",
        "customer_email": f"{fn.lower()}.{ln.lower()}{i+1}@email.com",
        "customer_phone": f"+91{random.randint(7000000000, 9999999999)}",
        "priority": random.choice(priorities),
        "street": f"{random.randint(1,200)}, {random.choice(['MG Road','SV Road','NH-48','Ring Road','Civil Lines','Camp Area','Banjara Hills','Whitefield','Salt Lake','Koramangala'])}",
        "city": city,
        "state": state,
        "postal_code": pin,
        "country": "India",
        "sku": sku,
        "product_name": name,
        "quantity": qty,
        "unit_price": sp,
    })
w("08_orders.csv", order_rows)

# ──────────────────────────────────────────────
# 09  SHIPMENTS  (100 shipments linked to 08_orders.csv by order_number)
# ──────────────────────────────────────────────
shipment_statuses = [
    "delivered", "delivered", "delivered", "delivered", "delivered",
    "out_for_delivery", "in_transit", "picked_up", "returned", "exception",
]
shipment_rows = []
random.seed(123)
for i, order in enumerate(order_rows):
    warehouse = random.choice(warehouses)
    carrier = random.choice(carriers)
    status = random.choice(shipment_statuses)
    created_offset_days = random.randint(5, 45)
    pickup_dt = datetime.datetime.now() - datetime.timedelta(days=created_offset_days - 1)
    delivery_scheduled_dt = pickup_dt + datetime.timedelta(days=random.randint(1, 6))
    if status == "delivered":
        delivery_actual_dt = delivery_scheduled_dt + datetime.timedelta(hours=random.randint(-8, 12))
    elif status in {"returned", "exception"}:
        delivery_actual_dt = pickup_dt + datetime.timedelta(days=random.randint(2, 5))
    else:
        delivery_actual_dt = ""

    if status in {"out_for_delivery", "delivered"}:
        current_city = order["city"]
        current_state = order["state"]
    else:
        current_city, current_state, _ = random.choice(cities_states)

    shipment_rows.append({
        "order_number": order["order_number"],
        "tracking_number": f"TRK-IMP-{i + 1:05d}",
        "carrier_name": carrier["name"],
        "warehouse_code": warehouse["code"],
        "status": status,
        "origin_street": warehouse["street"],
        "origin_city": warehouse["city"],
        "origin_state": warehouse["state"],
        "origin_postal_code": warehouse["postal_code"],
        "origin_country": warehouse["country"],
        "current_city": current_city,
        "current_state": current_state,
        "current_country": "India",
        "pickup_actual": pickup_dt.replace(microsecond=0).isoformat(),
        "delivery_scheduled": delivery_scheduled_dt.replace(microsecond=0).isoformat(),
        "delivery_actual": delivery_actual_dt.replace(microsecond=0).isoformat() if delivery_actual_dt else "",
        "shipping_cost": round(random.uniform(120, 2200), 2),
        "notes": f"Historical shipment import for {order['order_number']}",
    })
w("09_shipments.csv", shipment_rows)

print("\nAll CSV files generated in:", OUT)
print("\nIMPORT ORDER:")
print("  1. 01_warehouses.csv  — no deps")
print("  2. 02_carriers.csv    — no deps")
print("  3. 03_suppliers.csv   — no deps")
print("  4. 04_sales_channels.csv — leave default_warehouse_id blank or fill after step 1")
print("  5. 05_team_members.csv — no deps")
print("  6. 06_products.csv    — no deps")
print("  7. 07_inventory.csv   — warehouse placeholders auto-resolve by warehouse code")
print("  8. 08_orders.csv      — depends on products existing (SKU must match)")
print("  9. 09_shipments.csv   — depends on carriers + warehouses + orders; links by order_number")
