import type { PickedElement } from "./contract";

const MAX_PATH_DEPTH = 5;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function attributeSelector(name: string, value: string): string {
  return `[${name}="${CSS.escape(value)}"]`;
}

function anchorSelector(el: Element): string | null {
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }
  const testId = el.getAttribute("data-testid");
  if (testId) {
    return attributeSelector("data-testid", testId);
  }
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    return `${el.localName}${attributeSelector("aria-label", ariaLabel)}`;
  }
  return null;
}

function pathSegment(el: Element): string {
  const tag = el.localName;
  const parent = el.parentElement;
  if (!parent) {
    return tag;
  }
  const sameTag = Array.from(parent.children).filter(
    (sibling) => sibling.localName === tag,
  );
  return sameTag.length > 1
    ? `${tag}:nth-of-type(${sameTag.indexOf(el) + 1})`
    : tag;
}

function buildSelector(el: Element): string {
  const anchor = anchorSelector(el);
  if (anchor) {
    return anchor;
  }
  const segments: string[] = [];
  let current: Element | null = el;
  while (
    current &&
    current !== document.body &&
    segments.length < MAX_PATH_DEPTH
  ) {
    if (current !== el && current.id) {
      segments.unshift(`#${CSS.escape(current.id)}`);
      break;
    }
    segments.unshift(pathSegment(current));
    current = current.parentElement;
  }
  return segments.join(" > ");
}

function findLabel(el: Element): string | null {
  const candidates = [
    el.getAttribute("aria-label"),
    el.getAttribute("data-testid"),
    el.getAttribute("title"),
    el.matches("h1, h2, h3, h4, h5, h6")
      ? el.textContent
      : el.querySelector("h1, h2, h3, h4, h5, h6")?.textContent,
  ];
  for (const candidate of candidates) {
    const label = candidate ? collapse(candidate) : "";
    if (label) {
      return truncate(label, 200);
    }
  }
  return null;
}

export function describeElement(el: Element): PickedElement {
  const text = el instanceof HTMLElement ? el.innerText : el.textContent;
  return {
    selector: truncate(buildSelector(el), 500),
    tagName: truncate(el.localName, 40),
    label: findLabel(el),
    text: truncate(collapse(text ?? ""), 300),
    html: truncate(el.outerHTML.trim(), 1000),
  };
}
