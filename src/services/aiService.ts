import OpenAI from 'openai';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { PhotoLesson, Word, Sentence, createDefaultMastery, SentenceBreakdown, GrammarElement, GrammarRole, detectPhotoCategory } from '../types';
import {
  detectScriptType,
  containsKanji,
  createSimpleFurigana,
} from '../utils/japaneseText';
import { Language, DEFAULT_LANGUAGE, DEFAULT_NATIVE_LANGUAGE, getLanguageByCode, getGrammarOrder, hasParticles, hasClassifiers } from '../constants/languages';

// Backend proxy URL for production (keeps API key secure on server)
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Check if we should use the backend proxy
const useBackendProxy = !!API_BASE_URL;

const getClient = () => {
  // In production, prefer backend proxy to keep API key secure
  if (useBackendProxy) {
    // Create a client that routes through our backend proxy
    return new OpenAI({
      apiKey: 'proxy', // Not used - backend has the real key
      baseURL: `${API_BASE_URL}/api`,
      dangerouslyAllowBrowser: true,
    });
  }

  // Development fallback - direct API calls (NOT recommended for production)
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. For production, set EXPO_PUBLIC_API_BASE_URL to your backend proxy.');
  }

  if (!__DEV__) {
    console.warn('[Security Warning] Using client-side API key in production. Deploy a backend proxy for security.');
  }

  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
};

async function imageUriToBase64(uri: string): Promise<string> {
  // If already a base64 data URL, validate and return
  if (uri.startsWith('data:')) {
    // Check if it's a supported format
    const mimeMatch = uri.match(/^data:([^;]+);/);
    const mime = mimeMatch?.[1] || '';
    if (__DEV__) console.log('Image MIME type:', mime);

    // If HEIC, we can't use it - throw an error
    if (mime.includes('heic') || mime.includes('heif')) {
      throw new Error('HEIC format not supported. Please use a JPEG or PNG image.');
    }

    return uri;
  }

  // Web: use fetch and FileReader
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Native: handle various URI schemes
  // For iOS photo library URIs (ph://), we need to copy to a readable location
  if (uri.startsWith('ph://') || uri.startsWith('assets-library://')) {
    throw new Error('Photo library URI not supported. Please use expo-image-picker with base64 option.');
  }

  // Read the file as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Detect MIME type from file content (first bytes) or extension
  let mimeType = 'image/jpeg';

  // Check magic bytes for common formats
  if (base64.startsWith('/9j/')) {
    mimeType = 'image/jpeg';
  } else if (base64.startsWith('iVBORw0KGgo')) {
    mimeType = 'image/png';
  } else if (base64.startsWith('R0lGOD')) {
    mimeType = 'image/gif';
  } else if (base64.startsWith('UklGR')) {
    mimeType = 'image/webp';
  } else {
    // Fallback to extension detection
    const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
    if (extension === 'png') {
      mimeType = 'image/png';
    } else if (extension === 'gif') {
      mimeType = 'image/gif';
    } else if (extension === 'webp') {
      mimeType = 'image/webp';
    }
  }

  return `data:${mimeType};base64,${base64}`;
}

/**
 * Get language-specific example for the AI prompt
 */
function getLanguageExample(language: Language): {
  mainSubject: any;
  descriptorWord: any;
  sentence: any;
} {
  // Provide different examples based on target language
  const examples: Record<string, { mainSubject: any; descriptorWord: any; sentence: any }> = {
    ja: {
      mainSubject: {
        targetWord: "犬",
        reading: "いぬ",
        romaji: "inu",
        english: "dog",
      },
      descriptorWord: {
        targetWord: "茶色い",
        reading: "ちゃいろい",
        romaji: "chairoi",
        english: "brown",
      },
      sentence: {
        targetWord: "犬が木の匂いを嗅いでいます",
        reading: "いぬがきのにおいをかいでいます",
        romaji: "inu ga ki no nioi wo kaide imasu",
        english: "The dog is sniffing the tree",
      },
    },
    es: {
      mainSubject: {
        targetWord: "perro",
        reading: "",
        romaji: "perro",
        english: "dog",
      },
      descriptorWord: {
        targetWord: "marrón",
        reading: "",
        romaji: "marrón",
        english: "brown",
      },
      sentence: {
        targetWord: "El perro está oliendo el árbol",
        reading: "",
        romaji: "El perro está oliendo el árbol",
        english: "The dog is sniffing the tree",
      },
    },
    fr: {
      mainSubject: {
        targetWord: "chien",
        reading: "",
        romaji: "chien",
        english: "dog",
      },
      descriptorWord: {
        targetWord: "brun",
        reading: "",
        romaji: "brun",
        english: "brown",
      },
      sentence: {
        targetWord: "Le chien renifle l'arbre",
        reading: "",
        romaji: "Le chien renifle l'arbre",
        english: "The dog is sniffing the tree",
      },
    },
    zh: {
      mainSubject: {
        targetWord: "狗",
        reading: "gǒu",
        romaji: "gou",
        english: "dog",
      },
      descriptorWord: {
        targetWord: "棕色的",
        reading: "zōng sè de",
        romaji: "zong se de",
        english: "brown",
      },
      sentence: {
        targetWord: "狗在闻树",
        reading: "gǒu zài wén shù",
        romaji: "gou zai wen shu",
        english: "The dog is sniffing the tree",
      },
    },
    ko: {
      mainSubject: {
        targetWord: "개",
        reading: "gae",
        romaji: "gae",
        english: "dog",
      },
      descriptorWord: {
        targetWord: "갈색",
        reading: "galsaek",
        romaji: "galsaek",
        english: "brown",
      },
      sentence: {
        targetWord: "개가 나무 냄새를 맡고 있어요",
        reading: "gaega namu naemsaereul matgo isseoyo",
        romaji: "gaega namu naemsaereul matgo isseoyo",
        english: "The dog is sniffing the tree",
      },
    },
    de: {
      mainSubject: {
        targetWord: "Hund",
        reading: "",
        romaji: "Hund",
        english: "dog",
      },
      descriptorWord: {
        targetWord: "braun",
        reading: "",
        romaji: "braun",
        english: "brown",
      },
      sentence: {
        targetWord: "Der Hund schnüffelt am Baum",
        reading: "",
        romaji: "Der Hund schnüffelt am Baum",
        english: "The dog is sniffing the tree",
      },
    },
  };

  // Return language-specific example or fall back to a generic one
  return examples[language.code] || {
    mainSubject: {
      targetWord: language.exampleWord,
      reading: language.hasReading ? "romanization" : "",
      romaji: "romanization",
      english: "hello",
    },
    descriptorWord: {
      targetWord: "word",
      reading: language.hasReading ? "romanization" : "",
      romaji: "romanization",
      english: "word",
    },
    sentence: {
      targetWord: "Example sentence",
      reading: language.hasReading ? "romanization" : "",
      romaji: "romanization",
      english: "Example sentence",
    },
  };
}

/**
 * Get language-specific sentence generation guidance
 * Provides grammar rules and examples based on language features
 */
function getSentenceGuidance(language: Language): string {
  const grammarOrder = getGrammarOrder(language);
  const usesParticles = hasParticles(language);
  const usesClassifiers = hasClassifiers(language);

  let guidance = `\nSENTENCE STRUCTURE GUIDANCE for ${language.name}:\n`;

  // Grammar order guidance
  switch (grammarOrder) {
    case 'SOV':
      guidance += `- Word order: Subject → Object → Verb (SOV pattern)
- The verb comes at the END of the sentence
- Example structure: "[Subject] [Object] [Verb]"
`;
      break;
    case 'VSO':
      guidance += `- Word order: Verb → Subject → Object (VSO pattern)
- The verb comes at the BEGINNING of the sentence
`;
      break;
    case 'SVO':
    default:
      guidance += `- Word order: Subject → Verb → Object (SVO pattern)
- Similar to English word order
`;
      break;
  }

  // Particle guidance
  if (usesParticles) {
    guidance += `- Uses PARTICLES to mark grammatical roles (topic, subject, object, etc.)
- Particles attach to nouns to show their function in the sentence
`;
  }

  // Classifier guidance
  if (usesClassifiers) {
    guidance += `- Uses CLASSIFIERS/MEASURE WORDS for counting nouns
- Include appropriate classifiers when using numbers
`;
  }

  // Language-specific tips
  switch (language.code) {
    case 'ja':
      guidance += `- Japanese particles: は(topic), が(subject), を(object), に(direction/time), で(location/means)
- Verb conjugations: です/ます(polite), いる/ある(existence), ている(progressive)
- Chunking: Group [noun+particle] together, keep [verb+conjugation] together
`;
      break;
    case 'ko':
      guidance += `- Korean particles: 은/는(topic), 이/가(subject), 을/를(object), 에(location/time), 에서(at/from)
- Honorific forms: 합니다/해요 polite endings
- Chunking: Group [noun+particle], keep verb forms intact
`;
      break;
    case 'zh':
      guidance += `- Chinese is isolating - no conjugations or particles like Japanese/Korean
- Word order is critical for meaning
- Use measure words: 个(general), 只(animals), 本(books), etc.
`;
      break;
    case 'ar':
      guidance += `- Right-to-left script
- Verb typically starts the sentence (VSO)
- Noun-adjective order (adjective follows noun)
`;
      break;
    case 'hi':
      guidance += `- Verb comes at end (SOV order)
- Postpositions instead of prepositions
- Gender agreement between nouns and adjectives
`;
      break;
  }

  return guidance;
}

/**
 * Analyze a photo and extract vocabulary with full reading support
 * @param imageUri - The image to analyze
 * @param existingWords - Words the user has already learned (to avoid duplicates)
 * @param targetLanguage - Target language for vocabulary (defaults to Japanese)
 * @param nativeLanguage - Native language for translations (defaults to English)
 */
export async function analyzePhoto(
  imageUri: string,
  existingWords: string[] = [],
  targetLanguage: Language = DEFAULT_LANGUAGE,
  nativeLanguage: Language = DEFAULT_NATIVE_LANGUAGE
): Promise<PhotoLesson> {
  const client = getClient();
  const base64Image = await imageUriToBase64(imageUri);

  // Ensure languages are defined (fallback for existing users without these in state)
  const safeTargetLang = targetLanguage || DEFAULT_LANGUAGE;
  const safeNativeLang = nativeLanguage || DEFAULT_NATIVE_LANGUAGE;

  // Get language-specific examples for the prompt
  const langExample = getLanguageExample(safeTargetLang);
  const readingInstruction = safeTargetLang.hasReading
    ? `"reading": "${safeTargetLang.readingLabel.toLowerCase()} pronunciation (e.g., ${langExample.mainSubject.reading})",`
    : '"reading": "", // Leave empty for this language';

  // Build the exclusion list for the prompt
  // Include up to 100 words for better coverage
  const exclusionNote = existingWords.length > 0
    ? `\n\n*** CRITICAL - DO NOT USE THESE WORDS ***
The user has already learned these words. You MUST choose DIFFERENT vocabulary:
${existingWords.slice(0, 100).join(', ')}

RULES FOR AVOIDING DUPLICATES:
1. NEVER repeat any word from the list above (neither ${safeTargetLang.name} nor ${safeNativeLang.name})
2. If the obvious main subject is in the list, find a MORE SPECIFIC alternative:
   - "person" → "man", "woman", "child", "tourist", "swimmer", "runner"
   - "food" → specific dish name
   - "animal" → specific type: "tabby cat", "golden retriever"
   - "tree" → specific species: "cherry blossom", "pine tree", "palm"
3. For descriptors, use DIFFERENT adjectives than previously learned
4. Focus on UNIQUE details visible in THIS specific photo`
    : '';

  // Build reading field instructions based on language
  const readingFieldNote = safeTargetLang.hasReading
    ? `"reading": "${langExample.mainSubject.reading}", // ${safeTargetLang.readingLabel} for pronunciation`
    : '"reading": "", // Not needed for Latin script languages';

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2048,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a JSON API that analyzes images and returns ${safeTargetLang.name} vocabulary data. You MUST respond with valid JSON only. Never include any text, explanations, or markdown outside the JSON object.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: base64Image, detail: 'low' },
          },
          {
            type: 'text',
            text: `Analyze this image and identify the ONE MAIN SUBJECT that is the focus of the photo.
Provide vocabulary in ${safeTargetLang.name} (${safeTargetLang.nativeName}).
Provide meanings/translations in ${safeNativeLang.name}.${exclusionNote}

CRITICAL - MAIN SUBJECT IDENTIFICATION:
- Identify the SINGLE most important/prominent object, person, animal, or thing in the photo
- This is what the photographer was trying to capture
- Examples: a dog, a flower, a cup of coffee, a car, a person
- NOT background elements or multiple scattered objects

Then, provide EXACTLY 2 DESCRIPTIVE WORDS about that main subject (3 words total including main subject):
- Colors (red, blue, brown, white)
- Actions/States (sleeping, running, blooming, smelling)
- Quantities (two, many, single)
- Qualities (big, small, cute, old)
- Context (on table, in park, near tree)

POSITION & BOUNDING BOX:
- "position": center point of the object as percentage (x: 0-100, y: 0-100)
- "boundingBox": the region containing the object { x, y, width, height } as percentages
  - x: left edge (0-100), y: top edge (0-100), width: box width (0-100), height: box height (0-100)
  - Example: object in center taking up half the image → { x: 25, y: 25, width: 50, height: 50 }
Place the main subject where it appears. Place descriptors near the main subject.

${safeTargetLang.hasReading ? `READING FIELD: For ${safeTargetLang.name}, provide ${safeTargetLang.readingLabel.toLowerCase()} in the "reading" field.` : 'READING FIELD: Leave "reading" empty for Latin-script languages.'}

IMPORTANT: The "word" field must contain the word in ${safeTargetLang.name}, NOT in ${safeNativeLang.name}.
For example, if learning Spanish and the object is a dog, "word" should be "perro", not "dog".

CRITICAL - TRANSLATION LANGUAGE:
The "meaning" field must be in ${safeNativeLang.name} (${safeNativeLang.nativeName}).
Do NOT use English unless ${safeNativeLang.name} IS English.
${safeNativeLang.code === 'ja' ? 'Example: "meaning": "犬" (Japanese translation)' : ''}
${safeNativeLang.code === 'es' ? 'Example: "meaning": "perro" (Spanish translation)' : ''}
${safeNativeLang.code === 'zh' ? 'Example: "meaning": "狗" (Chinese translation)' : ''}

Return ONLY valid JSON (no markdown):
{
  "location": "park",
  "mainSubject": {
    "word": "${langExample.mainSubject.targetWord}",
    ${readingFieldNote}
    "romaji": "${langExample.mainSubject.romaji}",
    "meaning": "${safeNativeLang.code === 'en' ? 'dog' : safeNativeLang.code === 'ja' ? '犬' : safeNativeLang.code === 'zh' ? '狗' : safeNativeLang.code === 'ko' ? '개' : 'translation in ${safeNativeLang.name}'}",
    "partOfSpeech": "noun",
    "position": { "x": 50, "y": 50 },
    "boundingBox": { "x": 25, "y": 25, "width": 50, "height": 50 },
    "isMainSubject": true
  },
  "descriptorWords": [
    {
      "word": "${langExample.descriptorWord.targetWord}",
      ${safeTargetLang.hasReading ? `"reading": "${langExample.descriptorWord.reading}",` : '"reading": "",'}
      "romaji": "${langExample.descriptorWord.romaji}",
      "meaning": "${safeNativeLang.code === 'en' ? 'brown' : safeNativeLang.code === 'ja' ? '茶色' : safeNativeLang.code === 'zh' ? '棕色' : safeNativeLang.code === 'ko' ? '갈색' : 'translation in ${safeNativeLang.name}'}",
      "partOfSpeech": "adjective",
      "position": { "x": 25, "y": 35 },
      "boundingBox": { "x": 15, "y": 25, "width": 20, "height": 20 },
      "describesMain": true
    }
  ],
  "sentences": [
    {
      "sentence": "A COMPLETE SENTENCE in ${safeTargetLang.name} using the main subject word (5-10 words, natural grammar)",
      ${safeTargetLang.hasReading ? '"reading": "full sentence pronunciation/reading",' : '"reading": "",'}
      "romaji": "romanized full sentence",
      "meaning": "Translation of the FULL sentence in ${safeNativeLang.name}",
      "targetWord": "the vocabulary word this sentence teaches",
      "context": "brief scene description",
      "words": [
        { "word": "我", "reading": "wǒ", "meaning": "I", "role": "subject" },
        { "word": "喜欢", "reading": "xǐhuān", "meaning": "like", "role": "verb" },
        { "word": "咖啡", "reading": "kāfēi", "meaning": "coffee", "role": "object" }
      ]
    },
    {
      "sentence": "A COMPLETE SENTENCE in ${safeTargetLang.name} using descriptor word 1 (5-10 words)",
      ${safeTargetLang.hasReading ? '"reading": "full sentence pronunciation",' : '"reading": "",'}
      "romaji": "romanized full sentence",
      "meaning": "Translation in ${safeNativeLang.name}",
      "targetWord": "descriptor 1 word",
      "context": "scene description",
      "words": [
        { "word": "word1", "reading": "pronunciation", "meaning": "translation", "role": "grammatical role" }
      ]
    },
    {
      "sentence": "A COMPLETE SENTENCE in ${safeTargetLang.name} using descriptor word 2 (5-10 words)",
      ${safeTargetLang.hasReading ? '"reading": "full sentence pronunciation",' : '"reading": "",'}
      "romaji": "romanized full sentence",
      "meaning": "Translation in ${safeNativeLang.name}",
      "targetWord": "descriptor 2 word",
      "context": "scene description",
      "words": [
        { "word": "word1", "reading": "pronunciation", "meaning": "translation", "role": "grammatical role" }
      ]
    }
  ],
  "funFact": "A short interesting fact about one of the words in ${safeTargetLang.name} culture (written in ${safeNativeLang.name})"
}

CRITICAL SENTENCE REQUIREMENTS:
1. Generate ONE COMPLETE SENTENCE for EACH vocabulary word (3 sentences total)
2. Each "sentence" field must contain a FULL SENTENCE (5-10 words), NOT just the vocabulary word
3. The sentence must be grammatically correct in ${safeTargetLang.name}
4. Example for Korean: "서핑보드가 벽에 기대어 있습니다" NOT just "서핑보드"
5. Example for Japanese: "猫が窓辺で寝ています" NOT just "猫"
6. Each sentence must naturally include the targetWord it's teaching

CRITICAL - WORD BREAKDOWN IN SENTENCES:
Each sentence MUST include a "words" array that breaks down the sentence into individual words/phrases.
For each word in the array:
- "word": the word in ${safeTargetLang.name}
- "reading": pronunciation (hiragana for Japanese, pinyin for Chinese, romanization for Korean/Arabic/etc)
- "meaning": translation in ${safeNativeLang.name}
- "role": grammatical role (subject, verb, object, adjective, adverb, particle, time, location, etc.)

IMPORTANT FOR JAPANESE WORD BOUNDARIES:
- Keep i-adjective adverb forms together: 美しく (NOT 美 + しく)
- Keep verb conjugations together: 咲いています (NOT 咲い + ています)
- Keep noun+particle separate: 花 and が are separate words
- Include particles as separate words with their role

WORD BREAKDOWN EXAMPLES:
- Chinese "我喜欢咖啡": [{"word":"我","reading":"wǒ","meaning":"I","role":"subject"},{"word":"喜欢","reading":"xǐhuān","meaning":"like","role":"verb"},{"word":"咖啡","reading":"kāfēi","meaning":"coffee","role":"object"}]
- Korean "저는 커피를 좋아해요": [{"word":"저는","reading":"jeoneun","meaning":"I (topic)","role":"subject"},{"word":"커피를","reading":"keopireul","meaning":"coffee (object)","role":"object"},{"word":"좋아해요","reading":"joahaeyo","meaning":"like","role":"verb"}]
- Japanese "庭の花が美しく咲いています": [{"word":"庭","reading":"にわ","meaning":"garden","role":"location"},{"word":"の","reading":"の","meaning":"'s/of","role":"particle"},{"word":"花","reading":"はな","meaning":"flowers","role":"subject"},{"word":"が","reading":"が","meaning":"(subject)","role":"particle"},{"word":"美しく","reading":"うつくしく","meaning":"beautifully","role":"adverb"},{"word":"咲いています","reading":"さいています","meaning":"are blooming","role":"verb"}]
${getSentenceGuidance(safeTargetLang)}`,
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  // Parse JSON with safety checks
  let jsonString = content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonString = jsonMatch[0];

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (parseError) {
    if (__DEV__) {
      console.error('Failed to parse AI response:', jsonString.substring(0, 500));
    }
    throw new Error('AI returned invalid response format. Please try again.');
  }

  // Validate required fields exist
  if (!parsed.mainSubject) {
    throw new Error('AI response missing main subject. Please try again.');
  }
  const lessonId = `lesson-${Date.now()}`;
  const now = new Date().toISOString();

  // Helper function to process a word
  const processWord = (w: any, idx: number, isMainSubject: boolean = false): Word => {
    const wordId = `word-${Date.now()}-${idx}`;

    // Language-specific text processing
    // For Japanese: analyze script type, detect kanji, create furigana
    // For other languages: use simplified processing
    const isJapanese = safeTargetLang.code === 'ja';

    // Get the target language word - try multiple field names for robustness
    // Primary field is "word", fallback to legacy "japanese" and other variations
    const targetWord = w.word || w.japanese || w.targetWord || w.romaji || '';

    const scriptType = isJapanese ? detectScriptType(targetWord) : undefined;
    const hasKanji = isJapanese ? containsKanji(targetWord) : false;
    const furigana = isJapanese && targetWord
      ? createSimpleFurigana(targetWord, w.reading || targetWord)
      : undefined;

    // Extract position from AI response, with fallback
    const position = w.position ? {
      x: Math.max(10, Math.min(90, w.position.x || 50)),
      y: Math.max(15, Math.min(75, w.position.y || 50)),
    } : undefined;

    // Extract bounding box for flashcard cropping
    const boundingBox = w.boundingBox ? {
      x: Math.max(0, Math.min(100, w.boundingBox.x || 0)),
      y: Math.max(0, Math.min(100, w.boundingBox.y || 0)),
      width: Math.max(10, Math.min(100, w.boundingBox.width || 30)),
      height: Math.max(10, Math.min(100, w.boundingBox.height || 30)),
    } : undefined;

    // For non-reading languages, use the target word as reading if empty
    const reading = safeTargetLang.hasReading
      ? (w.reading || targetWord)
      : targetWord;

    // Get the meaning/translation - try "meaning" first (new format), then "english" (legacy)
    const meaning = w.meaning || w.english || '';

    return {
      id: wordId,
      japanese: targetWord, // Field name kept for backward compatibility - contains target language word
      reading,
      romaji: w.romaji || targetWord, // For Latin scripts, romaji = original word
      english: meaning, // Keep for backward compatibility
      nativeTranslation: meaning, // New field for native language translation
      nativeLanguageCode: safeNativeLang.code, // Track which language the translation is in
      scriptType,
      containsKanji: hasKanji,
      furigana,
      partOfSpeech: w.partOfSpeech || 'noun',
      position,
      boundingBox,
      // Mark if this is the main subject
      isMainSubject,
      // Mastery tracking
      mastery: 'new' as const,
      masteryScore: 0,
      masteryDetails: createDefaultMastery(),
      timesCorrect: 0,
      timesWrong: 0,
      timesSpoken: 0,
      interval: 0,
      readingInterval: 0,
    };
  };

  // Process words - handle both new format (mainSubject + descriptorWords) and old format (words array)
  // LIMIT TO 3 WORDS TOTAL: 1 main subject + 2 descriptors
  let words: Word[] = [];

  if (parsed.mainSubject) {
    // New format: main subject + descriptor words
    const mainWord = processWord(parsed.mainSubject, 0, true);
    words.push(mainWord);

    // Add descriptor words (limit to 2)
    if (parsed.descriptorWords && Array.isArray(parsed.descriptorWords)) {
      parsed.descriptorWords.slice(0, 2).forEach((w: any, idx: number) => {
        words.push(processWord(w, idx + 1, false));
      });
    }
  } else if (parsed.words && Array.isArray(parsed.words)) {
    // Old format fallback: array of words (limit to 3)
    words = parsed.words.slice(0, 3).map((w: any, idx: number) => processWord(w, idx, idx === 0));
  }

  // Ensure we never have more than 3 words
  words = words.slice(0, 3);

  // Post-process: Filter out any duplicates that slipped through the AI
  // (backup check in case AI ignores the exclusion list)
  if (existingWords.length > 0) {
    const existingSet = new Set(existingWords.filter(w => w).map(w => w.toLowerCase()));
    words = words.filter(word => {
      if (!word.english || !word.japanese) return true; // Keep words with missing fields
      const isDuplicate = existingSet.has(word.english.toLowerCase()) ||
                          existingSet.has(word.japanese);
      if (isDuplicate) {
        if (__DEV__) console.log(`Filtered duplicate word: ${word.japanese} (${word.english})`);
      }
      return !isDuplicate;
    });
  }

  // Process sentences
  const isJapaneseLang = safeTargetLang.code === 'ja';
  const sentences: Sentence[] = (parsed.sentences || []).map((s: any, idx: number) => {
    const sentenceId = `sentence-${Date.now()}-${idx}`;
    // Primary field is "sentence", fallback to "word" (legacy) and "japanese"
    const targetSentence = s.sentence || s.word || s.japanese || '';
    const furigana = isJapaneseLang && targetSentence
      ? createSimpleFurigana(targetSentence, s.reading || targetSentence)
      : undefined;

    // Find which words from vocabulary are used in this sentence
    const wordIds = words
      .filter(w => w.japanese && targetSentence.includes(w.japanese))
      .map(w => w.id);

    // Get the translation - try "meaning" first (new format), then "english" (legacy)
    const translation = s.meaning || s.english || '';

    // Process word breakdown for all languages including Japanese
    const sentenceWords = s.words && Array.isArray(s.words)
      ? s.words.map((w: any) => ({
          word: w.word || '',
          reading: w.reading || '',
          meaning: w.meaning || '',
          role: w.role || '',
        }))
      : undefined;

    return {
      id: sentenceId,
      japanese: targetSentence,
      reading: safeTargetLang.hasReading ? (s.reading || targetSentence) : targetSentence,
      romaji: s.romaji || targetSentence,
      translation, // Keep for backward compatibility
      nativeTranslation: translation, // New field for native language translation
      nativeLanguageCode: safeNativeLang.code, // Track which language the translation is in
      furigana,
      words: sentenceWords, // Word breakdown for Chinese, Korean, etc.
      wordIds,
      photoId: lessonId,
      sceneContext: s.context || 'scene description',
      readingMastery: 0,
      comprehensionMastery: 0,
    };
  });

  const location = parsed.location || 'your photo';

  return {
    id: lessonId,
    imageUri,
    words,
    sentences,
    location,
    createdAt: now,
    practiceCount: 0,
    wordsToReview: 0,
    averageMastery: 0,
    averageReadingMastery: 0,
    memoryStrength: 100,
    lastReviewedAt: now,
    reviewCount: 0,
    memoryStatus: 'fresh' as const,
    category: detectPhotoCategory(words, location),
  };
}

/**
 * Generate additional sentences using learned vocabulary
 */
export async function generateSentences(
  words: Word[],
  count: number = 2,
  targetLanguage: Language = DEFAULT_LANGUAGE,
  nativeLanguage: Language = DEFAULT_NATIVE_LANGUAGE
): Promise<Sentence[]> {
  const client = getClient();
  const isJapanese = targetLanguage.code === 'ja';

  // Use native translation if available, otherwise fall back to english field
  const wordList = words.map(w => `${w.japanese || w.romaji} (${w.nativeTranslation || w.english})`).join(', ');

  const readingNote = targetLanguage.hasReading
    ? `Include "${targetLanguage.readingLabel.toLowerCase()}" pronunciation in the "reading" field.`
    : 'Leave "reading" as empty string for Latin-script languages.';

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Create ${count} simple ${targetLanguage.name} sentences using these words: ${wordList}

The sentences should:
- Be suitable for beginner learners
- Use natural, everyday ${targetLanguage.name}
- Vary in structure
- Be COMPLETE sentences (5-10 words), NOT just single words
${getSentenceGuidance(targetLanguage)}
IMPORTANT: The "word" field must contain the FULL SENTENCE in ${targetLanguage.name}, NOT just the vocabulary word.
${readingNote}

CRITICAL - TRANSLATION LANGUAGE:
The "meaning" field must be in ${nativeLanguage.name} (${nativeLanguage.nativeName}).
Do NOT use English unless ${nativeLanguage.name} IS English.

Return ONLY valid JSON:
{
  "sentences": [
    {
      "word": "COMPLETE SENTENCE in ${targetLanguage.name} (5-10 words)",
      "reading": "${targetLanguage.hasReading ? 'pronunciation' : ''}",
      "romaji": "romanized version",
      "meaning": "Translation in ${nativeLanguage.name}",
      "context": "scene description"
    }
  ]
}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  let jsonString = content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonString = jsonMatch[0];

  const parsed = JSON.parse(jsonString);

  return (parsed.sentences || []).map((s: any, idx: number) => {
    const targetSentence = s.word || s.japanese || '';
    const furigana = isJapanese
      ? createSimpleFurigana(targetSentence, s.reading || targetSentence)
      : undefined;
    const wordIds = words
      .filter(w => {
        const wordText = w.japanese || w.romaji || '';
        return wordText && targetSentence.includes(wordText);
      })
      .map(w => w.id);

    // Get the translation - try "meaning" first (new format), then "english" (legacy)
    const translation = s.meaning || s.english || '';

    return {
      id: `sentence-${Date.now()}-${idx}`,
      japanese: targetSentence,
      reading: targetLanguage.hasReading ? (s.reading || targetSentence) : targetSentence,
      romaji: s.romaji || targetSentence,
      translation, // Keep for backward compatibility
      nativeTranslation: translation, // New field
      nativeLanguageCode: nativeLanguage.code,
      furigana,
      wordIds,
      sceneContext: s.context || 'practice',
      readingMastery: 0,
      comprehensionMastery: 0,
    };
  });
}

/**
 * Get reading details for a specific kanji
 */
export async function getKanjiDetails(kanji: string): Promise<{
  character: string;
  meanings: string[];
  onReading: string[];
  kunReading: string[];
  strokeCount: number;
  jlptLevel: number;
  examples: { word: string; reading: string; meaning: string }[];
}> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Provide detailed information about this kanji: ${kanji}

Return ONLY valid JSON:
{
  "character": "猫",
  "meanings": ["cat"],
  "onReading": ["ビョウ"],
  "kunReading": ["ねこ"],
  "strokeCount": 11,
  "jlptLevel": 3,
  "examples": [
    {"word": "子猫", "reading": "こねこ", "meaning": "kitten"},
    {"word": "猫背", "reading": "ねこぜ", "meaning": "slouch"}
  ]
}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  let jsonString = content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonString = jsonMatch[0];

  return JSON.parse(jsonString);
}

/**
 * Generate kana practice words (for kana learning)
 */
export async function generateKanaPractice(
  targetKana: string[],
  script: 'hiragana' | 'katakana',
  count: number = 5
): Promise<{ word: string; romaji: string; meaning: string }[]> {
  const client = getClient();

  const kanaList = targetKana.join(', ');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Generate ${count} simple Japanese words written in ${script} that use these characters: ${kanaList}

The words should:
- Be common, beginner-friendly words
- Be written entirely in ${script} (no kanji)
- Feature the target kana prominently

Return ONLY valid JSON:
{
  "words": [
    {"word": "ねこ", "romaji": "neko", "meaning": "cat"}
  ]
}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  let jsonString = content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonString = jsonMatch[0];

  const parsed = JSON.parse(jsonString);
  return parsed.words || [];
}

/**
 * Generate grammar breakdown for a sentence
 * Analyzes the sentence structure and explains each part
 */
export async function generateGrammarBreakdown(
  sentence: string,
  translation: string
): Promise<SentenceBreakdown> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyze the grammar structure of this Japanese sentence:
Japanese: ${sentence}
English: ${translation}

IMPORTANT RULES FOR JAPANESE WORD BOUNDARIES:
1. Keep i-adjective adverb forms as one unit: 美しく (NOT 美 + しく), 早く (NOT 早 + く)
2. Keep verb conjugations together: 咲いています (NOT 咲い + ています), 食べました (NOT 食べ + ました)
3. Keep noun + particle as separate: 花 and が are separate elements
4. Keep adverbs as complete units: きれいに, 静かに (NOT きれい + に for adverbial na-adjectives)
5. Common word patterns to keep together:
   - ています/ている (progressive)
   - ました/ます (polite past/present)
   - かった/くない (adjective conjugations)
   - 美しく/楽しく/早く etc. (i-adjective adverb forms = stem + く)

For each element, identify:
- word: The complete Japanese word/particle (following rules above)
- reading: Full hiragana reading
- role: subject, object, verb, particle, adjective, adverb, topic, location, time, or other
- explanation: Brief explanation in user's language (max 10 words)
- particleType: For particles only (が=subject marker, を=object marker, に=direction/time, で=location of action, は=topic, の=possessive, etc.)

Return ONLY valid JSON:
{
  "elements": [
    {
      "word": "庭",
      "reading": "にわ",
      "role": "location",
      "explanation": "garden - the location",
      "particleType": null
    },
    {
      "word": "の",
      "reading": "の",
      "role": "particle",
      "explanation": "possessive particle (of, 's)",
      "particleType": "possessive"
    },
    {
      "word": "花",
      "reading": "はな",
      "role": "subject",
      "explanation": "flower(s) - the subject",
      "particleType": null
    },
    {
      "word": "が",
      "reading": "が",
      "role": "particle",
      "explanation": "marks the subject",
      "particleType": "subject marker"
    },
    {
      "word": "美しく",
      "reading": "うつくしく",
      "role": "adverb",
      "explanation": "beautifully (adverb form of 美しい)",
      "particleType": null
    },
    {
      "word": "咲いています",
      "reading": "さいています",
      "role": "verb",
      "explanation": "are blooming (progressive form)",
      "particleType": null
    }
  ],
  "structure": "Location + の + Subject + が + Adverb + Verb(progressive)",
  "patternName": "descriptive state pattern",
  "notes": "Describes an ongoing state with an adverb modifier"
}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  let jsonString = content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonString = jsonMatch[0];

  const parsed = JSON.parse(jsonString);

  // Map the parsed elements to our type
  const elements: GrammarElement[] = (parsed.elements || []).map((e: any) => ({
    word: e.word,
    reading: e.reading,
    role: e.role as GrammarRole,
    explanation: e.explanation,
    particleType: e.particleType || undefined,
  }));

  return {
    elements,
    structure: parsed.structure || '',
    patternName: parsed.patternName,
    notes: parsed.notes,
  };
}

/**
 * Generate quiz questions for a set of sentences
 * Creates various question types for active learning
 */
export async function generateSentenceQuizQuestions(
  sentences: Sentence[],
  questionTypes: ('fill-blank' | 'grammar-identify' | 'sentence-construct')[] = ['fill-blank']
): Promise<{
  type: string;
  sentence: Sentence;
  question: string;
  answer: string;
  options?: string[];
  blankIndex?: number;
}[]> {
  const client = getClient();

  const sentenceData = sentences.map(s => ({
    japanese: s.japanese,
    reading: s.reading,
    translation: s.translation,
  }));

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Create quiz questions for these Japanese sentences:
${JSON.stringify(sentenceData, null, 2)}

Question types to generate: ${questionTypes.join(', ')}

For each sentence, create appropriate questions:
- fill-blank: Remove one word and ask user to fill it in
- grammar-identify: Ask which word serves a specific grammatical role
- sentence-construct: Shuffle words for user to rearrange

Return ONLY valid JSON:
{
  "questions": [
    {
      "type": "fill-blank",
      "sentenceIndex": 0,
      "question": "猫___テーブルの上にいます",
      "answer": "が",
      "options": ["が", "を", "は", "に"],
      "blankIndex": 1
    },
    {
      "type": "grammar-identify",
      "sentenceIndex": 0,
      "question": "Which word is the subject marker?",
      "answer": "が",
      "options": ["猫", "が", "の", "に"]
    }
  ]
}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  let jsonString = content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonString = jsonMatch[0];

  const parsed = JSON.parse(jsonString);

  return (parsed.questions || []).map((q: any) => ({
    type: q.type,
    sentence: sentences[q.sentenceIndex] || sentences[0],
    question: q.question,
    answer: q.answer,
    options: q.options,
    blankIndex: q.blankIndex,
  }));
}

// Legacy export for backward compatibility
export async function generateSentence(word: Word): Promise<{ japanese: string; romaji: string; english: string }> {
  const sentences = await generateSentences([word], 1);
  if (sentences.length > 0) {
    return {
      japanese: sentences[0].japanese,
      romaji: sentences[0].romaji,
      english: sentences[0].translation,
    };
  }
  throw new Error('Failed to generate sentence');
}
