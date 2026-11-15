/** The signed step from one angle to another the short way round, in -180 to 180 degrees. */
export const shortestTurn = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180
