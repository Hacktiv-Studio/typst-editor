import { StreamLanguage } from '@codemirror/language'

interface State {
  inMathBlock: boolean
  inRawBlock: boolean
  inBlockComment: boolean
}

const typstLanguage = StreamLanguage.define<State>({
  name: 'typst',

  startState(): State {
    return { inMathBlock: false, inRawBlock: false, inBlockComment: false }
  },

  token(stream: any, state: State): string | null {
    // Multi-line block comment continuation
    if (state.inBlockComment) {
      if (stream.match('*/')) {
        state.inBlockComment = false
      } else {
        stream.next()
      }
      return 'comment'
    }

    // Raw block fence ``` ... ```
    if (stream.match('```')) {
      state.inRawBlock = !state.inRawBlock
      return 'monospace'
    }
    if (state.inRawBlock) {
      if (stream.match('```')) {
        state.inRawBlock = false
      } else {
        stream.next()
      }
      return 'monospace'
    }

    // Math block $$ ... $$  (atom = math, distinct from string)
    if (stream.match('$$')) {
      state.inMathBlock = !state.inMathBlock
      return 'atom'
    }
    if (state.inMathBlock) {
      if (stream.match('$$')) {
        state.inMathBlock = false
      } else {
        stream.next()
      }
      return 'atom'
    }

    // Line comment //
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }

    // Block comment /* ... */
    if (stream.match('/*')) {
      state.inBlockComment = true
      while (!stream.eol()) {
        if (stream.match('*/')) { state.inBlockComment = false; break }
        stream.next()
      }
      return 'comment'
    }

    // Inline raw `...`
    if (stream.match('`')) {
      while (!stream.eol() && !stream.match('`', true)) stream.next()
      return 'monospace'
    }

    // Inline math $ ... $  (atom)
    if (stream.match('$')) {
      while (!stream.eol() && !stream.match('$', true)) stream.next()
      return 'atom'
    }

    // Headings: differentiate h1 (= ) h2 (== ) h3+ (===+)
    if (stream.sol()) {
      if (stream.match(/^===+\s/)) { stream.skipToEnd(); return 'qualifier' }
      if (stream.match(/^==\s/))   { stream.skipToEnd(); return 'def' }
      if (stream.match(/^=\s/))    { stream.skipToEnd(); return 'header' }
    }

    // Bold *...*
    if (stream.match('*')) {
      while (!stream.eol() && !stream.match('*', true)) stream.next()
      return 'strong'
    }

    // Italic _..._ — only when not preceded by a word character (e.g. foo_bar stays plain)
    if (stream.peek() === '_') {
      const prevChar = stream.pos > 0 ? stream.string[stream.pos - 1] : ''
      if (/\w/.test(prevChar)) {
        stream.next()
        return null
      }
      stream.next()
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

    // Numbers
    if (stream.match(/^-?\d+(\.\d+)?(pt|em|cm|mm|px|%|fr)?/)) {
      return 'number'
    }

    stream.next()
    return null
  },
})

export { typstLanguage }
