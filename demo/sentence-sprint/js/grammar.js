/* Sentence Sprint 1.1.1 — sentence checker, generator and "why is it wrong" hints.
   ANY grammatical English sentence built from the game's word set counts: there is no target sentence.
   A small feature grammar (subject–verb agreement, a/an, count/mass nouns, transitivity, object classes,
   tense-matching time words) parses the player's word sequence. The same grammar generates the sentences
   whose words are scattered along the track, and every generated sentence is re-checked by the parser.
   Runs on every device (live hint on easy levels) and on the host (the decision that counts).
   © 2026 Amir · Englishia */

/* ---------- lexicon (en, tier, native glosses he/ar/ru) ---------- */
// nouns: [sg, pl ("" = mass noun), classes, tier, he, ar, ru]
// classes: a animate · f food · d drink · r reading · y toy · b ball · t thing · o can be opened
//          p place · s sport · u school subject · l can be listened to · m show
const NOUNS = [
  ["dog", "dogs", "a", 1, "כלב", "كلب", "собака"], ["cat", "cats", "a", 1, "חתול", "قطة", "кошка"],
  ["boy", "boys", "a", 1, "ילד", "ولد", "мальчик"], ["girl", "girls", "a", 1, "ילדה", "بنت", "девочка"],
  ["teacher", "teachers", "a", 1, "מורה", "معلّم", "учитель"], ["friend", "friends", "a", 1, "חבר", "صديق", "друг"],
  ["bird", "birds", "a", 1, "ציפור", "طائر", "птица"], ["baby", "babies", "a", 1, "תינוק", "طفل رضيع", "малыш"],
  ["mother", "mothers", "a", 1, "אמא", "أمّ", "мама"], ["father", "fathers", "a", 1, "אבא", "أب", "папа"],
  ["sister", "sisters", "a", 1, "אחות", "أخت", "сестра"], ["brother", "brothers", "a", 1, "אח", "أخ", "брат"],
  ["rabbit", "rabbits", "a", 1, "ארנב", "أرنب", "кролик"], ["horse", "horses", "a", 2, "סוס", "حصان", "лошадь"],
  ["child", "children", "a", 2, "ילד", "طفل", "ребёнок"], ["man", "men", "a", 2, "איש", "رجل", "мужчина"],
  ["woman", "women", "a", 2, "אישה", "امرأة", "женщина"], ["student", "students", "a", 2, "תלמיד", "طالب", "ученик"],
  ["monkey", "monkeys", "a", 2, "קוף", "قرد", "обезьяна"], ["doctor", "doctors", "a", 2, "רופא", "طبيب", "врач"],
  ["lion", "lions", "a", 2, "אריה", "أسد", "лев"], ["farmer", "farmers", "a", 3, "חקלאי", "مزارع", "фермер"],
  ["neighbor", "neighbors", "a", 3, "שכן", "جار", "сосед"], ["scientist", "scientists", "a", 3, "מדען", "عالِم", "учёный"],
  ["elephant", "elephants", "a", 3, "פיל", "فيل", "слон"],
  ["apple", "apples", "f", 1, "תפוח", "تفاحة", "яблоко"], ["banana", "bananas", "f", 1, "בננה", "موزة", "банан"],
  ["cake", "cakes", "f", 1, "עוגה", "كعكة", "торт"], ["egg", "eggs", "f", 1, "ביצה", "بيضة", "яйцо"],
  ["sandwich", "sandwiches", "f", 2, "כריך", "شطيرة", "бутерброд"], ["cookie", "cookies", "f", 2, "עוגייה", "بسكويتة", "печенье"],
  ["carrot", "carrots", "f", 2, "גזר", "جزرة", "морковь"], ["orange", "oranges", "f", 2, "תפוז", "برتقالة", "апельсин"],
  ["tomato", "tomatoes", "f", 3, "עגבנייה", "طماطم", "помидор"],
  ["pizza", "", "f", 1, "פיצה", "بيتزا", "пицца"], ["bread", "", "f", 1, "לחם", "خبز", "хлеб"],
  ["chocolate", "", "f", 1, "שוקולד", "شوكولاتة", "шоколад"], ["rice", "", "f", 2, "אורז", "أرز", "рис"],
  ["soup", "", "f", 2, "מרק", "حساء", "суп"], ["cheese", "", "f", 2, "גבינה", "جبنة", "сыр"],
  ["water", "", "d", 1, "מים", "ماء", "вода"], ["milk", "", "d", 1, "חלב", "حليب", "молоко"],
  ["juice", "", "d", 1, "מיץ", "عصير", "сок"], ["tea", "", "d", 2, "תה", "شاي", "чай"], ["coffee", "", "d", 3, "קפה", "قهوة", "кофе"],
  ["book", "books", "ro", 1, "ספר", "كتاب", "книга"], ["story", "stories", "r", 2, "סיפור", "قصة", "рассказ"],
  ["letter", "letters", "ro", 2, "מכתב", "رسالة", "письмо"], ["message", "messages", "r", 2, "הודעה", "رسالة نصية", "сообщение"],
  ["newspaper", "newspapers", "r", 3, "עיתון", "جريدة", "газета"], ["poem", "poems", "r", 3, "שיר (פואמה)", "قصيدة", "стихотворение"],
  ["magazine", "magazines", "r", 3, "מגזין", "مجلة", "журнал"],
  ["ball", "balls", "yb", 1, "כדור", "كرة", "мяч"], ["toy", "toys", "y", 1, "צעצוע", "لعبة", "игрушка"],
  ["bike", "bikes", "y", 1, "אופניים", "دراجة", "велосипед"], ["kite", "kites", "y", 2, "עפיפון", "طائرة ورقية", "воздушный змей"],
  ["doll", "dolls", "y", 2, "בובה", "دمية", "кукла"], ["game", "games", "yg", 2, "משחק", "لعبة", "игра"],
  ["bag", "bags", "to", 1, "תיק", "حقيبة", "сумка"], ["box", "boxes", "to", 1, "קופסה", "صندوق", "коробка"],
  ["door", "doors", "to", 1, "דלת", "باب", "дверь"], ["car", "cars", "t", 1, "מכונית", "سيارة", "машина"],
  ["pen", "pens", "t", 1, "עט", "قلم", "ручка"], ["hat", "hats", "t", 1, "כובע", "قبعة", "шапка"],
  ["cup", "cups", "t", 1, "כוס", "كوب", "чашка"], ["window", "windows", "to", 2, "חלון", "نافذة", "окно"],
  ["phone", "phones", "t", 2, "טלפון", "هاتف", "телефон"], ["computer", "computers", "t", 2, "מחשב", "حاسوب", "компьютер"],
  ["picture", "pictures", "t", 2, "תמונה", "صورة", "картина"], ["key", "keys", "t", 2, "מפתח", "مفتاح", "ключ"],
  ["table", "tables", "t", 2, "שולחן", "طاولة", "стол"], ["umbrella", "umbrellas", "t", 3, "מטרייה", "مظلة", "зонт"],
  ["park", "parks", "p", 1, "פארק", "حديقة عامة", "парк"], ["house", "houses", "p", 1, "בית", "بيت", "дом"],
  ["room", "rooms", "p", 1, "חדר", "غرفة", "комната"], ["zoo", "zoos", "p", 1, "גן חיות", "حديقة الحيوانات", "зоопарк"],
  ["tree", "trees", "p", 1, "עץ", "شجرة", "дерево"], ["garden", "gardens", "p", 2, "גינה", "حديقة", "сад"],
  ["beach", "beaches", "p", 2, "חוף", "شاطئ", "пляж"], ["shop", "shops", "p", 2, "חנות", "متجر", "магазин"],
  ["city", "cities", "p", 2, "עיר", "مدينة", "город"], ["library", "libraries", "p", 2, "ספרייה", "مكتبة", "библиотека"],
  ["kitchen", "kitchens", "p", 2, "מטבח", "مطبخ", "кухня"], ["classroom", "classrooms", "p", 2, "כיתה", "صف", "класс"],
  ["museum", "museums", "p", 3, "מוזיאון", "متحف", "музей"], ["forest", "forests", "p", 3, "יער", "غابة", "лес"],
  ["river", "rivers", "p", 3, "נהר", "نهر", "река"],
  ["football", "", "s", 1, "כדורגל", "كرة القدم", "футбол"], ["basketball", "", "s", 2, "כדורסל", "كرة السلة", "баскетбол"],
  ["tennis", "", "s", 2, "טניס", "تنس", "теннис"],
  ["English", "", "u", 1, "אנגלית", "الإنجليزية", "английский"], ["music", "", "ul", 1, "מוזיקה", "موسيقى", "музыка"],
  ["math", "", "u", 2, "מתמטיקה", "رياضيات", "математика"], ["art", "", "u", 2, "אומנות", "فن", "искусство"],
  ["science", "", "u", 2, "מדעים", "علوم", "естествознание"], ["history", "", "u", 3, "היסטוריה", "تاريخ", "история"],
  ["TV", "", "m", 1, "טלוויזיה", "تلفاز", "телевизор"], ["movie", "movies", "m", 2, "סרט", "فيلم", "фильм"]
];
// nouns used without a determiner after a preposition (at school, to work) or after "go" (go home)
const BARE = [["school", 1, "בית ספר", "مدرسة", "школа"], ["home", 1, "הביתה / בבית", "البيت", "дом (домой)"], ["work", 2, "עבודה", "العمل", "работа"]];
const NAMES = [["Dan", "דן", "دان", "Дэн"], ["Noa", "נועה", "نوعا", "Ноа"], ["Sam", "סאם", "سام", "Сэм"], ["Maya", "מאיה", "مايا", "Майя"]];
// verbs: [base, 3sg, ing ("" = not used), past, tier, object 0 none / 1 optional / 2 required, object classes ("*" any), flags, he, ar, ru]
// flags: m = motion (to + place, home, here) · l = listen to · w = "with" partner
const VERBS = [
  ["run", "runs", "running", "ran", 1, 0, "", "m", "רץ", "يركض", "бегать"],
  ["walk", "walks", "walking", "walked", 1, 0, "", "mw", "הולך", "يمشي", "ходить"],
  ["jump", "jumps", "jumping", "jumped", 1, 0, "", "", "קופץ", "يقفز", "прыгать"],
  ["swim", "swims", "swimming", "swam", 1, 0, "", "", "שוחה", "يسبح", "плавать"],
  ["sleep", "sleeps", "sleeping", "slept", 1, 0, "", "", "ישן", "ينام", "спать"],
  ["sing", "sings", "singing", "sang", 1, 0, "", "w", "שר", "يغني", "петь"],
  ["play", "plays", "playing", "played", 1, 1, "sg", "w", "משחק", "يلعب", "играть"],
  ["eat", "eats", "eating", "ate", 1, 1, "f", "w", "אוכל", "يأكل", "есть"],
  ["drink", "drinks", "drinking", "drank", 1, 1, "d", "", "שותה", "يشرب", "пить"],
  ["read", "reads", "reading", "read", 1, 1, "r", "", "קורא", "يقرأ", "читать"],
  ["like", "likes", "", "liked", 1, 2, "*", "", "אוהב", "يحب", "любить"],
  ["love", "loves", "", "loved", 1, 2, "*", "", "אוהב מאוד", "يحب كثيرًا", "обожать"],
  ["have", "has", "", "had", 1, 2, "*", "", "יש ל־", "عنده", "иметь"],
  ["want", "wants", "", "wanted", 1, 2, "*", "", "רוצה", "يريد", "хотеть"],
  ["see", "sees", "", "saw", 1, 2, "*", "", "רואה", "يرى", "видеть"],
  ["watch", "watches", "watching", "watched", 1, 2, "ams", "", "צופה ב־", "يشاهد", "смотреть"],
  ["help", "helps", "helping", "helped", 1, 1, "a", "", "עוזר", "يساعد", "помогать"],
  ["go", "goes", "going", "went", 1, 0, "", "mw", "הולך (ל־)", "يذهب", "идти"],
  ["dance", "dances", "dancing", "danced", 2, 0, "", "w", "רוקד", "يرقص", "танцевать"],
  ["laugh", "laughs", "laughing", "laughed", 2, 0, "", "w", "צוחק", "يضحك", "смеяться"],
  ["write", "writes", "writing", "wrote", 2, 1, "r", "", "כותב", "يكتب", "писать"],
  ["cook", "cooks", "cooking", "cooked", 2, 1, "f", "w", "מבשל", "يطبخ", "готовить"],
  ["need", "needs", "", "needed", 2, 2, "*", "", "צריך", "يحتاج", "нуждаться"],
  ["find", "finds", "finding", "found", 2, 2, "tyrfab", "", "מוצא", "يجد", "находить"],
  ["open", "opens", "opening", "opened", 2, 2, "o", "", "פותח", "يفتح", "открывать"],
  ["kick", "kicks", "kicking", "kicked", 2, 2, "b", "", "בועט", "يركل", "пинать"],
  ["throw", "throws", "throwing", "threw", 2, 2, "yb", "", "זורק", "يرمي", "бросать"],
  ["buy", "buys", "buying", "bought", 2, 2, "fdtyrb", "", "קונה", "يشتري", "покупать"],
  ["make", "makes", "making", "made", 2, 2, "ft", "", "מכין", "يصنع", "делать"],
  ["draw", "draws", "drawing", "drew", 2, 1, "atpo", "", "מצייר", "يرسم", "рисовать"],
  ["come", "comes", "coming", "came", 2, 0, "", "mw", "בא", "يأتي", "приходить"],
  ["study", "studies", "studying", "studied", 2, 1, "u", "w", "לומד", "يدرس", "учить"],
  ["work", "works", "working", "worked", 2, 0, "", "w", "עובד", "يعمل", "работать"],
  ["listen", "listens", "listening", "listened", 2, 0, "", "l", "מקשיב", "يستمع", "слушать"],
  ["visit", "visits", "visiting", "visited", 3, 2, "ap", "", "מבקר", "يزور", "навещать"],
  ["clean", "cleans", "cleaning", "cleaned", 3, 2, "pt", "", "מנקה", "ينظّف", "убирать"],
  ["wash", "washes", "washing", "washed", 3, 2, "taf", "", "שוטף", "يغسل", "мыть"],
  ["climb", "climbs", "climbing", "climbed", 3, 1, "p", "", "מטפס", "يتسلّق", "лазать"],
  ["carry", "carries", "carrying", "carried", 3, 2, "tyfrb", "", "סוחב", "يحمل", "нести"],
  ["sit", "sits", "sitting", "sat", 1, 0, "", "u", "יושב", "يجلس", "сидеть"],
  ["stand", "stands", "standing", "stood", 1, 0, "", "u", "עומד", "يقف", "стоять"],
  ["wake", "wakes", "waking", "woke", 2, 0, "", "u", "מתעורר", "يستيقظ", "просыпаться"]
];
// particles after some verbs: sit down, stand up, wake up
const PART = { sit: ["down", "up"], stand: ["up"], wake: ["up"] };
const PARTS = [["down", "למטה", "إلى الأسفل", "вниз"], ["up", "למעלה", "إلى الأعلى", "вверх"]];
// verbs that do not make natural commands on their own
const NO_IMP = new Set(["like", "love", "have", "want", "need", "see"]);
const ADJS = [
  ["big", 1, "גדול", "كبير", "большой", "PNFT"], ["small", 1, "קטן", "صغير", "маленький", "PNFT"], ["little", 1, "קטנטן", "صغير", "маленький", "PNFT"],
  ["happy", 1, "שמח", "سعيد", "счастливый", "PN"], ["sad", 1, "עצוב", "حزين", "грустный", "PN"], ["red", 1, "אדום", "أحمر", "красный", "FT"],
  ["blue", 1, "כחול", "أزرق", "синий", "T"], ["green", 1, "ירוק", "أخضر", "зелёный", "FT"], ["good", 1, "טוב", "جيد", "хороший", "PNFT"],
  ["new", 1, "חדש", "جديد", "новый", "T"], ["old", 1, "ישן / זקן", "قديم", "старый", "PNT"], ["hot", 1, "חם", "حارّ", "горячий", "F"],
  ["cold", 1, "קר", "بارد", "холодный", "F"], ["funny", 1, "מצחיק", "مضحك", "смешной", "PNT"], ["fast", 1, "מהיר", "سريع", "быстрый", "NT"],
  ["tall", 1, "גבוה", "طويل", "высокий", "PT"], ["nice", 1, "נחמד", "لطيف", "милый", "PNFT"],
  ["hungry", 2, "רעב", "جائع", "голодный", "PN"], ["tired", 2, "עייף", "متعب", "усталый", "PN"], ["angry", 2, "כועס", "غاضب", "сердитый", "PN"],
  ["busy", 2, "עסוק", "مشغول", "занятой", "P"], ["kind", 2, "אדיב", "طيّب", "добрый", "P"], ["clever", 2, "חכם", "ذكي", "умный", "PN"],
  ["beautiful", 2, "יפה", "جميل", "красивый", "PNT"], ["delicious", 2, "טעים", "لذيذ", "вкусный", "F"], ["quiet", 2, "שקט", "هادئ", "тихий", "PNT"],
  ["strong", 2, "חזק", "قوي", "сильный", "PN"], ["brave", 2, "אמיץ", "شجاع", "смелый", "PN"], ["yellow", 2, "צהוב", "أصفر", "жёлтый", "FT"],
  ["young", 2, "צעיר", "صغير السن", "молодой", "PN"],
  ["curious", 3, "סקרן", "فضولي", "любопытный", "PN"], ["excited", 3, "נרגש", "متحمّس", "взволнованный", "P"], ["polite", 3, "מנומס", "مهذّب", "вежливый", "P"],
  ["dangerous", 3, "מסוכן", "خطير", "опасный", "NT"], ["comfortable", 3, "נוח", "مريح", "удобный", "T"], ["enormous", 3, "עצום", "ضخم", "огромный", "NT"],
  ["ancient", 3, "עתיק", "قديم جدًا", "древний", "T"], ["famous", 3, "מפורסם", "مشهور", "знаменитый", "PT"], ["careful", 3, "זהיר", "حذر", "осторожный", "P"],
  ["interesting", 3, "מעניין", "مثير للاهتمام", "интересный", "T"], ["expensive", 3, "יקר", "غالٍ", "дорогой", "T"]
];
// determiners: [word, sg count, plural, mass, tier, he, ar, ru]
const DETS = [
  ["the", 1, 1, 1, 1, "ה־ (המיודע)", "الـ (التعريف)", "(определённый артикль)"], ["a", 1, 0, 0, 1, "(אחד, לא מיודע)", "(نكرة: واحد)", "(один, какой-то)"],
  ["an", 1, 0, 0, 1, "(אחד, לפני תנועה)", "(نكرة قبل حرف علة)", "(один, перед гласной)"],
  ["my", 1, 1, 1, 1, "שלי", "ـي (لي)", "мой"], ["your", 1, 1, 1, 1, "שלך", "ـكَ (لك)", "твой"], ["his", 1, 1, 1, 1, "שלו", "ـه (له)", "его"],
  ["her", 1, 1, 1, 1, "שלה", "ـها (لها)", "её"], ["our", 1, 1, 1, 2, "שלנו", "ـنا (لنا)", "наш"], ["their", 1, 1, 1, 2, "שלהם", "ـهم (لهم)", "их"],
  ["this", 1, 0, 1, 1, "הזה", "هذا", "этот"], ["that", 1, 0, 1, 2, "ההוא", "ذلك", "тот"], ["these", 0, 1, 0, 2, "האלה", "هؤلاء", "эти"],
  ["those", 0, 1, 0, 3, "ההם", "أولئك", "те"], ["some", 0, 1, 1, 2, "כמה / קצת", "بعض", "несколько / немного"],
  ["two", 0, 1, 0, 1, "שני", "اثنان", "два"], ["three", 0, 1, 0, 1, "שלושה", "ثلاثة", "три"], ["many", 0, 1, 0, 2, "הרבה", "كثير", "много"]
];
// pronouns: subject [word, person, he, ar, ru] and object [word, he, ar, ru]
const SUBJ = [["I", "1s", "אני", "أنا", "я"], ["you", "2", "אתה / את", "أنتَ / أنتِ", "ты"], ["he", "3s", "הוא", "هو", "он"], ["she", "3s", "היא", "هي", "она"],
  ["it", "3s", "זה", "هو / هي (لغير العاقل)", "оно"], ["we", "pl", "אנחנו", "نحن", "мы"], ["they", "pl", "הם", "هم", "они"]];
const OBJ = [["me", "אותי", "ـني (أنا)", "меня"], ["you", "אותך", "ـكَ (أنت)", "тебя"], ["him", "אותו", "ـه (هو)", "его"], ["her", "אותה", "ـها (هي)", "её"],
  ["it", "את זה", "ـه (لغير العاقل)", "это"], ["us", "אותנו", "ـنا (نحن)", "нас"], ["them", "אותם", "ـهم (هم)", "их"]];
const BE = [["am", "1s", 0, "(אני) ...", "(أنا) ...", "(я) есть"], ["is", "3s", 0, "(הוא/היא) ...", "(هو/هي) ...", "есть (он/она)"], ["are", "x", 0, "(אנחנו/אתם/הם) ...", "(نحن/أنتم/هم) ...", "есть (мы/вы/они)"],
  ["was", "s", 1, "היה / הייתה", "كان / كانت", "был / была"], ["were", "x", 1, "היו", "كانوا", "были"]];
const MODALS = [["can", "can", 2, "יכול", "يستطيع", "может"], ["will", "will", 3, "(עתיד) יעשה", "سـ (للمستقبل)", "будет"]];
// prepositions: [word, object classes, bare nouns allowed, tier, he, ar, ru]
const PREPS = [
  ["in", "p", "school", 1, "ב־ / בתוך", "في", "в"], ["at", "p", "school home work", 1, "ב־ / אצל", "في / عند", "в / у"],
  ["to", "p", "school work", 1, "אל / ל־", "إلى", "в / к"], ["with", "ayb", "", 1, "עם", "مع", "с"],
  ["near", "pt", "school", 2, "ליד", "قرب", "около"], ["under", "pt", "", 2, "מתחת ל־", "تحت", "под"],
  ["on", "t", "", 2, "על", "على", "на"], ["from", "p", "school work", 3, "מ־", "من", "из"], ["for", "a", "", 3, "בשביל", "من أجل", "для"]
];
// adverbs: [word(s), kind m manner / t time, tenses allowed, tier, he, ar, ru]   tenses: p present · c continuous · s past · w will · n can · b be
const ADVS = [
  ["fast", "m", "pcswn", 1, "מהר", "بسرعة", "быстро"], ["well", "m", "pcswn", 2, "טוב", "جيدًا", "хорошо"], ["slowly", "m", "pcswn", 2, "לאט", "ببطء", "медленно"],
  ["together", "m", "pcswn", 2, "ביחד", "معًا", "вместе"], ["quietly", "m", "pcswn", 3, "בשקט", "بهدوء", "тихо"],
  ["now", "t", "pcnbw", 1, "עכשיו", "الآن", "сейчас"], ["today", "t", "pcswnb", 1, "היום", "اليوم", "сегодня"],
  ["every day", "t", "pcsnbw", 1, "כל יום", "كل يوم", "каждый день"], ["every morning", "t", "pcsnbw", 2, "כל בוקר", "كل صباح", "каждое утро"],
  ["yesterday", "t", "s", 2, "אתמול", "أمس", "вчера"], ["tomorrow", "t", "wc", 3, "מחר", "غدًا", "завтра"],
  // accepted anywhere a time word fits, but never generated as a target
  ["then", "t2", "pcswnb", 2, "אז", "ثم", "тогда"]
];
// frequency adverbs: before the main verb, after am/is/are/can/will, and (often, sometimes) at the start or the end
const FREQ = [["always", 2, "תמיד", "دائمًا", "всегда"], ["never", 2, "אף פעם", "أبدًا", "никогда"], ["often", 2, "לעתים קרובות", "غالبًا", "часто"], ["sometimes", 2, "לפעמים", "أحيانًا", "иногда"], ["usually", 3, "בדרך כלל", "عادةً", "обычно"]];
const THERE = ["there", 2, "שם", "هناك", "там"];
const VERY = ["very", 1, "מאוד", "جدًا", "очень"];
const HERE = ["here", 1, "כאן", "هنا", "здесь"];
const ANIMALS = new Set(["dog", "cat", "bird", "rabbit", "horse", "monkey", "lion", "elephant"]);
const MISC_GLOSS = { every: ["כל", "كل", "каждый"], day: ["יום", "يوم", "день"], morning: ["בוקר", "صباح", "утро"] };

/* ---------- index ---------- */
const LEX = new Map();     // lowercase word -> [entries]
const GLOSS = new Map();   // lowercase word -> {he, ar, ru, tier}
const add = (w, e) => { const k = w.toLowerCase(); if (!LEX.has(k)) LEX.set(k, []); LEX.get(k).push(e); };
const gl = (w, tier, he, ar, ru) => { const k = w.toLowerCase(); const g = GLOSS.get(k); if (!g) GLOSS.set(k, { he, ar, ru, tier }); else g.tier = Math.min(g.tier, tier); };
for (const [sg, pl, cls, tier, he, ar, ru] of NOUNS) {
  const anim = cls.includes("a");
  add(sg, { p: "N", num: pl ? "sg" : "mass", cls, anim, tier }); gl(sg, tier, he, ar, ru);
  if (pl) { add(pl, { p: "N", num: "pl", cls, anim, tier }); gl(pl, tier, he, ar, ru); }
}
for (const [w, tier, he, ar, ru] of BARE) { add(w, { p: "BARE", tier }); gl(w, tier, he, ar, ru); }
for (const [w, he, ar, ru] of NAMES) { add(w, { p: "NAME", tier: 1 }); gl(w, 1, he, ar, ru); }
for (const v of VERBS) {
  const [base, s, ing, past, tier, obj, ocls, flags, he, ar, ru] = v;
  const V = { base, tier, obj, ocls, flags };
  add(base, { p: "V", f: "base", v: V, tier }); add(s, { p: "V", f: "s", v: V, tier });
  if (ing) add(ing, { p: "V", f: "ing", v: V, tier }); add(past, { p: "V", f: "past", v: V, tier: Math.max(2, tier) });
  for (const w of [base, s, ing, past]) if (w) gl(w, tier, he, ar, ru);
}
for (const [w, tier, he, ar, ru] of ADJS) { add(w, { p: "A", tier }); gl(w, tier, he, ar, ru); }
for (const [w, sg, pl, mass, tier, he, ar, ru] of DETS) { add(w, { p: "D", sg, pl, mass, tier }); gl(w, tier, he, ar, ru); }
for (const [w, per, he, ar, ru] of SUBJ) { add(w, { p: "PS", per, tier: 1 }); gl(w, 1, he, ar, ru); }
for (const [w, he, ar, ru] of OBJ) { add(w, { p: "PO", tier: 1 }); if (!GLOSS.has(w)) gl(w, 1, he, ar, ru); }
for (const [w, per, past, he, ar, ru] of BE) { add(w, { p: "BE", per, past: !!past, tier: past ? 2 : 1 }); gl(w, past ? 2 : 1, he, ar, ru); }
for (const [w, k, tier, he, ar, ru] of MODALS) { add(w, { p: "MD", k, tier }); gl(w, tier, he, ar, ru); }
for (const [w, cls, bare, tier, he, ar, ru] of PREPS) { add(w, { p: "P", cls, bare: bare.split(" ").filter(Boolean), tier }); gl(w, tier, he, ar, ru); }
for (const [w, kind, ten, tier, he, ar, ru] of ADVS) { const ws = w.split(" "); add(ws[0], { p: "ADV", ws, kind, ten, tier }); if (ws.length === 1) gl(w, tier, he, ar, ru); }
for (const [w, he, ar, ru] of PARTS) { add(w, { p: "PRT", tier: 1 }); gl(w, 1, he, ar, ru); }
add("very", { p: "VERY", tier: 1 }); gl("very", 1, VERY[2], VERY[3], VERY[4]);
add("here", { p: "HERE", tier: 1 }); gl("here", 1, HERE[2], HERE[3], HERE[4]);
add("there", { p: "HERE", tier: 2 }); gl("there", 2, THERE[2], THERE[3], THERE[4]);
for (const [w, tier, he, ar, ru] of FREQ) { add(w, { p: "FQ", tier }); gl(w, tier, he, ar, ru); }
for (const k in MISC_GLOSS) { add(k, { p: "X", tier: 1 }); if (!GLOSS.has(k)) gl(k, 1, ...MISC_GLOSS[k]); }
GLOSS.set("you", { he: "אתה / אותך", ar: "أنتَ / ـكَ", ru: "ты / тебя", tier: 1 });
GLOSS.set("her", { he: "שלה / אותה", ar: "ـها (لها)", ru: "её", tier: 1 });
GLOSS.set("it", { he: "זה / את זה", ar: "هو / هي (لغير العاقل)", ru: "оно / это", tier: 1 });
GLOSS.set("that", { he: "ההוא", ar: "ذلك", ru: "тот", tier: 2 });

export const knownWord = (w) => LEX.has(String(w).toLowerCase());
export function gloss(w, lang) { const g = GLOSS.get(String(w).toLowerCase()); return g ? g[lang] || g.he : ""; }
/* how a word is written on a bubble / in the bar */
const CAPS = new Set(["i", "english", "tv", "dan", "noa", "sam", "maya"]);
export function disp(w) { const k = String(w).toLowerCase(); if (!CAPS.has(k)) return k; return k === "tv" ? "TV" : k === "i" ? "I" : k[0].toUpperCase() + k.slice(1); }
export function pretty(words) { const s = words.map(disp).join(" "); return s ? s[0].toUpperCase() + s.slice(1) + "." : ""; }

/* ---------- parser ---------- */
const VOWEL = /^[aeiou]/;
const okCls = (allowed, cls) => allowed === "*" || [...cls].some((c) => allowed.includes(c));
/** Returns {ok, reason} for a list of words. The sentence must use every word, in order. */
/* full check: the core parser plus the movable adverbs. A time word may open the sentence ("Now they are brave",
   "Today I run") and a frequency word may sit before the verb, after am/is/are/can/will, or (often/sometimes) at either end.
   Leaning towards accepting: a wrongly rejected good sentence hurts more than a rare odd one passing. */
const TIME1 = new Set(ADVS.filter((a) => a[1] === "t" || a[1] === "t2").map((a) => a[0].split(" ")[0]));
const FQW = new Set(FREQ.map((f) => f[0]));
export function check(words, depth = 0) {
  const T = words.map((w) => String(w).toLowerCase().trim());
  const r = check0(T);
  if (r.ok || depth > 2 || r.reason === "unknown" || r.reason === "short") return r;
  // 1) time word(s) first -> same words with the time phrase moved to the end
  if (TIME1.has(T[0])) for (const a of ADVS) {
    if (a[1] !== "t" && a[1] !== "t2") continue;
    const ws = a[0].split(" ");
    if (ws.every((w, q) => T[q] === w) && T.length > ws.length + 1) { const r2 = check(T.slice(ws.length).concat(ws), depth + 1); if (r2.ok) return r2; }
  }
  // 2) one frequency word in a natural position
  for (let k = 0; k < T.length; k++) {
    if (!FQW.has(T[k])) continue;
    const rest = T.slice(0, k).concat(T.slice(k + 1)); if (rest.length < 2) continue;
    const prev = k > 0 ? LEX.get(T[k - 1]) || [] : [], next = k + 1 < T.length ? LEX.get(T[k + 1]) || [] : [];
    const okPos = (k > 0 && (next.some((e) => e.p === "V" || e.p === "MD") || prev.some((e) => e.p === "BE" || e.p === "MD"))) ||
      ((k === 0 || k === T.length - 1) && /^(often|sometimes|usually)$/.test(T[k]));
    if (!okPos) continue;
    const r2 = check(rest, depth + 1); if (r2.ok) return r2;
  }
  return r;
}
function check0(T) {
  const n = T.length;
  if (n < 2) return { ok: false, reason: "short" };
  for (const w of T) if (!LEX.has(w)) return { ok: false, reason: "unknown" };
  const E = (i) => (i < n ? LEX.get(T[i]) : []);
  const has = (i, p) => E(i).filter((e) => e.p === p);

  // noun phrase from i: returns [{e, num, cls, anim}]
  function NP(i, wantObj) {
    const out = [];
    for (const e of has(i, "NAME")) out.push({ e: i + 1, num: "sg", cls: "a", anim: true, name: 1 });
    if (wantObj) for (const e of has(i, "PO")) out.push({ e: i + 1, num: "pro", cls: T[i] === "it" || T[i] === "them" ? "*" : "a", anim: true, pro: 1 });
    const dets = [null, ...has(i, "D")];
    for (const d of dets) {
      let j = d ? i + 1 : i;
      // optional "very", up to two adjectives
      const starts = [{ j, adj: 0 }];
      const res = [];
      const walk = (k, nadj, veryUsed) => {
        res.push({ k, nadj });
        if (nadj >= 2) return;
        if (!veryUsed && nadj === 0 && T[k] === "very" && has(k + 1, "A").length) { if (has(k + 1, "A").length) walk(k + 2, nadj + 1, true); }
        if (has(k, "A").length) walk(k + 1, nadj + 1, veryUsed);
      };
      walk(j, 0, false);
      for (const { k } of res) {
        for (const nn of has(k, "N")) {
          if (d) {
            if (nn.num === "sg" && !d.sg) continue;
            if (nn.num === "pl" && !d.pl) continue;
            if (nn.num === "mass" && !d.mass) continue;
            if (T[i] === "a" || T[i] === "an") { const nx = T[i + 1]; if (T[i] === "a" && VOWEL.test(nx)) continue; if (T[i] === "an" && !VOWEL.test(nx)) continue; }
          } else if (nn.num === "sg") continue;           // singular count nouns need a determiner
          out.push({ e: k + 1, num: nn.num, cls: nn.cls, anim: nn.anim });
        }
      }
    }
    return out;
  }
  // prepositional phrase: [{e, place}]
  function PP(i) {
    const out = [];
    for (const p of has(i, "P")) {
      for (const b of has(i + 1, "BARE")) if (p.bare.includes(T[i + 1])) out.push({ e: i + 2, w: T[i] });
      for (const np of NP(i + 1, true)) {
        if (np.pro) { if (p.cls.includes("a")) out.push({ e: np.e, w: T[i] }); continue; }
        if (np.name) { if (p.cls.includes("a")) out.push({ e: np.e, w: T[i] }); continue; }
        if (okCls(p.cls, np.cls)) out.push({ e: np.e, w: T[i] });
      }
    }
    if (T[i] === "here" || T[i] === "there") out.push({ e: i + 1, w: "here" });
    return out;
  }
  // verb complements for verb V starting at i: [{e}]
  function COMP(V, i) {
    const out = [];
    if (V.obj !== 2) out.push({ e: i });
    if (V.obj) for (const np of NP(i, true)) {
      if (np.pro) { if (V.ocls === "*" || V.ocls.includes("a") || T[i] === "it" || T[i] === "them") out.push({ e: np.e }); continue; }
      if (np.name) { if (okCls(V.ocls, "a")) out.push({ e: np.e }); continue; }
      if (okCls(V.ocls, np.cls)) out.push({ e: np.e });
    }
    if (V.flags.includes("m")) { if (T[i] === "home") out.push({ e: i + 1, dir: 1 }); for (const pp of PP(i)) if (pp.w === "to" || pp.w === "here") out.push({ e: pp.e, dir: 1 }); }
    if (V.flags.includes("u") && (PART[V.base] || []).includes(T[i])) out.push({ e: i + 1, prt: 1 });
    if (V.flags.includes("l") && T[i] === "to") for (const np of NP(i + 1, true)) if (np.pro || np.name || okCls("al", np.cls)) out.push({ e: np.e });
    return out;
  }
  // predicate for subject with person/number `per` and animacy: [{e, ten, act, pp}]
  function PRED(i, per, anim) {
    const out = [];
    const is3 = per === "3s";
    for (const v of has(i, "V")) {
      if (!anim) continue;
      let ten = null;
      if (v.f === "past") ten = "s";
      else if (v.f === "s" && is3) ten = "p";
      else if (v.f === "base" && !is3) ten = "p";
      if (!ten) continue;
      for (const c of COMP(v.v, i + 1)) out.push({ e: c.e, ten, act: 1, dir: c.dir });
    }
    for (const b of has(i, "BE")) {
      const agree = b.per === per || (b.per === "x" && (per === "2" || per === "pl")) || (b.per === "s" && (per === "1s" || per === "3s"));
      if (!agree) continue;
      const bt = b.past ? "s" : "b";
      // adjective (optionally "very")
      let j = i + 1; if (T[j] === "very") j++;
      if (has(j, "A").length) out.push({ e: j + 1, ten: bt });
      // noun phrase complement (a teacher / my friends)
      for (const np of NP(i + 1, false)) {
        if (np.name || np.num === "mass") continue;
        const want = per === "pl" ? "pl" : per === "2" ? null : "sg";
        if (want && np.num !== want) continue;
        if (anim !== null && np.anim !== anim) continue;
        if (np.num === "pl" && T[i + 1] !== "my" && !has(i + 1, "D").length && !has(i + 1, "A").length && false) continue;
        out.push({ e: np.e, ten: bt });
      }
      // place
      for (const pp of PP(i + 1)) if (pp.w !== "with" && pp.w !== "for" && pp.w !== "to" && pp.w !== "from") out.push({ e: pp.e, ten: bt, pp: 1 });
      // continuous: is running (fast)
      if (anim) for (const v of has(i + 1, "V")) if (v.f === "ing") for (const c of COMP(v.v, i + 2)) out.push({ e: c.e, ten: b.past ? "s" : "c", act: 1, dir: c.dir });
    }
    for (const md of has(i, "MD")) {
      if (!anim) continue;
      for (const v of has(i + 1, "V")) if (v.f === "base") for (const c of COMP(v.v, i + 2)) out.push({ e: c.e, ten: md.k === "can" ? "n" : "w", act: 1, dir: c.dir });
      if (md.k === "will") { let j = i + 2; if (T[i + 1] === "be") { if (T[j] === "very") j++; if (has(j, "A").length) out.push({ e: j + 1, ten: "w" }); } }
    }
    return out;
  }
  // modifiers: [manner] [place PP] [time]
  function MODS(i, pr) {
    const ends = [];
    const tryTime = (k) => {
      ends.push(k);
      for (const a of has(k, "ADV")) if (a.kind === "t" || a.kind === "t2") {
        const ten = pr.ten === "b" ? "b" : pr.ten;
        if (ten === "i" ? !["now", "today", "tomorrow", "every"].includes(a.ws[0]) : !a.ten.includes(ten)) continue;
        if (a.ws.every((w, q) => T[k + q] === w)) ends.push(k + a.ws.length);
      }
    };
    const tryPP = (k) => {
      tryTime(k);
      if (pr.pp || pr.dir) return;
      for (const pp of PP(k)) { if (pp.w === "to" || pp.w === "from") continue; if (pp.w === "with" && !pr.act) continue; if (pp.w === "for" && !pr.act) continue; tryTime(pp.e); }
    };
    tryPP(i);
    if (pr.act) for (const a of has(i, "ADV")) if (a.kind === "m" && a.ws.length === 1 && (pr.ten === "i" || a.ten.includes(pr.ten))) tryPP(i + 1);
    return ends;
  }
  // commands: Walk home. Run fast. Sit down. Read a book.
  for (const v of has(0, "V")) {
    if (v.f !== "base" || NO_IMP.has(v.v.base)) continue;
    for (const c of COMP(v.v, 1)) if (MODS(c.e, { e: c.e, ten: "i", act: 1, dir: c.dir }).includes(n)) return { ok: true, imp: 1 };
  }
  const subjects = [];
  for (const p of has(0, "PS")) subjects.push({ e: 1, per: p.per, anim: true });
  for (const np of NP(0, false)) subjects.push({ e: np.e, per: np.num === "pl" ? "pl" : "3s", anim: np.anim });
  // "This is my book." "That is a cat." "These are my friends." (only with be)
  if (n > 2 && /^(this|that|these|those)$/.test(T[0]) && has(1, "BE").length) subjects.push({ e: 1, per: /^(these|those)$/.test(T[0]) ? "pl" : "3s", anim: null });
  if (!subjects.length) return { ok: false, reason: "subject" };
  let gotPred = false;
  for (const s of subjects) for (const pr of PRED(s.e, s.per, s.anim)) {
    gotPred = true;
    if (MODS(pr.e, pr).includes(n)) return { ok: true };
  }
  return { ok: false, reason: gotPred ? "order" : "verb" };
}

/* ---------- levels ---------- */
// per difficulty: highest word tier, and which structures the generator may use
export const GEN = {
  veryeasy: { tier: 1, past: 0, cont: 0, can: 0, will: 0, adj: 0.25, glossBar: 1, liveOk: 1, speed: 225 },
  easy: { tier: 1, past: 0, cont: 1, can: 0, will: 0, adj: 0.35, glossBar: 1, liveOk: 1, speed: 240 },
  normal: { tier: 2, past: 1, cont: 1, can: 1, will: 0, adj: 0.4, glossBar: 0, liveOk: 1, speed: 255 },
  hard: { tier: 2, past: 1, cont: 1, can: 1, will: 1, adj: 0.45, glossBar: 0, liveOk: 0, speed: 270 },
  veryhard: { tier: 3, past: 1, cont: 1, can: 1, will: 1, adj: 0.5, glossBar: 0, liveOk: 0, speed: 285 },
  master: { tier: 3, past: 1, cont: 1, can: 1, will: 1, adj: 0.55, glossBar: 0, liveOk: 0, speed: 300 }
};
export const LENS = { s: [2, 4], m: [3, 6], l: [5, 8] };

/* ---------- generator (seeded) ---------- */
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function makeGenerator(levelKey, seed) {
  const G = GEN[levelKey] || GEN.normal, R = rng(seed);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const ok = (t) => t <= G.tier;
  const nouns = NOUNS.filter((x) => ok(x[3])), verbs = VERBS.filter((x) => ok(x[4])), adjs = ADJS.filter((x) => ok(x[1]));
  const dets = DETS.filter((x) => ok(x[4]) && x[0] !== "an");
  const kindOf = (n) => (n[2].includes("a") ? (ANIMALS.has(n[0]) ? "N" : "P") : /[fd]/.test(n[2]) ? "F" : "T");
  const adjFor = (k) => adjs.filter((a) => a[5].includes(k));
  const fixA = (out) => { for (let q = 0; q < out.length - 1; q++) if (out[q] === "a" || out[q] === "an") out[q] = VOWEL.test(out[q + 1]) ? "an" : "a"; return out; };
  // noun phrase: cls = allowed classes (null any non-place), num = "sg" | "pl" | null, place = sg place with a definite determiner
  function np(cls, num, opt = {}) {
    let pool = nouns.filter((x) => (cls ? okCls(cls, x[2]) : !x[2].includes("p")) && (!opt.people || (x[2].includes("a") && !ANIMALS.has(x[0]))));
    if (num) pool = pool.filter((x) => x[1]);
    if (opt.only) pool = pool.filter((x) => opt.only.includes(x[0]));
    if (opt.not) pool = pool.filter((x) => !opt.not.includes(x[0]) && !opt.not.includes(x[1]));
    if (!pool.length) return null;
    const nn = pick(pool), mass = !nn[1];
    const nb = mass ? "mass" : num || (opt.place ? "sg" : R() < 0.7 ? "sg" : "pl");
    const word = nb === "pl" ? nn[1] : nn[0];
    let adj = [];
    const A = adjFor(kindOf(nn));
    if (A.length && R() < G.adj * (opt.place ? 0.4 : 1)) {
      adj = [pick(A)[0]];
      if (G.tier > 1 && R() < 0.15) { if (R() < 0.5) adj = ["very", adj[0]]; else { const b = pick(A)[0]; if (b !== adj[0]) adj = [b, adj[0]]; } }
    }
    let ds;
    if (opt.place) ds = ["the", "my", "his", "her", "our", "their", "this"].filter((d) => dets.some((x) => x[0] === d));
    else ds = dets.filter((d) => (nb === "sg" ? d[1] : nb === "pl" ? d[2] : d[3])).map((d) => d[0]);
    const needDet = nb === "sg" || (nb === "pl" ? R() < 0.6 : R() < 0.25);
    const out = needDet && ds.length ? [pick(ds)] : [];
    return fixA(out.concat(adj, [word]));
  }
  function subject() {
    const r = R();
    if (r < 0.3) { const p = pick(SUBJ.filter((x) => x[0] !== "it")); return { w: [p[0]], per: p[1], k: "P", pro: 1 }; }
    if (r < 0.42) return { w: [pick(NAMES)[0]], per: "3s", k: "P", pro: 1 };
    const num = R() < 0.7 ? "sg" : "pl";
    const pool = nouns.filter((x) => x[2].includes("a") && x[1]); const nn = pick(pool);
    const word = num === "pl" ? nn[1] : nn[0], k = kindOf(nn), A = adjFor(k);
    const ds = dets.filter((d) => (num === "sg" ? d[1] : d[2])).map((d) => d[0]);
    const out = num === "sg" || R() < 0.7 ? [pick(ds)] : [];
    if (A.length && R() < G.adj) out.push(pick(A)[0]);
    out.push(word);
    return { w: fixA(out), per: num === "pl" ? "pl" : "3s", k, noun: nn };
  }
  const placePP = () => {
    const ps = PREPS.filter((p) => ok(p[3]) && ["in", "at", "near", "under"].includes(p[0]));
    const p = pick(ps);
    if (p[2] && R() < 0.4) return [p[0], pick(p[2].split(" ").filter((b) => b !== "work" || ok(2)))];
    const o = np("p", "sg", { place: true, only: PLACE_OK[p[0]] }); return o ? [p[0]].concat(o) : null;
  };
  const PLACE_OK = { in: "house room park garden shop city library kitchen classroom museum forest zoo", at: "park zoo beach shop library museum", near: "house park tree river beach shop zoo museum library", under: "tree table", to: "park zoo beach shop library museum city house garden forest river" };
  for (const k in PLACE_OK) PLACE_OK[k] = PLACE_OK[k].split(" ");
  const MANNER = { fast: "run walk swim eat drink read write work come go jump dance", well: "sing swim dance play cook read write draw work study", slowly: "run walk swim eat drink read write go come", together: "*", quietly: "read sleep walk play work study eat" };
  function imperative() {
    const V = pick(verbs.filter((v) => !NO_IMP.has(v[0]))), base = V[0], out = [base];
    let hadPP = false;
    if (V[7].includes("u")) out.push(pick(PART[base]));
    else if (V[5] === 2 || (V[5] === 1 && R() < 0.5)) { const o = np(V[6] === "*" ? null : V[6], null, {}); if (!o) return null; out.push(...o); }
    else if (V[7].includes("m") && R() < 0.6) { out.push(...(R() < 0.6 ? ["home"] : ["to", "school"])); hadPP = true; }
    else if (V[7].includes("l") && R() < 0.5) out.push("to", "music");
    return finish(out, "p", true, hadPP || V[7].includes("u"), { per: "2" }, V[5] ? "" : base);
  }
  function one() {
    if (R() < 0.2) return imperative();
    const s = subject(); if (!s.w) return null;
    const is3 = s.per === "3s";
    const out = s.w.slice();
    let ten = "p", act = false, verb = "", obj = false;
    if (R() < 0.28) {                                    // be + adjective / noun / place
      const past = G.past && R() < 0.25;
      out.push(past ? (s.per === "pl" || s.per === "2" ? "were" : "was") : s.per === "1s" ? "am" : is3 ? "is" : "are"); ten = past ? "s" : "b";
      const k = R();
      if (k < 0.55) { const A = adjFor(s.k).filter((a) => a[0] !== "little" && a[0] !== "fast"); if (!A.length) return null; if (R() < 0.2) out.push("very"); out.push(pick(A)[0]); }
      else if (k < 0.72 && s.pro && s.per !== "2") { const o = np("a", s.per === "pl" ? "pl" : "sg", { people: true }); if (!o || /^(the|this|that)$/.test(o[0])) return null; out.push(...o); }
      else { const o = placePP(); if (!o) return null; out.push(...o); return finish(out, ten, false, true, s, ""); }
    } else {
      const V = pick(verbs), [base, s3, ing, past] = V; verb = base;
      const m = R();
      if (G.cont && ing && m < 0.2) { out.push(s.per === "1s" ? "am" : is3 ? "is" : "are", ing); ten = "c"; }
      else if (G.past && m < 0.42) { out.push(past); ten = "s"; }
      else if (G.can && m < 0.52) { out.push("can", base); ten = "n"; }
      else if (G.will && m < 0.58) { out.push("will", base); ten = "w"; }
      else out.push(is3 ? s3 : base);
      act = true;
      if (V[5] === 2 || (V[5] === 1 && R() < 0.6)) {
        let o;
        if (V[6].includes("a") && R() < 0.15) o = [pick(OBJ.filter((x) => x[0] !== "it"))[0]];
        else o = np(V[6] === "*" ? null : V[6], null, { not: s.noun ? [s.noun[0]] : null });
        if (!o) return null; out.push(...o); obj = true;
      } else if (V[7].includes("m") && R() < 0.6) {
        const o = R() < 0.3 ? ["home"] : (R() < 0.4 ? ["to", "school"] : (() => { const n = np("p", "sg", { place: true, only: PLACE_OK.to }); return n ? ["to"].concat(n) : null; })());
        if (!o) return null; out.push(...o); return finish(out, ten, act, true, s, verb);
      } else if (V[7].includes("l") && R() < 0.7) out.push("to", "music");
    }
    return finish(out, ten, act, false, s, obj ? "" : verb);
  }
  function finish(out, ten, act, hadPP, s, verb) {
    if (act && verb && R() < 0.3) {
      const a = ADVS.filter((x) => x[1] === "m" && ok(x[3]) && x[2].includes(ten) && (MANNER[x[0]] === "*" ? s.per === "pl" : (MANNER[x[0]] || "").split(" ").includes(verb)));
      if (a.length) out.push(pick(a)[0]);
    }
    if (!hadPP && R() < 0.35) {
      if (act && R() < 0.3) { const o = R() < 0.5 ? ["with"].concat(np("a", null, { people: true }) || []) : null; if (o && o.length > 1) out.push(...o); }
      else if (act) { const o = placePP(); if (o) out.push(...o); }
    }
    if (R() < 0.3) { const a = ADVS.filter((x) => x[1] === "t" && ok(x[3]) && x[2].includes(ten)); if (a.length) out.push(...pick(a)[0].split(" ")); }
    return out;
  }
  /** one random valid sentence with length in [lo, hi] (words as tokens) */
  return function sentence(lo, hi) {
    for (let t = 0; t < 600; t++) {
      const s = one();
      if (!s || s.length < lo || s.length > hi) continue;
      if (!check(s).ok) continue;
      return s;
    }
    return lo <= 3 ? ["i", "like", "pizza"] : ["my", "dog", "likes", "pizza"];
  };
}
/** all words the generator may use at a level (for distractor bubbles) */
export function wordPool(levelKey) {
  const G = GEN[levelKey] || GEN.normal; const ok = (t) => t <= G.tier;
  const w = [];
  NOUNS.forEach((x) => { if (ok(x[3])) { w.push(x[0]); if (x[1]) w.push(x[1]); } });
  ADJS.forEach((x) => ok(x[1]) && w.push(x[0]));
  if (G.tier >= 2) { FREQ.forEach((x) => ok(x[1]) && w.push(x[0])); w.push("then", "there", "now"); }
  VERBS.forEach((x) => { if (ok(x[4])) { w.push(x[0], x[1]); if (G.cont && x[2]) w.push(x[2]); if (G.past) w.push(x[3]); } });
  return w;
}
/** a valid order of the same words, if one exists (for the answer report). Small sentences only. */
export function findOrder(words) {
  if (words.length > 6) return null;
  const a = words.slice(); const used = new Array(a.length).fill(false), cur = [];
  let found = null;
  (function rec() {
    if (found) return;
    if (cur.length === a.length) { if (check(cur).ok) found = cur.slice(); return; }
    const seen = new Set();
    for (let i = 0; i < a.length; i++) if (!used[i] && !seen.has(a[i])) { seen.add(a[i]); used[i] = true; cur.push(a[i]); rec(); cur.pop(); used[i] = false; }
  })();
  return found;
}

/* ---------- 1.1.1 why is it wrong? ----------
   Tries small repairs of a sentence the checker rejected (one changed word form, a/an, one added word, one moved word,
   one removed word). A hint is given only when a repair really makes the checker accept the sentence, so a hint never
   points at something that is not wrong; with no clean repair the caller shows the general message.
   Returns null or {k, a, b, c}: k = hint kind, a/b/c = English words for the message. */
const FORMS = new Map();          // word -> other forms of the same verb / noun
for (const v of VERBS) { const f = [v[0], v[1], v[2], v[3]].filter(Boolean); for (const w of f) FORMS.set(w, f.filter((x) => x !== w)); }
for (const x of NOUNS) if (x[1]) { FORMS.set(x[0], [x[1]]); FORMS.set(x[1], [x[0]]); }
const BEW = ["am", "is", "are", "was", "were"];
const MISSW = ["a", "an", "the", "am", "is", "are", "to", "at", "in", "with", "very", "my"];
const isA = (w, p) => (LEX.get(w) || []).some((e) => e.p === p);
const isVerb = (w) => isA(w, "V") || isA(w, "BE") || isA(w, "MD");
export function diagnose(words) {
  const T = words.map((w) => String(w).toLowerCase().trim()), n = T.length;
  if (n < 2 || !T.every((w) => LEX.has(w)) || check(T).ok) return null;
  const ok = (arr) => check(arr).ok;
  const subj = (k) => { const s = T.slice(0, k); return (s.length && s.length <= 3 ? s : s.slice(-1)).map(disp).join(" "); };
  const out = [];
  const put = (rank, h) => out.push([rank, out.length, h]);
  for (let i = 0; i < n; i++) {
    const w = T[i], prev = i ? T[i - 1] : "";
    // 1) another form of the same word
    for (const f of FORMS.get(w) || []) {
      const t2 = T.slice(); t2[i] = f; if (!ok(t2)) continue;
      const fe = (LEX.get(f) || []).find((e) => e.p === "V"), we = (LEX.get(w) || []).find((e) => e.p === "V");
      if (!fe && !isA(prev, "D")) continue;                     // cat/cats: only "two cat", "this cats"; otherwise a missing word is likelier
      if (fe && i === 0) continue;                              // "drinks juice": the subject is missing, not the form
      if (fe && we && i > 0 && fe.f === "s" && we.f === "base" && !isA(prev, "MD") && !isA(prev, "BE")) put(1, { k: "s3", a: subj(i), b: f });
      else if (fe && we && i > 0 && fe.f === "base" && we.f === "s" && !isA(prev, "MD") && prev !== "to") put(1, { k: "nos", a: subj(i), b: f });
      else if (i > 0 && (isA(prev, "MD") || isA(prev, "BE") || isA(prev, "D") || prev === "to")) put(3, { k: "after", a: disp(prev), b: f });
      else put(6, { k: "form", b: f, c: disp(w) });
    }
    // 1b) "I sleeping" -> am/is/are is missing before the -ing word
    if (i > 0 && (LEX.get(w) || []).some((e) => e.p === "V" && e.f === "ing") && !isA(prev, "BE"))
      for (const f of ["am", "is", "are", "was", "were"]) { const t2 = T.slice(0, i).concat([f], T.slice(i)); if (ok(t2)) { put(2, { k: "art", a: disp(w), b: f }); break; } }
    // 2) am / is / are / was / were
    if (BEW.includes(w)) for (const f of BEW) { if (f === w) continue; const t2 = T.slice(); t2[i] = f; if (ok(t2) && i > 0) put(1, { k: "be", a: subj(i), b: f }); }
    // 3) a <-> an
    if (w === "a" || w === "an") { const t2 = T.slice(); t2[i] = w === "a" ? "an" : "a"; if (i + 1 < n && ok(t2)) put(2, { k: "an", a: disp(T[i + 1]), b: t2[i] }); }
  }
  {
    // 4) one missing word
    for (let i = 0; i <= n; i++) for (const m of MISSW) {
      const t2 = T.slice(0, i).concat([m], T.slice(i)); if (!ok(t2)) continue;
      if (/^(a|an|the|my)$/.test(m) && i < n) put(5, { k: "art", a: disp(T[i]), b: m });
      else if (BEW.includes(m) && !T.some(isVerb)) put(5, { k: "verb", b: m });
      else put(7, { k: "miss", b: m });
    }
    // 4b) no subject: "is happy" -> "he is happy"
    if (!isA(T[0], "PS") && !isA(T[0], "NAME")) for (const m of ["he", "she", "it", "they", "i"]) { if (ok([m].concat(T))) { put(5, { k: "subj", b: disp(m) }); break; } }
    // 5) one word in the wrong place
    for (let i = 0; i < n; i++) for (let j = 0; j <= n; j++) {
      if (j === i || j === i + 1) continue;
      const rest = T.slice(0, i).concat(T.slice(i + 1)), at = j > i ? j - 1 : j;
      const t2 = rest.slice(0, at).concat([T[i]], rest.slice(at)); if (!ok(t2)) continue;
      if (at < rest.length) put(6, { k: "before", a: disp(T[i]), b: disp(rest[at]) });
      else put(6, { k: "after2", a: disp(T[i]), b: disp(rest[at - 1]) });
    }
    // 6) one extra word
    for (let i = 0; i < n; i++) { const t2 = T.slice(0, i).concat(T.slice(i + 1)); if (t2.length >= 2 && ok(t2)) put(8, { k: "extra", a: disp(T[i]) }); }
  }
  if (!out.length) return T.some(isVerb) ? null : { k: "noverb" };
  out.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  return out[0][2];
}
