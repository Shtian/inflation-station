"use client";

import { useEffect, useRef, useState } from "react";
import type { PickedElement } from "@/lib/feedback/contract";
import { describeElement } from "@/lib/feedback/describe-element";

type Highlight = {
  top: number;
  left: number;
  width: number;
  height: number;
  tagName: string;
};

const WIDGET_SELECTOR = "[data-feedback-widget]";

// Swallowed so the app under the cursor does not open menus or navigate while picking.
const BLOCKED_EVENTS = ["pointerdown", "pointerup", "mousedown", "mouseup"];

function toHighlight(el: Element): Highlight {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    tagName: el.localName,
  };
}

function targetAt(x: number, y: number): Element | null {
  const el = document.elementFromPoint(x, y);
  if (!el || el.closest(WIDGET_SELECTOR) || el === document.documentElement) {
    return null;
  }
  return el;
}

export function ElementPickerOverlay({
  onPick,
  onCancel,
}: {
  onPick: (element: PickedElement) => void;
  onCancel: () => void;
}) {
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const targetRef = useRef<Element | null>(null);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const target = targetAt(event.clientX, event.clientY);
      targetRef.current = target;
      setHighlight(target ? toHighlight(target) : null);
    }

    function onScroll() {
      const target = targetRef.current;
      setHighlight(target?.isConnected ? toHighlight(target) : null);
    }

    function block(event: Event) {
      if ((event.target as Element | null)?.closest?.(WIDGET_SELECTOR)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function onClick(event: MouseEvent) {
      const target = targetAt(event.clientX, event.clientY);
      if (!target) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onPick(describeElement(target));
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    }

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    for (const type of BLOCKED_EVENTS) {
      document.addEventListener(type, block, true);
    }
    return () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      for (const type of BLOCKED_EVENTS) {
        document.removeEventListener(type, block, true);
      }
    };
  }, [onPick, onCancel]);

  return (
    <>
      <style>{"* { cursor: crosshair !important; }"}</style>
      <output className="fixed top-3 left-1/2 z-feedback -translate-x-1/2 rounded-full bg-foreground px-4 py-1.5 text-background text-xs shadow-lg">
        Klikk på et element for å legge det ved · Esc for å avbryte
      </output>
      {highlight ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-feedback rounded-sm bg-brand/10 outline-2 outline-brand"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        >
          <span className="absolute -top-5 left-0 rounded-sm bg-brand px-1.5 py-0.5 font-mono text-[10px] text-brand-foreground leading-none">
            {highlight.tagName}
          </span>
        </div>
      ) : null}
    </>
  );
}
