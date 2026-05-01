import { StreamLanguage } from '@codemirror/language'

interface State {
  inMathBlock: boolean
  inRawBlock: boolean
}

const typstLanguage = StreamLanguage.define<State>({
  name: 'typst',

  startState(): State {
    return { inMathBlock: false, inRawBlock: false }
  },

  token(stream: any, state: State): string | null {
    // Raw block fence ``` ... ```
    if (stream.match('```')) {
      state.inRawBlock = !state.inRawBlock
      return 'monospace'
    }
    if (state.inRawBlock) {
      stream.skipToEnd()
      return 'monospace'
    }

    // Math block $$ ... $$
    if (stream.match('$$')) {
      state.inMathBlock = !state.inMathBlock
      return 'string'
    }
    if (state.inMathBlock) {
      stream.skipToEnd()
      return 'string'
    }

    // Line comment //
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }

    // Block comment /* ... */
    if (stream.match('/*')) {
      while (!stream.eol()) {
        if (stream.match('*/')) break
        stream.next()
      }
      return 'comment'
    }

    // Inline raw `...`
    if (stream.match('`')) {
      while (!stream.eol() && !stream.match('`', true)) stream.next()
      return 'monospace'
    }

    // Inline math $ ... $
    if (stream.match('$')) {
      while (!stream.eol() && !stream.match('$', true)) stream.next()
      return 'string'
    }

    // Headings = / == / ===
    if (stream.sol() && stream.match(/^=+\s/)) {
      stream.skipToEnd()
      return 'heading'
    }

    // Bold *...*
    if (stream.match('*')) {
      while (!stream.eol() && !stream.match('*', true)) stream.next()
      return 'strong'
    }

    // Italic _..._
    if (stream.match('_')) {
      while (!stream.eol() && !stream.match('_', true)) stream.next()
      return 'emphasis'
    }

    // Hash commands: #keyword or #funcname(
    if (stream.match('#')) {
      stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/)
      return 'keyword'
    }

    // String literals "..."
    if (stream.match('"')) {
      while (!stream.eol()) {
        if (stream.next() === '"') break
      }
      return 'string'
    }

    stream.next()
    return null
  },
})

export { typstLanguage }
