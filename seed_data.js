/**
 * ============================================================
 * SHREE SAMARTH MEDICAL — Comprehensive Indian Mock Data Seeder
 * ============================================================
 * Seeds: ~560 medicines, 12 suppliers, 60 customers, 30 doctors,
 *        purchase history, and invoice/billing history.
 * Run: node seed_data.js
 * ============================================================
 */

const path = require('path');
const Database = require('better-sqlite3');
const { encrypt } = require('./server/encryption');

const DB_PATH = path.join(__dirname, 'data', 'pharmacy.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('🌱 Starting Shree Samarth Medical Data Seeder...\n');

// ── HELPERS ───────────────────────────────────────────────────────────────────
function randomOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max, dec = 2) { return parseFloat((Math.random() * (max - min) + min).toFixed(dec)); }
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
function subMonths(date, months) { return addMonths(date, -months); }
const TODAY = new Date().toISOString().slice(0, 10);
const batchCounter = { n: 1000 };
function nextBatch(prefix = 'BT') { return `${prefix}${batchCounter.n++}`; }

// ── CLEAR EXISTING DATA ───────────────────────────────────────────────────────
console.log('🗑️  Clearing existing data...');
db.exec(`
  DELETE FROM invoice_h1_details;
  DELETE FROM invoice_items;
  DELETE FROM invoices;
  DELETE FROM purchase_items;
  DELETE FROM purchases;
  DELETE FROM batches;
  DELETE FROM medicines;
  DELETE FROM customers;
  DELETE FROM doctors;
  DELETE FROM supplier_payments;
  DELETE FROM suppliers;
`);
console.log('✅ Existing data cleared.\n');

// ══════════════════════════════════════════════════════════════════════════════
// 1. SUPPLIERS
// ══════════════════════════════════════════════════════════════════════════════
const supplierRows = [
  { name: 'Sun Pharma Distributor, Mumbai',     phone: '9820111001', email: 'sun@distributor.in',      address: 'Lower Parel, Mumbai, Maharashtra', gst_number: '27AABCS1234A1Z5', dl_number: 'MH-DL-00112' },
  { name: 'Cipla Medpro, Pune',                  phone: '9422201234', email: 'cipla@medpro.in',         address: 'Kothrud, Pune, Maharashtra',       gst_number: '27AAACC5678B1Z9', dl_number: 'MH-DL-00298' },
  { name: 'Dr. Reddy\'s Agency, Hyderabad',      phone: '9848011122', email: 'drreddy@agency.in',       address: 'Ameerpet, Hyderabad, Telangana',   gst_number: '36AAACR7890C1Z2', dl_number: 'TS-DL-00455' },
  { name: 'Lupin Sales, Ahmedabad',              phone: '9712345678', email: 'lupin@sales.in',          address: 'Navrangpura, Ahmedabad, Gujarat',  gst_number: '24AAACL4567D1Z8', dl_number: 'GJ-DL-00312' },
  { name: 'Torrent Pharma Depot, Vadodara',      phone: '9898754321', email: 'torrent@depot.in',        address: 'Alkapuri, Vadodara, Gujarat',      gst_number: '24AAACT1122E1Z3', dl_number: 'GJ-DL-00421' },
  { name: 'Alkem Medical, Patna',                phone: '9431012345', email: 'alkem@medical.in',        address: 'Boring Road, Patna, Bihar',        gst_number: '10AAACA3344F1Z7', dl_number: 'BR-DL-00201' },
  { name: 'Mankind Pharma, New Delhi',           phone: '9811234567', email: 'mankind@pharma.in',       address: 'Connaught Place, New Delhi',       gst_number: '07AAACM5566G1Z4', dl_number: 'DL-DL-00789' },
  { name: 'Abbott Healthcare, Chennai',          phone: '9444501234', email: 'abbott@hcare.in',         address: 'Anna Nagar, Chennai, Tamil Nadu',  gst_number: '33AAACA7788H1Z6', dl_number: 'TN-DL-00654' },
  { name: 'Intas Pharmaceuticals, Surat',        phone: '9825123456', email: 'intas@pharma.in',         address: 'Athwa Lines, Surat, Gujarat',      gst_number: '24AAACI9900I1Z1', dl_number: 'GJ-DL-00567' },
  { name: 'Glenmark Medical Agency, Nashik',     phone: '9423401234', email: 'glenmark@agency.in',      address: 'Gangapur Road, Nashik, Maharashtra', gst_number: '27AAACG2211J1Z0', dl_number: 'MH-DL-00678' },
  { name: 'Zydus Cadila Depot, Anand',           phone: '9978123456', email: 'zydus@depot.in',          address: 'Vallabh Vidyanagar, Anand, Gujarat', gst_number: '24AAACZ3322K1Z8', dl_number: 'GJ-DL-00234' },
  { name: 'Himalaya Drugs, Bengaluru',           phone: '9845012345', email: 'himalaya@drugs.in',       address: 'Rajajinagar, Bengaluru, Karnataka', gst_number: '29AAACH4433L1Z5', dl_number: 'KA-DL-00345' },
];
const insSupplier = db.prepare('INSERT INTO suppliers (name, phone, email, address, gst_number, dl_number) VALUES (?, ?, ?, ?, ?, ?)');
const suppliers = supplierRows.map(s => {
  const r = insSupplier.run(s.name, s.phone, s.email, s.address, s.gst_number, s.dl_number);
  return { id: r.lastInsertRowid, ...s };
});
console.log(`✅ ${suppliers.length} Suppliers inserted.`);

// ══════════════════════════════════════════════════════════════════════════════
// 2. DOCTORS
// ══════════════════════════════════════════════════════════════════════════════
const doctorRows = [
  { name: 'Rajesh Kumar Sharma',      hospital: 'City General Hospital',          phone: '9820001111', address: 'Civil Lines, Nagpur', specialization: 'General Physician' },
  { name: 'Priya Mehta',              hospital: 'Apex Multispecialty Clinic',      phone: '9821002222', address: 'Shivaji Nagar, Pune', specialization: 'Gynecologist' },
  { name: 'Suresh Babu Patel',        hospital: 'Heart Care Institute',            phone: '9822003333', address: 'Banjara Hills, Hyderabad', specialization: 'Cardiologist' },
  { name: 'Anita Desai',              hospital: 'Sunshine Children Hospital',      phone: '9823004444', address: 'FC Road, Pune', specialization: 'Pediatrician' },
  { name: 'Mohammed Irfan Khan',      hospital: 'Al-Shifa Medical Centre',         phone: '9824005555', address: 'Malegaon, Nashik', specialization: 'Orthopedician' },
  { name: 'Kavitha Nair',             hospital: 'Amrita Institute of Medical Sciences', phone: '9825006666', address: 'Kochi, Kerala', specialization: 'Neurologist' },
  { name: 'Deepak Joshi',             hospital: 'Lilavati Hospital',               phone: '9826007777', address: 'Bandra, Mumbai', specialization: 'Gastroenterologist' },
  { name: 'Swati Kulkarni',           hospital: 'Ruby Hall Clinic',                phone: '9827008888', address: 'Wanowrie, Pune', specialization: 'Dermatologist' },
  { name: 'Arjun Singh Rawat',        hospital: 'AIIMS Delhi',                     phone: '9828009999', address: 'Ansari Nagar, Delhi', specialization: 'General Surgeon' },
  { name: 'Lakshmi Narayan',          hospital: 'JSS Hospital',                    phone: '9829010001', address: 'Mysuru, Karnataka', specialization: 'Endocrinologist' },
  { name: 'Vikram Chandra',           hospital: 'Fortis Hospital',                 phone: '9830011112', address: 'Mulund, Mumbai', specialization: 'Pulmonologist' },
  { name: 'Radhika Iyer',             hospital: 'Kovai Medical Center',            phone: '9831012223', address: 'Coimbatore, Tamil Nadu', specialization: 'Ophthalmologist' },
  { name: 'Nikhil Gaikwad',           hospital: 'Sassoon General Hospital',        phone: '9832013334', address: 'Pune, Maharashtra', specialization: 'ENT Specialist' },
  { name: 'Sunita Agarwal',           hospital: 'Medanta Hospital',                phone: '9833014445', address: 'Gurugram, Haryana', specialization: 'Oncologist' },
  { name: 'Sanjay Patil',             hospital: 'KEM Hospital',                    phone: '9834015556', address: 'Parel, Mumbai', specialization: 'Psychiatrist' },
  { name: 'Meenakshi Sundaram',       hospital: 'Apollo Hospitals',                phone: '9835016667', address: 'Greams Road, Chennai', specialization: 'Nephrologist' },
  { name: 'Rohit Verma',              hospital: 'PGI Chandigarh',                  phone: '9836017778', address: 'Sector 12, Chandigarh', specialization: 'Rheumatologist' },
  { name: 'Fatima Begum Sheikh',      hospital: 'Nair Hospital',                   phone: '9837018889', address: 'Mumbai Central, Mumbai', specialization: 'Radiologist' },
  { name: 'Ganesh Prasad',            hospital: 'Ahmedabad Civil Hospital',        phone: '9838019990', address: 'Asarwa, Ahmedabad', specialization: 'Urologist' },
  { name: 'Pooja Banerjee',           hospital: 'SSKM Hospital',                   phone: '9839021101', address: 'Park Circus, Kolkata', specialization: 'Anesthesiologist' },
  { name: 'Kiran Deshpande',          hospital: 'Nagpur Government Medical College', phone: '9840022212', address: 'Medical Square, Nagpur', specialization: 'General Physician' },
  { name: 'Arun Tiwari',              hospital: 'Indore MY Hospital',              phone: '9841023323', address: 'M.G. Road, Indore', specialization: 'General Physician' },
  { name: 'Lalitha Krishnamurthy',    hospital: 'Nimhans Bengaluru',               phone: '9842024434', address: 'Hosur Road, Bengaluru', specialization: 'Neurologist' },
  { name: 'Satish Chavan',            hospital: 'District Civil Hospital',         phone: '9843025545', address: 'Kolhapur, Maharashtra', specialization: 'General Physician' },
  { name: 'Namrata Singh',            hospital: 'Patna Medical College',           phone: '9844026656', address: 'Ashok Rajpath, Patna', specialization: 'Gynecologist' },
  { name: 'Alok Kumar Mishra',        hospital: 'BHU Institute of Medical Sciences', phone: '9845027767', address: 'Lanka, Varanasi', specialization: 'General Physician' },
  { name: 'Charu Mathur',             hospital: 'SMS Hospital',                    phone: '9846028878', address: 'Jaipur, Rajasthan', specialization: 'Diabetologist' },
  { name: 'Prasad Narayanan',         hospital: 'Government Medical College Kozhikode', phone: '9847029989', address: 'Kozhikode, Kerala', specialization: 'Cardiologist' },
  { name: 'Divya Bhosle',             hospital: 'Thane Civil Hospital',            phone: '9848031100', address: 'Thane, Maharashtra', specialization: 'Pediatrician' },
  { name: 'Harish Pandey',            hospital: 'SGPGI Lucknow',                   phone: '9849032211', address: 'Raibareli Road, Lucknow', specialization: 'Gastroenterologist' },
];
const insDoctor = db.prepare('INSERT INTO doctors (name, hospital, phone, address, specialization) VALUES (?, ?, ?, ?, ?)');
const doctors = doctorRows.map(d => {
  const r = insDoctor.run(d.name, d.hospital, d.phone, d.address, d.specialization);
  return { id: r.lastInsertRowid, ...d };
});
console.log(`✅ ${doctors.length} Doctors inserted.`);

// ══════════════════════════════════════════════════════════════════════════════
// 3. CUSTOMERS
// ══════════════════════════════════════════════════════════════════════════════
const customerRows = [
  { name: 'Ramesh Suresh Patil',       phone: '9890001001', address: 'Dhantoli, Nagpur, MH 440012' },
  { name: 'Sunita Arun Joshi',         phone: '9890002002', address: 'Sadar, Nagpur, MH 440001' },
  { name: 'Mahesh Prabhu Kulkarni',    phone: '9890003003', address: 'Sitabuldi, Nagpur, MH 440012' },
  { name: 'Geeta Raghunath Deshmukh', phone: '9890004004', address: 'Wardhaman Nagar, Nagpur, MH 440008' },
  { name: 'Ajay Kumar Sahu',           phone: '9890005005', address: 'Itwari, Nagpur, MH 440002' },
  { name: 'Priya Sunil Sharma',        phone: '9890006006', address: 'Gandhibagh, Nagpur, MH 440002' },
  { name: 'Vinod Shankar More',        phone: '9890007007', address: 'Kamptee Road, Nagpur, MH 440017' },
  { name: 'Kavita Ram Thakre',         phone: '9890008008', address: 'Nandanvan, Nagpur, MH 440009' },
  { name: 'Suresh Baliram Bonde',      phone: '9890009009', address: 'Manewada, Nagpur, MH 440027' },
  { name: 'Anita Prakash Bhoyar',      phone: '9890010010', address: 'Pardi, Nagpur, MH 440014' },
  { name: 'Rajendra Vithal Meshram',   phone: '9890011011', address: 'Ambazari, Nagpur, MH 440033' },
  { name: 'Rekha Dinesh Shende',       phone: '9890012012', address: 'Lakadganj, Nagpur, MH 440008' },
  { name: 'Sanjay Devidas Wankhede',   phone: '9890013013', address: 'Congress Nagar, Nagpur, MH 440012' },
  { name: 'Asha Ramrao Nagpure',       phone: '9890014014', address: 'Pratap Nagar, Nagpur, MH 440022' },
  { name: 'Mohan Govind Maske',        phone: '9890015015', address: 'Ganesh Peth, Nagpur, MH 440018' },
  { name: 'Lata Vishwas Thosar',       phone: '9890016016', address: 'Jaripatka, Nagpur, MH 440014' },
  { name: 'Rajan Nilkanth Ukey',       phone: '9890017017', address: 'Dharampeth, Nagpur, MH 440010' },
  { name: 'Bharati Sudhir Autkar',     phone: '9890018018', address: 'Trimurti Nagar, Nagpur, MH 440022' },
  { name: 'Ganesh Manohar Tembhurne', phone: '9890019019', address: 'Manish Nagar, Nagpur, MH 440015' },
  { name: 'Smita Sanjay Deshpande',    phone: '9890020020', address: 'Ramdaspeth, Nagpur, MH 440010' },
  { name: 'Prasad Narayan Sapkal',     phone: '9890021021', address: 'Hudkeshwar, Nagpur, MH 440034' },
  { name: 'Deepa Arun Bawankar',       phone: '9890022022', address: 'Bajaj Nagar, Nagpur, MH 440010' },
  { name: 'Ashok Tryambak Lanjewar',   phone: '9890023023', address: 'Hingna, Nagpur, MH 441110' },
  { name: 'Nanda Santosh Choudhari',   phone: '9890024024', address: 'Wathoda, Nagpur, MH 440035' },
  { name: 'Hemant Dilip Kshirsagar',   phone: '9890025025', address: 'Khamla, Nagpur, MH 440025' },
  { name: 'Vandana Vijay Raut',        phone: '9890026026', address: 'Sakkardara, Nagpur, MH 440009' },
  { name: 'Nilesh Pandurang Mane',     phone: '9890027027', address: 'Butibori, Nagpur, MH 441108' },
  { name: 'Asha Yashvant Nandurkar',   phone: '9890028028', address: 'Besa, Nagpur, MH 440034' },
  { name: 'Pravin Dattatraya Gajbe',   phone: '9890029029', address: 'Imambada, Nagpur, MH 440002' },
  { name: 'Swati Damodar Bharad',      phone: '9890030030', address: 'Ambazari Layout, Nagpur, MH 440033' },
  { name: 'Vijay Tulsiram Ingle',      phone: '9890031031', address: 'Sonam Nagar, Nagpur, MH 440027' },
  { name: 'Shobha Naresh Pawar',       phone: '9890032032', address: 'Godhni, Nagpur, MH 440034' },
  { name: 'Devendra Shriram Bhandarkar', phone: '9890033033', address: 'Yashodhara Nagar, Nagpur, MH 440022' },
  { name: 'Meena Ashok Lilhare',       phone: '9890034034', address: 'Kalamna, Nagpur, MH 440030' },
  { name: 'Arun Gajanan Pande',        phone: '9890035035', address: 'Gittikhadan, Nagpur, MH 440013' },
  { name: 'Sarla Kishor Meshram',       phone: '9890036036', address: 'Koregaon Park, Pune, MH 411001' },
  { name: 'Ramdas Keshav Mhatre',      phone: '9890037037', address: 'Dadar, Mumbai, MH 400014' },
  { name: 'Usha Bhaskar Gokhale',      phone: '9890038038', address: 'Shivajinagar, Pune, MH 411005' },
  { name: 'Dilip Shankarrao Waghmare', phone: '9890039039', address: 'Camp, Amravati, MH 444602' },
  { name: 'Pushpa Ramkrishna Jadhav',  phone: '9890040040', address: 'Mahal, Nagpur, MH 440032' },
  { name: 'Santosh Ramaji Bhusari',    phone: '9890041041', address: 'Hinganghat, Wardha, MH 442301' },
  { name: 'Rohini Namdeo Ingole',      phone: '9890042042', address: 'Kamthi, Nagpur, MH 441001' },
  { name: 'Kiran Ramchandra Ghuge',    phone: '9890043043', address: 'Bhandara, MH 441904' },
  { name: 'Archana Sudhir Gopal',      phone: '9890044044', address: 'Gondia, MH 441601' },
  { name: 'Ravi Prakash Nair',         phone: '9890045045', address: 'Parel, Mumbai, MH 400012' },
  { name: 'Pooja Anand Shukla',        phone: '9890046046', address: 'Indore, MP 452001' },
  { name: 'Shailesh Dinkar Badwaik',   phone: '9890047047', address: 'Akola, MH 444001' },
  { name: 'Sunanda Madhukar Dhande',   phone: '9890048048', address: 'Yavatmal, MH 445001' },
  { name: 'Naresh Yeshwant Bhalerao',  phone: '9890049049', address: 'Chandrapur, MH 442401' },
  { name: 'Chanda Bhau Mankar',        phone: '9890050050', address: 'Washim, MH 444505' },
  { name: 'Tushar Baburao Deogade',    phone: '9890051051', address: 'Khamgaon, Buldhana, MH 444303' },
  { name: 'Madhuri Krushna Hiwse',     phone: '9890052052', address: 'Mehkar, Buldhana, MH 443301' },
  { name: 'Sushil Rambhau Thakur',     phone: '9890053053', address: 'Pandharkawada, Yavatmal, MH 445302' },
  { name: 'Alka Prabhakar Kolhe',      phone: '9890054054', address: 'Sawner, Nagpur, MH 441107' },
  { name: 'Rakesh Chandrakant Parale', phone: '9890055055', address: 'Umred, Nagpur, MH 441203' },
  { name: 'Gauri Vitthal Bhende',      phone: '9890056056', address: 'Parseoni, Nagpur, MH 441105' },
  { name: 'Hemraj Janardhan Rathod',   phone: '9890057057', address: 'Ramtek, Nagpur, MH 441106' },
  { name: 'Nalini Dattatray Kale',     phone: '9890058058', address: 'Arvi, Wardha, MH 442201' },
  { name: 'Dinesh Prabhakarrao Mankar',phone: '9890059059', address: 'Hingna Road, Nagpur, MH 441110' },
  { name: 'Varsha Suresh Petkar',      phone: '9890060060', address: 'Laxmi Nagar, Nagpur, MH 440022' },
];
const insCustomer = db.prepare('INSERT INTO customers (name, phone, address, credit_balance, last_payment_mode) VALUES (?, ?, ?, ?, ?)');
const customers = customerRows.map((c, i) => {
  const credit = i < 10 ? randFloat(0, 2500) : 0;
  const r = insCustomer.run(c.name, encrypt(c.phone), encrypt(c.address), credit, 'Cash');
  return { id: r.lastInsertRowid, ...c, credit_balance: credit };
});
console.log(`✅ ${customers.length} Customers inserted.`);

// ══════════════════════════════════════════════════════════════════════════════
// 4. MEDICINES (560 products)
// ══════════════════════════════════════════════════════════════════════════════
const insMed = db.prepare(`INSERT INTO medicines (brand_name, generic_name, company_name, drug_group, unit_category, hsn_code, gst_percent, schedule, is_h1, tablets_per_strip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

function addMed(brand, generic, company, group, unit, hsn, gst, schedule, is_h1, tps) {
  const r = insMed.run(brand, generic, company, group, unit || 'Tablet', hsn || '3004', gst || 12, schedule || '', is_h1 || 0, tps || (unit === 'Tablet' || unit === 'Capsule' || !unit ? 10 : 1));
  return { id: r.lastInsertRowid, brand_name: brand, unit_category: unit || 'Tablet', tablets_per_strip: tps || 10, gst_percent: gst || 12 };
}

const meds = [];

// ── ANALGESICS & ANTIPYRETICS ─────────────────────────────────────────────────
meds.push(addMed('Crocin 500',            'Paracetamol 500mg',       'GlaxoSmithKline Pharma',    'Analgesic',   'Tablet',  '3004', 5,  'OTC', 0, 15));
meds.push(addMed('Crocin 650',            'Paracetamol 650mg',       'GlaxoSmithKline Pharma',    'Analgesic',   'Tablet',  '3004', 5,  'OTC', 0, 15));
meds.push(addMed('Dolo 650',              'Paracetamol 650mg',       'Micro Labs Ltd',             'Analgesic',   'Tablet',  '3004', 5,  'OTC', 0, 15));
meds.push(addMed('Dolo 500',              'Paracetamol 500mg',       'Micro Labs Ltd',             'Analgesic',   'Tablet',  '3004', 5,  'OTC', 0, 15));
meds.push(addMed('Paracip 500',           'Paracetamol 500mg',       'Cipla Ltd',                  'Analgesic',   'Tablet',  '3004', 5,  'OTC', 0, 10));
meds.push(addMed('Combiflam',             'Ibuprofen+Paracetamol',   'Sanofi India Ltd',           'Analgesic',   'Tablet',  '3004', 12, 'OTC', 0, 20));
meds.push(addMed('Brufen 400',            'Ibuprofen 400mg',         'Abbott India Ltd',           'NSAID',       'Tablet',  '3004', 12, 'OTC', 0, 10));
meds.push(addMed('Brufen 600',            'Ibuprofen 600mg',         'Abbott India Ltd',           'NSAID',       'Tablet',  '3004', 12, 'OTC', 0, 10));
meds.push(addMed('Ibugesic Plus',         'Ibuprofen+Paracetamol',   'Cipla Ltd',                  'Analgesic',   'Tablet',  '3004', 12, 'OTC', 0, 10));
meds.push(addMed('Nimulid',               'Nimesulide 100mg',         'Panacea Biotec Ltd',         'NSAID',       'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Nise 100',              'Nimesulide 100mg',         'Dr. Reddy\'s Laboratories',  'NSAID',       'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Zerodol P',             'Aceclofenac+Paracetamol', 'Ipca Laboratories',          'Analgesic',   'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Voveran 50',            'Diclofenac 50mg',         'Novartis India Ltd',         'NSAID',       'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Voveran SR 100',        'Diclofenac SR 100mg',     'Novartis India Ltd',         'NSAID',       'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Hifenac P',             'Aceclofenac+Paracetamol', 'Intas Pharmaceuticals',      'Analgesic',   'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Dolokind Plus',         'Aceclofenac+Paracetamol', 'Mankind Pharma Ltd',         'Analgesic',   'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Meftal Spas',           'Mefenamic+Dicyclomine',   'Blue Cross Laboratories',    'Antispasmodic','Capsule','3004', 12, 'H',   0, 10));
meds.push(addMed('Meftal P',              'Mefenamic Acid 250mg',    'Blue Cross Laboratories',    'NSAID',       'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Calpol 250',            'Paracetamol 250mg/5ml',   'GlaxoSmithKline Pharma',    'Analgesic',   'Syrup',   '3004', 5,  'OTC', 0, 1));
meds.push(addMed('Panadol 500',           'Paracetamol 500mg',       'GlaxoSmithKline Pharma',    'Analgesic',   'Tablet',  '3004', 5,  'OTC', 0, 10));

// ── ANTIBIOTICS ───────────────────────────────────────────────────────────────
meds.push(addMed('Augmentin 625',         'Amoxicillin+Clavulanate', 'GlaxoSmithKline Pharma',    'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 6));
meds.push(addMed('Augmentin 375',         'Amoxicillin+Clavulanate', 'GlaxoSmithKline Pharma',    'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 6));
meds.push(addMed('Mox 500',               'Amoxicillin 500mg',       'Sun Pharmaceutical Ind.',    'Antibiotic',  'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Mox 250',               'Amoxicillin 250mg',       'Sun Pharmaceutical Ind.',    'Antibiotic',  'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Novamox 500',           'Amoxicillin 500mg',       'Cipla Ltd',                  'Antibiotic',  'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Azithral 500',          'Azithromycin 500mg',      'Alembic Pharmaceuticals',    'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 3));
meds.push(addMed('Azithral 250',          'Azithromycin 250mg',      'Alembic Pharmaceuticals',    'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 6));
meds.push(addMed('Zithromax 500',         'Azithromycin 500mg',      'Pfizer Ltd India',           'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 3));
meds.push(addMed('Ciplox 500',            'Ciprofloxacin 500mg',     'Cipla Ltd',                  'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Cifran 500',            'Ciprofloxacin 500mg',     'Sun Pharmaceutical Ind.',    'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Cifran OD 1000',        'Ciprofloxacin 1000mg',    'Sun Pharmaceutical Ind.',    'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 5));
meds.push(addMed('Norflox 400',           'Norfloxacin 400mg',       'Cipla Ltd',                  'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Oflox 200',             'Ofloxacin 200mg',         'Cipla Ltd',                  'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Taxim O 200',           'Cefixime 200mg',          'Alkem Laboratories Ltd',     'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Taxim O 400',           'Cefixime 400mg',          'Alkem Laboratories Ltd',     'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Zifi 200',              'Cefixime 200mg',          'FDC Ltd',                    'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Cefolac 200',           'Cefaclor 250mg',          'Lupin Ltd',                  'Antibiotic',  'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Ciplox TZ',             'Ciprofloxacin+Tinidazole','Cipla Ltd',                  'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Metrogyl 400',          'Metronidazole 400mg',     'J.B. Chemicals',             'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 15));
meds.push(addMed('Flagyl 400',            'Metronidazole 400mg',     'Abbott India Ltd',           'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 15));
meds.push(addMed('Tiniba 500',            'Tinidazole 500mg',        'Zydus Lifesciences',         'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 4));
meds.push(addMed('Doxycap 100',           'Doxycycline 100mg',       'Cipla Ltd',                  'Antibiotic',  'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Vibramycin 100',        'Doxycycline 100mg',       'Pfizer Ltd India',           'Antibiotic',  'Capsule', '3004', 12, 'H',   0, 8));
meds.push(addMed('Pantocid',              'Pantoprazole 40mg',       'Sun Pharmaceutical Ind.',    'PPI',         'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Amoxyclav 625',         'Amoxicillin+Clavulanate', 'Cipla Ltd',                  'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 6));
meds.push(addMed('Clavam 625',            'Amoxicillin+Clavulanate', 'Alembic Pharmaceuticals',    'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 6));
meds.push(addMed('Meronem 1g',            'Meropenem 1g',            'AstraZeneca India',          'Antibiotic',  'Injection','3004', 12, 'H',   0, 1));
meds.push(addMed('Magnex 1g',             'Sulbactam+Ampicillin',    'Pfizer Ltd India',           'Antibiotic',  'Injection','3004', 12, 'H',   0, 1));
meds.push(addMed('Clindamycin 300mg',     'Clindamycin 300mg',       'Cipla Ltd',                  'Antibiotic',  'Capsule', '3004', 12, 'H',   0, 4));
meds.push(addMed('Dalacin C 300',         'Clindamycin 300mg',       'Pfizer Ltd India',           'Antibiotic',  'Capsule', '3004', 12, 'H',   0, 16));
meds.push(addMed('Erythrocin 250',        'Erythromycin 250mg',      'Abbott India Ltd',           'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 10));

// ── ANTIFUNGALS ───────────────────────────────────────────────────────────────
meds.push(addMed('Canesten Cream',        'Clotrimazole 1%',         'Bayer Zydus Pharma',         'Antifungal',  'Cream',   '3304', 18, 'OTC', 0, 1));
meds.push(addMed('Candid B Cream',        'Clotrimazole+Beclomethasone','Glenmark Pharmaceuticals', 'Antifungal',  'Cream',   '3304', 18, 'H',   0, 1));
meds.push(addMed('Funazole 150',          'Fluconazole 150mg',       'Cipla Ltd',                  'Antifungal',  'Tablet',  '3004', 12, 'H',   0, 1));
meds.push(addMed('Zocon 150',             'Fluconazole 150mg',       'FDC Ltd',                    'Antifungal',  'Tablet',  '3004', 12, 'H',   0, 1));
meds.push(addMed('Itraconazole 200mg',    'Itraconazole 200mg',      'Cipla Ltd',                  'Antifungal',  'Capsule', '3004', 12, 'H',   0, 4));
meds.push(addMed('Sporanox 100',          'Itraconazole 100mg',      'Johnson & Johnson',          'Antifungal',  'Capsule', '3004', 12, 'H',   0, 4));
meds.push(addMed('Terbinorm 250',         'Terbinafine 250mg',       'Cipla Ltd',                  'Antifungal',  'Tablet',  '3004', 12, 'H',   0, 7));

// ── PPI / ANTACIDS ────────────────────────────────────────────────────────────
meds.push(addMed('Pan 40',                'Pantoprazole 40mg',       'Alkem Laboratories Ltd',     'PPI',         'Tablet',  '3004', 12, 'H',   0, 15));
meds.push(addMed('Pan D',                 'Pantoprazole+Domperidone','Alkem Laboratories Ltd',     'PPI',         'Capsule', '3004', 12, 'H',   0, 15));
meds.push(addMed('Omez 20',               'Omeprazole 20mg',         'Dr. Reddy\'s Laboratories',  'PPI',         'Capsule', '3004', 12, 'H',   0, 15));
meds.push(addMed('Omez D',                'Omeprazole+Domperidone',  'Dr. Reddy\'s Laboratories',  'PPI',         'Capsule', '3004', 12, 'H',   0, 15));
meds.push(addMed('Rantac 150',            'Ranitidine 150mg',        'J.B. Chemicals',             'H2 Blocker',  'Tablet',  '3004', 12, 'OTC', 0, 20));
meds.push(addMed('Zantac 150',            'Ranitidine 150mg',        'GlaxoSmithKline Pharma',    'H2 Blocker',  'Tablet',  '3004', 12, 'OTC', 0, 10));
meds.push(addMed('Razo 20',               'Rabeprazole 20mg',        'Sun Pharmaceutical Ind.',    'PPI',         'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Rablet 20',             'Rabeprazole 20mg',        'Lupin Ltd',                  'PPI',         'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Nexpro 40',             'Esomeprazole 40mg',       'Torrent Pharmaceuticals',    'PPI',         'Tablet',  '3004', 12, 'H',   0, 7));
meds.push(addMed('Nexium 40',             'Esomeprazole 40mg',       'AstraZeneca India',          'PPI',         'Tablet',  '3004', 12, 'H',   0, 7));
meds.push(addMed('Digene Gel',            'Antacid Syrup',           'Abbott India Ltd',           'Antacid',     'Syrup',   '2106', 5,  'OTC', 0, 1));
meds.push(addMed('Gelusil MPS',           'Antacid Tablet',          'Pfizer Ltd India',           'Antacid',     'Tablet',  '2106', 5,  'OTC', 0, 15));
meds.push(addMed('Mucaine Gel',           'Antacid Gel',             'Pfizer Ltd India',           'Antacid',     'Syrup',   '2106', 5,  'OTC', 0, 1));
meds.push(addMed('Pantocid DSR',          'Pantoprazole+Domperidone','Sun Pharmaceutical Ind.',    'PPI',         'Capsule', '3004', 12, 'H',   0, 15));
meds.push(addMed('Veloz 20',              'Rabeprazole 20mg',        'Lupin Ltd',                  'PPI',         'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Neksium 20',            'Esomeprazole 20mg',       'AstraZeneca India',          'PPI',         'Tablet',  '3004', 12, 'H',   0, 7));

// ── ANTIHISTAMINES & COLD ─────────────────────────────────────────────────────
meds.push(addMed('Allegra 120',           'Fexofenadine 120mg',      'Sanofi India Ltd',           'Antihistamine','Tablet', '3004', 12, 'OTC', 0, 10));
meds.push(addMed('Allegra 180',           'Fexofenadine 180mg',      'Sanofi India Ltd',           'Antihistamine','Tablet', '3004', 12, 'OTC', 0, 10));
meds.push(addMed('Atarax 25',             'Hydroxyzine 25mg',        'UCB India',                  'Antihistamine','Tablet', '3004', 12, 'H',   0, 15));
meds.push(addMed('Cetriz',                'Cetirizine 10mg',         'Cipla Ltd',                  'Antihistamine','Tablet', '3004', 5,  'OTC', 0, 15));
meds.push(addMed('Zyrtec',                'Cetirizine 10mg',         'Johnson & Johnson',          'Antihistamine','Tablet', '3004', 5,  'OTC', 0, 7));
meds.push(addMed('Okacet',                'Cetirizine 10mg',         'Cipla Ltd',                  'Antihistamine','Tablet', '3004', 5,  'OTC', 0, 15));
meds.push(addMed('Levocet 5',             'Levocetirizine 5mg',      'Sun Pharmaceutical Ind.',    'Antihistamine','Tablet', '3004', 5,  'OTC', 0, 10));
meds.push(addMed('Montair 10',            'Montelukast 10mg',        'Cipla Ltd',                  'Antihistamine','Tablet', '3004', 12, 'H',   0, 10));
meds.push(addMed('Montemac 10',           'Montelukast 10mg',        'Macleods Pharmaceuticals',   'Antihistamine','Tablet', '3004', 12, 'H',   0, 10));
meds.push(addMed('Sinarest',              'Cold Tablet',             'Centaur Pharmaceuticals',    'Cold & Flu',  'Tablet',  '3004', 12, 'OTC', 0, 10));
meds.push(addMed('Wikoryl',               'Paracetamol+Phenylephrine','Win Medicare Ltd',          'Cold & Flu',  'Tablet',  '3004', 12, 'OTC', 0, 10));
meds.push(addMed('Febrex Plus',           'Paracetamol+Phenylephrine','Cipla Ltd',                 'Cold & Flu',  'Tablet',  '3004', 12, 'OTC', 0, 10));
meds.push(addMed('D Cold Total',          'Cold Tablet',             'Sun Pharmaceutical Ind.',    'Cold & Flu',  'Tablet',  '3004', 12, 'OTC', 0, 10));
meds.push(addMed('Coldarin',              'Cold Tablet',             'Strides Pharma',             'Cold & Flu',  'Tablet',  '3004', 12, 'OTC', 0, 10));
meds.push(addMed('Benadryl Cough Syrup',  'Diphenhydramine+Ammonium','Johnson & Johnson',          'Cough',       'Syrup',   '3004', 12, 'OTC', 0, 1));
meds.push(addMed('Corex D',               'Chlorpheniramine+Codeine','Pfizer Ltd India',           'Cough',       'Syrup',   '3004', 12, 'H',   0, 1));
meds.push(addMed('Ascoril LS',            'Levosalbutamol+Ambroxol', 'Glenmark Pharmaceuticals',   'Cough',       'Syrup',   '3004', 12, 'OTC', 0, 1));
meds.push(addMed('Ambrolite',             'Ambroxol 30mg',           'Alkem Laboratories Ltd',     'Mucolytic',   'Tablet',  '3004', 12, 'OTC', 0, 10));
meds.push(addMed('Mucosolvan',            'Ambroxol 75mg SR',        'Boehringer Ingelheim',       'Mucolytic',   'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Alex Syrup',            'Chlorpheniramine+Dextromethorphan','Mankind Pharma',    'Cough',       'Syrup',   '3004', 12, 'OTC', 0, 1));
meds.push(addMed('Kofex DX',              'Dextromethorphan+Guaifenesin','Ajanta Pharma',          'Cough',       'Syrup',   '3004', 12, 'OTC', 0, 1));

// ── CARDIOVASCULAR ────────────────────────────────────────────────────────────
meds.push(addMed('Aten 50',               'Atenolol 50mg',           'Zydus Lifesciences',         'Beta-Blocker','Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Aten 25',               'Atenolol 25mg',           'Zydus Lifesciences',         'Beta-Blocker','Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Tenormin 50',           'Atenolol 50mg',           'AstraZeneca India',          'Beta-Blocker','Tablet',  '3004', 12, 'H',   0, 28));
meds.push(addMed('Metolar 25',            'Metoprolol 25mg',         'Cipla Ltd',                  'Beta-Blocker','Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Metolar XR 50',         'Metoprolol XR 50mg',      'Cipla Ltd',                  'Beta-Blocker','Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Betaloc ZOK 50',        'Metoprolol 50mg',         'AstraZeneca India',          'Beta-Blocker','Tablet',  '3004', 12, 'H',   0, 20));
meds.push(addMed('Amlokind 5',            'Amlodipine 5mg',          'Mankind Pharma Ltd',         'CCB',         'Tablet',  '3004', 12, 'H',   0, 15));
meds.push(addMed('Amlokind AT',           'Amlodipine+Atenolol',     'Mankind Pharma Ltd',         'CCB',         'Tablet',  '3004', 12, 'H',   0, 15));
meds.push(addMed('Norvasc 5',             'Amlodipine 5mg',          'Pfizer Ltd India',           'CCB',         'Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Stamlo 5',              'Amlodipine 5mg',          'Dr. Reddy\'s Laboratories',  'CCB',         'Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Telma 40',              'Telmisartan 40mg',        'Glenmark Pharmaceuticals',   'ARB',         'Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Telma 80',              'Telmisartan 80mg',        'Glenmark Pharmaceuticals',   'ARB',         'Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Telma H',               'Telmisartan+Hydrochlorothiazide','Glenmark Pharmaceuticals','ARB',   'Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Telma AM',              'Telmisartan+Amlodipine',  'Glenmark Pharmaceuticals',   'ARB+CCB',     'Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Eritel 40',             'Telmisartan 40mg',        'Torrent Pharmaceuticals',    'ARB',         'Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Losar H',               'Losartan+Hydrochlorothiazide','Cipla Ltd',              'ARB',         'Tablet',  '3004', 12, 'H',   0, 15));
meds.push(addMed('Cosart 50',             'Losartan 50mg',           'Cipla Ltd',                  'ARB',         'Tablet',  '3004', 12, 'H',   0, 15));
meds.push(addMed('Olsar 20',              'Olmesartan 20mg',         'Cipla Ltd',                  'ARB',         'Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Ecosprin 75',           'Aspirin 75mg',            'USV Ltd',                    'Antiplatelet','Tablet',  '3004', 5,  'H',   0, 14));
meds.push(addMed('Ecosprin 150',          'Aspirin 150mg',           'USV Ltd',                    'Antiplatelet','Tablet',  '3004', 5,  'H',   0, 14));
meds.push(addMed('Disprin',               'Aspirin 350mg',           'Reckitt Benckiser',          'Antiplatelet','Tablet',  '3004', 5,  'OTC', 0, 10));
meds.push(addMed('Clopivas 75',           'Clopidogrel 75mg',        'Cipla Ltd',                  'Antiplatelet','Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Plavix 75',             'Clopidogrel 75mg',        'Sanofi India Ltd',           'Antiplatelet','Tablet',  '3004', 12, 'H',   0, 28));
meds.push(addMed('Rosave 10',             'Rosuvastatin 10mg',       'Sun Pharmaceutical Ind.',    'Statin',      'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Rosave 20',             'Rosuvastatin 20mg',       'Sun Pharmaceutical Ind.',    'Statin',      'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Rozavel 10',            'Rosuvastatin 10mg',       'Sun Pharmaceutical Ind.',    'Statin',      'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Atorva 10',             'Atorvastatin 10mg',       'Zydus Lifesciences',         'Statin',      'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Atorva 20',             'Atorvastatin 20mg',       'Zydus Lifesciences',         'Statin',      'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Atorva 40',             'Atorvastatin 40mg',       'Zydus Lifesciences',         'Statin',      'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Lipitor 20',            'Atorvastatin 20mg',       'Pfizer Ltd India',           'Statin',      'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Storvas 10',            'Atorvastatin 10mg',       'Sun Pharmaceutical Ind.',    'Statin',      'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Fenocap 200',           'Fenofibrate 200mg',       'Sun Pharmaceutical Ind.',    'Lipid',       'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Lopid 300',             'Gemfibrozil 300mg',       'Pfizer Ltd India',           'Lipid',       'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Cardivas 6.25',         'Carvedilol 6.25mg',       'Sun Pharmaceutical Ind.',    'Beta-Blocker','Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Sorbitrate 5',          'Isosorbide Dinitrate 5mg','Sun Pharmaceutical Ind.',    'Nitrate',     'Tablet',  '3004', 12, 'H',   0, 15));
meds.push(addMed('Minipress XL 5',        'Prazosin XR 5mg',         'Pfizer Ltd India',           'Alpha Blocker','Tablet', '3004', 12, 'H',   0, 14));

// ── DIABETES ──────────────────────────────────────────────────────────────────
meds.push(addMed('Glycomet 500',          'Metformin 500mg',         'USV Ltd',                    'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 20));
meds.push(addMed('Glycomet 1000',         'Metformin 1000mg',        'USV Ltd',                    'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 20));
meds.push(addMed('Glucophage 500',        'Metformin 500mg',         'Abbott India Ltd',           'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 20));
meds.push(addMed('Glucophage 1000',       'Metformin 1000mg',        'Abbott India Ltd',           'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 20));
meds.push(addMed('Januvia 50',            'Sitagliptin 50mg',        'MSD Pharmaceuticals',        'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 28));
meds.push(addMed('Januvia 100',           'Sitagliptin 100mg',       'MSD Pharmaceuticals',        'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 28));
meds.push(addMed('Voglibose 0.2',         'Voglibose 0.2mg',         'Lupin Ltd',                  'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Voglibose 0.3',         'Voglibose 0.3mg',         'Lupin Ltd',                  'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Glimepiride 1mg',       'Glimepiride 1mg',         'Sanofi India Ltd',           'Sulfonylurea','Tablet',  '3004', 12, 'H',   0, 15));
meds.push(addMed('Glimepiride 2mg',       'Glimepiride 2mg',         'Sanofi India Ltd',           'Sulfonylurea','Tablet',  '3004', 12, 'H',   0, 15));
meds.push(addMed('Amaryl 1',              'Glimepiride 1mg',         'Sanofi India Ltd',           'Sulfonylurea','Tablet',  '3004', 12, 'H',   0, 30));
meds.push(addMed('Amaryl 2',              'Glimepiride 2mg',         'Sanofi India Ltd',           'Sulfonylurea','Tablet',  '3004', 12, 'H',   0, 30));
meds.push(addMed('Gluformin G1',          'Metformin+Glimepiride',   'Torrent Pharmaceuticals',    'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Jalra 50',              'Vildagliptin 50mg',       'Novartis India Ltd',         'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 28));
meds.push(addMed('Forxiga 10',            'Dapagliflozin 10mg',      'AstraZeneca India',          'SGLT2i',      'Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Jardiance 10',          'Empagliflozin 10mg',      'Boehringer Ingelheim',       'SGLT2i',      'Tablet',  '3004', 12, 'H',   0, 30));
meds.push(addMed('Invokana 100',          'Canagliflozin 100mg',     'Janssen Pharmaceuticals',    'SGLT2i',      'Tablet',  '3004', 12, 'H',   0, 30));
meds.push(addMed('Glucobay 25',           'Acarbose 25mg',           'Bayer Zydus Pharma',         'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 30));
meds.push(addMed('Pioz 15',               'Pioglitazone 15mg',       'Torrent Pharmaceuticals',    'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 14));
meds.push(addMed('Actom 15/500',          'Pioglitazone+Metformin',  'Torrent Pharmaceuticals',    'Antidiabetic','Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Huminsulin 30/70',      'Human Insulin 30/70',     'Eli Lilly India',            'Insulin',     'Injection','3004', 0,  'H',   0, 1));
meds.push(addMed('Insulatard',            'Isophane Human Insulin',  'Novo Nordisk India',         'Insulin',     'Injection','3004', 0,  'H',   0, 1));
meds.push(addMed('Novorapid',             'Insulin Aspart',          'Novo Nordisk India',         'Insulin',     'Injection','3004', 0,  'H',   0, 1));

// ── THYROID ───────────────────────────────────────────────────────────────────
meds.push(addMed('Thyronorm 25',          'Levothyroxine 25mcg',     'Abbott India Ltd',           'Thyroid',     'Tablet',  '3004', 12, 'H',   0, 120));
meds.push(addMed('Thyronorm 50',          'Levothyroxine 50mcg',     'Abbott India Ltd',           'Thyroid',     'Tablet',  '3004', 12, 'H',   0, 120));
meds.push(addMed('Thyronorm 75',          'Levothyroxine 75mcg',     'Abbott India Ltd',           'Thyroid',     'Tablet',  '3004', 12, 'H',   0, 120));
meds.push(addMed('Thyronorm 100',         'Levothyroxine 100mcg',    'Abbott India Ltd',           'Thyroid',     'Tablet',  '3004', 12, 'H',   0, 120));
meds.push(addMed('Thyrox 25',             'Levothyroxine 25mcg',     'Macleods Pharmaceuticals',   'Thyroid',     'Tablet',  '3004', 12, 'H',   0, 120));
meds.push(addMed('Thyrox 50',             'Levothyroxine 50mcg',     'Macleods Pharmaceuticals',   'Thyroid',     'Tablet',  '3004', 12, 'H',   0, 120));
meds.push(addMed('Eltroxin 50',           'Levothyroxine 50mcg',     'GlaxoSmithKline Pharma',    'Thyroid',     'Tablet',  '3004', 12, 'H',   0, 100));

// ── VITAMINS & SUPPLEMENTS ────────────────────────────────────────────────────
meds.push(addMed('Becosules',             'Vitamin B Complex',       'Pfizer Ltd India',           'Vitamin',     'Capsule', '2106', 12, 'OTC', 0, 20));
meds.push(addMed('Becosules Z',           'Multivitamin+Zinc',       'Pfizer Ltd India',           'Vitamin',     'Capsule', '2106', 12, 'OTC', 0, 20));
meds.push(addMed('Limcee 500',            'Vitamin C 500mg',         'Abbott India Ltd',           'Vitamin',     'Tablet',  '2106', 5,  'OTC', 0, 15));
meds.push(addMed('Celin 500',             'Vitamin C 500mg',         'GlaxoSmithKline Pharma',    'Vitamin',     'Tablet',  '2106', 5,  'OTC', 0, 30));
meds.push(addMed('Shelcal 500',           'Calcium+Vit D3',          'Elder Pharmaceuticals',      'Calcium',     'Tablet',  '2106', 5,  'OTC', 0, 15));
meds.push(addMed('Calcirol 60000',        'Vitamin D3 60000 IU',     'Zydus Lifesciences',         'Vitamin',     'Capsule', '2106', 5,  'OTC', 0, 4));
meds.push(addMed('Uprise D3 60K',         'Cholecalciferol 60000IU', 'USV Ltd',                    'Vitamin',     'Capsule', '2106', 5,  'OTC', 0, 4));
meds.push(addMed('Nurokind LC',           'Methylcobalamin+Folic',   'Mankind Pharma Ltd',         'Neurotropic', 'Tablet',  '2106', 12, 'OTC', 0, 10));
meds.push(addMed('Nurokind Gold',         'Methylcobalamin+Alpha Lipoic','Mankind Pharma Ltd',      'Neurotropic', 'Capsule', '2106', 12, 'OTC', 0, 10));
meds.push(addMed('Nervijen',              'Methylcobalamin 1500mcg', 'Intas Pharmaceuticals',      'Neurotropic', 'Tablet',  '2106', 12, 'OTC', 0, 10));
meds.push(addMed('Methycobal 500',        'Methylcobalamin 500mcg',  'Eisai Pharmaceuticals',      'Neurotropic', 'Tablet',  '2106', 12, 'OTC', 0, 10));
meds.push(addMed('Supradyn',              'Multivitamin',            'Bayer Zydus Pharma',         'Multivitamin','Tablet',  '2106', 12, 'OTC', 0, 30));
meds.push(addMed('Revital H',             'Multivitamin+Ginseng',    'Ranbaxy Laboratories',       'Multivitamin','Capsule', '2106', 12, 'OTC', 0, 30));
meds.push(addMed('Zincovit',              'Multivitamin+Zinc',       'Apex Laboratories',          'Multivitamin','Tablet',  '2106', 5,  'OTC', 0, 15));
meds.push(addMed('Neurobion Forte',       'Vitamin B1+B6+B12',       'Procter & Gamble Health',    'Vitamin',     'Tablet',  '2106', 5,  'OTC', 0, 30));
meds.push(addMed('Nature Made Iron 65',   'Iron 65mg',               'Pfizer Ltd India',           'Mineral',     'Tablet',  '2106', 5,  'OTC', 0, 30));
meds.push(addMed('Ferrochelate',          'Carbonyl Iron+Folic',     'Indus Pharma',               'Haematinic',  'Tablet',  '2106', 5,  'OTC', 0, 30));
meds.push(addMed('Dexorange Syrup',       'Iron+B12+Folic Acid',     'Franco-Indian Pharma',       'Haematinic',  'Syrup',   '2106', 5,  'OTC', 0, 1));
meds.push(addMed('Tonoferon Syrup',       'Iron+Folic Acid',         'East India Pharma',          'Haematinic',  'Syrup',   '2106', 5,  'OTC', 0, 1));
meds.push(addMed('Orofer XT',             'Ferrous Ascorbate+Folic', 'Emcure Pharmaceuticals',     'Haematinic',  'Tablet',  '2106', 5,  'OTC', 0, 10));
meds.push(addMed('Fefol Vit',             'Ferrous Sulphate+Folic',  'GlaxoSmithKline Pharma',    'Haematinic',  'Capsule', '2106', 5,  'OTC', 0, 30));
meds.push(addMed('Autrin',                'Iron+B-Complex',          'Sun Pharmaceutical Ind.',    'Haematinic',  'Capsule', '2106', 5,  'OTC', 0, 10));

// ── DERMATOLOGY ───────────────────────────────────────────────────────────────
meds.push(addMed('Betnovate C',           'Betamethasone+Clioquinol','GlaxoSmithKline Pharma',    'Steroid Skin','Cream',   '3304', 18, 'H',   0, 1));
meds.push(addMed('Betnovate N',           'Betamethasone+Neomycin', 'GlaxoSmithKline Pharma',    'Steroid Skin','Cream',   '3304', 18, 'H',   0, 1));
meds.push(addMed('Clobetasol 0.05%',      'Clobetasol Propionate',   'Cipla Ltd',                  'Steroid Skin','Cream',   '3304', 18, 'H',   0, 1));
meds.push(addMed('Temovate',              'Clobetasol 0.05%',        'GlaxoSmithKline Pharma',    'Steroid Skin','Cream',   '3304', 18, 'H',   0, 1));
meds.push(addMed('Dermikem OC',           'Clotrimazole+Octinoxate', 'Dermkem',                    'Antifungal',  'Cream',   '3304', 18, 'OTC', 0, 1));
meds.push(addMed('Quadriderm',            'Beclomethasone+Neomycin', 'Abbott India Ltd',           'Steroid Skin','Cream',   '3304', 18, 'H',   0, 1));
meds.push(addMed('Fucidin',               'Fusidic Acid 2%',         'Leo Pharma',                 'Antibiotic Skin','Cream','3304', 18, 'H',  0, 1));
meds.push(addMed('Silverex',              'Silver Sulphadiazine 1%', 'Zydus Lifesciences',         'Wound Care',  'Cream',   '3304', 18, 'H',   0, 1));
meds.push(addMed('Soframycin',            'Framycetin 1%',           'Sanofi India Ltd',           'Antibiotic Skin','Cream','3304', 18, 'H',  0, 1));
meds.push(addMed('Acne Neem Face Wash',   'Salicylic Acid+Neem',     'Himalaya Drug Company',      'Dermatology', 'Cream',   '3304', 18, 'OTC', 0, 1));
meds.push(addMed('Tacrolimus 0.1%',       'Tacrolimus 0.1%',         'Sun Pharmaceutical Ind.',    'Immunomodulator','Ointment','3304',18,'H', 0, 1));
meds.push(addMed('Mometasone Cream',      'Mometasone Furoate 0.1%', 'Sun Pharmaceutical Ind.',    'Steroid Skin','Cream',   '3304', 18, 'H',   0, 1));
meds.push(addMed('Elocon',                'Mometasone Furoate 0.1%', 'MSD Pharmaceuticals',        'Steroid Skin','Cream',   '3304', 18, 'H',   0, 1));
meds.push(addMed('Calamine Lotion',       'Calamine 8% w/v',         'Piramal Healthcare',         'Skin Soothing','Lotion', '3304', 18, 'OTC', 0, 1));
meds.push(addMed('Lacto Calamine',        'Calamine+Zinc Oxide',     'Piramal Healthcare',         'Skin Soothing','Lotion', '3304', 18, 'OTC', 0, 1));

// ── RESPIRATORY / BRONCHODILATORS ─────────────────────────────────────────────
meds.push(addMed('Asthalin 2mg',          'Salbutamol 2mg',          'Cipla Ltd',                  'Bronchodilator','Tablet','3004', 12, 'H',   0, 10));
meds.push(addMed('Asthalin 4mg',          'Salbutamol 4mg',          'Cipla Ltd',                  'Bronchodilator','Tablet','3004', 12, 'H',   0, 10));
meds.push(addMed('Asthalin Inhaler',      'Salbutamol Inhaler',      'Cipla Ltd',                  'Bronchodilator','Inhaler','3004',12, 'H',  0, 1));
meds.push(addMed('Salbetol',              'Salbutamol 4mg',          'Alembic Pharmaceuticals',    'Bronchodilator','Tablet','3004', 12, 'H',   0, 10));
meds.push(addMed('Foracort 200',          'Formoterol+Budesonide',   'Cipla Ltd',                  'Bronchodilator','Inhaler','3004',12, 'H',  0, 1));
meds.push(addMed('Seroflo 250',           'Salmeterol+Fluticasone',  'Cipla Ltd',                  'Bronchodilator','Inhaler','3004',12, 'H',  0, 1));
meds.push(addMed('Flohale 250',           'Fluticasone Propionate',  'Cipla Ltd',                  'Inhaled Corticosteroid','Inhaler','3004',12,'H',0,1));
meds.push(addMed('Budecort 200',          'Budesonide 200mcg',       'Cipla Ltd',                  'Inhaled Corticosteroid','Inhaler','3004',12,'H',0,1));
meds.push(addMed('Spiriva',               'Tiotropium 18mcg',        'Boehringer Ingelheim',       'LAMA',        'Inhaler', '3004', 12, 'H',   0, 1));
meds.push(addMed('Aminophylline 100',     'Aminophylline 100mg',     'Cipla Ltd',                  'Xanthine',    'Tablet',  '3004', 12, 'H',   0, 30));
meds.push(addMed('Deriphyllin',           'Theophylline+Etofylline', 'Franco-Indian Pharma',       'Xanthine',    'Tablet',  '3004', 12, 'H',   0, 30));
meds.push(addMed('Thymoqil',              'Thymoquinone Extract',    'Himalaya Drug Company',      'Respiratory', 'Capsule', '3004', 12, 'OTC', 0, 10));

// ── GASTROINTESTINAL ──────────────────────────────────────────────────────────
meds.push(addMed('Motilius',              'Domperidone 10mg',        'Cipla Ltd',                  'Prokinetic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Domstal 10',            'Domperidone 10mg',        'Torrent Pharmaceuticals',    'Prokinetic',  'Tablet',  '3004', 12, 'H',   0, 30));
meds.push(addMed('Perinorm',              'Metoclopramide 10mg',     'Nicholas Piramal India',     'Antiemetic',  'Tablet',  '3004', 12, 'H',   0, 30));
meds.push(addMed('Emeset 4',              'Ondansetron 4mg',         'Cipla Ltd',                  'Antiemetic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Kytril 2',              'Granisetron 2mg',         'Roche India',                'Antiemetic',  'Tablet',  '3004', 12, 'H',   0, 2));
meds.push(addMed('Ondansetron 4mg Inj',  'Ondansetron 4mg/2ml',     'Cipla Ltd',                  'Antiemetic',  'Injection','3004',12, 'H',  0, 1));
meds.push(addMed('Buscopan',              'Hyoscine Butylbromide',   'Sanofi India Ltd',           'Antispasmodic','Tablet', '3004', 12, 'H',   0, 20));
meds.push(addMed('Cyclospas',             'Dicyclomine 10mg',        'Nicholas Piramal India',     'Antispasmodic','Tablet', '3004', 12, 'H',   0, 30));
meds.push(addMed('Enterogermina',         'Bacillus clausii',        'Sanofi India Ltd',           'Probiotic',   'Syrup',   '3004', 5,  'OTC', 0, 1));
meds.push(addMed('Econorm',               'Saccharomyces boulardii', 'Sun Pharmaceutical Ind.',    'Probiotic',   'Capsule', '3004', 5,  'OTC', 0, 10));
meds.push(addMed('Sporlac',               'Lactobacillus Spores',    'Sankyo Pharma',              'Probiotic',   'Tablet',  '3004', 5,  'OTC', 0, 10));
meds.push(addMed('Elixir Antacid',        'Aluminium Hydroxide Gel', 'GlaxoSmithKline Pharma',    'Antacid',     'Syrup',   '2106', 5,  'OTC', 0, 1));
meds.push(addMed('Isabgol Husk',          'Psyllium Husk',           'Dabur India Ltd',            'Laxative',    'Powder',  '1211', 5,  'OTC', 0, 1));
meds.push(addMed('Cremaffin',             'Liquid Paraffin+Milk Magn','Abbott India Ltd',           'Laxative',    'Syrup',   '3004', 12, 'OTC', 0, 1));
meds.push(addMed('Dulcoflex',             'Bisacodyl 5mg',           'Boehringer Ingelheim',       'Laxative',    'Tablet',  '3004', 12, 'OTC', 0, 10));
meds.push(addMed('DPHM 25',               'Diphenhydramine 25mg',    'Cipla Ltd',                  'Antihistamine','Tablet', '3004', 12, 'H',   0, 10));
meds.push(addMed('Mosid MT',              'Mosapride 5mg',           'Sun Pharmaceutical Ind.',    'Prokinetic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Itopride 150',          'Itopride HCl 150mg SR',   'Dr. Reddy\'s Laboratories',  'Prokinetic',  'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Lactugal',              'Lactulose Syrup',         'Macleods Pharmaceuticals',   'Laxative',    'Syrup',   '3004', 12, 'OTC', 0, 1));

// ── NEUROLOGICAL & PSYCHIATRIC ────────────────────────────────────────────────
meds.push(addMed('Gardenal 30',           'Phenobarbitone 30mg',     'Sanofi India Ltd',           'Antiepileptic','Tablet', '3004', 12, 'H',   0, 30));
meds.push(addMed('Eptoin 100',            'Phenytoin 100mg',         'Abbott India Ltd',           'Antiepileptic','Tablet', '3004', 12, 'H',   0, 30));
meds.push(addMed('Valparin CR 300',       'Valproate CR 300mg',      'Sun Pharmaceutical Ind.',    'Antiepileptic','Tablet', '3004', 12, 'H',   0, 10));
meds.push(addMed('Valparin CR 500',       'Valproate CR 500mg',      'Sun Pharmaceutical Ind.',    'Antiepileptic','Tablet', '3004', 12, 'H',   0, 10));
meds.push(addMed('Tegretol 200',          'Carbamazepine 200mg',     'Novartis India Ltd',         'Antiepileptic','Tablet', '3004', 12, 'H',   0, 10));
meds.push(addMed('Tegrital 200',          'Carbamazepine 200mg',     'Sun Pharmaceutical Ind.',    'Antiepileptic','Tablet', '3004', 12, 'H',   0, 10));
meds.push(addMed('Lamosyn 50',            'Lamotrigine 50mg',        'Sun Pharmaceutical Ind.',    'Antiepileptic','Tablet', '3004', 12, 'H',   0, 30));
meds.push(addMed('Topirol 50',            'Topiramate 50mg',         'Sun Pharmaceutical Ind.',    'Antiepileptic','Tablet', '3004', 12, 'H',   0, 10));
meds.push(addMed('Lonazep 0.5',           'Clonazepam 0.5mg',        'Sun Pharmaceutical Ind.',    'Anxiolytic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Lonazep 1',             'Clonazepam 1mg',          'Sun Pharmaceutical Ind.',    'Anxiolytic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Clonotril 0.5',         'Clonazepam 0.5mg',        'Cipla Ltd',                  'Anxiolytic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Alprax 0.25',           'Alprazolam 0.25mg',       'Torrent Pharmaceuticals',    'Anxiolytic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Alprax 0.5',            'Alprazolam 0.5mg',        'Torrent Pharmaceuticals',    'Anxiolytic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Restyl 0.25',           'Alprazolam 0.25mg',       'Cipla Ltd',                  'Anxiolytic',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Nexito Plus',           'Escitalopram+Clonazepam', 'Sun Pharmaceutical Ind.',    'Antidepressant','Tablet','3004', 12, 'H',  0, 10));
meds.push(addMed('Nexito 5',              'Escitalopram 5mg',        'Sun Pharmaceutical Ind.',    'Antidepressant','Tablet','3004', 12, 'H',  0, 14));
meds.push(addMed('Nexito 10',             'Escitalopram 10mg',       'Sun Pharmaceutical Ind.',    'Antidepressant','Tablet','3004', 12, 'H',  0, 14));
meds.push(addMed('Cipralex 10',           'Escitalopram 10mg',       'Lundbeck India',             'Antidepressant','Tablet','3004', 12, 'H',  0, 28));
meds.push(addMed('Serta 50',              'Sertraline 50mg',         'Torrent Pharmaceuticals',    'Antidepressant','Tablet','3004', 12, 'H',  0, 14));
meds.push(addMed('Zoloft 50',             'Sertraline 50mg',         'Pfizer Ltd India',           'Antidepressant','Tablet','3004', 12, 'H',  0, 14));
meds.push(addMed('Flunil 20',             'Fluoxetine 20mg',         'Intas Pharmaceuticals',      'Antidepressant','Capsule','3004',12, 'H',  0, 10));
meds.push(addMed('Prodep 20',             'Fluoxetine 20mg',         'Sun Pharmaceutical Ind.',    'Antidepressant','Capsule','3004',12, 'H',  0, 10));
meds.push(addMed('Prothiaden 75',         'Dothiepin 75mg',          'Abbott India Ltd',           'Antidepressant','Tablet','3004', 12, 'H',  0, 10));
meds.push(addMed('Sibelium 5',            'Flunarizine 5mg',         'Cipla Ltd',                  'Anti-migraine','Tablet','3004', 12, 'H',   0, 10));
meds.push(addMed('Migranil',              'Dihydroergotamine+Caffeine','Novartis India Ltd',        'Anti-migraine','Tablet','3004', 12, 'H',  0, 10));
meds.push(addMed('Suminat 25',            'Sumatriptan 25mg',        'Sun Pharmaceutical Ind.',    'Anti-migraine','Tablet','3004', 12, 'H',   0, 2));
meds.push(addMed('Neuropathol',           'Pregabalin 75mg',         'Mankind Pharma Ltd',         'Neuropathic', 'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Lyrica 75',             'Pregabalin 75mg',         'Pfizer Ltd India',           'Neuropathic', 'Capsule', '3004', 12, 'H',   0, 14));
meds.push(addMed('Pregeb 75',             'Pregabalin 75mg',         'Sun Pharmaceutical Ind.',    'Neuropathic', 'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Gabapin NT 100',        'Gabapentin+Nortriptyline','Intas Pharmaceuticals',      'Neuropathic', 'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Gabapentin 300',        'Gabapentin 300mg',        'Sun Pharmaceutical Ind.',    'Neuropathic', 'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Syndopa 110',           'Levodopa+Carbidopa',      'Sun Pharmaceutical Ind.',    'Antiparkinsonian','Tablet','3004',12,'H',  0, 10));
meds.push(addMed('Pacitane 2',            'Trihexyphenidyl 2mg',     'Pfizer Ltd India',           'Antiparkinsonian','Tablet','3004',12,'H',  0, 30));
meds.push(addMed('Prozac 20',             'Fluoxetine 20mg',         'Eli Lilly India',            'Antidepressant','Capsule','3004',12,'H',   0, 14));

// ── UROLOGY ───────────────────────────────────────────────────────────────────
meds.push(addMed('Flomax 0.4',            'Tamsulosin 0.4mg',        'Boehringer Ingelheim',       'Alpha Blocker','Capsule','3004', 12, 'H',  0, 10));
meds.push(addMed('Urimax 0.4',            'Tamsulosin 0.4mg',        'Cipla Ltd',                  'Alpha Blocker','Capsule','3004', 12, 'H',  0, 10));
meds.push(addMed('Contiflo OD',           'Tamsulosin OD 0.4mg',     'Sun Pharmaceutical Ind.',    'Alpha Blocker','Capsule','3004', 12, 'H',  0, 10));
meds.push(addMed('Silodal 8',             'Silodosin 8mg',           'Sun Pharmaceutical Ind.',    'Alpha Blocker','Capsule','3004', 12, 'H',  0, 10));
meds.push(addMed('Fincar 5',              'Finasteride 5mg',         'Cipla Ltd',                  'Anti-BPH',    'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Proscar 5',             'Finasteride 5mg',         'MSD Pharmaceuticals',        'Anti-BPH',    'Tablet',  '3004', 12, 'H',   0, 28));
meds.push(addMed('Pyridium 100',          'Phenazopyridine 100mg',   'Wyeth India',                'UTI Relief',  'Tablet',  '3004', 12, 'H',   0, 12));
meds.push(addMed('Ural Sachet',           'Urinary Alkalizer',       'Care Formulary',             'UTI Relief',  'Sachet',  '3004', 12, 'OTC', 0, 1));

// ── HORMONES ──────────────────────────────────────────────────────────────────
meds.push(addMed('Dydroboon 10',          'Dydrogesterone 10mg',     'Solvay Pharma',              'Progestogen', 'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Duphaston 10',          'Dydrogesterone 10mg',     'Abbott India Ltd',           'Progestogen', 'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Utrogestan 200',        'Progesterone 200mg',      'Besins Healthcare',          'Progestogen', 'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Meprate 10',            'Medroxyprogesterone 10mg','Pfizer Ltd India',           'Progestogen', 'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Estradiol Patch',       'Estradiol 50mcg Patch',   'Novartis India Ltd',         'Estrogen',    'Other',   '3004', 12, 'H',   0, 1));
meds.push(addMed('Premarin 0.625',        'Conjugated Estrogen',     'Pfizer Ltd India',           'Estrogen',    'Tablet',  '3004', 12, 'H',   0, 28));
meds.push(addMed('Dexamethasone 0.5',     'Dexamethasone 0.5mg',     'Sun Pharmaceutical Ind.',    'Corticosteroid','Tablet','3004', 12, 'H',  0, 30));
meds.push(addMed('Wysolone 5',            'Prednisolone 5mg',        'Pfizer Ltd India',           'Corticosteroid','Tablet','3004', 12, 'H',  0, 20));
meds.push(addMed('Wysolone 10',           'Prednisolone 10mg',       'Pfizer Ltd India',           'Corticosteroid','Tablet','3004', 12, 'H',  0, 20));
meds.push(addMed('Defcort 6',             'Deflazacort 6mg',         'Macleods Pharmaceuticals',   'Corticosteroid','Tablet','3004', 12, 'H',  0, 10));
meds.push(addMed('Medrol 4',              'Methylprednisolone 4mg',  'Pfizer Ltd India',           'Corticosteroid','Tablet','3004', 12, 'H',  0, 10));
meds.push(addMed('Hydrocortisone 100mg',  'Hydrocortisone 100mg',    'Themis Chemicals',           'Corticosteroid','Injection','3004',12,'H',0, 1));

// ── OPHTHALMOLOGY ─────────────────────────────────────────────────────────────
meds.push(addMed('Timolol Eye Drops',     'Timolol Maleate 0.5%',    'Sun Pharmaceutical Ind.',    'Anti-glaucoma','Drops',  '3004', 12, 'H',  0, 1));
meds.push(addMed('Latanoprost Eye Drop',  'Latanoprost 0.005%',      'Sun Pharmaceutical Ind.',    'Anti-glaucoma','Drops',  '3004', 12, 'H',  0, 1));
meds.push(addMed('Tobramycin Eye Drop',   'Tobramycin 0.3%',         'Cipla Ltd',                  'Antibiotic Eye','Drops', '3004', 12, 'H',  0, 1));
meds.push(addMed('Moxicip Eye Drop',      'Moxifloxacin 0.5%',       'Cipla Ltd',                  'Antibiotic Eye','Drops', '3004', 12, 'H',  0, 1));
meds.push(addMed('Tears Naturale',        'Carboxymethylcellulose',  'Alcon India Ltd',            'Lubricant Eye','Drops',  '3004', 12, 'OTC', 0, 1));
meds.push(addMed('Systane Eye Drop',      'Polyethylene Glycol',     'Alcon India Ltd',            'Lubricant Eye','Drops',  '3004', 12, 'OTC', 0, 1));
meds.push(addMed('Mydriacyl',             'Tropicamide 1%',          'Alcon India Ltd',            'Mydriatic',   'Drops',   '3004', 12, 'H',   0, 1));
meds.push(addMed('Refresh Tears',         'Carboxymethylcellulose',  'Alcon India Ltd',            'Lubricant Eye','Drops',  '3004', 12, 'OTC', 0, 1));
meds.push(addMed('Betagan Eye Drop',      'Levobunolol 0.5%',        'Allergan India',             'Anti-glaucoma','Drops',  '3004', 12, 'H',  0, 1));

// ── ENT ───────────────────────────────────────────────────────────────────────
meds.push(addMed('Nasivion Nasal Drop',   'Oxymetazoline 0.05%',     'Merck India',                'Decongestant','Drops',   '3004', 12, 'OTC', 0, 1));
meds.push(addMed('Flonase',               'Fluticasone Nasal Spray', 'GlaxoSmithKline Pharma',    'Nasal Steroid','Spray',  '3004', 12, 'H',   0, 1));
meds.push(addMed('Otrivin',               'Xylometazoline 0.1%',     'Novartis India Ltd',         'Decongestant','Drops',   '3004', 12, 'OTC', 0, 1));
meds.push(addMed('Soliwax Ear Drop',      'Paradichlorobenzene',     'Dr. Reddy\'s Laboratories',  'Ear Wax',     'Drops',   '3004', 12, 'OTC', 0, 1));
meds.push(addMed('Otosporin',             'Polymyxin B+Neomycin',    'GlaxoSmithKline Pharma',    'Antibiotic Ear','Drops',  '3004', 12, 'H', 0, 1));

// ── MUSCULOSKELETAL & PAIN ────────────────────────────────────────────────────
meds.push(addMed('Methycobal Injection',  'Methylcobalamin 500mcg/ml','Eisai Pharmaceuticals',     'Neurotropic', 'Injection','2106', 12, 'H',  0, 1));
meds.push(addMed('Moov Cream',            'Levomenthol+Methyl Salicylate','Reckitt Benckiser',     'Topical Pain','Cream',   '3304', 18, 'OTC', 0, 1));
meds.push(addMed('Volini Gel',            'Diclofenac+Methyl Salicylate','Ranbaxy Laboratories',   'Topical Pain','Gel',     '3304', 18, 'OTC', 0, 1));
meds.push(addMed('Relispray',             'Benzyl Nicotinate+Diethylamine','Cipla Ltd',            'Topical Pain','Spray',   '3304', 18, 'OTC', 0, 1));
meds.push(addMed('Iodex',                 'Methyl Salicylate+Camphor','Beiersdorf India',          'Topical Pain','Other',   '3304', 18, 'OTC', 0, 1));
meds.push(addMed('Nucoxia 90',            'Etoricoxib 90mg',         'Sun Pharmaceutical Ind.',    'COX-2 Inhibitor','Tablet','3004',12, 'H',  0, 7));
meds.push(addMed('Arcoxia 90',            'Etoricoxib 90mg',         'MSD Pharmaceuticals',        'COX-2 Inhibitor','Tablet','3004',12, 'H',  0, 7));
meds.push(addMed('Celcox 200',            'Celecoxib 200mg',         'Sun Pharmaceutical Ind.',    'COX-2 Inhibitor','Capsule','3004',12,'H',  0, 10));
meds.push(addMed('Celebrex 200',          'Celecoxib 200mg',         'Pfizer Ltd India',           'COX-2 Inhibitor','Capsule','3004',12,'H', 0, 10));
meds.push(addMed('Colospa Retard',        'Mebeverine 135mg SR',     'Mylan Pharmaceuticals',      'Antispasmodic','Tablet', '3004', 12, 'H',   0, 15));
meds.push(addMed('Etamsylate 500',        'Etamsylate 500mg',        'Nicholas Piramal India',     'Hemostatic',  'Tablet',  '3004', 12, 'H',   0, 10));

// ── ANTIVIRALS ────────────────────────────────────────────────────────────────
meds.push(addMed('Zovirax 200',           'Acyclovir 200mg',         'GlaxoSmithKline Pharma',    'Antiviral',   'Tablet',  '3004', 12, 'H',   0, 25));
meds.push(addMed('Acivir 400',            'Acyclovir 400mg',         'Cipla Ltd',                  'Antiviral',   'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Valcivir 500',          'Valacyclovir 500mg',      'Cipla Ltd',                  'Antiviral',   'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Tamiflu 75',            'Oseltamivir 75mg',        'Roche India',                'Antiviral',   'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Hepcinat 400',          'Sofosbuvir 400mg',        'Natco Pharma Ltd',           'Antiviral',   'Tablet',  '3004', 12, 'H1',  1, 28));
meds.push(addMed('Tenofovir 300',         'Tenofovir 300mg',         'Cipla Ltd',                  'Antiviral',   'Tablet',  '3004', 12, 'H',   0, 30));
meds.push(addMed('Lamivudine 150',        'Lamivudine 150mg',        'Cipla Ltd',                  'Antiviral',   'Tablet',  '3004', 12, 'H',   0, 30));

// ── ONCOLOGY (H1) ─────────────────────────────────────────────────────────────
meds.push(addMed('Methotrexate 2.5',      'Methotrexate 2.5mg',      'Pfizer Ltd India',           'Anticancer',  'Tablet',  '3004', 12, 'H1',  1, 10));
meds.push(addMed('Gleevec 400',           'Imatinib 400mg',          'Novartis India Ltd',         'Anticancer',  'Tablet',  '3004', 12, 'H1',  1, 10));
meds.push(addMed('Capecitabine 500',      'Capecitabine 500mg',      'Roche India',                'Anticancer',  'Tablet',  '3004', 12, 'H1',  1, 10));
meds.push(addMed('Letrozole 2.5',         'Letrozole 2.5mg',         'Sun Pharmaceutical Ind.',    'Anticancer',  'Tablet',  '3004', 12, 'H',   0, 10));
meds.push(addMed('Tamoxifen 10',          'Tamoxifen 10mg',          'Alkem Laboratories Ltd',     'Anticancer',  'Tablet',  '3004', 12, 'H',   0, 10));

// ── PEDIATRICS ────────────────────────────────────────────────────────────────
meds.push(addMed('Crocin Drops',          'Paracetamol 100mg/ml',    'GlaxoSmithKline Pharma',    'Analgesic',   'Drops',   '3004', 5,  'OTC', 0, 1));
meds.push(addMed('Meftal P Drops',        'Mefenamic Acid Drops',    'Blue Cross Laboratories',    'NSAID',       'Drops',   '3004', 12, 'H',   0, 1));
meds.push(addMed('Ziprax CV 50',          'Cefpodoxime+Clavulanate', 'Mankind Pharma Ltd',         'Antibiotic',  'Syrup',   '3004', 12, 'H',   0, 1));
meds.push(addMed('Azee 200 DT',           'Azithromycin 200mg DT',   'Cipla Ltd',                  'Antibiotic',  'Tablet',  '3004', 12, 'H',   0, 3));
meds.push(addMed('Pediacef Syrup',        'Cefixime 100mg/5ml',      'Cipla Ltd',                  'Antibiotic',  'Syrup',   '3004', 12, 'H',   0, 1));
meds.push(addMed('ORS Electral',          'ORS Powder',              'FDC Ltd',                    'ORS',         'Sachet',  '2106', 5,  'OTC', 0, 1));
meds.push(addMed('Pedialyte',             'Electrolyte Solution',    'Abbott India Ltd',           'ORS',         'Syrup',   '2106', 5,  'OTC', 0, 1));
meds.push(addMed('Humog HP 75',           'Human Menopausal Gonadotropin','Bharat Serums',         'Hormone',     'Injection','3004', 12, 'H',  0, 1));

// ── IMMUNOLOGY / ALLERGY ──────────────────────────────────────────────────────
meds.push(addMed('Prednisolone 20mg',     'Prednisolone 20mg',       'Cipla Ltd',                  'Corticosteroid','Tablet','3004', 12, 'H',  0, 10));
meds.push(addMed('Methyl Prednisolone 8', 'Methylprednisolone 8mg',  'Pfizer Ltd India',           'Corticosteroid','Tablet','3004', 12, 'H',  0, 10));
meds.push(addMed('Betamethasone 0.5',     'Betamethasone 0.5mg',     'GlaxoSmithKline Pharma',    'Corticosteroid','Tablet','3004', 12, 'H',  0, 20));
meds.push(addMed('Dexamethasone 4mg Inj','Dexamethasone 4mg/ml',     'Sun Pharmaceutical Ind.',    'Corticosteroid','Injection','3004',12,'H',0,1));
meds.push(addMed('Hydrocortisone Cream',  'Hydrocortisone 1%',       'Cipla Ltd',                  'Steroid Skin','Cream',   '3304', 18, 'OTC', 0, 1));
meds.push(addMed('OmniCef 300',           'Cefdinir 300mg',          'Abbott India Ltd',           'Antibiotic',  'Capsule', '3004', 12, 'H',   0, 10));
meds.push(addMed('Azoran 50',             'Azathioprine 50mg',       'Sun Pharmaceutical Ind.',    'Immunosuppressant','Tablet','3004',12,'H1',1,10));

// ── HEPATOLOGY ────────────────────────────────────────────────────────────────
meds.push(addMed('Ursocol 300',           'Ursodeoxycholic Acid 300mg','Sun Pharmaceutical Ind.',  'Hepatoprotective','Tablet','3004',12,'H',0,10));
meds.push(addMed('Udiliv 300',            'UDCA 300mg',              'Abbott India Ltd',           'Hepatoprotective','Tablet','3004',12,'H',0,10));
meds.push(addMed('Liv 52',               'Liver Tonic Herbal',       'Himalaya Drug Company',      'Hepatoprotective','Tablet','3004',5, 'OTC',0,12));
meds.push(addMed('Silymarin 140',         'Silymarin 140mg',         'Sun Pharmaceutical Ind.',    'Hepatoprotective','Capsule','3004',12,'OTC',0,10));

// ── AYURVEDIC / HERBAL ────────────────────────────────────────────────────────
meds.push(addMed('Septilin',              'Guduchi+Licorice',        'Himalaya Drug Company',      'Immunomodulator','Tablet','2106',5,'OTC',0,20));
meds.push(addMed('Confido',               'Ashwagandha+Salab Mishri','Himalaya Drug Company',      'Herbal',       'Tablet', '2106', 5, 'OTC', 0, 20));
meds.push(addMed('Himcolin Gel',          'Botanical Herbs',         'Himalaya Drug Company',      'Herbal',       'Gel',    '3304', 18, 'OTC', 0, 1));
meds.push(addMed('Diabecon',              'Shilajeet+Meshashringi',  'Himalaya Drug Company',      'Herbal',       'Tablet', '2106', 5, 'OTC', 0, 60));
meds.push(addMed('Cystone',               'Shilapushpa+Pasanabheda', 'Himalaya Drug Company',      'Urinary',      'Tablet', '2106', 5, 'OTC', 0, 60));
meds.push(addMed('Triphala Churna',       'Amla+Haritaki+Bibhitaki', 'Dabur India Ltd',            'Herbal',       'Powder', '1211', 5, 'OTC', 0, 1));
meds.push(addMed('Ashwagandha Churna',    'Withania Somnifera',      'Patanjali Ayurved',          'Adaptogen',    'Powder', '1211', 5, 'OTC', 0, 1));
meds.push(addMed('Chyawanprash Special', 'Amalaki+Herbs',           'Dabur India Ltd',            'Tonic',        'Other',  '2106', 5, 'OTC', 0, 1));
meds.push(addMed('Himalaya Bonnisan',     'Dill+Fennel Herbal',      'Himalaya Drug Company',      'Pediatric',    'Syrup',  '2106', 5, 'OTC', 0, 1));
meds.push(addMed('Mentat',                'Brahmi+Ashwagandha',      'Himalaya Drug Company',      'Neurotropic',  'Tablet', '2106', 5, 'OTC', 0, 10));

// ── MISC ──────────────────────────────────────────────────────────────────────
meds.push(addMed('Dettol Antiseptic',     'Chloroxylenol 4.8%',      'Reckitt Benckiser',          'Antiseptic',   'Liquid',  '3808', 18, 'OTC', 0, 1));
meds.push(addMed('Savlon Liquid',         'Chlorhexidine+Cetrimide', 'ICI India Ltd',              'Antiseptic',   'Liquid',  '3808', 18, 'OTC', 0, 1));
meds.push(addMed('ORS I.V. 500ml',        'Normal Saline 0.9%',      'Baxter India',               'IV Fluid',     'Injection','2844', 12, 'H',  0, 1));
meds.push(addMed('Ringer Lactate 500ml',  'Ringer Lactate',          'Baxter India',               'IV Fluid',     'Injection','2844', 12, 'H',  0, 1));
meds.push(addMed('Dextrose 5% 500ml',     'Dextrose 5%',             'Baxter India',               'IV Fluid',     'Injection','1702', 12, 'H',  0, 1));
meds.push(addMed('Insulin Syringe U100',  '1ml U100 Insulin Syringe','BD Medical India',           'Medical Device','Other',  '9018', 12, 'OTC', 0, 1));
meds.push(addMed('Glucocheck Strip',      'Blood Glucose Test Strip', 'Johnson & Johnson',          'Diagnostic',   'Other',   '9027', 12, 'OTC', 0, 1));
meds.push(addMed('Accu-Chek Strip',       'Blood Glucose Test Strip', 'Roche India',               'Diagnostic',   'Other',   '9027', 12, 'OTC', 0, 1));
meds.push(addMed('Neosporin Powder',      'Bacitracin+Neomycin',     'Johnson & Johnson',          'Antibiotic Skin','Powder','3304', 18, 'OTC', 0, 1));
meds.push(addMed('Burnol Cream 0.5%',     'Tannic Acid 2%',          'German Remedies',            'Burns',        'Cream',   '3304', 18, 'OTC', 0, 1));
meds.push(addMed('Cetaphil Moisturizer',  'Moisturizing Cream',      'Galderma India',             'Dermatology',  'Cream',   '3304', 18, 'OTC', 0, 1));

// extra fillers to reach ~560 ─────────────────────────────────────────────────
const extraMeds = [
  ['Emflam 400',     'Mefenamic Acid 400mg',    'Zydus Lifesciences',    'NSAID',      'Tablet', '3004', 12, 'H', 0, 10],
  ['Maxolon 10',     'Metoclopramide 10mg',     'GlaxoSmithKline Pharma','Antiemetic', 'Tablet', '3004', 12, 'H', 0, 30],
  ['Zofran 4',       'Ondansetron 4mg',         'GlaxoSmithKline Pharma','Antiemetic', 'Tablet', '3004', 12, 'H', 0, 10],
  ['Zofer 8',        'Ondansetron 8mg',         'Cipla Ltd',             'Antiemetic', 'Tablet', '3004', 12, 'H', 0, 10],
  ['Loperamide 2',   'Loperamide 2mg',          'Cipla Ltd',             'Antidiarrheal','Capsule','3004',12,'OTC',0,6],
  ['Imodium 2',      'Loperamide 2mg',          'Johnson & Johnson',     'Antidiarrheal','Capsule','3004',12,'OTC',0,6],
  ['Pepto-Bismol',   'Bismuth Subsalicylate',   'Procter & Gamble Health','Antidiarrheal','Tablet','3004',12,'OTC',0,10],
  ['Norset 15',      'Mirtazapine 15mg',        'Organon India',         'Antidepressant','Tablet','3004',12,'H',0,10],
  ['Zolpidem 10',    'Zolpidem 10mg',           'Sun Pharmaceutical Ind.','Sedative',  'Tablet', '3004', 12, 'H', 0, 10],
  ['Nitrazepam 5',   'Nitrazepam 5mg',          'Sun Pharmaceutical Ind.','Hypnotic',  'Tablet', '3004', 12, 'H', 0, 10],
  ['Frisium 10',     'Clobazam 10mg',           'Sanofi India Ltd',      'Antiepileptic','Tablet','3004',12,'H',0,10],
  ['Carbigen 200',   'Carbamazapine 200mg CR',  'Sun Pharmaceutical Ind.','Antiepileptic','Tablet','3004',12,'H',0,10],
  ['Oxetol 300',     'Oxcarbazepine 300mg',     'Sun Pharmaceutical Ind.','Antiepileptic','Tablet','3004',12,'H',0,10],
  ['Epitab 200',     'Carbamazepine 200mg',     'Torrent Pharmaceuticals','Antiepileptic','Tablet','3004',12,'H',0,10],
  ['Dilantin 100',   'Phenytoin 100mg ER',      'Pfizer Ltd India',      'Antiepileptic','Capsule','3004',12,'H',0,30],
  ['Lioresal 10',    'Baclofen 10mg',           'Novartis India Ltd',    'Muscle Relaxant','Tablet','3004',12,'H',0,30],
  ['Myospaz',        'Chlorzoxazone+Paracetamol','Mankind Pharma Ltd',   'Muscle Relaxant','Tablet','3004',12,'H',0,10],
  ['Carisoma 350',   'Carisoprodol 350mg',      'Wallace Pharma',        'Muscle Relaxant','Tablet','3004',12,'H',0,30],
  ['Thiocolchicoside 4','Thiocolchicoside 4mg', 'Sun Pharmaceutical Ind.','Muscle Relaxant','Tablet','3004',12,'H',0,10],
  ['Robafen',        'Methocarbamol 750mg',     'Robins India',          'Muscle Relaxant','Tablet','3004',12,'H',0,10],
  ['Dicyclomine 20', 'Dicyclomine 20mg',        'Cipla Ltd',             'Antispasmodic','Tablet', '3004',12,'H',0,30],
  ['Pantop 40',      'Pantoprazole 40mg',       'Aristo Pharmaceuticals','PPI','Tablet','3004',12,'H',0,10],
  ['Omesec 20',      'Omeprazole 20mg',         'Cipla Ltd',             'PPI','Capsule','3004',12,'H',0,15],
  ['Lansoprazole 30','Lansoprazole 30mg',       'Dr. Reddy\'s Laboratories','PPI','Capsule','3004',12,'H',0,14],
  ['Prevacid 30',    'Lansoprazole 30mg',       'Takeda India',          'PPI','Capsule','3004',12,'H',0,14],
  ['Aciloc 150',     'Ranitidine 150mg',        'Cadila Healthcare',     'H2 Blocker','Tablet','3004',12,'OTC',0,10],
  ['Acimax 20',      'Omeprazole 20mg',         'Intas Pharmaceuticals', 'PPI','Capsule','3004',12,'H',0,15],
  ['Fabiflu 200',    'Favipiravir 200mg',       'Glenmark Pharmaceuticals','Antiviral','Tablet','3004',12,'H',0,10],
  ['Molnunat 200',   'Molnupiravir 200mg',      'Natco Pharma Ltd',      'Antiviral','Capsule','3004',12,'H',0,10],
  ['Paxlovid',       'Nirmatrelvir+Ritonavir',  'Pfizer Ltd India',      'Antiviral','Tablet','3004',12,'H',0,10],
  ['Remdesivir 100', 'Remdesivir 100mg',        'Cipla Ltd',             'Antiviral','Injection','3004',12,'H',0,1],
  ['Ivermectin 12',  'Ivermectin 12mg',         'Sun Pharmaceutical Ind.','Antiparasitic','Tablet','3004',12,'H',0,1],
  ['Albendazole 400','Albendazole 400mg',       'GlaxoSmithKline Pharma','Antiparasitic','Tablet','3004',12,'OTC',0,1],
  ['Zentel 400',     'Albendazole 400mg',       'GlaxoSmithKline Pharma','Antiparasitic','Tablet','3004',12,'OTC',0,1],
  ['Mebendazole 100','Mebendazole 100mg',       'Cipla Ltd',             'Antiparasitic','Tablet','3004',12,'OTC',0,6],
  ['Combantrin',     'Pyrantel Pamoate 250mg',  'Johnson & Johnson',     'Antiparasitic','Tablet','3004',12,'OTC',0,3],
  ['Chloroquine 250','Chloroquine 250mg',       'Ipca Laboratories',     'Antimalarial','Tablet','3004',12,'H',0,14],
  ['Artequick',      'Artemisinin+Piperaquine', 'Cipla Ltd',             'Antimalarial','Tablet','3004',12,'H',0,6],
  ['Coartem',        'Artemether+Lumefantrine', 'Novartis India Ltd',    'Antimalarial','Tablet','3004',12,'H',0,6],
  ['P-Alaxin',       'Dihydroartemisinin+Piperaquine','Ipca Laboratories','Antimalarial','Tablet','3004',12,'H',0,6],
  ['Spasmo Proxyvon','Dextropropoxyphene+Paracetamol','Wockhardt Ltd',   'Analgesic','Capsule','3004',12,'H',0,10],
  ['Tramadol 50',    'Tramadol 50mg HCl',       'Sun Pharmaceutical Ind.','Opioid','Capsule','3004',12,'H',0,10],
  ['Ultracet',       'Tramadol+Paracetamol',    'Janssen Pharmaceuticals','Analgesic','Tablet','3004',12,'H',0,10],
  ['Dytor 10',       'Torsemide 10mg',          'Cipla Ltd',             'Diuretic','Tablet','3004',12,'H',0,10],
  ['Lasix 40',       'Furosemide 40mg',         'Sanofi India Ltd',      'Diuretic','Tablet','3004',12,'H',0,30],
  ['Aldactone 25',   'Spironolactone 25mg',     'Pfizer Ltd India',      'Diuretic','Tablet','3004',12,'H',0,30],
  ['Inspra 25',      'Eplerenone 25mg',         'Pfizer Ltd India',      'Diuretic','Tablet','3004',12,'H',0,30],
  ['Diamox 250',     'Acetazolamide 250mg',     'Pfizer Ltd India',      'Diuretic','Tablet','3004',12,'H',0,30],
  ['Hydralazine 25', 'Hydralazine 25mg',        'Cipla Ltd',             'Antihypertensive','Tablet','3004',12,'H',0,30],
  ['Aldomet 250',    'Methyldopa 250mg',        'MSD Pharmaceuticals',   'Antihypertensive','Tablet','3004',12,'H',0,30],
  ['Nicardia 10',    'Nifedipine 10mg',         'Torrent Pharmaceuticals','CCB','Capsule','3004',12,'H',0,30],
  ['Coveram 5/5',    'Perindopril+Amlodipine',  'Servier India',         'ACEi+CCB','Tablet','3004',12,'H',0,30],
  ['Aceten 5',       'Captopril 5mg',           'Cipla Ltd',             'ACEi','Tablet','3004',12,'H',0,30],
  ['Envas 5',        'Enalapril 5mg',           'Cadila Healthcare',     'ACEi','Tablet','3004',12,'H',0,14],
  ['Ramipres 5',     'Ramipril 5mg',            'Cipla Ltd',             'ACEi','Tablet','3004',12,'H',0,15],
  ['Cardace 5',      'Ramipril 5mg',            'Sanofi India Ltd',      'ACEi','Tablet','3004',12,'H',0,15],
  ['Ramistar 2.5',   'Ramipril 2.5mg',          'Sun Pharmaceutical Ind.','ACEi','Tablet','3004',12,'H',0,15],
  ['Lisinopril 5',   'Lisinopril 5mg',          'Sun Pharmaceutical Ind.','ACEi','Tablet','3004',12,'H',0,30],
  ['Valsartan 80',   'Valsartan 80mg',          'Novartis India Ltd',    'ARB','Tablet','3004',12,'H',0,14],
  ['Diovan 80',      'Valsartan 80mg',          'Novartis India Ltd',    'ARB','Tablet','3004',12,'H',0,28],
  ['Sacubitril+Valsartan','Sacubitril+Valsartan 100mg','Novartis India Ltd','Combination','Tablet','3004',12,'H',0,14],
  ['Digoxin 0.25',   'Digoxin 0.25mg',          'GlaxoSmithKline Pharma','Cardiac Glycoside','Tablet','3004',12,'H',0,30],
  ['Amiodarone 200', 'Amiodarone 200mg',        'Sun Pharmaceutical Ind.','Antiarrhythmic','Tablet','3004',12,'H',0,10],
  ['Cordarone 200',  'Amiodarone 200mg',        'Sanofi India Ltd',      'Antiarrhythmic','Tablet','3004',12,'H',0,30],
  ['Warfarin 2',     'Warfarin 2mg',            'GlaxoSmithKline Pharma','Anticoagulant','Tablet','3004',12,'H',0,30],
  ['Acitrom 2',      'Acenocoumarol 2mg',       'Nicholas Piramal India','Anticoagulant','Tablet','3004',12,'H',0,30],
  ['Heparin 5000 Inj','Heparin 5000 IU/ml',    'Biological E',          'Anticoagulant','Injection','3004',12,'H',0,1],
  ['Enoxaparin 40',  'Enoxaparin 40mg/0.4ml',  'Sanofi India Ltd',      'LMWH','Injection','3004',12,'H',0,1],
  ['Rivaroxaban 20', 'Rivaroxaban 20mg',        'Bayer Zydus Pharma',    'NOAC','Tablet','3004',12,'H',0,14],
  ['Apixaban 5',     'Apixaban 5mg',            'Pfizer Ltd India',      'NOAC','Tablet','3004',12,'H',0,10],
  ['Dabigatran 110', 'Dabigatran 110mg',        'Boehringer Ingelheim',  'NOAC','Capsule','3004',12,'H',0,30],
  ['Tranexamic 500', 'Tranexamic Acid 500mg',   'Sun Pharmaceutical Ind.','Hemostatic','Tablet','3004',12,'H',0,10],
  ['Etamsylate 250', 'Etamsylate 250mg',        'Cipla Ltd',             'Hemostatic','Tablet','3004',12,'H',0,10],
  ['Phytomenadione', 'Vitamin K1 10mg',         'Cipla Ltd',             'Hemostatic','Tablet','3004',12,'H',0,10],
  ['Allopurinol 100','Allopurinol 100mg',       'Cipla Ltd',             'Antigout','Tablet','3004',12,'H',0,30],
  ['Allopurinol 300','Allopurinol 300mg',       'Cipla Ltd',             'Antigout','Tablet','3004',12,'H',0,30],
  ['Febucip 40',     'Febuxostat 40mg',         'Cipla Ltd',             'Antigout','Tablet','3004',12,'H',0,10],
  ['Colchicine 0.5', 'Colchicine 0.5mg',        'Sun Pharmaceutical Ind.','Antigout','Tablet','3004',12,'H',0,10],
  ['Benzbromarone 50','Benzbromarone 50mg',     'Albert David Ltd',      'Antigout','Tablet','3004',12,'H',0,10],
  ['Hydroxychloroquine 400','Hydroxychloroquine 400mg','Ipca Laboratories','DMARD','Tablet','3004',12,'H',0,10],
  ['Plaquenil 200',  'Hydroxychloroquine 200mg','Sanofi India Ltd',      'DMARD','Tablet','3004',12,'H',0,30],
  ['Sulfasalazine 500','Sulfasalazine 500mg',   'Sun Pharmaceutical Ind.','DMARD','Tablet','3004',12,'H',0,10],
  ['Leflunomide 10', 'Leflunomide 10mg',        'Cipla Ltd',             'DMARD','Tablet','3004',12,'H',0,10],
  ['Imuran 50',      'Azathioprine 50mg',       'Glaxo SmithKline',      'Immunosuppressant','Tablet','3004',12,'H1',1,10],
  ['Actilyse 50mg',  'Alteplase 50mg',          'Boehringer Ingelheim',  'Thrombolytic','Injection','3004',12,'H',0,1],
  ['Noromycin 100',  'Norfloxacin 100mg Susp',  'Cipla Ltd',             'Antibiotic','Syrup','3004',12,'H',0,1],
  ['Clindac A',      'Clindamycin 1% Gel',      'Cipla Ltd',             'Antibiotic Skin','Gel','3304',18,'H',0,1],
  ['Betadine Solution','Povidone Iodine 10%',   'Win Medicare Ltd',      'Antiseptic','Liquid','3808',18,'OTC',0,1],
  ['Framycetin 1%',  'Framycetin Sulphate 1%',  'Sanofi India Ltd',      'Antibiotic Skin','Cream','3304',18,'H',0,1],
  ['Nitrofurantoin 100','Nitrofurantoin 100mg', 'Macleods Pharmaceuticals','Antibiotic','Capsule','3004',12,'H',0,14],
  ['Macrobid 100',   'Nitrofurantoin 100mg MR', 'Pfizer Ltd India',      'Antibiotic','Capsule','3004',12,'H',0,14],
  ['Fosfomycin 3g',  'Fosfomycin 3g',           'Zuventus Healthcare',   'Antibiotic','Sachet','3004',12,'H',0,1],
  ['Piperacillin+Tazo','Piperacillin+Tazobactam 4.5g','Cipla Ltd',       'Antibiotic','Injection','3004',12,'H',0,1],
  ['Colistin 1.5M',  'Colistin 1.5M IU',        'Zuventus Healthcare',   'Antibiotic','Injection','3004',12,'H1',1,1],
  ['Vancomycin 500', 'Vancomycin 500mg',        'Sun Pharmaceutical Ind.','Antibiotic','Injection','3004',12,'H',0,1],
  ['Imipenem+Cilastatin','Imipenem 500mg+Cilastatin','MSD Pharmaceuticals','Antibiotic','Injection','3004',12,'H',0,1],
  ['Linezolid 600',  'Linezolid 600mg',         'Sun Pharmaceutical Ind.','Antibiotic','Tablet','3004',12,'H1',1,10],
  ['Rifampicin 450', 'Rifampicin 450mg',        'Cipla Ltd',             'Anti-TB','Capsule','3004',12,'H',0,10],
  ['Isoniazid 300',  'Isoniazid 300mg',         'Cipla Ltd',             'Anti-TB','Tablet','3004',12,'H',0,30],
  ['Pyrazinamide 750','Pyrazinamide 750mg',     'Cipla Ltd',             'Anti-TB','Tablet','3004',12,'H',0,10],
  ['Ethambutol 800', 'Ethambutol 800mg',        'Lupin Ltd',             'Anti-TB','Tablet','3004',12,'H',0,10],
  ['R-Cinex',        'Rifampicin+Isoniazid',    'Lupin Ltd',             'Anti-TB','Tablet','3004',12,'H',0,10],
  ['RIFE 4',         'Rifampicin+Isoniazid+Pyrazinamide+Ethambutol','Macleods','Anti-TB','Tablet','3004',12,'H',0,10],
  ['Niacin 500',     'Nicotinic Acid 500mg',    'Cipla Ltd',             'Vitamin','Tablet','2106',5,'OTC',0,30],
  ['Pyridoxine 40',  'Pyridoxine 40mg',         'Abbott India Ltd',      'Vitamin','Tablet','2106',5,'OTC',0,30],
  ['Thiamine 100',   'Thiamine HCl 100mg',      'Cipla Ltd',             'Vitamin','Tablet','2106',5,'OTC',0,30],
  ['Riboflavin 10',  'Riboflavin 10mg',         'Sun Pharmaceutical Ind.','Vitamin','Tablet','2106',5,'OTC',0,30],
  ['Biotin 5mg',     'Biotin 5mg',              'Abbott India Ltd',      'Vitamin','Tablet','2106',5,'OTC',0,30],
  ['Omega 3 1000',   'Omega 3 Fatty Acids 1g',  'Sun Pharmaceutical Ind.','Supplement','Capsule','2106',12,'OTC',0,10],
  ['Flaxseed Oil 1g','Flaxseed Oil 1000mg',     'Himalaya Drug Company', 'Supplement','Capsule','2106',5,'OTC',0,30],
  ['Coral Calcium',  'Calcium Carbonate+Vit D3','Cipla Ltd',             'Calcium','Tablet','2106',5,'OTC',0,15],
  ['Cal C 500',      'Calcium Carbonate 1.25g', 'Abbott India Ltd',      'Calcium','Tablet','2106',5,'OTC',0,30],
  ['Ossopan 800',    'Hydroxyapatite 800mg',    'Sun Pharmaceutical Ind.','Calcium','Tablet','2106',5,'OTC',0,30],
];
for (const e of extraMeds) {
  meds.push(addMed(...e));
}
console.log(`✅ ${meds.length} Medicines inserted.`);

// ══════════════════════════════════════════════════════════════════════════════
// 5. BATCHES (2-3 batches per medicine with varied expiry & qty)
// ══════════════════════════════════════════════════════════════════════════════
const insBatch = db.prepare(`INSERT INTO batches (medicine_id, batch_number, mfg_date, expiry_date, purchase_rate, selling_rate, mrp, quantity, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const batches = [];
for (const med of meds) {
  const numBatches = randInt(1, 3);
  for (let b = 0; b < numBatches; b++) {
    const supplier = randomOf(suppliers);
    const mfgOffset = randInt(6, 24);
    const expiryOffset = randInt(6, 24);  // months from today
    const mfgDate = subMonths(TODAY, mfgOffset);
    const expiryDate = addMonths(TODAY, expiryOffset);
    const isSyrupOrLiquid = ['Syrup','Drops','Injection','Liquid','Gel','Cream','Ointment','Lotion','Spray','Powder','Other','Sachet'].includes(med.unit_category);
    const basePrice = isSyrupOrLiquid ? randFloat(25, 250) : randFloat(10, 600);
    const purchase_rate = parseFloat((basePrice * 0.7).toFixed(2));
    const selling_rate = parseFloat((basePrice * 0.85).toFixed(2));
    const mrp = basePrice;
    const qty = isSyrupOrLiquid ? randInt(5, 50) : randInt(50, 500);
    const r = insBatch.run(med.id, nextBatch('BTH'), mfgDate, expiryDate, purchase_rate, selling_rate, mrp, qty, supplier.id);
    batches.push({ id: r.lastInsertRowid, medicine_id: med.id, mrp, selling_rate, purchase_rate, qty, supplier_id: supplier.id, expiryDate });
  }
}
// Add some near-expiry batches for dashboard alerts
for (let i = 0; i < 15; i++) {
  const med = randomOf(meds);
  const supplier = randomOf(suppliers);
  const mfgDate = subMonths(TODAY, 18);
  const expiryDate = addMonths(TODAY, randInt(1, 2)); // 1-2 months from now
  const mrp = randFloat(50, 400);
  const r = insBatch.run(med.id, nextBatch('EXP'), mfgDate, expiryDate, mrp * 0.7, mrp * 0.85, mrp, randInt(5, 30), supplier.id);
  batches.push({ id: r.lastInsertRowid, medicine_id: med.id, mrp, selling_rate: mrp * 0.85, purchase_rate: mrp * 0.7, qty: randInt(5,30), supplier_id: supplier.id, expiryDate });
}
// Add some low-stock batches
for (let i = 0; i < 20; i++) {
  const med = randomOf(meds);
  const supplier = randomOf(suppliers);
  const mrp = randFloat(20, 200);
  const r = insBatch.run(med.id, nextBatch('LOW'), subMonths(TODAY, 3), addMonths(TODAY, 12), mrp * 0.7, mrp * 0.85, mrp, randInt(1, 8), supplier.id);
  batches.push({ id: r.lastInsertRowid, medicine_id: med.id, mrp, selling_rate: mrp * 0.85, purchase_rate: mrp * 0.7, qty: randInt(1,8), supplier_id: supplier.id, expiryDate: addMonths(TODAY, 12) });
}
console.log(`✅ ${batches.length} Batches inserted.`);

// ══════════════════════════════════════════════════════════════════════════════
// 6. PURCHASES (80 purchase orders over past 12 months)
// ══════════════════════════════════════════════════════════════════════════════
const insPurchase = db.prepare(`INSERT INTO purchases (supplier_id, invoice_number, total_amount, amount_paid, notes, purchase_date) VALUES (?, ?, ?, ?, ?, ?)`);
const insPurchaseItem = db.prepare(`INSERT INTO purchase_items (purchase_id, medicine_id, batch_id, quantity, purchase_rate, selling_rate, mrp) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const insSupPay = db.prepare(`INSERT INTO supplier_payments (supplier_id, amount, payment_mode, payment_date, notes) VALUES (?, ?, ?, ?, ?)`);

let purchaseCount = 0;
for (let p = 0; p < 80; p++) {
  const supplier = randomOf(suppliers);
  const daysAgo = randInt(0, 365);
  const purchaseDate = subMonths(TODAY, 0);
  const pd = new Date(TODAY);
  pd.setDate(pd.getDate() - daysAgo);
  const pDate = pd.toISOString().slice(0, 10);
  const pNum = `PUR${2024}${String(p + 100).padStart(4, '0')}`;
  
  const pr = insPurchase.run(supplier.id, pNum, 0, 0, 'Regular purchase order', pDate);
  const purchaseId = pr.lastInsertRowid;
  
  let total = 0;
  const numItems = randInt(5, 20);
  const supplierBatches = batches.filter(b => b.supplier_id === supplier.id);
  const useBatches = supplierBatches.length > 0 ? supplierBatches : batches;
  
  for (let i = 0; i < numItems; i++) {
    const batch = randomOf(useBatches);
    const qty = randInt(10, 100);
    const lineTotal = qty * batch.purchase_rate;
    total += lineTotal;
    insPurchaseItem.run(purchaseId, batch.medicine_id, batch.id, qty, batch.purchase_rate, batch.selling_rate, batch.mrp);
  }
  
  const paid = Math.random() > 0.2 ? total : total * randFloat(0.5, 0.9);
  db.prepare('UPDATE purchases SET total_amount = ?, amount_paid = ? WHERE id = ?').run(total, paid, purchaseId);
  
  if (paid > 0) {
    insSupPay.run(supplier.id, paid, 'Cash', pDate, `Payment for ${pNum}`);
  }
  purchaseCount++;
}
console.log(`✅ ${purchaseCount} Purchases inserted.`);

// ══════════════════════════════════════════════════════════════════════════════
// 7. INVOICES / SALES (300 invoices over past 12 months)
// ══════════════════════════════════════════════════════════════════════════════
const insInvoice = db.prepare(`INSERT INTO invoices (invoice_number, customer_id, doctor_id, subtotal, discount_amount, gst_amount, total_amount, payment_mode, amount_paid, credit_amount, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insInvItem = db.prepare(`INSERT INTO invoice_items (invoice_id, medicine_id, batch_id, quantity, unit_price, mrp, discount_percent, gst_percent, gst_amount, total, tablets_per_strip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

// Get available batches with qty > 0
const getBatchesForBilling = () => batches.filter(b => b.qty > 5);

const payModes = ['Cash', 'Cash', 'Cash', 'UPI', 'UPI', 'Udhaari'];
let invoiceCount = 0;

// Group medicines by id for fast batch lookup
const medBatchMap = {};
for (const b of batches) {
  if (!medBatchMap[b.medicine_id]) medBatchMap[b.medicine_id] = [];
  medBatchMap[b.medicine_id].push(b);
}

const medIds = meds.map(m => m.id);

for (let inv = 0; inv < 300; inv++) {
  const daysAgo = randInt(0, 365);
  const invDate = new Date(TODAY);
  invDate.setDate(invDate.getDate() - daysAgo);
  invDate.setHours(randInt(9, 20), randInt(0, 59), 0);
  const invDateStr = invDate.toISOString().replace('T', ' ').slice(0, 19);
  
  const customer = Math.random() > 0.3 ? randomOf(customers) : null;
  const doctor = Math.random() > 0.6 ? randomOf(doctors) : null;
  const payMode = randomOf(payModes);
  const invoiceNumber = `INV${String(invDate.getFullYear()).slice(2)}${String(invDate.getMonth()+1).padStart(2,'0')}${String(inv + 1).padStart(4,'0')}`;
  
  const numItems = randInt(1, 8);
  let subtotal = 0;
  let gstTotal = 0;
  const processedItems = [];
  
  const availBatches = getBatchesForBilling();
  if (availBatches.length === 0) continue;
  
  for (let i = 0; i < numItems; i++) {
    const batch = randomOf(availBatches);
    const med = meds.find(m => m.id === batch.medicine_id);
    if (!med) continue;
    const qty = randInt(1, 15);
    const price = batch.selling_rate;
    const disc = Math.random() > 0.8 ? randFloat(2, 10) : 0;
    const lineTotal = qty * price * (1 - disc / 100);
    const gstPct = med.gst_percent || 12;
    const lineGst = (lineTotal * gstPct) / 100;
    subtotal += lineTotal;
    gstTotal += lineGst;
    processedItems.push({ med, batch, qty, price, disc, lineTotal, lineGst, gstPct });
  }
  
  if (processedItems.length === 0) continue;
  const discount = Math.random() > 0.9 ? randFloat(5, 50) : 0;
  const totalAmt = Math.round((subtotal + gstTotal - discount) * 100) / 100;
  const paid = payMode === 'Udhaari' ? 0 : totalAmt;
  const credit = Math.max(0, totalAmt - paid);
  
  const ir = insInvoice.run(invoiceNumber, customer?.id || null, doctor?.id || null, subtotal, discount, gstTotal, totalAmt, payMode, paid, credit, '', invDateStr);
  const invoiceId = ir.lastInsertRowid;
  
  for (const item of processedItems) {
    const tps = item.med.tablets_per_strip || 10;
    insInvItem.run(invoiceId, item.med.id, item.batch.id, item.qty, item.price, item.batch.mrp, item.disc, item.gstPct, item.lineGst, item.lineTotal, tps);
  }
  
  // Update customer credit if Udhaari
  if (customer && credit > 0) {
    db.prepare('UPDATE customers SET credit_balance = credit_balance + ? WHERE id = ?').run(credit, customer.id);
  }
  
  invoiceCount++;
}

console.log(`✅ ${invoiceCount} Invoices inserted.`);

// ══════════════════════════════════════════════════════════════════════════════
// FINAL SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
const stats = {
  suppliers: db.prepare('SELECT COUNT(*) as n FROM suppliers').get().n,
  doctors: db.prepare('SELECT COUNT(*) as n FROM doctors').get().n,
  customers: db.prepare('SELECT COUNT(*) as n FROM customers').get().n,
  medicines: db.prepare('SELECT COUNT(*) as n FROM medicines').get().n,
  batches: db.prepare('SELECT COUNT(*) as n FROM batches').get().n,
  purchases: db.prepare('SELECT COUNT(*) as n FROM purchases').get().n,
  invoices: db.prepare('SELECT COUNT(*) as n FROM invoices').get().n,
  invoiceItems: db.prepare('SELECT COUNT(*) as n FROM invoice_items').get().n,
  totalSales: db.prepare('SELECT COALESCE(SUM(total_amount),0) as t FROM invoices').get().t,
};

console.log('\n🎉 Seeding Complete!\n');
console.log('══════════════════════════════════════════');
console.log(`  Suppliers       : ${stats.suppliers}`);
console.log(`  Doctors         : ${stats.doctors}`);
console.log(`  Customers       : ${stats.customers}`);
console.log(`  Medicines       : ${stats.medicines}`);
console.log(`  Batches         : ${stats.batches}`);
console.log(`  Purchases       : ${stats.purchases}`);
console.log(`  Invoices        : ${stats.invoices}`);
console.log(`  Invoice Items   : ${stats.invoiceItems}`);
console.log(`  Total Sales     : ₹${stats.totalSales.toFixed(2)}`);
console.log('══════════════════════════════════════════');
console.log('\nRun "npm run dev" to start the application.\n');

db.close();
