# ts-hover-text

Get TypeScript hover text (QuickInfo) for a symbol in a code string. Designed for testing TypeScript type inference.

## Installation

```bash
pnpm add -D ts-hover-text
# or
npm add -D ts-hover-text
```

## Usage

```typescript
import { getHoverText } from 'ts-hover-text'

const hover = getHoverText(
  'import { MyType } from "./types"\nconst x: MyType',
  'x',
  { sourceRoot: './src' }
)
// Returns: ['const x: MyType']
```

## API

### `getHoverText(code, symbolName, options?)`

Get hover information for a symbol in TypeScript code.

**Parameters:**

- `code` - The TypeScript code string to analyze
- `symbolName` - The identifier name to get hover info for (e.g., 'x', 'myFn')
- `options` - Optional configuration:
  - `sourceRoot` - Root directory for resolving imports, relative to your project root (where package.json is) (default: 'src')
  - `compilerOptions` - TypeScript compiler options
  - `returnRaw` - Return raw QuickInfo object instead of formatted strings

**Returns:**
- `string[]` - Array of hover text lines (when `returnRaw: false` or omitted)
- `QuickInfo` - Raw TypeScript QuickInfo object (when `returnRaw: true`)


## Sequential Execution Required

Test cases using getHoverText must be run sequentially so they don't conflict with each other.

The Typescript language service has an expensive setup phase so we run this only once per test file, then share the in-memory state across all test cases. But the state is mutated per test case so this could cause conflicts if run in parallel

### Vitest
```typescript
describe.sequential('type tests', () => {
  test('first', () => {
    const hover1 = getHoverText('const x = 1', 'x')
    expect(hover1).toEqual(['const x: 1'])
  })
  
  test('second', () => {
    const hover2 = getHoverText('const y = "hello"', 'y')
    expect(hover2).toEqual(['const y: "hello"'])
  })
})
```

### Jest
Jest runs tests sequentially by default. No special configuration needed unless you use `--maxWorkers` or `--workerThreads`.

### node:test
```typescript
describe('type tests', { concurrency: false }, () => {
  test('first', () => {
    const hover = getHoverText('const x = 1', 'x')
    // ...
  })
})
```

## Import Resolution

Imports in your code string are resolved relative to `sourceRoot`, which is resolved relative to your **project root** (where your `package.json` is located).

Given a project structure like:
```
/my-project/
  package.json
  src/
    Path.ts
    types.ts
```

You can resolve imports regardless of where you run the tests from:

```typescript
// With sourceRoot: 'src' (default)
getHoverText(
  'import { Path } from "./Path"\nconst path: Path',
  'path',
  { sourceRoot: 'src' }
)
// Resolves import to: /my-project/src/Path.ts
```

This works whether you run tests from `/my-project`, `/my-project/src`, or anywhere else in the project tree.

## Advanced Usage

### Raw QuickInfo

Access the full TypeScript QuickInfo object:

```typescript
import { getHoverText } from 'ts-hover-text'

const quickInfo = getHoverText(
  'const x: number = 1',
  'x',
  { returnRaw: true }
)

// Access documentation, tags, etc.
console.log(quickInfo.documentation)
```

### Custom Compiler Options

```typescript
const hover = getHoverText(
  'const x = 1n',
  'x',
  {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      strict: true
    }
  }
)
```
