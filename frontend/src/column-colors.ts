// A column's colour is stored by name on the session (`column_colors`); a column
// without one takes the colour of its position, so older boards look unchanged.
export const COLUMN_COLORS = ['green', 'amber', 'blue', 'red', 'purple', 'pink'] as const
export type ColumnColor = (typeof COLUMN_COLORS)[number]

export const columnColorVar = (color: ColumnColor): string => `var(--retro-col-${COLUMN_COLORS.indexOf(color) + 1})`

export const resolveColumnColor = (
  colors: Record<string, ColumnColor> | undefined,
  column: string,
  index: number,
): ColumnColor => colors?.[column] ?? COLUMN_COLORS[index % COLUMN_COLORS.length]
