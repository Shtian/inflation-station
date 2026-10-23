import {
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { getCategoryColor } from "@/lib/category-color";
import { cn } from "@/lib/utils";
import {
  averageSpend,
  type CategoryKey,
  getCategoryKey,
  layoutTreemap,
  type ShareMapItem,
  shareMapItemSpend,
} from "../category-spend";
import {
  formatCount,
  formatPercent,
  formatWholeNok,
} from "../overview-dashboard.utils";

type CategoryShareMapProps = {
  items: ShareMapItem[];
  total: number;
  canHide: boolean;
  onHide: (key: CategoryKey) => void;
};

type Size = { width: number; height: number };

type TooltipAnchor = {
  key: string;
  top: number;
  inset: number;
  side: "left" | "right";
};

const GAP = 3;
const OTHER_KEY = "other";
const OTHER_NAME = "Andre";
const OTHER_FILL =
  "color-mix(in oklch, var(--muted-foreground) 45%, var(--card))";
const TOOLTIP_OFFSET = 14;
const TOOLTIP_FLIP_MARGIN = 260;
const TILE_CLASS_NAME =
  "absolute flex flex-col items-start justify-between overflow-hidden rounded-md px-2.5 py-2 text-left outline-none transition-opacity hover:opacity-100! focus-visible:ring-3 focus-visible:ring-ring/50 group-hover/map:opacity-55";

function itemKey(item: ShareMapItem) {
  return item.kind === "category" ? getCategoryKey(item.row) : OTHER_KEY;
}

function itemName(item: ShareMapItem) {
  return item.kind === "category" ? item.row.categoryName : OTHER_NAME;
}

function fitLabels(name: string, width: number, height: number) {
  const longestWord = Math.max(...name.split(" ").map((word) => word.length));
  return {
    name: width > longestWord * 8 + 20 && height > 30,
    amount: width > 90 && height > 54,
    percent: width > 64 && height > 70,
  };
}

function anchorAt(key: string, clientX: number, clientY: number) {
  const flip = clientX > window.innerWidth - TOOLTIP_FLIP_MARGIN;
  return {
    key,
    top: clientY + TOOLTIP_OFFSET,
    inset: flip
      ? window.innerWidth - clientX + TOOLTIP_OFFSET
      : clientX + TOOLTIP_OFFSET,
    side: flip ? "right" : "left",
  } satisfies TooltipAnchor;
}

export function CategoryShareMap({
  items,
  total,
  canHide,
  onHide,
}: CategoryShareMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [anchor, setAnchor] = useState<TooltipAnchor | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const tiles = size
    ? layoutTreemap(items, {
        width: size.width + GAP,
        height: size.height + GAP,
      })
    : [];
  const hoveredItem = anchor
    ? items.find((item) => itemKey(item) === anchor.key)
    : undefined;

  return (
    <div
      ref={containerRef}
      className="group/map relative h-[460px] sm:h-[380px]"
    >
      {tiles.map((tile) => {
        const { item } = tile;
        const key = itemKey(item);
        const name = itemName(item);
        const spend = shareMapItemSpend(item);
        const width = tile.width - GAP;
        const height = tile.height - GAP;
        const labels = fitLabels(name, width, height);
        const color =
          item.kind === "category"
            ? getCategoryColor(name)
            : {
                backgroundColor: OTHER_FILL,
                lightTextColor: undefined,
              };
        const style: CSSProperties = {
          left: tile.x,
          top: tile.y,
          width,
          height,
          backgroundColor: color.backgroundColor,
          color: color.lightTextColor,
        };
        const tooltipHandlers = {
          onPointerMove: (event: PointerEvent) =>
            setAnchor(anchorAt(key, event.clientX, event.clientY)),
          onPointerLeave: () => setAnchor(null),
          onFocus: (event: FocusEvent<HTMLElement>) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setAnchor(anchorAt(key, rect.left, rect.top));
          },
          onBlur: () => setAnchor(null),
        };
        const content = (
          <>
            <span>
              {labels.name ? (
                <span className="block text-sm leading-tight font-semibold">
                  {name}
                </span>
              ) : null}
              {labels.amount ? (
                <span className="block text-xs font-medium tabular-nums opacity-80">
                  {formatWholeNok(spend)}
                </span>
              ) : null}
            </span>
            {labels.percent ? (
              <span className="text-xl leading-none font-semibold tracking-tight tabular-nums">
                {formatPercent(total > 0 ? spend / total : 0)}
              </span>
            ) : null}
          </>
        );

        return item.kind === "category" ? (
          <button
            key={key}
            type="button"
            aria-label={`Skjul ${name}`}
            aria-disabled={!canHide}
            className={cn(TILE_CLASS_NAME, canHide && "cursor-pointer")}
            style={style}
            onClick={() => {
              if (!canHide) {
                return;
              }
              setAnchor(null);
              onHide(key);
            }}
            {...tooltipHandlers}
          >
            {content}
          </button>
        ) : (
          <div
            key={key}
            className={cn(TILE_CLASS_NAME, "text-foreground")}
            style={style}
            {...tooltipHandlers}
          >
            {content}
          </div>
        );
      })}
      {anchor && hoveredItem ? (
        <ShareMapTooltip
          anchor={anchor}
          item={hoveredItem}
          total={total}
          canHide={canHide}
        />
      ) : null}
    </div>
  );
}

function ShareMapTooltip({
  anchor,
  item,
  total,
  canHide,
}: {
  anchor: TooltipAnchor;
  item: ShareMapItem;
  total: number;
  canHide: boolean;
}) {
  const spend = shareMapItemSpend(item);

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 grid min-w-40 gap-1 rounded-lg border border-border/50 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl"
      style={{ top: anchor.top, [anchor.side]: anchor.inset }}
    >
      <div className="flex justify-between gap-4 font-semibold">
        <span>{itemName(item)}</span>
        <span className="tabular-nums">
          {formatPercent(total > 0 ? spend / total : 0, 1)}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Beløp</span>
        <span className="tabular-nums">{formatWholeNok(spend)}</span>
      </div>
      {item.kind === "other" ? (
        item.members.map((member) => (
          <div
            key={getCategoryKey(member)}
            className="flex justify-between gap-4"
          >
            <span>{member.categoryName}</span>
            <span className="tabular-nums">
              {formatWholeNok(member.spendNok)}
            </span>
          </div>
        ))
      ) : (
        <>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>
              {formatCount(
                item.row.transactionCount,
                "transaksjon",
                "transaksjoner",
              )}
            </span>
            <span className="tabular-nums">
              {formatWholeNok(averageSpend(item.row))} snitt
            </span>
          </div>
          {canHide ? (
            <div className="text-muted-foreground">Klikk for å skjule</div>
          ) : null}
        </>
      )}
    </div>
  );
}
