/**
 * Japanese character data for tracing practice
 */

export type CharacterSet = 'hiragana' | 'katakana' | 'kanji';

export interface Character {
  id: string;
  character: string;
  romaji: string;
  meaning?: string;
  strokeCount: number;
  set: CharacterSet;
  row?: string; // For hiragana/katakana grouping (a, ka, sa, etc.)
}

// Basic Hiragana (46 characters)
export const HIRAGANA: Character[] = [
  // Vowels (a-row)
  { id: 'h-a', character: 'あ', romaji: 'a', strokeCount: 3, set: 'hiragana', row: 'a' },
  { id: 'h-i', character: 'い', romaji: 'i', strokeCount: 2, set: 'hiragana', row: 'a' },
  { id: 'h-u', character: 'う', romaji: 'u', strokeCount: 2, set: 'hiragana', row: 'a' },
  { id: 'h-e', character: 'え', romaji: 'e', strokeCount: 2, set: 'hiragana', row: 'a' },
  { id: 'h-o', character: 'お', romaji: 'o', strokeCount: 3, set: 'hiragana', row: 'a' },

  // K-row
  { id: 'h-ka', character: 'か', romaji: 'ka', strokeCount: 3, set: 'hiragana', row: 'ka' },
  { id: 'h-ki', character: 'き', romaji: 'ki', strokeCount: 4, set: 'hiragana', row: 'ka' },
  { id: 'h-ku', character: 'く', romaji: 'ku', strokeCount: 1, set: 'hiragana', row: 'ka' },
  { id: 'h-ke', character: 'け', romaji: 'ke', strokeCount: 3, set: 'hiragana', row: 'ka' },
  { id: 'h-ko', character: 'こ', romaji: 'ko', strokeCount: 2, set: 'hiragana', row: 'ka' },

  // S-row
  { id: 'h-sa', character: 'さ', romaji: 'sa', strokeCount: 3, set: 'hiragana', row: 'sa' },
  { id: 'h-shi', character: 'し', romaji: 'shi', strokeCount: 1, set: 'hiragana', row: 'sa' },
  { id: 'h-su', character: 'す', romaji: 'su', strokeCount: 2, set: 'hiragana', row: 'sa' },
  { id: 'h-se', character: 'せ', romaji: 'se', strokeCount: 3, set: 'hiragana', row: 'sa' },
  { id: 'h-so', character: 'そ', romaji: 'so', strokeCount: 1, set: 'hiragana', row: 'sa' },

  // T-row
  { id: 'h-ta', character: 'た', romaji: 'ta', strokeCount: 4, set: 'hiragana', row: 'ta' },
  { id: 'h-chi', character: 'ち', romaji: 'chi', strokeCount: 2, set: 'hiragana', row: 'ta' },
  { id: 'h-tsu', character: 'つ', romaji: 'tsu', strokeCount: 1, set: 'hiragana', row: 'ta' },
  { id: 'h-te', character: 'て', romaji: 'te', strokeCount: 1, set: 'hiragana', row: 'ta' },
  { id: 'h-to', character: 'と', romaji: 'to', strokeCount: 2, set: 'hiragana', row: 'ta' },

  // N-row
  { id: 'h-na', character: 'な', romaji: 'na', strokeCount: 4, set: 'hiragana', row: 'na' },
  { id: 'h-ni', character: 'に', romaji: 'ni', strokeCount: 3, set: 'hiragana', row: 'na' },
  { id: 'h-nu', character: 'ぬ', romaji: 'nu', strokeCount: 2, set: 'hiragana', row: 'na' },
  { id: 'h-ne', character: 'ね', romaji: 'ne', strokeCount: 2, set: 'hiragana', row: 'na' },
  { id: 'h-no', character: 'の', romaji: 'no', strokeCount: 1, set: 'hiragana', row: 'na' },

  // H-row
  { id: 'h-ha', character: 'は', romaji: 'ha', strokeCount: 3, set: 'hiragana', row: 'ha' },
  { id: 'h-hi', character: 'ひ', romaji: 'hi', strokeCount: 1, set: 'hiragana', row: 'ha' },
  { id: 'h-fu', character: 'ふ', romaji: 'fu', strokeCount: 4, set: 'hiragana', row: 'ha' },
  { id: 'h-he', character: 'へ', romaji: 'he', strokeCount: 1, set: 'hiragana', row: 'ha' },
  { id: 'h-ho', character: 'ほ', romaji: 'ho', strokeCount: 4, set: 'hiragana', row: 'ha' },

  // M-row
  { id: 'h-ma', character: 'ま', romaji: 'ma', strokeCount: 3, set: 'hiragana', row: 'ma' },
  { id: 'h-mi', character: 'み', romaji: 'mi', strokeCount: 2, set: 'hiragana', row: 'ma' },
  { id: 'h-mu', character: 'む', romaji: 'mu', strokeCount: 3, set: 'hiragana', row: 'ma' },
  { id: 'h-me', character: 'め', romaji: 'me', strokeCount: 2, set: 'hiragana', row: 'ma' },
  { id: 'h-mo', character: 'も', romaji: 'mo', strokeCount: 3, set: 'hiragana', row: 'ma' },

  // Y-row
  { id: 'h-ya', character: 'や', romaji: 'ya', strokeCount: 3, set: 'hiragana', row: 'ya' },
  { id: 'h-yu', character: 'ゆ', romaji: 'yu', strokeCount: 2, set: 'hiragana', row: 'ya' },
  { id: 'h-yo', character: 'よ', romaji: 'yo', strokeCount: 2, set: 'hiragana', row: 'ya' },

  // R-row
  { id: 'h-ra', character: 'ら', romaji: 'ra', strokeCount: 2, set: 'hiragana', row: 'ra' },
  { id: 'h-ri', character: 'り', romaji: 'ri', strokeCount: 2, set: 'hiragana', row: 'ra' },
  { id: 'h-ru', character: 'る', romaji: 'ru', strokeCount: 1, set: 'hiragana', row: 'ra' },
  { id: 'h-re', character: 'れ', romaji: 're', strokeCount: 2, set: 'hiragana', row: 'ra' },
  { id: 'h-ro', character: 'ろ', romaji: 'ro', strokeCount: 1, set: 'hiragana', row: 'ra' },

  // W-row
  { id: 'h-wa', character: 'わ', romaji: 'wa', strokeCount: 2, set: 'hiragana', row: 'wa' },
  { id: 'h-wo', character: 'を', romaji: 'wo', strokeCount: 3, set: 'hiragana', row: 'wa' },

  // N
  { id: 'h-n', character: 'ん', romaji: 'n', strokeCount: 1, set: 'hiragana', row: 'n' },
];

// Basic Katakana (46 characters)
export const KATAKANA: Character[] = [
  // Vowels (a-row)
  { id: 'k-a', character: 'ア', romaji: 'a', strokeCount: 2, set: 'katakana', row: 'a' },
  { id: 'k-i', character: 'イ', romaji: 'i', strokeCount: 2, set: 'katakana', row: 'a' },
  { id: 'k-u', character: 'ウ', romaji: 'u', strokeCount: 3, set: 'katakana', row: 'a' },
  { id: 'k-e', character: 'エ', romaji: 'e', strokeCount: 3, set: 'katakana', row: 'a' },
  { id: 'k-o', character: 'オ', romaji: 'o', strokeCount: 3, set: 'katakana', row: 'a' },

  // K-row
  { id: 'k-ka', character: 'カ', romaji: 'ka', strokeCount: 2, set: 'katakana', row: 'ka' },
  { id: 'k-ki', character: 'キ', romaji: 'ki', strokeCount: 3, set: 'katakana', row: 'ka' },
  { id: 'k-ku', character: 'ク', romaji: 'ku', strokeCount: 2, set: 'katakana', row: 'ka' },
  { id: 'k-ke', character: 'ケ', romaji: 'ke', strokeCount: 3, set: 'katakana', row: 'ka' },
  { id: 'k-ko', character: 'コ', romaji: 'ko', strokeCount: 2, set: 'katakana', row: 'ka' },

  // S-row
  { id: 'k-sa', character: 'サ', romaji: 'sa', strokeCount: 3, set: 'katakana', row: 'sa' },
  { id: 'k-shi', character: 'シ', romaji: 'shi', strokeCount: 3, set: 'katakana', row: 'sa' },
  { id: 'k-su', character: 'ス', romaji: 'su', strokeCount: 2, set: 'katakana', row: 'sa' },
  { id: 'k-se', character: 'セ', romaji: 'se', strokeCount: 2, set: 'katakana', row: 'sa' },
  { id: 'k-so', character: 'ソ', romaji: 'so', strokeCount: 2, set: 'katakana', row: 'sa' },

  // T-row
  { id: 'k-ta', character: 'タ', romaji: 'ta', strokeCount: 3, set: 'katakana', row: 'ta' },
  { id: 'k-chi', character: 'チ', romaji: 'chi', strokeCount: 3, set: 'katakana', row: 'ta' },
  { id: 'k-tsu', character: 'ツ', romaji: 'tsu', strokeCount: 3, set: 'katakana', row: 'ta' },
  { id: 'k-te', character: 'テ', romaji: 'te', strokeCount: 3, set: 'katakana', row: 'ta' },
  { id: 'k-to', character: 'ト', romaji: 'to', strokeCount: 2, set: 'katakana', row: 'ta' },

  // N-row
  { id: 'k-na', character: 'ナ', romaji: 'na', strokeCount: 2, set: 'katakana', row: 'na' },
  { id: 'k-ni', character: 'ニ', romaji: 'ni', strokeCount: 2, set: 'katakana', row: 'na' },
  { id: 'k-nu', character: 'ヌ', romaji: 'nu', strokeCount: 2, set: 'katakana', row: 'na' },
  { id: 'k-ne', character: 'ネ', romaji: 'ne', strokeCount: 4, set: 'katakana', row: 'na' },
  { id: 'k-no', character: 'ノ', romaji: 'no', strokeCount: 1, set: 'katakana', row: 'na' },

  // H-row
  { id: 'k-ha', character: 'ハ', romaji: 'ha', strokeCount: 2, set: 'katakana', row: 'ha' },
  { id: 'k-hi', character: 'ヒ', romaji: 'hi', strokeCount: 2, set: 'katakana', row: 'ha' },
  { id: 'k-fu', character: 'フ', romaji: 'fu', strokeCount: 1, set: 'katakana', row: 'ha' },
  { id: 'k-he', character: 'ヘ', romaji: 'he', strokeCount: 1, set: 'katakana', row: 'ha' },
  { id: 'k-ho', character: 'ホ', romaji: 'ho', strokeCount: 4, set: 'katakana', row: 'ha' },

  // M-row
  { id: 'k-ma', character: 'マ', romaji: 'ma', strokeCount: 2, set: 'katakana', row: 'ma' },
  { id: 'k-mi', character: 'ミ', romaji: 'mi', strokeCount: 3, set: 'katakana', row: 'ma' },
  { id: 'k-mu', character: 'ム', romaji: 'mu', strokeCount: 2, set: 'katakana', row: 'ma' },
  { id: 'k-me', character: 'メ', romaji: 'me', strokeCount: 2, set: 'katakana', row: 'ma' },
  { id: 'k-mo', character: 'モ', romaji: 'mo', strokeCount: 3, set: 'katakana', row: 'ma' },

  // Y-row
  { id: 'k-ya', character: 'ヤ', romaji: 'ya', strokeCount: 2, set: 'katakana', row: 'ya' },
  { id: 'k-yu', character: 'ユ', romaji: 'yu', strokeCount: 2, set: 'katakana', row: 'ya' },
  { id: 'k-yo', character: 'ヨ', romaji: 'yo', strokeCount: 3, set: 'katakana', row: 'ya' },

  // R-row
  { id: 'k-ra', character: 'ラ', romaji: 'ra', strokeCount: 2, set: 'katakana', row: 'ra' },
  { id: 'k-ri', character: 'リ', romaji: 'ri', strokeCount: 2, set: 'katakana', row: 'ra' },
  { id: 'k-ru', character: 'ル', romaji: 'ru', strokeCount: 2, set: 'katakana', row: 'ra' },
  { id: 'k-re', character: 'レ', romaji: 're', strokeCount: 1, set: 'katakana', row: 'ra' },
  { id: 'k-ro', character: 'ロ', romaji: 'ro', strokeCount: 3, set: 'katakana', row: 'ra' },

  // W-row
  { id: 'k-wa', character: 'ワ', romaji: 'wa', strokeCount: 2, set: 'katakana', row: 'wa' },
  { id: 'k-wo', character: 'ヲ', romaji: 'wo', strokeCount: 3, set: 'katakana', row: 'wa' },

  // N
  { id: 'k-n', character: 'ン', romaji: 'n', strokeCount: 2, set: 'katakana', row: 'n' },
];

// Basic Kanji (numbers and common characters)
export const BASIC_KANJI: Character[] = [
  // Numbers
  { id: 'kj-1', character: '一', romaji: 'ichi', meaning: 'one', strokeCount: 1, set: 'kanji' },
  { id: 'kj-2', character: '二', romaji: 'ni', meaning: 'two', strokeCount: 2, set: 'kanji' },
  { id: 'kj-3', character: '三', romaji: 'san', meaning: 'three', strokeCount: 3, set: 'kanji' },
  { id: 'kj-4', character: '四', romaji: 'shi/yon', meaning: 'four', strokeCount: 5, set: 'kanji' },
  { id: 'kj-5', character: '五', romaji: 'go', meaning: 'five', strokeCount: 4, set: 'kanji' },
  { id: 'kj-6', character: '六', romaji: 'roku', meaning: 'six', strokeCount: 4, set: 'kanji' },
  { id: 'kj-7', character: '七', romaji: 'shichi/nana', meaning: 'seven', strokeCount: 2, set: 'kanji' },
  { id: 'kj-8', character: '八', romaji: 'hachi', meaning: 'eight', strokeCount: 2, set: 'kanji' },
  { id: 'kj-9', character: '九', romaji: 'kyuu/ku', meaning: 'nine', strokeCount: 2, set: 'kanji' },
  { id: 'kj-10', character: '十', romaji: 'juu', meaning: 'ten', strokeCount: 2, set: 'kanji' },

  // Basic words
  { id: 'kj-sun', character: '日', romaji: 'hi/nichi', meaning: 'day/sun', strokeCount: 4, set: 'kanji' },
  { id: 'kj-moon', character: '月', romaji: 'tsuki/getsu', meaning: 'moon/month', strokeCount: 4, set: 'kanji' },
  { id: 'kj-fire', character: '火', romaji: 'hi/ka', meaning: 'fire', strokeCount: 4, set: 'kanji' },
  { id: 'kj-water', character: '水', romaji: 'mizu/sui', meaning: 'water', strokeCount: 4, set: 'kanji' },
  { id: 'kj-tree', character: '木', romaji: 'ki/moku', meaning: 'tree/wood', strokeCount: 4, set: 'kanji' },
  { id: 'kj-gold', character: '金', romaji: 'kane/kin', meaning: 'gold/money', strokeCount: 8, set: 'kanji' },
  { id: 'kj-earth', character: '土', romaji: 'tsuchi/do', meaning: 'earth/soil', strokeCount: 3, set: 'kanji' },
  { id: 'kj-person', character: '人', romaji: 'hito/jin', meaning: 'person', strokeCount: 2, set: 'kanji' },
  { id: 'kj-mountain', character: '山', romaji: 'yama/san', meaning: 'mountain', strokeCount: 3, set: 'kanji' },
  { id: 'kj-river', character: '川', romaji: 'kawa', meaning: 'river', strokeCount: 3, set: 'kanji' },
  { id: 'kj-big', character: '大', romaji: 'oo/dai', meaning: 'big', strokeCount: 3, set: 'kanji' },
  { id: 'kj-small', character: '小', romaji: 'chii/shou', meaning: 'small', strokeCount: 3, set: 'kanji' },
  { id: 'kj-up', character: '上', romaji: 'ue/jou', meaning: 'up/above', strokeCount: 3, set: 'kanji' },
  { id: 'kj-down', character: '下', romaji: 'shita/ka', meaning: 'down/below', strokeCount: 3, set: 'kanji' },
  { id: 'kj-middle', character: '中', romaji: 'naka/chuu', meaning: 'middle/inside', strokeCount: 4, set: 'kanji' },
];

// Helper to get all characters
export const getAllCharacters = (): Character[] => [
  ...HIRAGANA,
  ...KATAKANA,
  ...BASIC_KANJI,
];

// Helper to get characters by set
export const getCharactersBySet = (set: CharacterSet): Character[] => {
  switch (set) {
    case 'hiragana':
      return HIRAGANA;
    case 'katakana':
      return KATAKANA;
    case 'kanji':
      return BASIC_KANJI;
    default:
      return [];
  }
};

// Get unique rows for a character set
export const getRows = (set: CharacterSet): string[] => {
  const characters = getCharactersBySet(set);
  const rows = new Set(characters.map(c => c.row).filter(Boolean));
  return Array.from(rows) as string[];
};
