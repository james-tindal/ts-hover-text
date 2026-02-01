import ts from 'typescript'
import * as path from 'path'
import { randomBytes } from 'crypto'

/**
 * Get TypeScript hover text (QuickInfo) for a symbol in a code string.
 *
 * @param code - The TypeScript code string to analyze
 * @param symbolName - The identifier name to get hover info for (e.g., 'x', 'myFn')
 * @param options - Configuration options
 * @returns Formatted hover text lines, or raw QuickInfo if returnRaw is true
 * @throws Error if the symbol is not found, TypeScript program fails, or no hover info available
 * @example getHoverText('const x: number = 1', 'x') // ['const x: number']
 */
export function getHoverText(
	code: string,
	symbolName: string,
	options?: GetHoverTextOptions & { returnRaw?: false }
): string[]
export function getHoverText(
	code: string,
	symbolName: string,
	options: GetHoverTextOptions & { returnRaw: true }
): ts.QuickInfo
export function getHoverText(
	code: string,
	symbolName: string,
	options: GetHoverTextOptions = {}
): string[] | ts.QuickInfo {
	const opts = { ...defaultOptions, ...options }
	const virtualFileName = path.join(
		opts.sourceRoot,
		`${generateRandomFileName()}.ts`
	)
	
	return getHoverTextInternal(code, symbolName, virtualFileName, opts)
}

export interface GetHoverTextOptions {
	/**
	 * The root directory where your source files are located.
	 * Import statements in your code will be resolved relative to this directory.
	 *
	 * @default 'src'
	 * @example
	 * './src' - imports like './types' resolve to './src/types.ts'
	 * './lib' - imports like './types' resolve to './lib/types.ts'
	 */
	sourceRoot?: string

	/**
	 * TypeScript compiler options. These control how your code is parsed and
	 * what features are available.
	 *
	 * @default
	 * {
	 *   target: ts.ScriptTarget.ES2020,
	 *   module: ts.ModuleKind.CommonJS,
	 *   esModuleInterop: true,
	 *   strict: true,
	 *   skipLibCheck: true
	 * }
	 */
	compilerOptions?: ts.CompilerOptions

	/**
	 * If true, return the raw QuickInfo object instead of formatted strings.
	 * Useful if you need access to documentation, tags, or other metadata.
	 *
	 * @default false
	 */
	returnRaw?: boolean
}

const defaultOptions: Required<GetHoverTextOptions> = {
	sourceRoot: 'src',
	compilerOptions: {
		target: ts.ScriptTarget.ES2020,
		module: ts.ModuleKind.CommonJS,
		esModuleInterop: true,
		strict: true,
		skipLibCheck: true,
	},
	returnRaw: false,
}

// Module-level state for caching - DO NOT export
let currentCode = ''
let currentVirtualFileName = ''
let codeVersion = 0
const registry = ts.createDocumentRegistry()

function getHoverTextInternal(
	code: string,
	symbolName: string,
	virtualFileName: string,
	opts: Required<GetHoverTextOptions>
): string[] {
	currentCode = code
	currentVirtualFileName = virtualFileName
	codeVersion++
	
	const host: ts.LanguageServiceHost = {
		getScriptFileNames: () => [virtualFileName],
		getScriptVersion: fileName =>
			String(fileName === virtualFileName ? codeVersion : 1),
		getScriptSnapshot(name) {
			if (name === virtualFileName)
				return ts.ScriptSnapshot.fromString(currentCode)
			if (ts.sys.fileExists(name))
				return ts.ScriptSnapshot.fromString(ts.sys.readFile(name) || '')
			return undefined
		},
		getCurrentDirectory: () => process.cwd(),
		getCompilationSettings: () => opts.compilerOptions,
		getDefaultLibFileName: ts.getDefaultLibFilePath,
		fileExists: name =>
			name === virtualFileName || ts.sys.fileExists(name),
		readFile: (name) =>
			name === virtualFileName
				? currentCode
				: ts.sys.readFile(name),
		readDirectory: ts.sys.readDirectory,
		directoryExists: ts.sys.directoryExists,
		getDirectories: ts.sys.getDirectories,
		resolveModuleNames: (moduleNames, containingFile) =>
			moduleNames.map((moduleName) => {
				const resolved = ts.resolveModuleName(
					moduleName,
					containingFile,
					opts.compilerOptions,
					ts.sys
				)
				return resolved.resolvedModule
			}),
	}

	const services = ts.createLanguageService(host, registry)

	const program = services.getProgram()
	if (!program)
		throw Error(
			`Failed to create TypeScript program for virtual file "${virtualFileName}"`
		)

	const sourceFile = program.getSourceFile(virtualFileName)
	if (!sourceFile)
		throw Error(`Source file "${virtualFileName}" not found in program`)

	const pos = findIdentifierPosition(sourceFile, symbolName)
	if (pos === -1)
		throw Error(
			`Symbol "${symbolName}" not found as identifier in code. ` +
			`Ensure "${symbolName}" appears as a standalone identifier ` +
			`(not in comments/strings). Code: ${code.slice(0, 200)}` +
			`${code.length > 200 ? '...' : ''}`
		)

	const quickInfo = services.getQuickInfoAtPosition(virtualFileName, pos)
	if (!quickInfo)
		throw Error(
			`No hover info available for symbol "${symbolName}" ` +
			`at position ${pos}. The symbol may not have type information.`
		)

	if (opts.returnRaw)
		return quickInfo as unknown as string[]

	const hoverText = ts.displayPartsToString(quickInfo.displayParts)
	return hoverText.split('\n').map((line) => line.trim()).filter(Boolean)
}

function findIdentifierPosition(
	sourceFile: ts.SourceFile,
	symbolName: string
): number {
	let position = -1

	const visit = (node: ts.Node) => {
		if (position !== -1) return

		if (ts.isIdentifier(node) && node.text === symbolName) {
			position = node.getStart(sourceFile)
			return
		}

		ts.forEachChild(node, visit)
	}

	ts.forEachChild(sourceFile, visit)
	return position
}

const generateRandomFileName = () =>
	`virtual-${randomBytes(8).toString('hex')}`
