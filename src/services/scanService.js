import * as ImagePicker from 'expo-image-picker';
import { Paths, File, Directory } from 'expo-file-system';
import { generateId } from '../lib/db';

let _receiptsDir = null;
function getReceiptsDir() {
  if (!_receiptsDir) {
    _receiptsDir = new Directory(Paths.document, 'receipts');
    _receiptsDir.create({ intermediates: true, idempotent: true });
  }
  return _receiptsDir;
}

let MLKitOCR = null;
try {
  MLKitOCR = require('@react-native-ml-kit/text-recognition');
} catch (_) {}

export async function requestCameraPermission() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

export async function requestGalleryPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function captureReceipt() {
  const options = ['Take Photo', 'Choose from Gallery', 'Cancel'];

  return new Promise((resolve) => {
    const action = (index) => {
      if (index === 0) pickFromCamera().then(resolve);
      else if (index === 1) pickFromGallery().then(resolve);
      else resolve(null);
    };

    const Alert = require('react-native').Alert;
    Alert.alert('Scan Receipt', 'How would you like to capture the receipt?', [
      { text: options[0], onPress: () => action(0) },
      { text: options[1], onPress: () => action(1) },
      { text: options[2], style: 'cancel', onPress: () => action(2) },
    ]);
  });
}

async function pickFromCamera() {
  const granted = await requestCameraPermission();
  if (!granted) {
    const { Alert } = require('react-native');
    Alert.alert('Permission Required', 'Camera access is needed to scan receipts.');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
  });

  if (result.canceled) return null;
  return result.assets[0].uri;
}

async function pickFromGallery() {
  const granted = await requestGalleryPermission();
  if (!granted) {
    const { Alert } = require('react-native');
    Alert.alert('Permission Required', 'Photo library access is needed to select receipts.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
  });

  if (result.canceled) return null;
  return result.assets[0].uri;
}

export function saveReceiptImage(sourceUri) {
  const dir = getReceiptsDir();
  const ext = sourceUri.split('.').pop() || 'jpg';
  const filename = `receipt_${generateId()}.${ext}`;
  const destFile = new File(dir, filename);
  try {
    new File(sourceUri).copy(destFile);
    return destFile.uri;
  } catch (_) {
    return sourceUri;
  }
}

export function deleteReceiptImage(uri) {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (_) {}
}

export async function scanReceipt(imageUri, userId) {
  let rawText = '';

  try {
    rawText = await tryOnDeviceOCR(imageUri);
  } catch (_) {}

  if (!rawText || rawText.trim().length < 10) {
    rawText = await tryCloudOCR(imageUri, userId);
  }

  if (!rawText || rawText.trim().length < 5) {
    throw new Error('Could not read this receipt. Try a clearer image with better lighting.');
  }

  return parseOcrText(rawText);
}

async function tryOnDeviceOCR(imageUri) {
  if (!MLKitOCR) return '';

  const result = await MLKitOCR.recognize(imageUri);
  if (!result || !result.text) return '';

  const lines = result.blocks
    ? result.blocks.flatMap((b) => b.lines || []).map((l) => l.text)
    : result.text.split('\n');

  const text = lines.join('\n');
  if (text.trim().length < 10) return '';
  return text;
}

async function tryCloudOCR(imageUri, userId) {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'receipt.jpg',
  });
  formData.append('language', 'eng');
  formData.append('OCREngine', '2');
  formData.append('isOverlayRequired', 'false');

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { 'apikey': 'helloworld' },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR service error (${response.status})`);
  }

  const data = await response.json();
  if (data.IsErroredOnProcessing) {
    throw new Error(data.ErrorMessage?.[0] || 'OCR processing failed');
  }

  const parsedResults = data.ParsedResults || [];
  if (parsedResults.length === 0) return '';

  const text = parsedResults.map((r) => r.ParsedText).join('\n');
  return text || '';
}

export function parseOcrText(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const merchant = extractMerchant(lines);
  const totalAmount = extractTotalAmount(lines, rawText);
  const currency = extractCurrency(rawText);
  const date = extractDate(rawText);
  const items = extractItems(lines, totalAmount);
  const suggestedTitle = generateTitle(merchant, items);
  const suggestedCategory = suggestCategory(rawText, merchant, items);

  return {
    merchant,
    totalAmount,
    currency: currency || null,
    date: date || null,
    items,
    suggestedCategory,
    suggestedTitle,
    confidence: totalAmount ? 'high' : items.length > 0 ? 'medium' : 'low',
    rawText: rawText.slice(0, 2000),
  };
}

function extractMerchant(lines) {
  const skipPatterns = [
    /^[-\s]*$/, /receipt|invoice|bill|sale|order/i, /^tel:?/i,
    /^\d+$/, /^tax|vat|gst/i, /^(date|time|store|shop|market)/i,
  ];

  for (const line of lines.slice(0, Math.min(6, lines.length))) {
    const cleaned = line.replace(/[*#]/g, '').trim();
    if (!cleaned || cleaned.length < 2) continue;
    if (skipPatterns.some((p) => p.test(cleaned))) continue;
    if (cleaned.length > 4 && cleaned.length < 60) return cleaned;
  }
  return null;
}

function extractTotalAmount(lines, rawText) {
  const totalKeywords = [
    /(?:total|amount|due|balance|grand total|payable|net|sum)\s*:?\s*([\d,]+\.?\d*)/i,
    /(?:total|amount|due)[:\s]*([\d,]+\.?\d{2})\s*$/mi,
    /^([\d,]+\.?\d{2})\s*(?:total|amount)$/mi,
    /(?:cash|change|charge)\s*([\d,]+\.?\d{2})/i,
  ];

  const amounts = [];

  for (const keyword of totalKeywords) {
    const match = rawText.match(keyword);
    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val < 9999999) {
        amounts.push(val);
      }
    }
  }

  const allAmounts = [];
  const amountRegex = /([\d,]+\.?\d{2,})/g;
  let am;
  while ((am = amountRegex.exec(rawText)) !== null) {
    const val = parseFloat(am[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0 && val < 9999999) {
      allAmounts.push(val);
    }
  }

  if (amounts.length > 0) {
    const sorted = [...new Set(amounts)].sort((a, b) => b - a);
    return sorted[0];
  }

  if (allAmounts.length > 0) {
    const sorted = [...new Set(allAmounts)].sort((a, b) => b - a);
    return sorted[0];
  }

  return null;
}

function extractCurrency(text) {
  const currencyMap = {
    'PKR': /PKR|Rs\.?|₨/i,
    'USD': /\$|USD/i,
    'EUR': /€|EUR/i,
    'GBP': /£|GBP/i,
    'AED': /AED|د.إ/i,
    'SAR': /SAR|﷼/i,
    'QAR': /QAR|ر.ق/i,
    'INR': /₹|INR/i,
  };

  for (const [code, pattern] of Object.entries(currencyMap)) {
    if (pattern.test(text)) return code;
  }
  return null;
}

function isValidDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) daysInMonth[2] = 29;
  return d <= daysInMonth[m];
}

function isReasonableDate(y, m, d) {
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const min = new Date(2000, 0, 1);
  const max = new Date(now.getFullYear() + 1, 11, 31);
  return date >= min && date <= max;
}

function extractTime(text) {
  const timePatterns = [
    // HH:MM:SS AM/PM
    { pattern: /(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM|am|pm)/i, hasAmpm: true, hasSeconds: true },
    // HH:MM AM/PM
    { pattern: /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i, hasAmpm: true, hasSeconds: false },
    // HH.MM AM/PM
    { pattern: /(\d{1,2})\.(\d{2})\s*(AM|PM|am|pm)/i, hasAmpm: true, hasSeconds: false },
    // HH:MM:SS (24h)
    { pattern: /(\d{1,2}):(\d{2}):(\d{2})(?!\s*:)/i, hasAmpm: false, hasSeconds: true },
    // HH:MM (24h)
    { pattern: /(\d{1,2}):(\d{2})(?!\s*:)/, hasAmpm: false, hasSeconds: false },
    // HH.MM (24h)
    { pattern: /(\d{1,2})\.(\d{2})(?!\s*\.)/, hasAmpm: false, hasSeconds: false },
  ];

  for (const { pattern, hasAmpm, hasSeconds } of timePatterns) {
    const match = text.match(pattern);
    if (!match) continue;

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) continue;
    if (hours < 1 || hours > 23) continue;

    if (hasAmpm) {
      const ampm = (match[hasSeconds ? 4 : 3] || '').toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  }
  return null;
}

function tryResolveDate(a, b, c, isYearLast, text, timeStr) {
  let candidates = [];

  if (isYearLast) {
    // YYYY-MM-DD
    candidates.push({ y: parseInt(a), m: parseInt(b), d: parseInt(c) });
  } else {
    const p1 = parseInt(a);
    const p2 = parseInt(b);
    const p3 = parseInt(c);

    if (p3 > 31 && p3 <= 9999) {
      // a/b/YYYY or a-b-YYYY
      // Pakistan uses DD/MM/YYYY — try DD/MM first (p2=month, p1=day)
      if (isReasonableDate(p3, p2, p1) && isValidDate(p3, p2, p1)) {
        candidates.push({ y: p3, m: p2, d: p1 });
      }
      if (isReasonableDate(p3, p1, p2) && isValidDate(p3, p1, p2)) {
        candidates.push({ y: p3, m: p1, d: p2 });
      }
    } else {
      // 2-digit year
      const now = new Date();
      const currentYear = now.getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      let yearFull = century + p3;
      if (yearFull > currentYear + 10) yearFull -= 100;
      if (yearFull < 2000) yearFull = 2000 + p3;

      // DD/MM/YY first (Pakistan format)
      if (isReasonableDate(yearFull, p2, p1) && isValidDate(yearFull, p2, p1)) {
        candidates.push({ y: yearFull, m: p2, d: p1 });
      }
      if (isReasonableDate(yearFull, p1, p2) && isValidDate(yearFull, p1, p2)) {
        candidates.push({ y: yearFull, m: p1, d: p2 });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Multiple candidates — prefer DD/MM (first in array = Pakistan format)
  // Only filter future dates for the MM/DD interpretation to avoid picking wrong century
  const now = new Date();
  const valid = candidates.filter((c) => {
    const ts = new Date(c.y, c.m - 1, c.d).getTime();
    return ts <= now.getTime() + 86400000; // allow 1 day in future (timezone)
  });
  const { y, m, d } = valid.length > 0 ? valid[0] : candidates[0];
  return timeStr
    ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${timeStr}`
    : `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function extractDate(text) {
  const timeStr = extractTime(text) || null;

  // Skip lines that are clearly not dates (phone, invoice, bill numbers, etc.)
  const filterLine = (fullMatch) => {
    const skip = [
      /^\d{3,4}[-/]\d{7,}$/,           // phone: 0300-1234567
      /^#?\d+[-/]\d+[-/]\d+$/,          // invoice/ref: 123-456-789
      /(?:tel|phone|fax|mobile|cell)/i,  // tel: prefix
      /^[A-Z]+\d+/,                     // REF123, INV-456
    ];
    return !skip.some((p) => p.test(fullMatch.trim()));
  };

  // 1. Named months: "25 Dec 2026", "December 25, 2026"
  const namedPatterns = [
    /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\.?\s*,?\s*(\d{4})/i,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\.?\s*(\d{1,2}),?\s*(\d{4})/i,
  ];

  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  for (const pattern of namedPatterns) {
    const match = text.match(pattern);
    if (!match || !filterLine(match[0])) continue;
    const m = months.indexOf(match[2]?.slice(0, 3).toLowerCase() || match[1].slice(0, 3).toLowerCase());
    let day = parseInt(match[1]?.length > 3 ? match[1] : match[2]);
    const year = parseInt(match[3]);
    if (m >= 0 && isValidDate(year, m + 1, day) && isReasonableDate(year, m + 1, day)) {
      return timeStr
        ? `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${timeStr}`
        : `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2. Numeric dates in various formats - collect ALL candidates, pick best
  const numericPatterns = [
    { pattern: /(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/, isYearLast: true },
    { pattern: /(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?!\d)/, isYearLast: false },
    { pattern: /(\d{1,2})[-/](\d{1,2})[-/](\d{2})(?!\d)/, isYearLast: false },
    { pattern: /(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/, isYearLast: false },
    { pattern: /(\d{1,2})\.(\d{1,2})\.(\d{2})(?!\d)/, isYearLast: false },
  ];

  let bestResult = null;
  let bestScore = -1;

  for (const { pattern, isYearLast } of numericPatterns) {
    const reg = new RegExp(pattern.source, 'g');
    let pm;
    while ((pm = reg.exec(text)) !== null) {
      const fullMatch = pm[0];
      if (!filterLine(fullMatch)) continue;

      const a = pm[1], b = pm[2], c = pm[3];
      const result = tryResolveDate(a, b, c, isYearLast, text, timeStr);
      if (!result) continue;

      // Score: prefer dates with time, named context clues
      let score = 0;
      if (timeStr) score += 10;
      const contextBefore = text.slice(Math.max(0, pm.index - 20), pm.index).toLowerCase();
      if (/date|issued|purchased|sold|transaction|receipt|bill|invoice/i.test(contextBefore)) score += 20;
      if (/^\d{4}$/.test(c)) score += 5; // 4-digit year preferred

      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }
    }
  }

  return bestResult || null;
}

function extractItems(lines, totalAmount) {
  const items = [];
  const pricePattern = /([\d,]+\.?\d{2,})/;
  let foundTotal = false;

  for (const line of lines) {
    if (/total|amount|due|vat|gst|tax|change|cash|visa|mastercard|payment/i.test(line)) {
      if (/(total|amount|due)/i.test(line)) foundTotal = true;
      continue;
    }

    if (foundTotal) continue;

    const priceMatch = line.match(pricePattern);
    if (!priceMatch) continue;

    const price = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (isNaN(price) || price <= 0 || price >= 9999999) continue;
    if (totalAmount && price > totalAmount) continue;

    const name = line.replace(pricePattern, '').replace(/[*#@]/g, '').replace(/\s+/g, ' ').trim();
    if (name.length > 1 && name.length < 80) {
      items.push({ name: name || `Item ${items.length + 1}`, price });
    }
  }

  if (items.length === 0) return [];
  return items.slice(0, 20);
}

function generateTitle(merchant, items) {
  if (merchant) return `Purchase at ${merchant}`;

  const itemNames = items.map((i) => i.name);
  const joined = itemNames.slice(0, 3).join(', ');
  if (joined.length > 3) return joined.slice(0, 50);
  if (items.length > 0) return `${items.length} items purchased`;
  return 'Receipt Scan';
}

function suggestCategory(text, merchant, items) {
  const keywordMap = [
    {
      parent: 'Food & Drink',
      subs: {
        Groceries: ['grocery', 'supermarket', 'super store', 'vegetable', 'fruit', 'milk', 'bread', 'rice', 'meat', 'chicken', 'eggs', 'food', 'snack', 'drink', 'water', 'juice', 'bakery', 'dairy', 'al meera', 'lulu', 'carrefour', 'spinneys', 'waitrose'],
        'Restaurants & Fast Food': ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'kfc', 'mcdonald', 'subway', 'domino', 'dine', 'takeaway', 'food court'],
        'Bar & Cafe': ['cafe', 'coffee', 'starbucks', 'tea', 'espresso', 'latte'],
      },
    },
    {
      parent: 'Transportation',
      subs: {
        Fuel: ['fuel', 'petrol', 'diesel', 'gas', 'gas station', 'pump', 'shell', 'adnoc', 'enoc'],
        'Public Transport': ['metro', 'bus', 'train', 'taxi', 'uber', 'careem', 'public transport', 'fare', 'ticket'],
        'Car Maintenance': ['garage', 'car wash', 'tyre', 'tire', 'oil change', 'maintenance', 'repair', 'auto'],
      },
    },
    {
      parent: 'Shopping',
      subs: {
        Clothing: ['clothing', 'apparel', 'shirt', 'dress', 'shoe', 'footwear', 'fashion', 'brand', 'outfit', 'garment'],
        Electronics: ['electronic', 'mobile', 'phone', 'laptop', 'computer', 'charger', 'cable', 'battery', 'tv', 'screen'],
        'Home & Garden': ['home', 'furniture', 'decor', 'garden', 'plant', 'kitchen', 'utensil', 'towel', 'bed', 'pillow'],
      },
    },
    {
      parent: 'Health & Personal',
      subs: {
        'Medical & Pharmacy': ['pharmacy', 'medical', 'medicine', 'drug', 'pill', 'tablet', 'doctor', 'hospital', 'clinic', 'prescription', 'health', 'vitamin'],
        'Personal Care': ['salon', 'haircut', 'spa', 'cosmetic', 'beauty', 'soap', 'shampoo', 'cream', 'perfume'],
      },
    },
    {
      parent: 'Entertainment',
      subs: {
        'Streaming Services': ['netflix', 'spotify', 'amazon prime', 'hulu', 'disney', 'subscription', 'streaming'],
        'Movies & Concerts': ['cinema', 'movie', 'ticket', 'concert', 'theater', 'show', 'vox', 'novo'],
      },
    },
    {
      parent: 'Housing & Utilities',
      subs: {
        'Electricity & Gas': ['electricity', 'gas bill', 'electric bill', 'utility', 'power', 'energy', 'kwh'],
        'Internet & TV': ['internet', 'wifi', 'broadband', 'cable', 'tv bill', 'network'],
        'Rent & Mortgage': ['rent', 'lease', 'mortgage', 'property', 'accommodation'],
      },
    },
    {
      parent: 'Education',
      subs: {
        Tuition: ['tuition', 'school fee', 'university', 'college', 'course', 'training', 'class'],
        'Books & Stationery': ['book', 'stationery', 'notebook', 'pen', 'pencil', 'bag', 'school supply'],
      },
    },
    {
      parent: 'Kids & Family',
      subs: {
        'Baby Supplies': ['baby', 'diaper', 'wipes', 'formula', 'baby food', 'toy', 'kids'],
      },
    },
    {
      parent: 'Charity & Zakat',
      subs: {
        Zakat: ['zakat', 'sadaqah', 'charity', 'donation', 'masjid', 'mosque', 'ngo', 'aid'],
      },
    },
  ];

  const searchText = [merchant || '', ...(items || []).map((i) => i.name)].join(' ').toLowerCase();

  let bestParent = null;
  let bestSub = null;
  let bestScore = 0;

  for (const group of keywordMap) {
    for (const [subName, keywords] of Object.entries(group.subs)) {
      let score = 0;
      for (const kw of keywords) {
        if (searchText.includes(kw)) {
          score += kw.length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestParent = group.parent;
        bestSub = subName;
      }
    }
  }

  if (bestParent && bestSub) {
    return { parentName: bestParent, subCategoryName: bestSub };
  }

  return null;
}
