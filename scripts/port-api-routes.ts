import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.join(import.meta.dirname, "..");
const NEXT_API_DIR = "src/app/api";
const START_API_DIR = "src/routes/api";
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

type Edit = { start: number; end: number; text: string };

export type SiblingImport = {
  specifier: string;
  rewrittenSpecifier: string;
  nextPath: string;
  startPath: string;
};

function toStartSegments(posixPath: string): string {
  return posixPath.replace(/\[([^\]/]+)\]/g, "$$$1");
}

function toNextSegments(posixPath: string): string {
  return posixPath.replace(/\$([^/]+)/g, "[$1]");
}

export function startRoutePath(nextRoutePath: string): {
  file: string;
  routeId: string;
} {
  const relative = path.posix.relative(NEXT_API_DIR, nextRoutePath);
  if (
    relative.startsWith("..") ||
    path.posix.basename(relative) !== "route.ts"
  ) {
    throw new Error(`${nextRoutePath}: not a Next API route handler`);
  }
  const routeId = `/api/${toStartSegments(path.posix.dirname(relative))}`;
  return { file: `src/routes${routeId}.ts`, routeId };
}

export function siblingImports(
  source: string,
  routeId: string,
): SiblingImport[] {
  const sourceFile = parse(source, routeId);
  return sourceFile.statements.flatMap((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.startsWith(".")
    ) {
      return [];
    }
    return [resolveSibling(statement.moduleSpecifier.text, routeId)];
  });
}

function resolveSibling(specifier: string, routeId: string): SiblingImport {
  if (path.posix.extname(specifier) !== "") {
    fail(routeId, `relative import "${specifier}" has an extension`);
  }
  const nextPath = `${path.posix.join(`src/app${toNextSegments(routeId)}`, specifier)}.ts`;
  if (!nextPath.startsWith(`${NEXT_API_DIR}/`)) {
    fail(routeId, `relative import "${specifier}" leaves ${NEXT_API_DIR}`);
  }
  const mirrored = toStartSegments(path.posix.relative(NEXT_API_DIR, nextPath));
  const startPath = path.posix.join(
    START_API_DIR,
    path.posix.dirname(mirrored),
    `-${path.posix.basename(mirrored)}`,
  );
  const fromDir = path.posix.dirname(`src/routes${routeId}.ts`);
  const relative = path.posix.relative(fromDir, startPath.replace(/\.ts$/, ""));
  return {
    specifier,
    rewrittenSpecifier: relative.startsWith(".") ? relative : `./${relative}`,
    nextPath,
    startPath,
  };
}

function fail(routeId: string, reason: string): never {
  throw new Error(`Cannot port ${routeId}: ${reason}`);
}

function parse(source: string, routeId: string): ts.SourceFile {
  return ts.createSourceFile(
    `${routeId}.ts`,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind)
  );
}

function isNextModule(specifier: string): boolean {
  return specifier === "next" || specifier.startsWith("next/");
}

function isNextResponseImport(statement: ts.ImportDeclaration): boolean {
  const bindings = statement.importClause?.namedBindings;
  return (
    (statement.moduleSpecifier as ts.StringLiteral).text === "next/server" &&
    !statement.importClause?.isTypeOnly &&
    !statement.importClause?.name &&
    bindings !== undefined &&
    ts.isNamedImports(bindings) &&
    bindings.elements.length === 1 &&
    !bindings.elements[0].propertyName &&
    bindings.elements[0].name.text === "NextResponse"
  );
}

function isTypeReferenceTo(node: ts.TypeNode | undefined, name: string) {
  return (
    node !== undefined &&
    ts.isTypeReferenceNode(node) &&
    ts.isIdentifier(node.typeName) &&
    node.typeName.text === name &&
    !node.typeArguments
  );
}

function handlerContext(
  handler: ts.FunctionDeclaration,
  routeId: string,
): string {
  const method = handler.name?.text;
  const [request, routeParams, ...rest] = handler.parameters;
  if (rest.length > 0) {
    fail(routeId, `${method} takes more than two parameters`);
  }
  const names: string[] = [];
  if (request) {
    if (
      !ts.isIdentifier(request.name) ||
      request.initializer ||
      request.dotDotDotToken ||
      request.questionToken ||
      (request.type && !isTypeReferenceTo(request.type, "Request"))
    ) {
      fail(routeId, `${method} has an unrecognized request parameter`);
    }
    const name = request.name.text;
    if (name === "request") {
      names.push("request");
    } else if (name !== "_request") {
      names.push(`request: ${name}`);
    }
  }
  if (routeParams) {
    const binding = routeParams.name;
    if (
      !ts.isObjectBindingPattern(binding) ||
      binding.elements.length !== 1 ||
      binding.elements[0].propertyName ||
      binding.elements[0].initializer ||
      binding.elements[0].dotDotDotToken ||
      !ts.isIdentifier(binding.elements[0].name) ||
      binding.elements[0].name.text !== "params" ||
      routeParams.initializer ||
      routeParams.questionToken ||
      !isTypeReferenceTo(routeParams.type, "RouteParams")
    ) {
      fail(
        routeId,
        `${method} second parameter is not \`{ params }: RouteParams\``,
      );
    }
    names.push("params");
  }
  return names.length > 0 ? `{ ${names.join(", ")} }` : "";
}

function applyEdits(
  source: string,
  start: number,
  end: number,
  edits: Edit[],
): string {
  let text = "";
  let cursor = start;
  for (const edit of edits) {
    if (edit.start < start || edit.end > end) continue;
    text += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return text + source.slice(cursor, end);
}

export function transformRoute(source: string, routeId: string): string {
  const sourceFile = parse(source, routeId);
  const handlers: ts.FunctionDeclaration[] = [];
  const kept: ts.Statement[] = [];
  const droppable: ts.Statement[] = [];
  const edits: Edit[] = [];
  let routeParamsAlias: ts.TypeAliasDeclaration | undefined;

  const siblings = new Map(
    siblingImports(source, routeId).map((sibling) => [
      sibling.specifier,
      sibling.rewrittenSpecifier,
    ]),
  );

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = (statement.moduleSpecifier as ts.StringLiteral).text;
      if (isNextResponseImport(statement)) {
        droppable.push(statement);
        continue;
      }
      if (isNextModule(specifier)) {
        fail(routeId, `unsupported import from "${specifier}"`);
      }
      if (specifier.startsWith("@/app/")) {
        fail(routeId, `imports app module "${specifier}"`);
      }
      const rewritten = siblings.get(specifier);
      if (rewritten) {
        edits.push({
          start: statement.moduleSpecifier.getStart(),
          end: statement.moduleSpecifier.end,
          text: JSON.stringify(rewritten),
        });
      }
      kept.push(statement);
      continue;
    }

    if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) {
      fail(routeId, `unrecognized export at line ${lineOf(statement)}`);
    }

    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      if (
        ts.isTypeAliasDeclaration(statement) &&
        statement.name.text === "RouteParams"
      ) {
        routeParamsAlias = statement;
        droppable.push(statement);
        continue;
      }
      kept.push(statement);
      continue;
    }

    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.length === 1 &&
      ts.isIdentifier(statement.declarationList.declarations[0].name) &&
      statement.declarationList.declarations[0].name.text === "dynamic"
    ) {
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      HTTP_METHODS.has(statement.name.text) &&
      statement.body &&
      hasModifier(statement, ts.SyntaxKind.AsyncKeyword) &&
      !hasModifier(statement, ts.SyntaxKind.DefaultKeyword) &&
      !statement.asteriskToken &&
      !statement.typeParameters &&
      !statement.type
    ) {
      handlers.push(statement);
      continue;
    }

    fail(routeId, `unrecognized export at line ${lineOf(statement)}`);
  }

  if (handlers.length === 0) {
    fail(routeId, "no HTTP method handlers");
  }

  for (const statement of droppable) {
    if (ts.getLeadingCommentRanges(source, statement.getFullStart())?.length) {
      fail(
        routeId,
        `dropping line ${lineOf(statement)} would lose its leading comment`,
      );
    }
  }

  const handlerNames = new Set(handlers.map((handler) => handler.name?.text));
  const handlerParamTypes = new Set(
    handlers.flatMap((handler) => handler.parameters[1]?.type ?? []),
  );

  const visit = (node: ts.Node, handler?: ts.FunctionDeclaration) => {
    if (ts.isImportDeclaration(node)) return;

    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (handlerNames.has(name) && node !== handler?.name) {
        fail(routeId, `${name} is referenced at line ${lineOf(node)}`);
      }
      if (name === "NextResponse") {
        const access = node.parent;
        if (
          !ts.isPropertyAccessExpression(access) ||
          access.expression !== node ||
          access.name.text !== "json" ||
          !ts.isCallExpression(access.parent) ||
          access.parent.expression !== access
        ) {
          fail(
            routeId,
            `unsupported NextResponse usage at line ${lineOf(node)}`,
          );
        }
        edits.push({ start: node.getStart(), end: node.end, text: "Response" });
      }
      if (name === "NextRequest") {
        fail(routeId, `unsupported NextRequest usage at line ${lineOf(node)}`);
      }
      if (
        name === "RouteParams" &&
        node.parent !== routeParamsAlias &&
        !handlerParamTypes.has(node.parent as ts.TypeNode)
      ) {
        fail(
          routeId,
          `RouteParams is used outside handler signatures at line ${lineOf(node)}`,
        );
      }
      return;
    }

    if (
      (ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal) &&
        isNextModule(node.argument.literal.text)) ||
      (ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.some(
          (argument) =>
            ts.isStringLiteral(argument) && isNextModule(argument.text),
        ))
    ) {
      fail(routeId, `unsupported next import at line ${lineOf(node)}`);
    }

    // Next inlines NEXT_PUBLIC_* at build time; Start's build defines the same values as VITE_*.
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text.startsWith("NEXT_PUBLIC_") &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "env" &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "process"
    ) {
      edits.push({
        start: node.getStart(),
        end: node.end,
        text: `import.meta.env.VITE_${node.name.text.slice("NEXT_PUBLIC_".length)}`,
      });
      return;
    }

    if (
      handler?.parameters[1] &&
      ts.isAwaitExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "params"
    ) {
      edits.push({ start: node.getStart(), end: node.end, text: "params" });
      return;
    }

    ts.forEachChild(node, (child) => visit(child, handler));
  };

  for (const statement of sourceFile.statements) {
    const handler = handlers.find((candidate) => candidate === statement);
    visit(statement, handler);
  }

  edits.sort((a, b) => a.start - b.start);

  const moduleText = kept
    .map((statement) =>
      applyEdits(source, statement.getFullStart(), statement.end, edits),
    )
    .join("")
    .trim();

  const handlerEntries = handlers.map((handler) => {
    const body = handler.body as ts.Block;
    const bodyText = applyEdits(source, body.getStart(), body.end, edits);
    const leadingComments = source
      .slice(handler.getFullStart(), handler.getStart())
      .trim();
    return `${leadingComments ? `${leadingComments}\n` : ""}${handler.name?.text}: async (${handlerContext(handler, routeId)}) => ${bodyText},`;
  });

  return `import { createFileRoute } from "@tanstack/react-router";
${moduleText ? `${moduleText}\n` : ""}
export const Route = createFileRoute(${JSON.stringify(routeId)})({
server: {
handlers: {
${handlerEntries.join("\n")}
ANY: async () => new Response(null, { status: 405 }),
},
},
});
`;
}

function lineOf(node: ts.Node): number {
  const sourceFile = node.getSourceFile();
  return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

function assertStandaloneSibling(sibling: SiblingImport, source: string) {
  const sourceFile = parse(source, sibling.nextPath);
  for (const statement of sourceFile.statements) {
    if (
      (ts.isImportDeclaration(statement) ||
        ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const specifier = statement.moduleSpecifier.text;
      if (
        isNextModule(specifier) ||
        specifier.startsWith(".") ||
        specifier.startsWith("@/app/")
      ) {
        throw new Error(
          `${sibling.nextPath}: cannot copy a module that imports "${specifier}"`,
        );
      }
    }
  }
}

function main() {
  const nextRoutes = readdirSync(path.join(ROOT, NEXT_API_DIR), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((file) => path.basename(file) === "route.ts")
    .map((file) =>
      path.posix.join(NEXT_API_DIR, file.split(path.sep).join(path.posix.sep)),
    )
    .sort();
  const outputs = new Map<string, string>();

  for (const nextRoute of nextRoutes) {
    const source = readFileSync(path.join(ROOT, nextRoute), "utf8");
    const { file, routeId } = startRoutePath(nextRoute);
    try {
      outputs.set(file, transformRoute(source, routeId));
      for (const sibling of siblingImports(source, routeId)) {
        const siblingSource = readFileSync(
          path.join(ROOT, sibling.nextPath),
          "utf8",
        );
        assertStandaloneSibling(sibling, siblingSource);
        outputs.set(sibling.startPath, siblingSource);
      }
    } catch (error) {
      throw new Error(`${nextRoute}: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  // The directory is wholly generated, so clearing it drops ports of deleted Next routes.
  rmSync(path.join(ROOT, START_API_DIR), { recursive: true, force: true });
  for (const [file, text] of outputs) {
    mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
    writeFileSync(path.join(ROOT, file), text);
  }

  execFileSync(
    path.join(ROOT, "node_modules/.bin/biome"),
    ["check", "--write", "--linter-enabled=false", ...outputs.keys()],
    { cwd: ROOT, stdio: "inherit" },
  );
  console.log(`Ported ${nextRoutes.length} routes to ${START_API_DIR}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
