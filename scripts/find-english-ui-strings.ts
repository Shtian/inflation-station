import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const ALLOWLIST_PATH = join(import.meta.dirname, "english-ui-allowlist.tsv");

const IGNORED_JSX_ATTRIBUTES = new Set([
  "className",
  "id",
  "key",
  "href",
  "src",
  "type",
  "variant",
  "size",
  "name",
  "role",
  "side",
  "align",
  "orientation",
  "mode",
  "method",
  "action",
  "autoComplete",
  "inputMode",
  "lang",
  "dataKey",
  "nameKey",
  "fill",
  "stroke",
  "target",
  "rel",
  "accept",
  "htmlFor",
  "aria-describedby",
  "aria-labelledby",
  "aria-controls",
  "form",
  "value",
  "defaultValue",
  "defaultTheme",
]);

const UI_MESSAGE_CALLEE =
  /^(toast(\.\w+)?|badRequest|mutationError|mutationValidationError|\w*Error|.*\.(min|max|length|nonempty|regex|refine|superRefine|int|positive|nonnegative))$/;

const UI_PROPERTY_NAMES = new Set([
  "label",
  "title",
  "description",
  "message",
  "placeholder",
  "heading",
  "hint",
  "helpText",
  "emptyMessage",
  "emptyText",
  "successMessage",
  "errorMessage",
  "pendingLabel",
  "actionLabel",
  "subtitle",
  "caption",
  "summary",
  "text",
]);

const ENGLISH_WORDS = new Set(
  `the and of to with without your you is are was were be been not this that these those
  add added adding edit edited delete deleted deleting remove removed save saved saving cancel close
  open select selected choose search loading failed error could please back next previous new all
  none month months transaction transactions category categories account accounts amount date
  description review reviews settings upload uploaded uploading file files rule rules name from into
  on in  by has have had update updated updating show hide  income expense expenses spending
  spend spent net merchant unknown uncategorized apply submit continue done retry try again more less
  view details create created changes change nothing yet empty light dark theme generate generating
  overview help  message cleanup mapping column columns row rows skip skipped duplicate duplicates
   pending ready success warning out  first will when what which how why there here than
  then only also can cannot must should would use used using it its we our no yes copy copied reset
  clear manage enter  choose drop or keep left right  end previous today yesterday week year
  something went wrong unable invalid required optional missing found balance accounts ask`
    .split(/\s+/)
    .filter(Boolean),
);

type Finding = { file: string; line: number; text: string };

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    if (/\.(test|spec)\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}

function looksEnglish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-zæøå']+/g) ?? [];
  return words.some((word) => ENGLISH_WORDS.has(word.replace(/'s$/, "")));
}

function isUiContext(node: ts.Node): boolean {
  let current: ts.Node = node;
  while (current.parent) {
    const parent: ts.Node = current.parent;
    if (ts.isJsxAttribute(parent)) {
      const attribute = parent.name.getText();
      return (
        !IGNORED_JSX_ATTRIBUTES.has(attribute) && !attribute.startsWith("data-")
      );
    }
    if (ts.isJsxExpression(parent) && !ts.isJsxAttribute(parent.parent)) {
      return true;
    }
    if (ts.isPropertyAssignment(parent) && parent.initializer === current) {
      return UI_PROPERTY_NAMES.has(parent.name.getText().replace(/["']/g, ""));
    }
    if (ts.isCallExpression(parent)) {
      const callee = parent.expression.getText();
      return UI_MESSAGE_CALLEE.test(callee);
    }
    if (ts.isNewExpression(parent)) {
      return /Error$/.test(parent.expression.getText());
    }
    if (
      ts.isBinaryExpression(parent) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ].includes(parent.operatorToken.kind)
    ) {
      return false;
    }
    if (
      ts.isConditionalExpression(parent) ||
      ts.isBinaryExpression(parent) ||
      ts.isParenthesizedExpression(parent) ||
      ts.isTemplateSpan(parent) ||
      ts.isTemplateExpression(parent)
    ) {
      current = parent;
      continue;
    }
    return false;
  }
  return false;
}

function scanFile(path: string): Finding[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings: Finding[] = [];

  const report = (node: ts.Node, text: string) => {
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (
      !trimmed ||
      !looksEnglish(trimmed) ||
      /^[a-z0-9]+([-_][a-z0-9]+)+$/i.test(trimmed)
    )
      return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    findings.push({
      file: relative(ROOT, path),
      line: line + 1,
      text: trimmed,
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      report(node, node.text);
    } else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      isUiContext(node)
    ) {
      report(node, node.text);
    } else if (ts.isTemplateExpression(node) && isUiContext(node)) {
      report(
        node,
        [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(
          " ",
        ),
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

function loadAllowlist(): Set<string> {
  return new Set(
    readFileSync(ALLOWLIST_PATH, "utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => {
        const [file, text] = line.split("\t");
        return `${file}\t${text}`;
      }),
  );
}

const allowlist = loadAllowlist();
const findings = listSourceFiles(SRC)
  .flatMap(scanFile)
  .filter((finding) => !allowlist.has(`${finding.file}\t${finding.text}`));

for (const finding of findings) {
  console.log(`${finding.file}:${finding.line}\t${finding.text}`);
}
console.log(`\n${findings.length} English UI strings`);
process.exitCode = findings.length > 0 ? 1 : 0;
