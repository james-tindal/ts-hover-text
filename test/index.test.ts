import { describe, expect, test } from 'vitest'
import { getHoverText } from '../src/index'

const importCode = 'import { foo } from "./fixture"\n'

describe.sequential('getHoverText', () => {
	test('returns hover text for simple variable', () => {
		const hover = getHoverText('const x: number = 1', 'x')
		expect(hover).toContain('const x: number')
	})

	test('returns formatted array for multi-line types', () => {
		const code = `const obj: {
			a: string
			b: number
		}`
		const hover = getHoverText(code, 'obj')
		expect(hover).toStrictEqual([
			'const obj: {',
				'a: string;',
				'b: number;',
			'}'
		])
	})

	test('throws when symbol not found', () => {
		expect(() => getHoverText('const x = 1', 'nonexistent')).toThrow(
			/Symbol "nonexistent" not found/
		)
	})
})

describe('import resolution', () => {
	test('resolves imports from filesystem', () => {
		const hover = getHoverText(
			importCode + 'const x = foo',
			'x',
			{ sourceRoot: 'test' }
		)
		expect(hover).toEqual(['const x: "hello"'])
	})

	test('resolves imported type in type position', () => {
		const hover = getHoverText(
			importCode + 'const x: typeof foo = foo',
			'x',
			{ sourceRoot: 'test' }
		)
		expect(hover).toEqual(['const x: "hello"'])
	})
})

describe('performance', () => {
	test('first call completes in reasonable time', () => {
		const start = performance.now()
		getHoverText('const x: number = 1', 'x')
		const duration = performance.now() - start
		expect(duration).toBeLessThan(2000)
	})

	test('subsequent calls are fast', () => {
		const start = performance.now()
		getHoverText('const a: string = "a"', 'a')
		getHoverText('const b: string = "b"', 'b')
		getHoverText('const c: string = "c"', 'c')
		const duration = performance.now() - start
		expect(duration).toBeLessThan(200)
	})

	test('import resolution does not significantly slow down', () => {
		const start = performance.now()
		getHoverText(importCode + 'const x = foo', 'x', { sourceRoot: 'test' })
		getHoverText(importCode + 'const y = foo', 'y', { sourceRoot: 'test' })
		getHoverText(importCode + 'const z = foo', 'z', { sourceRoot: 'test' })
		const duration = performance.now() - start
		expect(duration).toBeLessThan(500)
	})
})
