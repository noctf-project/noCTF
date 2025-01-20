const ICON_MAP: { [k in string]: string } = {
    'all': 'material-symbols:background-dot-small',
    'pwn': 'material-symbols:bug-report-rounded',
    'crypto': 'material-symbols:key',
    'web': 'tabler:world',
    'rev': 'material-symbols:fast-rewind',
    'misc': 'mdi:puzzle',
}

export const categoryToIcon = (category: string) => {
    const c = category.toLowerCase()
    if (!(c in ICON_MAP)) {
        return 'carbon:unknown-filled'
    }
    return ICON_MAP[c] as string
}

const DIFFICULTY_BG_MAP: { [k in Difficulty]: string } = {
    beginner: 'bg-diff-beginner',
    easy: 'bg-diff-easy',
    medium: 'bg-diff-medium',
    hard: 'bg-diff-hard',
}
export const DIFFICULTIES = [
    'beginner', 'easy', 'medium', 'hard',
] as const
export type Difficulty = typeof DIFFICULTIES[number]

export const difficultyToBgColour = (difficulty: Difficulty) => {
    return DIFFICULTY_BG_MAP[difficulty]
}
