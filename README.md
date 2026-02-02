# ts-hover-text

Get TypeScript hover text (QuickInfo) for a symbol in a code string. Use this to test TypeScript type inference in your tests.

## Installation

```bash
pnpm add -D ts-hover-text
# or
npm i -D ts-hover-text
```

## Quick Start

```typescript
import { tsHoverText } from 'ts-hover-text'

const getHoverText = tsHoverText({ sourceRoot: 'src' })

test('my type test', () => {
  const hover = getHoverText('const x: number = 1', 'x')
  expect(hover).toEqual(['const x: number'])
})
```

## API

### `tsHoverText(options?)`

Create a configured `getHoverText` function. Call this once per test file.

**Options:**
- `sourceRoot` - Directory for resolving imports, relative to your project root (default: `'src'`)
- `tsConfigPath` - Path to tsconfig.json (default: `'tsconfig.json'`)
- `trimmedLines` - Return array of trimmed lines (default: `true`), or raw string (`false`)
- `compilerOptions` - Override TypeScript settings

### `getHoverText(code, symbolName)`

Get hover text for a symbol in your code string.

**Parameters:**
- `code` - TypeScript code to analyze
- `symbolName` - Identifier to get hover info for

**Returns:**
- `string[]` - Trimmed lines (default)
- `string` - Raw hover text (when `trimmedLines: false`)

## Imports

Imports in your code resolve relative to `sourceRoot`, which is relative to your project root (where package.json is). For example:

```typescript
// With sourceRoot: 'src'
getHoverText('import { Foo } from "./Foo"\nconst x = Foo', 'x')
// Resolves ./Foo to <project>/src/Foo.ts
```

## Performance

The first call parses TypeScript lib and source directory files and takes around a second. Subsequent calls are usually around 50ms.

## Examples

**Test type inference:**
```typescript
/* eslint-disable @stylistic/indent */
test('object type inference', () => {
  const hover = getHoverText('const obj: { a: string; b: number }', 'obj')
  expect(hover).toEqual([
    'const obj: {',
      'a: string;',
      'b: number;',
    '}',
  ])
})
```

**Test with imports:**
```typescript
// test/fixture.ts: export const foo = 'hello'
const getHoverText = tsHoverText({ sourceRoot: 'test' })

test('resolves imports', () => {
  const hover = getHoverText(
    'import { foo } from "./fixture"\nconst x = foo',
    'x'
  )
  expect(hover).toEqual(['const x: "hello"'])
})
```
