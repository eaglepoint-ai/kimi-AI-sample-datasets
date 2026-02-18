import { BGCOLOR_PRIORITY } from "../constants";

/**
 * Derive a priority label from a bgcolor value.
 * Returns "None" for unknown colors.
 */
export function priorityFromBgcolor(bgcolor) {
  return BGCOLOR_PRIORITY[bgcolor] || "None";
}

/**
 * Return a dot color for displaying priority on cards.
 */
export function priorityDotColor(bgcolor) {
  const p = priorityFromBgcolor(bgcolor);
  if (p === "High") return "red";
  if (p === "Medium") return "orange";
  if (p === "Low") return "green";
  return "grey";
}

/**
 * Generate a unique STORY-XXXX prefix that doesn't collide
 * with any existing task full name.
 */
export function generateStoryNumber(existingNames, title) {
  let prefix;
  do {
    const num = Math.floor(1000 + Math.random() * 9000);
    prefix = `STORY-${num}`;
  } while (existingNames.some((n) => n === `${prefix}: ${title}`));
  return prefix;
}
