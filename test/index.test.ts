import { describe, expect, test } from 'vitest'
import { getHoverText } from '../src/index'

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
		expect(hover.length).toBeGreaterThan(1)
		expect(hover[0]).toContain('const obj:')
	})

	test('throws when symbol not found', () => {
		expect(() => getHoverText('const x = 1', 'nonexistent')).toThrow(
			/Symbol "nonexistent" not found/
		)
	})
})
