// Places that artists use as tags ("tbilisi", "brazil"). They say where the music comes from, not what it sounds like, so they are never genres.
// Written the way people write them; compared in the normalised form of normalizeTag (lower case, no spaces, dots, dashes or underscores).
const PLACES = [
  // countries and nations
  'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'argentina', 'armenia', 'australia', 'austria', 'azerbaijan', 'bahamas', 'bahrain',
  'bangladesh', 'barbados', 'belarus', 'belgium', 'belize', 'benin', 'bolivia', 'bosnia', 'botswana', 'brasil', 'brazil', 'brunei', 'bulgaria',
  'burkina faso', 'burma', 'cambodia', 'cameroon', 'canada', 'chad', 'chile', 'china', 'colombia', 'congo', 'costa rica', 'croatia', 'cuba',
  'cyprus', 'czech republic', 'czechia', 'denmark', 'dominican republic', 'ecuador', 'egypt', 'el salvador', 'england', 'eritrea', 'estonia',
  'ethiopia', 'finland', 'france', 'gabon', 'gambia', 'georgia', 'germany', 'ghana', 'great britain', 'greece', 'guatemala', 'guinea', 'guyana',
  'haiti', 'honduras', 'hong kong', 'hungary', 'iceland', 'india', 'indonesia', 'iran', 'iraq', 'ireland', 'israel', 'italy', 'ivory coast',
  'jamaica', 'japan', 'jordan', 'kazakhstan', 'kenya', 'korea', 'south korea', 'north korea', 'kosovo', 'kuwait', 'kyrgyzstan', 'laos', 'latvia',
  'lebanon', 'liberia', 'libya', 'lithuania', 'luxembourg', 'macedonia', 'north macedonia', 'madagascar', 'malawi', 'malaysia', 'mali', 'malta',
  'mexico', 'moldova', 'monaco', 'mongolia', 'montenegro', 'morocco', 'mozambique', 'myanmar', 'namibia', 'nepal', 'netherlands', 'holland',
  'new zealand', 'nicaragua', 'niger', 'nigeria', 'northern ireland', 'norway', 'oman', 'pakistan', 'palestine', 'panama', 'paraguay', 'peru',
  'philippines', 'poland', 'portugal', 'puerto rico', 'qatar', 'romania', 'russia', 'rwanda', 'saudi arabia', 'scotland', 'senegal', 'serbia',
  'singapore', 'slovakia', 'slovenia', 'somalia', 'south africa', 'spain', 'sri lanka', 'sudan', 'suriname', 'sweden', 'switzerland', 'syria',
  'taiwan', 'tajikistan', 'tanzania', 'thailand', 'togo', 'trinidad', 'tunisia', 'turkey', 'turkiye', 'uganda', 'ukraine', 'united arab emirates',
  'united kingdom', 'united states', 'uk', 'usa', 'us', 'uruguay', 'uzbekistan', 'venezuela', 'vietnam', 'wales', 'yemen', 'yugoslavia', 'zambia', 'zimbabwe',
  // continents and regions
  'africa', 'asia', 'europe', 'north america', 'south america', 'latin america', 'oceania', 'scandinavia', 'balkans', 'caucasus', 'middle east',
  'west africa', 'east africa', 'southeast asia', 'central asia', 'eastern europe', 'western europe', 'baltics', 'caribbean', 'pacific northwest',
  'new england', 'midwest', 'deep south', 'west coast', 'east coast', 'bay area', 'catalonia', 'basque country', 'bavaria', 'siberia', 'quebec',
  'ontario', 'california', 'texas', 'florida', 'ohio', 'michigan', 'oregon', 'washington', 'new jersey', 'pennsylvania', 'illinois', 'georgia usa',
  'tennessee', 'louisiana', 'colorado', 'arizona', 'minnesota', 'wisconsin', 'massachusetts', 'virginia', 'north carolina', 'brittany', 'sicily',
  'sardinia', 'tuscany', 'andalusia', 'galicia', 'flanders', 'tyrol', 'transylvania', 'patagonia', 'minas gerais', 'sao paulo', 'rio grande do sul',
  // cities (the ones that come up most as tags)
  'tbilisi', 'yerevan', 'baku', 'kyiv', 'kiev', 'kharkiv', 'lviv', 'odessa', 'minsk', 'moscow', 'saint petersburg', 'st petersburg', 'riga',
  'tallinn', 'vilnius', 'warsaw', 'krakow', 'wroclaw', 'poznan', 'gdansk', 'prague', 'brno', 'bratislava', 'budapest', 'vienna', 'graz',
  'zagreb', 'ljubljana', 'belgrade', 'sarajevo', 'skopje', 'sofia', 'bucharest', 'athens', 'thessaloniki', 'istanbul', 'ankara', 'izmir',
  'berlin', 'hamburg', 'munich', 'cologne', 'koln', 'dusseldorf', 'frankfurt', 'leipzig', 'dresden', 'stuttgart', 'bremen', 'hannover', 'nuremberg',
  'amsterdam', 'rotterdam', 'utrecht', 'the hague', 'brussels', 'antwerp', 'ghent', 'paris', 'lyon', 'marseille', 'toulouse', 'bordeaux', 'lille',
  'nantes', 'strasbourg', 'geneva', 'zurich', 'basel', 'bern', 'milan', 'rome', 'turin', 'bologna', 'florence', 'naples', 'genoa', 'venice',
  'madrid', 'barcelona', 'valencia', 'seville', 'bilbao', 'lisbon', 'porto', 'london', 'manchester', 'liverpool', 'birmingham', 'leeds', 'sheffield',
  'bristol', 'glasgow', 'edinburgh', 'cardiff', 'belfast', 'dublin', 'cork', 'newcastle', 'nottingham', 'brighton', 'oxford', 'cambridge',
  'copenhagen', 'aarhus', 'stockholm', 'gothenburg', 'malmo', 'oslo', 'bergen', 'helsinki', 'reykjavik', 'new york', 'nyc', 'brooklyn', 'manhattan',
  'queens', 'bronx', 'philadelphia', 'boston', 'baltimore', 'washington dc', 'pittsburgh', 'chicago', 'detroit', 'cleveland', 'cincinnati',
  'columbus', 'milwaukee', 'minneapolis', 'st louis', 'kansas city', 'denver', 'austin', 'houston', 'dallas', 'san antonio', 'new orleans',
  'memphis', 'nashville', 'atlanta', 'miami', 'orlando', 'tampa', 'charlotte', 'raleigh', 'richmond', 'seattle', 'portland', 'san francisco',
  'oakland', 'los angeles', 'la', 'san diego', 'sacramento', 'las vegas', 'phoenix', 'salt lake city', 'honolulu', 'toronto', 'montreal', 'vancouver',
  'ottawa', 'calgary', 'edmonton', 'winnipeg', 'mexico city', 'guadalajara', 'monterrey', 'havana', 'kingston', 'san juan', 'bogota', 'medellin',
  'caracas', 'quito', 'lima', 'la paz', 'santiago', 'buenos aires', 'cordoba', 'rosario', 'montevideo', 'asuncion', 'rio de janeiro', 'rio',
  'sao paulo', 'brasilia', 'salvador', 'recife', 'fortaleza', 'belo horizonte', 'curitiba', 'porto alegre', 'belem', 'manaus', 'goiania',
  'tokyo', 'osaka', 'kyoto', 'nagoya', 'sapporo', 'fukuoka', 'seoul', 'busan', 'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'chengdu', 'taipei',
  'bangkok', 'hanoi', 'ho chi minh city', 'saigon', 'manila', 'jakarta', 'bandung', 'bali', 'kuala lumpur', 'singapore city', 'delhi', 'new delhi',
  'mumbai', 'bombay', 'kolkata', 'calcutta', 'bangalore', 'chennai', 'karachi', 'lahore', 'dhaka', 'kathmandu', 'colombo', 'tehran', 'baghdad',
  'beirut', 'damascus', 'amman', 'jerusalem', 'tel aviv', 'haifa', 'cairo', 'alexandria', 'tunis', 'algiers', 'casablanca', 'marrakech', 'dakar',
  'accra', 'lagos', 'abuja', 'nairobi', 'addis ababa', 'kampala', 'kinshasa', 'luanda', 'johannesburg', 'cape town', 'durban', 'harare', 'maputo',
  'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra', 'auckland', 'wellington', 'christchurch',
];

const squash = (text) => String(text).toLowerCase().replace(/[\s._-]+/g, '');
const SET = new Set(PLACES.map(squash));

/** True when the (normalised) tag is the name of a country, region or city. */
export const isPlace = (key) => SET.has(squash(key));
