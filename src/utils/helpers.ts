export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function normalizeJapanese(text: string): string {
  // Normalize full-width/half-width characters and trim
  return text.normalize('NFKC').trim().toLowerCase();
}

export function checkAnswer(userAnswer: string, expectedAnswer: string): boolean {
  return normalizeJapanese(userAnswer) === normalizeJapanese(expectedAnswer);
}
