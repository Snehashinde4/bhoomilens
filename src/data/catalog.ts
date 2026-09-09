/**
 * Reference master data for the synthetic engine.
 * State centroids are approximate administrative centres, sufficient for a
 * cartographic prototype; they are not survey-grade coordinates.
 */

export interface StateSeed {
  code: string;
  name: string;
  zone: string;
  center: [number, number]; // [lng, lat]
  districts: string[];
  language: string;
}

export const STATE_SEEDS: StateSeed[] = [
  { code: 'AP', name: 'Andhra Pradesh', zone: 'South', center: [80.05, 15.91], language: 'te', districts: ['Guntur', 'Visakhapatnam', 'Kurnool', 'Anantapur', 'Chittoor', 'Nellore'] },
  { code: 'AR', name: 'Arunachal Pradesh', zone: 'North East', center: [94.73, 28.22], language: 'en', districts: ['Papum Pare', 'Tawang', 'Changlang', 'West Siang'] },
  { code: 'AS', name: 'Assam', zone: 'North East', center: [92.94, 26.2], language: 'bn', districts: ['Kamrup', 'Dibrugarh', 'Nagaon', 'Cachar', 'Sonitpur'] },
  { code: 'BR', name: 'Bihar', zone: 'East', center: [85.31, 25.6], language: 'hi', districts: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga', 'Purnia'] },
  { code: 'CG', name: 'Chhattisgarh', zone: 'Central', center: [81.86, 21.28], language: 'hi', districts: ['Raipur', 'Bilaspur', 'Durg', 'Korba', 'Bastar'] },
  { code: 'GA', name: 'Goa', zone: 'West', center: [74.12, 15.3], language: 'mr', districts: ['North Goa', 'South Goa'] },
  { code: 'GJ', name: 'Gujarat', zone: 'West', center: [71.19, 22.26], language: 'gu', districts: ['Ahmedabad', 'Surat', 'Rajkot', 'Vadodara', 'Bhavnagar', 'Kutch'] },
  { code: 'HR', name: 'Haryana', zone: 'North', center: [76.09, 29.06], language: 'hi', districts: ['Gurugram', 'Faridabad', 'Hisar', 'Karnal', 'Rohtak', 'Ambala'] },
  { code: 'HP', name: 'Himachal Pradesh', zone: 'North', center: [77.17, 31.11], language: 'hi', districts: ['Shimla', 'Kangra', 'Mandi', 'Solan'] },
  { code: 'JH', name: 'Jharkhand', zone: 'East', center: [85.28, 23.61], language: 'hi', districts: ['Ranchi', 'Dhanbad', 'Jamshedpur', 'Bokaro', 'Hazaribagh'] },
  { code: 'KA', name: 'Karnataka', zone: 'South', center: [75.71, 15.32], language: 'kn', districts: ['Bengaluru Rural', 'Mysuru', 'Belagavi', 'Kalaburagi', 'Tumakuru', 'Dharwad'] },
  { code: 'KL', name: 'Kerala', zone: 'South', center: [76.27, 10.85], language: 'en', districts: ['Ernakulam', 'Thrissur', 'Kozhikode', 'Palakkad', 'Kollam'] },
  { code: 'MP', name: 'Madhya Pradesh', zone: 'Central', center: [78.66, 22.97], language: 'hi', districts: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar'] },
  { code: 'MH', name: 'Maharashtra', zone: 'West', center: [75.71, 19.75], language: 'mr', districts: ['Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Ahmednagar', 'Thane'] },
  { code: 'MN', name: 'Manipur', zone: 'North East', center: [93.91, 24.66], language: 'en', districts: ['Imphal West', 'Imphal East', 'Churachandpur'] },
  { code: 'ML', name: 'Meghalaya', zone: 'North East', center: [91.37, 25.47], language: 'en', districts: ['East Khasi Hills', 'West Garo Hills', 'Ri Bhoi'] },
  { code: 'MZ', name: 'Mizoram', zone: 'North East', center: [92.94, 23.16], language: 'en', districts: ['Aizawl', 'Lunglei', 'Champhai'] },
  { code: 'NL', name: 'Nagaland', zone: 'North East', center: [94.56, 26.16], language: 'en', districts: ['Kohima', 'Dimapur', 'Mokokchung'] },
  { code: 'OD', name: 'Odisha', zone: 'East', center: [85.1, 20.95], language: 'or', districts: ['Khordha', 'Cuttack', 'Sundargarh', 'Ganjam', 'Balasore', 'Angul'] },
  { code: 'PB', name: 'Punjab', zone: 'North', center: [75.34, 31.15], language: 'pa', districts: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda'] },
  { code: 'RJ', name: 'Rajasthan', zone: 'North', center: [74.22, 27.02], language: 'hi', districts: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Alwar', 'Ajmer', 'Bharatpur'] },
  { code: 'SK', name: 'Sikkim', zone: 'North East', center: [88.51, 27.53], language: 'en', districts: ['East Sikkim', 'South Sikkim'] },
  { code: 'TN', name: 'Tamil Nadu', zone: 'South', center: [78.66, 11.13], language: 'ta', districts: ['Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli', 'Vellore', 'Thanjavur'] },
  { code: 'TG', name: 'Telangana', zone: 'South', center: [79.02, 18.11], language: 'te', districts: ['Rangareddy', 'Warangal', 'Karimnagar', 'Nalgonda', 'Khammam'] },
  { code: 'TR', name: 'Tripura', zone: 'North East', center: [91.99, 23.94], language: 'bn', districts: ['West Tripura', 'South Tripura'] },
  { code: 'UP', name: 'Uttar Pradesh', zone: 'North', center: [80.95, 26.85], language: 'hi', districts: ['Lucknow', 'Kanpur Nagar', 'Varanasi', 'Agra', 'Meerut', 'Gorakhpur', 'Prayagraj', 'Bareilly'] },
  { code: 'UK', name: 'Uttarakhand', zone: 'North', center: [79.02, 30.07], language: 'hi', districts: ['Dehradun', 'Haridwar', 'Nainital', 'Udham Singh Nagar'] },
  { code: 'WB', name: 'West Bengal', zone: 'East', center: [87.86, 22.99], language: 'bn', districts: ['Bardhaman', 'Nadia', 'Murshidabad', 'Hooghly', 'Bankura', 'Malda'] },
];

export const VILLAGE_STEMS = [
  'Sanganer', 'Bagru', 'Chomu', 'Amber', 'Phulera', 'Bassi', 'Kotputli', 'Shahpura',
  'Rampura', 'Devgarh', 'Nandgaon', 'Kishanpur', 'Madhopur', 'Bhilwara Khurd', 'Sultanpur',
  'Narsinghpur', 'Govindpur', 'Lakshmipur', 'Chandpur', 'Hariharpur', 'Bhagwanpur',
  'Kalyanpur', 'Mahadevpura', 'Anandpur', 'Sitapur Kalan', 'Jamalpur', 'Raghunathpur',
  'Ratanpur', 'Dhanora', 'Karanpur', 'Pipariya', 'Mohanpur', 'Salempur', 'Baragaon',
  'Bhojpur', 'Nagla Khurd', 'Tikri', 'Ujjainpur', 'Chikkanahalli', 'Doddaballapura',
  'Hosahalli', 'Nelamangala', 'Thirumalai', 'Vadakkupatti', 'Peddapalli', 'Kondapur',
];

export const TEHSIL_SUFFIXES = ['Sadar', 'Purvi', 'Pashchimi', 'Uttari', 'Dakshini', 'Khurd', 'Kalan'];

export const FIRST_NAMES = [
  'Ram Lal', 'Shyam', 'Mohan', 'Suresh', 'Ramesh', 'Kailash', 'Prakash', 'Vijay',
  'Anil', 'Sunil', 'Rajesh', 'Mahesh', 'Dinesh', 'Naresh', 'Girdhari', 'Bhanwar',
  'Hukum', 'Devi Lal', 'Chandra', 'Gopal', 'Hari', 'Jagdish', 'Kishan', 'Laxman',
  'Madan', 'Narayan', 'Om', 'Puran', 'Raghu', 'Sohan', 'Tulsi', 'Uday', 'Vasant',
  'Yogendra', 'Kamla', 'Sunita', 'Savitri', 'Geeta', 'Radha', 'Sarita', 'Meena Devi',
  'Lakshmi', 'Parvati', 'Anita', 'Kavita',
];

export const SURNAMES = [
  'Meena', 'Sharma', 'Verma', 'Yadav', 'Gupta', 'Singh', 'Chauhan', 'Patel', 'Reddy',
  'Naidu', 'Gowda', 'Rao', 'Patil', 'Deshmukh', 'Jadhav', 'Kulkarni', 'Nair', 'Menon',
  'Das', 'Mondal', 'Chakraborty', 'Sahoo', 'Behera', 'Mishra', 'Tiwari', 'Pandey',
  'Jat', 'Gurjar', 'Bishnoi', 'Rathore', 'Solanki', 'Parmar', 'Thakur', 'Kumawat',
];

export const OFFICER_FIRST = [
  'A.', 'B.', 'C.', 'D.', 'K.', 'M.', 'N.', 'P.', 'R.', 'S.', 'T.', 'V.',
];

export const AGENCIES = [
  'National Highways Authority of India',
  'Ministry of Railways',
  'State Water Resources Department',
  'Industrial Development Corporation',
  'Urban Development Authority',
  'National High Speed Rail Corporation',
  'State Public Works Department',
  'Irrigation and Command Area Development',
];

export const OFFICES = [
  'Office of the District Collector',
  'Land Acquisition Cell',
  'Revenue Department',
  'Sub-Divisional Magistrate Office',
  'Directorate of Land Records',
  'Special Land Acquisition Office',
  'Compensation Disbursement Cell',
  'R&R Implementation Unit',
];

export const COURTS = [
  'District Court',
  'High Court',
  'Land Acquisition Tribunal',
  'Revenue Board',
  'Civil Judge (Senior Division)',
];

export const HIGHWAY_CORRIDORS = [
  'NH-48', 'NH-44', 'NH-19', 'NH-27', 'NH-16', 'NH-52', 'NH-66', 'NH-30', 'NH-53', 'NH-65',
];

export const RAIL_CORRIDORS = [
  'Dedicated Freight Corridor', 'High Speed Rail Link', 'Doubling Project',
  'Gauge Conversion', 'Metro Rail Extension', 'Suburban Rail Corridor',
];

export const IRRIGATION_SCHEMES = [
  'Lift Irrigation Scheme', 'Canal Modernisation', 'Multipurpose Reservoir',
  'Barrage Project', 'Command Area Development', 'Micro Irrigation Network',
];

export const INDUSTRIAL_NODES = [
  'Industrial Corridor Node', 'Investment Region', 'Logistics Park',
  'Textile Park', 'Electronics Manufacturing Cluster', 'Mega Food Park',
];

export const URBAN_SCHEMES = [
  'Ring Road Development', 'Township Scheme', 'Smart City Zone',
  'Outer Growth Corridor', 'Riverfront Development', 'Transit Oriented Development',
];

export const BANK_NAMES = [
  'State Bank of India', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank',
  'Union Bank of India', 'Central Bank of India', 'Regional Rural Bank',
];

export const RESEARCH_TAGS = [
  'land acquisition', 'compensation', 'digitisation', 'OCR', 'cadastral survey',
  'watershed', 'remote sensing', 'title guarantee', 'mutation', 'dispute resolution',
  'rehabilitation', 'GIS', 'policy evaluation', 'delay analysis', 'record of rights',
];

/** Sample native-script strings used to demonstrate multilingual OCR evidence. */
export const NATIVE_SAMPLES: Record<string, { owner: string[]; village: string[]; classification: string[] }> = {
  hi: {
    owner: ['राम लाल मीणा', 'श्याम सिंह', 'मोहन लाल शर्मा', 'सुरेश कुमार यादव'],
    village: ['सांगानेर', 'बगरू', 'चौमूं', 'आमेर'],
    classification: ['कृषि भूमि', 'आबादी भूमि', 'सरकारी भूमि'],
  },
  mr: {
    owner: ['राम लाल पाटील', 'सुनील जाधव', 'महेश देशमुख'],
    village: ['सांगवी', 'वाघोली', 'खेड'],
    classification: ['शेतजमीन', 'बिनशेती', 'सरकारी जमीन'],
  },
  kn: {
    owner: ['ರಾಮ ಲಾಲ್ ಗೌಡ', 'ಸುರೇಶ್ ರಾವ್', 'ಮಹೇಶ್ ಶೆಟ್ಟಿ'],
    village: ['ಚಿಕ್ಕನಹಳ್ಳಿ', 'ಹೊಸಹಳ್ಳಿ', 'ನೆಲಮಂಗಲ'],
    classification: ['ಕೃಷಿ ಭೂಮಿ', 'ಕೃಷಿಯೇತರ', 'ಸರ್ಕಾರಿ ಭೂಮಿ'],
  },
  ta: {
    owner: ['ராம் லால்', 'சுரேஷ் குமார்', 'மகேஷ் ராஜ்'],
    village: ['வடக்குப்பட்டி', 'திருமலை', 'சேலம்பட்டி'],
    classification: ['விவசாய நிலம்', 'விவசாயமற்ற நிலம்'],
  },
  te: {
    owner: ['రామ్ లాల్ రెడ్డి', 'సురేష్ నాయుడు', 'మహేష్ రావు'],
    village: ['కొండాపూర్', 'పెద్దపల్లి', 'నార్సింగి'],
    classification: ['వ్యవసాయ భూమి', 'వ్యవసాయేతర భూమి'],
  },
  gu: {
    owner: ['રામ લાલ પટેલ', 'સુરેશ સોલંકી', 'મહેશ પરમાર'],
    village: ['બગોદરા', 'સાણંદ', 'ધોળકા'],
    classification: ['ખેતીની જમીન', 'બિનખેતી'],
  },
  pa: {
    owner: ['ਰਾਮ ਲਾਲ ਸਿੰਘ', 'ਸੁਰੇਸ਼ ਕੁਮਾਰ', 'ਮਹੇਸ਼ ਸਿੰਘ'],
    village: ['ਖੰਨਾ', 'ਸਮਰਾਲਾ', 'ਦੋਰਾਹਾ'],
    classification: ['ਖੇਤੀ ਜ਼ਮੀਨ', 'ਗੈਰ-ਖੇਤੀ'],
  },
  bn: {
    owner: ['রাম লাল দাস', 'সুরেশ মণ্ডল', 'মহেশ চক্রবর্তী'],
    village: ['বর্ধমান', 'নদিয়া', 'হুগলি'],
    classification: ['কৃষি জমি', 'অকৃষি জমি'],
  },
  or: {
    owner: ['ରାମ ଲାଲ ସାହୁ', 'ସୁରେଶ ବେହେରା', 'ମହେଶ ମିଶ୍ର'],
    village: ['ଖୋର୍ଦ୍ଧା', 'କଟକ', 'ଅନୁଗୁଳ'],
    classification: ['କୃଷି ଜମି', 'ଅକୃଷି ଜମି'],
  },
  ur: {
    owner: ['رام لال', 'سریش کمار', 'مہیش سنگھ'],
    village: ['سلطان پور', 'جمال پور', 'رام پور'],
    classification: ['زرعی زمین', 'غیر زرعی'],
  },
  en: {
    owner: ['Ram Lal Meena', 'Suresh Kumar', 'Mahesh Singh'],
    village: ['Sanganer', 'Bagru', 'Chomu'],
    classification: ['Agricultural', 'Non-Agricultural', 'Government'],
  },
};
