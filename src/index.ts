import ts from 'typescript'
import * as path from 'path'
import { randomBytes } from 'crypto'
import { packageDirectorySync } from 'package-directory'

const projectRoot = packageDirectorySync()!

if (!projectRoot)
	throw Error(
		'Could not find package.json. ' +
		'ts-hover-text must be run from within a project with a package.json file.'
	)

/**
 * Get TypeScript hover text (QuickInfo) for a symbol in a code string.
 *
 * @param code - The TypeScript code string to analyze
 * @param symbolName - The identifier name to get hover info for (e.g., 'x', 'myFn')
 * @param options - Configuration options
 * @returns Hover text as trimmed lines (default) or raw string
 * @throws Error if the symbol is not found, TypeScript program fails, or no hover info available
 * @example getHoverText('const x: number = 1', 'x') // ['const x: number']
 */
export function getHoverText(
	code: string,
	symbolName: string,
	options?: GetHoverTextOptions & { trimmedLines?: true }
): string[]
export function getHoverText(
	code: string,
	symbolName: string,
	options: GetHoverTextOptions & { trimmedLines: false }
): string
export function getHoverText(
	code: string,
	symbolName: string,
	options: GetHoverTextOptions = {}
): string[] | string {
	const opts = { ...defaultOptions, ...options }
	const virtualFileName = path.join(
		projectRoot,
		opts.sourceRoot,
		`${generateRandomFileName()}.ts`
	)

	return getHoverTextInternal(code, symbolName, virtualFileName, opts)
}

export interface GetHoverTextOptions {
	/**
	 * The root directory where your source files are located.
	 * Relative to your project root (where package.json is).
	 * Import statements resolve relative to this directory.
	 *
	 * @default 'src'
	 * @example
	 * 'src' - imports like './types' resolve to <project>/src/types.ts
	 * 'lib' - imports like './types' resolve to <project>/lib/types.ts
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
	 * If true (default), returns array of trimmed lines.
	 * If false, returns the raw hover string with newlines.
	 *
	 * @default true
	 */
	trimmedLines?: boolean

	/**
	 * Path to a tsconfig.json file to use for compiler options.
	 * Relative to project root or absolute path.
	 * If not specified, looks for tsconfig.json in project root.
	 *
	 * @default 'tsconfig.json' (in project root)
	 */
	tsConfigPath?: string
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
	trimmedLines: true,
	tsConfigPath: 'tsconfig.json',
}

const registry = ts.createDocumentRegistry()

function getHoverTextInternal(
	code: string,
	symbolName: string,
	virtualFileName: string,
	opts: Required<GetHoverTextOptions>
): string[] | string {

	const compilerOptions = resolveCompilerOptions(opts)

	const host: ts.LanguageServiceHost = {
		getScriptFileNames: () => [virtualFileName],
		getScriptVersion: () => '1',
		getScriptSnapshot(name) {
			if (name === virtualFileName)
				return ts.ScriptSnapshot.fromString(code)
			if (ts.sys.fileExists(name))
				return ts.ScriptSnapshot.fromString(ts.sys.readFile(name) || '')
			return undefined
		},
		getCurrentDirectory: () => process.cwd(),
		getCompilationSettings: () => compilerOptions,
		getDefaultLibFileName: ts.getDefaultLibFilePath,
		fileExists: name =>
			name === virtualFileName || ts.sys.fileExists(name),
		readFile: (name) =>
			name === virtualFileName
				? code
				: ts.sys.readFile(name),
		readDirectory: ts.sys.readDirectory,
		directoryExists: ts.sys.directoryExists,
		getDirectories: ts.sys.getDirectories,
		resolveModuleNames: (moduleNames, containingFile) =>
			moduleNames.map((moduleName) => {
				const resolved = ts.resolveModuleName(
					moduleName,
					containingFile,
					compilerOptions,
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

	const hoverText = ts.displayPartsToString(quickInfo.displayParts)
	return opts.trimmedLines
		? hoverText.split('\n').map((line) => line.trim()).filter(Boolean)
		: hoverText
}

function resolveCompilerOptions(
	opts: Required<GetHoverTextOptions>
): ts.CompilerOptions {
	// Merge order: defaults < tsconfig < user compilerOptions
	let options = { ...defaultOptions.compilerOptions }

	// Try to load from tsconfig
	const tsConfigPath = path.isAbsolute(opts.tsConfigPath)
		? opts.tsConfigPath
		: path.join(projectRoot, opts.tsConfigPath)

	if (ts.sys.fileExists(tsConfigPath)) {
		const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile)
		if (configFile.error) {
			console.warn(`Warning: Error reading tsconfig at ${tsConfigPath}`)
		} else {
			const parsedConfig = ts.parseJsonConfigFileContent(
				configFile.config,
				ts.sys,
				path.dirname(tsConfigPath)
			)

			if (parsedConfig.errors.length > 0)
				console.warn(`Warning: Errors parsing tsconfig at ${tsConfigPath}`)

			options = { ...options, ...parsedConfig.options }
		}
	}

	// Merge user compilerOptions (if they differ from defaults)
	const hasUserCompilerOptions =
		opts.compilerOptions !== defaultOptions.compilerOptions
	if (hasUserCompilerOptions)
		options = { ...options, ...opts.compilerOptions }

	return options
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
