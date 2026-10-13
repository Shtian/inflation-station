export type DeltaDirection = "up" | "down" | "flat";

// Under one krone is noise from øre rounding, not a change worth reporting.
export function toDeltaDirection(deltaNok: number): DeltaDirection {
  if (Math.abs(deltaNok) < 1) {
    return "flat";
  }

  return deltaNok > 0 ? "up" : "down";
}
