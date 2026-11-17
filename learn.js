/* "Learn to read" chapter: letters, vowel marks, joining, reading rules, word building, practice.
   Bilingual (Assamese / English). Example words come from letters-data.js (real Quran words from Quran.com). */
(function () {
  'use strict';
  const ZWJ = '‍';
  // [letter, Assamese name, Assamese sound, Latin, how to say it (en), joins to the next letter?, how to say it (as)]
  const LET = [
    ['ا', 'আলিফ', 'আ', 'a', 'A straight line. On its own it carries a vowel; after a letter it stretches the “a” sound.', 0, 'এডাল পোন ৰেখা। অকলে থাকিলে ই স্বৰধ্বনি বহন কৰে; আন আখৰৰ পিছত থাকিলে “আ” ধ্বনিটো দীঘল কৰে।'],
    ['ب', 'বা', 'ব', 'b', 'Like ব. One dot below.', 1, 'ব-ৰ দৰে। তলত এটা ফুট।'],
    ['ت', 'তা', 'ত', 't', 'Like ত. Two dots above.', 1, 'ত-ৰ দৰে। ওপৰত দুটা ফুট।'],
    ['ث', 'ছা', 'ছ', 'th', 'Soft “th” as in “think”: tip of the tongue between the teeth. Three dots above.', 1, 'ইংৰাজী “think”-ৰ “th”-ৰ দৰে কোমল ধ্বনি: জিভাৰ আগ দাঁতৰ মাজত ৰাখক। ওপৰত তিনিটা ফুট।'],
    ['ج', 'জীম', 'জ', 'j', 'Like “j” in “jam”. One dot inside.', 1, 'ইংৰাজী “jam”-ৰ “j”-ৰ দৰে। ভিতৰত এটা ফুট।'],
    ['ح', 'হা', 'হ', 'ḥ', 'A breathy হ from the middle of the throat, like breathing on a mirror. No dot.', 1, 'ডিঙিৰ মাজভাগৰ পৰা ওলোৱা উশাহযুক্ত হ — আইনাত উশাহ এৰাৰ দৰে। ফুট নাই।'],
    ['خ', 'খা', 'খ', 'kh', 'A rough খ from the top of the throat. One dot above.', 1, 'ডিঙিৰ ওপৰভাগৰ পৰা ওলোৱা খহটা খ। ওপৰত এটা ফুট।'],
    ['د', 'দাল', 'দ', 'd', 'Like দ.', 0, 'দ-ৰ দৰে।'],
    ['ذ', 'যাল', 'য', 'dh', '“th” as in “this”: tongue tip between the teeth, with voice. One dot above.', 0, 'ইংৰাজী “this”-ৰ “th”-ৰ দৰে: জিভাৰ আগ দাঁতৰ মাজত, মাতৰ সৈতে। ওপৰত এটা ফুট।'],
    ['ر', 'ৰা', 'ৰ', 'r', 'Like ৰ — a light tap of the tongue.', 0, 'ৰ-ৰ দৰে — জিভাৰ এটা পাতল টোকৰ।'],
    ['ز', 'যা', 'য', 'z', 'A buzzing “z” as in “zoo”. One dot above.', 0, 'ইংৰাজী “zoo”-ৰ “z”-ৰ দৰে গুণগুণীয়া ধ্বনি। ওপৰত এটা ফুট।'],
    ['س', 'ছীন', 'ছ', 's', 'A thin, clear “s”. Three small teeth.', 1, 'পাতল, স্পষ্ট “s” ধ্বনি। তিনিটা সৰু দাঁত।'],
    ['ش', 'শ্বীন', 'শ্ব', 'sh', '“sh” as in “ship”. Three dots above.', 1, 'ইংৰাজী “ship”-ৰ “sh”-ৰ দৰে। ওপৰত তিনিটা ফুট।'],
    ['ص', 'ছাদ', 'ছ', 'ṣ', 'A heavy “s”: raise the back of the tongue and fill the mouth.', 1, 'গধুৰ “s”: জিভাৰ পিছভাগ ওপৰলৈ তুলি মুখ ভৰাই উচ্চাৰণ কৰক।'],
    ['ض', 'দ্বাদ', 'দ্ব', 'ḍ', 'A heavy “d” made with the side of the tongue against the upper back teeth.', 1, 'গধুৰ “d”: জিভাৰ কাষ ওপৰৰ পিছফালৰ দাঁতত লগাই উচ্চাৰণ কৰক।'],
    ['ط', 'ত্বা', 'ত্ব', 'ṭ', 'A heavy, full-mouth “t”.', 1, 'গধুৰ, মুখ ভৰা “t”।'],
    ['ظ', 'যা', 'য', 'ẓ', 'A heavy “dh”: tongue tip between the teeth, mouth full.', 1, 'গধুৰ “dh”: জিভাৰ আগ দাঁতৰ মাজত, মুখ ভৰাই।'],
    ['ع', 'আঈন', '‘আ', 'ʿ', 'A squeezed sound from the middle of the throat. Listen to the example and copy it.', 1, 'ডিঙিৰ মাজভাগৰ পৰা চেপি উলিওৱা ধ্বনি। উদাহৰণটো শুনক আৰু অনুকৰণ কৰক।'],
    ['غ', 'গাঈন', 'গ', 'gh', 'Like a soft gargle from the top of the throat. One dot above.', 1, 'ডিঙিৰ ওপৰভাগৰ পৰা কুলকুলি কৰাৰ দৰে কোমল ধ্বনি। ওপৰত এটা ফুট।'],
    ['ف', 'ফা', 'ফ', 'f', '“f”: upper teeth touch the lower lip (not two lips like Assamese ফ). One dot above.', 1, '“f”: ওপৰৰ দাঁতে তলৰ ওঁঠ স্পৰ্শ কৰে (অসমীয়া ফ-ৰ দৰে দুটা ওঁঠেৰে নহয়)। ওপৰত এটা ফুট।'],
    ['ق', 'ক্বাফ', 'ক্ব', 'q', 'A deep “k” from the very back of the tongue. Two dots above.', 1, 'জিভাৰ একেবাৰে পিছভাগৰ পৰা ওলোৱা গভীৰ “k”। ওপৰত দুটা ফুট।'],
    ['ك', 'কাফ', 'ক', 'k', 'Like ক.', 1, 'ক-ৰ দৰে।'],
    ['ل', 'লাম', 'ল', 'l', 'Like ল.', 1, 'ল-ৰ দৰে।'],
    ['م', 'মীম', 'ম', 'm', 'Like ম.', 1, 'ম-ৰ দৰে।'],
    ['ن', 'নূন', 'ন', 'n', 'Like ন. One dot above.', 1, 'ন-ৰ দৰে। ওপৰত এটা ফুট।'],
    ['ه', 'হা', 'হ', 'h', 'A light হ from the bottom of the throat.', 1, 'ডিঙিৰ তলভাগৰ পৰা ওলোৱা পাতল হ।'],
    ['و', 'ৱাও', 'ৱ', 'w', 'Like ৱ with rounded lips. After a damma it stretches the “u” sound.', 0, 'ওঁঠ ঘূৰণীয়া কৰি ৱ-ৰ দৰে। পেশৰ পিছত থাকিলে “উ” ধ্বনি দীঘল কৰে।'],
    ['ي', 'ইয়া', 'য়', 'y', 'Like য়. After a kasra it stretches the “i” sound. Two dots below.', 1, 'য়-ৰ দৰে। যেৰৰ পিছত থাকিলে “ই” ধ্বনি দীঘল কৰে। তলত দুটা ফুট।']
  ];
  const FAMILIES = [['ب', 'ت', 'ث', 'ن', 'ي'], ['ج', 'ح', 'خ'], ['د', 'ذ'], ['ر', 'ز'], ['س', 'ش'], ['ص', 'ض'], ['ط', 'ظ'], ['ع', 'غ'], ['ف', 'ق']];
  // [English name, Assamese name, builder, English note, Assamese note]
  const MARKS = [
    ['Fatha', 'যবৰ', (c) => c + 'َ', 'A small stroke above the letter. Short “a”.', 'আখৰৰ ওপৰত এডাল সৰু ৰেখা। চুটি “আ”।'],
    ['Kasra', 'যেৰ', (c) => c + 'ِ', 'A small stroke below the letter. Short “i”.', 'আখৰৰ তলত এডাল সৰু ৰেখা। চুটি “ই”।'],
    ['Damma', 'পেশ', (c) => c + 'ُ', 'A small و above the letter. Short “u”.', 'আখৰৰ ওপৰত এটা সৰু و। চুটি “উ”।'],
    ['Long ā', 'দীঘল আ', (c) => c + 'َا', 'Fatha followed by alif ا — stretch the “a” for two counts.', 'যবৰৰ পিছত আলিফ ا — “আ” ধ্বনি দুই মাত্ৰা টানক।'],
    ['Long ī', 'দীঘল ঈ', (c) => c + 'ِي', 'Kasra followed by ya ي — stretch the “i” for two counts.', 'যেৰৰ পিছত ইয়া ي — “ই” ধ্বনি দুই মাত্ৰা টানক।'],
    ['Long ū', 'দীঘল ঊ', (c) => c + 'ُو', 'Damma followed by waw و — stretch the “u” for two counts.', 'পেশৰ পিছত ৱাও و — “উ” ধ্বনি দুই মাত্ৰা টানক।'],
    ['Sukun', 'জযম (ছুকূন)', (c) => 'أَ' + c + 'ْ', 'A small circle: the letter has no vowel. It closes the sound before it (shown here after أَ).', 'এটা সৰু ঘূৰণীয়া চিন: আখৰটোত কোনো স্বৰধ্বনি নাই। ই আগৰ ধ্বনিটো বন্ধ কৰে (ইয়াত أَ-ৰ পিছত দেখুওৱা হৈছে)।'],
    ['Shadda', 'তাশদীদ', (c) => 'أَ' + c + 'َّ', 'A small “w” shape: the letter is said twice — once closing, once opening (shown here after أَ).', 'সৰু “w”-ৰ দৰে চিন: আখৰটো দুবাৰ উচ্চাৰণ কৰা হয় — এবাৰ বন্ধ কৰি, এবাৰ খুলি (ইয়াত أَ-ৰ পিছত দেখুওৱা হৈছে)।'],
    ['Tanwin -an', 'দুই যবৰ', (c) => c + 'ًا', 'Two fathas: add an “n” sound — “an”. The alif after it is not read.', 'দুটা যবৰ: শেষত “ন” ধ্বনি যোগ হয় — “আন”। পিছৰ আলিফ পঢ়া নহয়।'],
    ['Tanwin -in', 'দুই যেৰ', (c) => c + 'ٍ', 'Two kasras: “in”.', 'দুটা যেৰ: “ইন”।'],
    ['Tanwin -un', 'দুই পেশ', (c) => c + 'ٌ', 'Two dammas: “un”.', 'দুটা পেশ: “উন”।']
  ];
  const BUILD = ['ب', 'ت', 'س', 'م', 'ن', 'ل', 'ك', 'ر', 'د', 'ق', 'ف', 'ج', 'ه'];
  // [title en, text en, example keys, show stopping form?, title as, text as]
  const RULES = [
    ['Sukun — stop on the letter', 'The small circle means no vowel. Close the sound on that letter.', ['112:1:1'], false, 'ছুকূন — আখৰত ৰৈ যাওক', 'সৰু ঘূৰণীয়া চিনৰ অৰ্থ স্বৰধ্বনি নাই। সেই আখৰতে ধ্বনিটো বন্ধ কৰক।'],
    ['Shadda — say it twice', 'Hold the letter: first to close the syllable, then to open the next.', ['1:2:3'], false, 'তাশদীদ — দুবাৰ উচ্চাৰণ কৰক', 'আখৰটো ধৰি ৰাখক: প্ৰথমে আগৰ ধ্বনি বন্ধ কৰিবলৈ, তাৰ পিছত পৰৱৰ্তী ধ্বনি খুলিবলৈ।'],
    ['Long vowels', 'Alif after fatha, ya after kasra and waw after damma stretch the sound for two counts. A small upright alif above a letter does the same as a full alif.', ['1:4:1', '1:1:4', '114:1:2'], false, 'দীঘল স্বৰ (মাদ্দ)', 'যবৰৰ পিছত আলিফ, যেৰৰ পিছত ইয়া আৰু পেশৰ পিছত ৱাও থাকিলে ধ্বনি দুই মাত্ৰা টনা হয়। আখৰৰ ওপৰত থকা সৰু থিয় আলিফেও সম্পূৰ্ণ আলিফৰ দৰেই কাম কৰে।'],
    ['“Al-” before moon letters', 'The ل of ٱلْ has a sukun and is pronounced: al-ḥamdu.', ['1:2:1'], false, 'চন্দ্ৰ আখৰৰ আগত “আল”', 'ٱلْ-ৰ ل-ত জযম থাকে আৰু ইয়াক উচ্চাৰণ কৰা হয়: আল-হামদু।'],
    ['“Al-” before sun letters', 'The ل has no mark and is silent; the next letter carries a shadda and is doubled: ar-raḥmān, an-nās.', ['1:1:3', '114:1:4'], false, 'সূৰ্য আখৰৰ আগত “আল”', 'ل-ত কোনো চিন নাথাকে আৰু ই নীৰৱ; পিছৰ আখৰত তাশদীদ থাকে আৰু সেইটো দুবাৰ পঢ়া হয়: আৰ-ৰাহমান, আন-নাছ।'],
    ['Tanwin — the “n” ending', 'Double marks at the end of a word add an “n” sound: -un, -an, -in.', ['112:1:4', '112:4:4', '103:2:4'], false, 'তানৱীন — “ন” অন্ত', 'শব্দৰ শেষত দুটা চিন থাকিলে “ন” ধ্বনি যোগ হয়: -উন, -আন, -ইন।'],
    ['Stopping at the end of a verse', 'When you stop, drop the last short vowel or tanwin. Long vowels stay.', ['114:1:4', '1:2:4'], true, 'আয়াতৰ শেষত ৰোৱা (ৱাক্বফ)', 'ৰৈ গ’লে শেষৰ চুটি স্বৰ বা তানৱীন বাদ দিয়ক। দীঘল স্বৰ থাকি যায়।'],
    ['Ta marbuta ة', 'The round ta is read “t” when you continue and “h” when you stop on it.', ['114:6:2'], true, 'তা মাৰবূত্বা ة', 'ঘূৰণীয়া তা-ক আগবাঢ়ি গ’লে “ত” আৰু তাত ৰৈ গ’লে “হ” পঢ়া হয়।'],
    ['The joining alif ٱ', 'Alif with a small sign above it is only pronounced when you begin from it. In the middle of recitation it is silent and the words join.', ['1:6:1'], false, 'সংযোগী আলিফ ٱ', 'ওপৰত সৰু চিন থকা এই আলিফ কেৱল তাৰ পৰা আৰম্ভ কৰিলেহে উচ্চাৰণ কৰা হয়। তিলাৱতৰ মাজত ই নীৰৱ আৰু শব্দবোৰ জোৰা লাগে।'],
    ['Small و and ي after ه', 'A small waw or ya after the pronoun ه stretches its vowel.', ['112:4:3'], false, 'ه-ৰ পিছত সৰু و আৰু ي', 'সৰ্বনাম ه-ৰ পিছত সৰু ৱাও বা ইয়া থাকিলে তাৰ স্বৰ দীঘল হয়।']
  ];
  const PREFIX = [['وَ', 'ৱা', 'and', 'আৰু'], ['فَ', 'ফা', 'so, then', 'তাৰ পিছত, গতিকে'], ['بِ', 'বি', 'with, in, by', 'সৈতে, -ত, দ্বাৰা'], ['لِ', 'লি', 'for, to', 'বাবে, -লৈ'], ['كَ', 'কা', 'like', 'দৰে'], ['ٱلْ', 'আল', 'the', 'নিৰ্দিষ্ট বুজায় (-টো, -জন)']];
  const SUFFIX = [['ـهُ', 'হু', 'him, his', 'তেওঁক, তেওঁৰ'], ['ـهَا', 'হা', 'her', 'তাইক, তাইৰ'], ['ـهُمْ', 'হুম', 'them, their', 'তেওঁলোকক, তেওঁলোকৰ'], ['ـكَ', 'কা', 'you, your', 'তোমাক, তোমাৰ'], ['ـكُمْ', 'কুম', 'you all, your', 'তোমালোকক, তোমালোকৰ'], ['ـنَا', 'না', 'us, our', 'আমাক, আমাৰ'], ['ـِى', 'ঈ', 'me, my', 'মোক, মোৰ']];
  const PARTS = [['112:4:1', 'and + not', 'ৱা (আৰু) + লাম (নাই)'], ['114:1:3', 'in + Lord', 'বি (ওচৰত) + ৰাব্ব (প্ৰতিপালক)'], ['1:2:2', 'for + Allah', 'লি (বাবে) + আল্লাহ'], ['1:2:1', 'the + praise', 'আল + হামদ (প্ৰশংসা)'],
    ['112:4:3', 'for + him', 'লা (বাবে) + হু (তেওঁৰ)'], ['1:7:4', 'on + them', 'আলাই (ওপৰত) + হিম (তেওঁলোকৰ)'], ['108:2:2', 'to + Lord + your', 'লি (বাবে) + ৰাব্ব (প্ৰতিপালক) + কা (তোমাৰ)'], ['1:6:1', 'guide + us', 'ইহদি (পথ দেখুওৱা) + না (আমাক)']];
  // Assamese meanings for the example words (looked up by the word's Latin transliteration, then by its English meaning)
  const TR_AS = {
    'iyyāka': 'কেৱল তোমাকেই', "bis'mi": 'নামত', 'tabbat': 'ধ্বংস হওক', 'thumma': 'তাৰ পিছত', 'jāa': 'আহিল', 'ḥāsidin': 'হিংসুক', 'khalaqa': 'তেওঁ সৃষ্টি কৰিলে', 'dīni': 'দ্বীন',
    'dhāta': 'যুক্ত, অধিকাৰী', 'rabbi': 'প্ৰতিপালক', "zur'tumu": 'তোমালোকে দৰ্শন কৰা', 'sawfa': 'অতি সোনকালে', 'sharri': 'অনিষ্ট', 'ṣirāṭa': 'পথ', 'ḍalla': 'পথ হেৰুৱালে', 'ṭaʿāmi': 'খাদ্য',
    'ẓahraka': 'তোমাৰ পিঠি', 'ʿanhu': 'তেওঁৰ পৰা', 'ghayri': 'নহয়, বাহিৰে', 'fī': '-ত, ভিতৰত', 'qul': 'কোৱা', 'kufuwan': 'সমতুল্য', 'lillahi': 'আল্লাহৰ বাবে', 'māliki': 'মালিক',
    'naʿbudu': 'আমি ইবাদত কৰোঁ', 'huwa': 'তেওঁ', 'walā': 'আৰু নহয়', 'yawmi': 'দিন', 'l-raḥmāni': 'পৰম কৰুণাময়', 'l-raḥīmi': 'পৰম দয়ালু', 'al-ḥamdu': 'সকলো প্ৰশংসা', 'l-ʿālamīna': 'জগতসমূহ',
    "ih'dinā": 'আমাক পথ দেখুওৱা', 'ʿalayhim': 'তেওঁলোকৰ ওপৰত', "khus'rin": 'ক্ষতি', 'lirabbika': 'তোমাৰ প্ৰতিপালকৰ বাবে', 'aḥadun': 'এক', 'yūlad': 'জন্ম দিয়া হৈছে', 'walam': 'আৰু নাই',
    'lahu': 'তেওঁৰ বাবে', 'aʿūdhu': 'মই আশ্ৰয় বিচাৰোঁ', 'birabbi': 'প্ৰতিপালকৰ ওচৰত', 'l-nāsi': 'মানুহ', 'l-jinati': 'জিন'
  };
  const MEAN_AS = {
    'of what': 'কি, যি', 'what': 'কি, যি', 'indeed': 'নিশ্চয়', 'in': '-ত, ভিতৰত', 'when': 'যেতিয়া', 'and what': 'আৰু কি, যি', 'of those': 'যিসকল', 'those': 'যিসকল', 'and when': 'আৰু যেতিয়া', 'then': 'তাৰ পিছত',
    'except': 'বাহিৰে', 'from': 'পৰা', 'the one who': 'যিজন', 'the day': 'দিন', 'that day': 'সেইদিনা', 'wherein': 'তাত', 'and not': 'আৰু নহয়', 'of your lord': 'তোমাৰ প্ৰতিপালক', 'will make you know': 'তোমাক জনাব',
    'indeed, he': 'নিশ্চয় তেওঁ', 'nay': 'কেতিয়াও নহয়', 'him whose': 'যি, যাৰ', 'man': 'মানুহ', 'that': 'যে, সেই', 'he': 'তেওঁ', 'they': 'তেওঁলোক', 'have not': 'নাইনে', 'believe': 'ঈমান আনিছে',
    'to': 'ফালে, ওপৰত', 'do not': 'নহয়, না', 'of allah': 'আল্লাহ', 'on them': 'তেওঁলোকৰ ওপৰত', 'is allah': 'আল্লাহ', 'mankind': 'মানুহ', 'is surely, in': 'নিশ্চয় …-ত'
  };

  const isMark = (ch) => { const c = ch.charCodeAt(0); return (c >= 0x064B && c <= 0x065F) || c === 0x0670 || (c >= 0x06D6 && c <= 0x06ED) || (c >= 0x08D3 && c <= 0x08FF) || c === 0x0640; };
  const forms = (c, j) => [c, j ? c + ZWJ : c, ZWJ + c + (j ? ZWJ : ''), ZWJ + c];
  const clean = (m) => m.replace(/[()\[\]]/g, '').trim();

  function view(app) {
    const { h, $, $$, sayWord, shuffle, openModal, closeModal, burst, store, touchDay } = window.Noor;
    const D = window.LESSON_DATA, P = window.AsPron;
    const AS = window.Noor.lang() === 'as';
    const L = (en, as) => (AS ? as : en);
    const meaning = (w) => AS ? (TR_AS[w.tr] || MEAN_AS[clean(w.m).toLowerCase()] || clean(w.m)) : clean(w.m);
    const wordCard = (w, opts = {}) => h('button', { class: 'wcard', onclick: () => sayWord(w), title: L('Tap to hear', 'শুনিবলৈ টিপক') },
      h('span', { class: 'ar', dir: 'rtl', lang: 'ar' }, w.t),
      h('span', { class: 'pa', lang: 'as' }, opts.stop ? P.word(w.t) + ' → ' + P.verse([w.t]) : P.word(w.t)),
      h('span', { class: 'mn' }, opts.note || meaning(w)), h('span', { class: 'spk' }, '🔊 ' + w.k));
    const body = h('div', { class: 'lbody' });

    /* 1. letters */
    const tabLetters = () => {
      const detail = h('div', { class: 'ldetail' });
      const show = (X, btn) => {
        const [c, name, snd, lat, tipEn, j, tipAs] = X, f = forms(c, j), ex = D.ex[c];
        $$('.lcell', body).forEach(b => b.classList.toggle('on', b === btn));
        const fam = FAMILIES.find(g => g.includes(c));
        detail.replaceChildren(
          h('div', { class: 'lbig', lang: 'ar' }, c),
          h('div', { class: 'linfo' },
            h('h3', {}, name, h('small', {}, L(' · sounds like ', ' · ধ্বনি ')), h('b', { class: 'snd' }, snd), h('small', {}, ' (' + lat + ')')),
            h('p', {}, L(tipEn, tipAs)),
            h('div', { class: 'forms' }, [L('Alone', 'অকলে'), L('Start', 'আৰম্ভণি'), L('Middle', 'মাজত'), L('End', 'শেষত')].map((lab, i) => h('div', {}, h('span', { class: 'ar', lang: 'ar' }, f[i]), h('small', {}, lab)))),
            j ? null : h('p', { class: 'muted' }, L('This letter never joins to the letter after it, so its “start” and “middle” shapes look like “alone” and “end”.', 'এই আখৰ পিছৰ আখৰৰ লগত কেতিয়াও জোৰা নালাগে; সেয়ে ইয়াৰ “আৰম্ভণি” আৰু “মাজত” ৰূপ “অকলে” আৰু “শেষত”-ৰ দৰেই।')),
            fam ? h('p', { class: 'muted' }, L('Same shape, different dots: ', 'একে ৰূপ, বেলেগ ফুট: '), h('span', { class: 'ar sm', lang: 'ar' }, fam.join('  '))) : null,
            ex ? h('div', { class: 'row left' }, wordCard(ex)) : null));
        detail.classList.remove('pop'); void detail.offsetWidth; detail.classList.add('pop');
        if (ex && btn && btn.dataset.user) sayWord(ex);
      };
      const grid = h('div', { class: 'lgrid', dir: 'rtl' }, LET.map(X => h('button', { class: 'lcell', onclick: (e) => { e.currentTarget.dataset.user = '1'; show(X, e.currentTarget); } }, h('span', { class: 'ar', lang: 'ar' }, X[0]), h('small', { lang: 'as' }, X[1]))));
      body.replaceChildren(
        h('p', { class: 'lead' }, L('Arabic is read from right to left. It has 28 letters, and all of them are consonants — the vowels are small marks written above or below. Tap a letter to see its shapes and hear a Quran word that begins with it.',
          'আৰবী সোঁফালৰ পৰা বাওঁফাললৈ পঢ়া হয়। ইয়াত 28টা আখৰ আছে আৰু সকলোবোৰ ব্যঞ্জনবৰ্ণ — স্বৰধ্বনিবোৰ আখৰৰ ওপৰত বা তলত লিখা সৰু সৰু চিন। এটা আখৰত টিপক; তাৰ ৰূপবোৰ চাওক আৰু সেই আখৰেৰে আৰম্ভ হোৱা কোৰআনৰ এটা শব্দ শুনক।')),
        h('div', { class: 'lsplit' }, grid, detail));
      show(LET[1], $$('.lcell', body)[1]);
    };

    /* 2. vowel marks */
    const tabMarks = () => {
      let c = 'ب', m = 0;
      const out = h('div', { class: 'syll' });
      const draw = () => {
        const t = MARKS[m][2](c);
        out.replaceChildren(h('div', { class: 'lbig', lang: 'ar' }, t), h('div', { class: 'eq' }, '='), h('div', { class: 'sndbig', lang: 'as' }, P.word(t)),
          h('p', {}, h('b', {}, L(MARKS[m][0] + ' (' + MARKS[m][1] + '): ', MARKS[m][1] + ' (' + MARKS[m][0] + '): ')), L(MARKS[m][3], MARKS[m][4])));
        out.classList.remove('pop'); void out.offsetWidth; out.classList.add('pop');
        $$('.pickL', body).forEach(b => b.classList.toggle('on', b.dataset.c === c));
        $$('.pickM', body).forEach(b => b.classList.toggle('on', +b.dataset.m === m));
      };
      body.replaceChildren(
        h('p', { class: 'lead' }, L('A letter alone has no vowel. The small marks tell you which vowel to say. Pick a letter and a mark, and read the sound in Assamese.',
          'অকলশৰীয়া আখৰত কোনো স্বৰধ্বনি নাথাকে। সৰু চিনবোৰে কয় কোনটো স্বৰ উচ্চাৰণ কৰিব লাগে। এটা আখৰ আৰু এটা চিন বাছক, আৰু ধ্বনিটো অসমীয়াত পঢ়ক।')),
        h('div', { class: 'picks', dir: 'rtl' }, BUILD.map(x => h('button', { class: 'chip pickL arc', 'data-c': x, lang: 'ar', onclick: () => { c = x; draw(); } }, x))),
        h('div', { class: 'picks' }, MARKS.map((x, i) => h('button', { class: 'chip pickM', 'data-m': i, onclick: () => { m = i; draw(); } }, L(x[0], x[1])))),
        out);
      draw();
    };

    /* 3. joining */
    const tabJoin = () => {
      const keys = ['1:1:1', '1:5:2', '1:2:3', '112:1:4', '1:4:1', '1:7:4'].map(k => D.byKey[k]).concat(D.ex['خ']).filter(Boolean);
      let i = 0;
      const stage = h('div', { class: 'join' });
      const draw = () => {
        const w = keys[i], letters = [...w.t].filter(ch => !isMark(ch));
        stage.replaceChildren(
          h('div', { class: 'jl', dir: 'rtl' }, letters.map((ch, k) => h('span', { class: 'jbox ar', lang: 'ar', style: `animation-delay:${k * 140}ms` }, ch === 'ٱ' ? 'ا' : ch))),
          h('div', { class: 'eq' }, L('↓ join and add the marks', '↓ জোৰা লগাওক আৰু চিনবোৰ দিয়ক')),
          h('div', { class: 'row' }, wordCard(w)));
      };
      body.replaceChildren(
        h('p', { class: 'lead' }, L('Inside a word, letters are joined like handwriting, and each letter changes shape a little. Six letters — ا د ذ ر ز و — join only to the letter before them, never to the one after, so they leave a small gap.',
          'শব্দৰ ভিতৰত আখৰবোৰ হাতৰ লিখাৰ দৰে জোৰা লাগে আৰু প্ৰতিটো আখৰৰ ৰূপ অলপ সলনি হয়। ছয়টা আখৰ — ا د ذ ر ز و — কেৱল আগৰ আখৰৰ লগতহে জোৰা লাগে, পিছৰ আখৰৰ লগত কেতিয়াও নহয়; সেয়ে তাৰ পিছত অলপ ফাঁক থাকে।')),
        stage,
        h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: () => { i = (i + 1) % keys.length; draw(); } }, L('Next word →', 'পৰৱৰ্তী শব্দ →'))));
      draw();
    };

    /* 4. reading rules */
    const tabRules = () => body.replaceChildren(
      h('p', { class: 'lead' }, L('These few rules cover most of what you meet on every page. Each example is a real word from the Quran — tap it to hear it.',
        'এই কেইটামান নিয়মেই প্ৰতিটো পৃষ্ঠাত পোৱা প্ৰায় সকলো কথা সামৰি লয়। প্ৰতিটো উদাহৰণ কোৰআনৰ প্ৰকৃত শব্দ — শুনিবলৈ তাত টিপক।')),
      h('div', { class: 'rules' }, RULES.map(([title, text, keys, stop, titleAs, textAs], i) => h('div', { class: 'rule', style: `animation-delay:${i * 60}ms` },
        h('i', {}, i + 1), h('h3', {}, L(title, titleAs)), h('p', {}, L(text, textAs)),
        h('div', { class: 'row left' }, keys.map(k => D.byKey[k]).filter(Boolean).map(w => wordCard(w, { stop })))))));

    /* 5. word building */
    const tabBuild = () => {
      const table = (rows) => h('div', { class: 'affix' }, rows.map(([a, as, en, mAs]) => h('div', {}, h('span', { class: 'ar', lang: 'ar' }, a), h('b', { lang: 'as' }, as), h('span', {}, L(en, mAs)))));
      body.replaceChildren(
        h('p', { class: 'lead' }, L('One Arabic word often holds several English words. Small pieces are attached to the front and the end. Once you know these pieces, long words become easy to understand.',
          'আৰবীৰ এটা শব্দত প্ৰায়ে কেইবাটাও অসমীয়া শব্দৰ অৰ্থ থাকে। শব্দৰ আগত আৰু শেষত সৰু সৰু অংশ লগ লাগে। এই অংশবোৰ চিনি পালে দীঘল শব্দও বুজিবলৈ সহজ হয়।')),
        h('div', { class: 'two' },
          h('div', { class: 'panel' }, h('h3', {}, L('Attached to the front', 'শব্দৰ আগত লগ লগা')), table(PREFIX)),
          h('div', { class: 'panel' }, h('h3', {}, L('Attached to the end', 'শব্দৰ শেষত লগ লগা')), table(SUFFIX))),
        h('h3', { class: 'subh' }, L('See the pieces in real words', 'প্ৰকৃত শব্দত অংশবোৰ চাওক')),
        h('div', { class: 'row left' }, PARTS.map(([k, note, noteAs]) => D.byKey[k] && wordCard(D.byKey[k], { note: L(note, noteAs) }))),
        h('div', { class: 'panel', style: 'margin-top:18px' }, h('h3', {}, L('Word families', 'শব্দৰ পৰিয়াল')),
          h('p', {}, L('Most Arabic words grow from a root of three letters, and words from the same root share a meaning. These two names of Allah both come from the root ر ح م, which carries the meaning of mercy:',
            'আৰবীৰ বেছিভাগ শব্দ তিনিটা আখৰৰ মূলৰ পৰা গঢ়ি উঠে, আৰু একে মূলৰ শব্দবোৰৰ অৰ্থ ওচৰা-ওচৰি। আল্লাহৰ এই দুটা নাম ر ح م মূলৰ পৰা আহিছে, যাৰ অৰ্থ ৰহমত (দয়া):')),
          h('div', { class: 'row left' }, ['1:1:3', '1:1:4'].map(k => wordCard(D.byKey[k])))));
    };

    /* 6. common words */
    const tabCommon = () => body.replaceChildren(
      h('p', { class: 'lead' }, L('These are the words that appear most often in Surah Al-Fatihah and the short surahs of the last part of the Quran. Learn these and you already recognise a large share of what you recite in salah.',
        'ছুৰা ফাতিহা আৰু কোৰআনৰ শেষ অংশৰ চুটি ছুৰাবোৰত এই শব্দবোৰ আটাইতকৈ বেছিকৈ আহে। এইবোৰ শিকিলে আপুনি ছালাতত পঢ়া কথাৰ এটা ডাঙৰ অংশ চিনি পাব।')),
      h('div', { class: 'row left' }, D.common.map(w => wordCard(w, { note: meaning(w) + ' · ' + w.n + L('×', ' বাৰ') }))));

    /* 7. practice */
    const quiz = () => {
      const qs = shuffle(LET).slice(0, 10); let i = 0, score = 0;
      const next = () => {
        if (i >= qs.length) {
          touchDay(); store.set('letterQuiz', Math.max(store.get('letterQuiz', 0), score));
          const sheet = openModal(h('h2', {}, score >= 8 ? L('MashaAllah — well done!', 'মাশ্বাআল্লাহ — বৰ ভাল!') : L('Good effort', 'ভাল চেষ্টা')), h('div', { class: 'big' }, score + '/10'),
            h('p', { class: 'muted', style: 'text-align:center' }, L('Repeat this a few times a day until every letter is instant. Then your eyes stop hesitating and your recitation speeds up.',
              'প্ৰতিটো আখৰ দেখামাত্ৰে চিনি নোপোৱালৈকে দিনে কেইবাবাৰো এইটো কৰক। তেতিয়া চকু ৰৈ নাযায় আৰু তিলাৱত খৰ হয়।')),
            h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: quiz }, L('Again', 'আকৌ')), h('button', { class: 'btn', onclick: closeModal }, L('Close', 'বন্ধ কৰক'))));
          if (score >= 8) burst(sheet);
          return;
        }
        const q = qs[i], f = forms(q[0], q[5]), shape = f[Math.floor(Math.random() * 4)];
        const opts = shuffle([q, ...shuffle(LET.filter(l => l[1] !== q[1])).slice(0, 3)]);
        const nextBtn = h('button', { class: 'btn gold', hidden: true, onclick: () => { i++; next(); } }, L('Next →', 'পৰৱৰ্তী →'));
        const box = h('div', { class: 'opts' }, opts.map(o => h('button', {
          class: 'opt', lang: 'as', 'data-c': o[0], onclick: (e) => {
            $$('.opt', box).forEach(b => { b.disabled = true; if (b.dataset.c === q[0]) b.classList.add('right'); });
            if (o[0] === q[0]) { score++; setTimeout(() => { i++; next(); }, 700); } else { e.currentTarget.classList.add('wrong'); nextBtn.hidden = false; }
          }
        }, o[1] + ' (' + o[3] + ')')));
        const sheet = openModal(h('h2', {}, L('Which letter is this?', 'এইটো কোন আখৰ?')), h('div', { class: 'muted' }, L(`Letter ${i + 1} of 10`, `আখৰ ${i + 1} / 10`)),
          h('div', { class: 'qprog' }, h('i', { style: `width:${i * 10}%` })), h('div', { class: 'qword', lang: 'ar' }, shape), box, h('div', { class: 'row' }, nextBtn));
      };
      next();
    };
    const tabPractice = () => body.replaceChildren(
      h('p', { class: 'lead' }, L('Fast recitation starts with instant letter recognition. In this drill a letter appears in one of its four shapes and you choose its name.',
        'খৰকৈ তিলাৱত কৰিবলৈ প্ৰথমে আখৰ দেখামাত্ৰে চিনি পাব লাগিব। এই অনুশীলনত এটা আখৰ তাৰ চাৰিটা ৰূপৰ এটাত দেখা যাব আৰু আপুনি তাৰ নাম বাছিব।')),
      h('div', { class: 'endcard' }, h('h3', {}, L('Letter recognition drill', 'আখৰ চিনাৰ অনুশীলন')), h('p', {}, L('Ten letters. Your best score so far: ', 'দহটা আখৰ। এতিয়ালৈকে আপোনাৰ সৰ্বোচ্চ নম্বৰ: ') + store.get('letterQuiz', 0) + '/10'),
        h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: quiz }, L('Start the drill', 'অনুশীলন আৰম্ভ কৰক')))),
      h('div', { class: 'endcard' }, h('h3', {}, L('Then read real verses', 'তাৰ পিছত প্ৰকৃত আয়াত পঢ়ক')), h('p', {}, L('Open a short surah, hide the pronunciation lines, and try to read each word before you tap it to check.',
        'এটা চুটি ছুৰা খোলক, উচ্চাৰণৰ শাৰীবোৰ লুকুৱাই ৰাখক, আৰু প্ৰতিটো শব্দত টিপি পৰীক্ষা কৰাৰ আগতে নিজে পঢ়িবলৈ চেষ্টা কৰক।')),
        h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/s/112' }, L('Practise on Al-Ikhlas →', 'ছুৰা ইখলাছত অনুশীলন কৰক →')))));

    const TABS = [['Letters', 'আখৰ', tabLetters], ['Vowel marks', 'স্বৰচিন', tabMarks], ['Joining', 'জোৰা লগোৱা', tabJoin], ['Reading rules', 'পঢ়াৰ নিয়ম', tabRules], ['Word building', 'শব্দ গঠন', tabBuild], ['Common words', 'সঘন শব্দ', tabCommon], ['Practice', 'অনুশীলন', tabPractice]];
    const tabs = h('div', { class: 'ltabs' }, TABS.map(([en, as, fn], i) => h('button', { class: 'chip ltab', onclick: (e) => { $$('.ltab', tabs).forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); store.set('learnTab', i); fn(); body.classList.remove('fadein'); void body.offsetWidth; body.classList.add('fadein'); } }, (i + 1) + '. ' + L(en, as))));
    app.replaceChildren(
      h('section', { class: 'shead' }, h('div', { class: 'shead-art', html: Scenes.forSurah(96) }), h('div', { class: 'shead-in' },
        h('div', { class: 'shead-txt' }, h('div', { class: 'sub' }, L('Chapter 1 · for beginners', 'অধ্যায় 1 · নতুন শিকাৰুৰ বাবে')), h('h1', {}, L('Learn to read Arabic', 'আৰবী পঢ়িবলৈ শিকক')),
          h('div', { class: 'sub mean' }, L('Letters, vowel marks and the basics you need before reciting', 'তিলাৱতৰ আগতে লাগতিয়াল আখৰ, স্বৰচিন আৰু মৌলিক কথা'))),
        h('div', { class: 'arname', lang: 'ar', 'aria-hidden': 'true' }, 'ا ب ت'))),
      h('div', { class: 'wrap' }, tabs, body, window.Noor.footer()));
    $$('.ltab', tabs)[Math.min(store.get('learnTab', 0), TABS.length - 1)].click();
  }

  window.Learn = { view };
})();
