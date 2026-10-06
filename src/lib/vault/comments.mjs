// Obsidian comments: `%% inline %%` and multi-line blocks.
// This is how outline / private notes live in the same file as the article.
//
// They are removed *before* markdown parsing because a block comment can span
// paragraphs, lists and headings. Fenced code and inline code are left alone.

export function stripComments(text) {
  const out = [];
  let fence = null; // the opening fence string while inside a fenced code block
  let inComment = false;

  for (const line of text.split('\n')) {
    if (!inComment) {
      const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (fence) {
        if (m && m[1][0] === fence[0] && m[1].length >= fence.length && /^\s{0,3}(`+|~+)\s*$/.test(line)) {
          fence = null;
        }
        out.push(line);
        continue;
      }
      if (m) {
        fence = m[1];
        out.push(line);
        continue;
      }
    }

    const wasInComment = inComment;
    let res = '';
    let i = 0;
    while (i < line.length) {
      if (inComment) {
        const j = line.indexOf('%%', i);
        if (j === -1) {
          i = line.length;
        } else {
          inComment = false;
          i = j + 2;
        }
        continue;
      }
      if (line[i] === '`') {
        const run = /^`+/.exec(line.slice(i))[0];
        const end = line.indexOf(run, i + run.length);
        if (end === -1) {
          res += line.slice(i);
          break;
        }
        res += line.slice(i, end + run.length);
        i = end + run.length;
        continue;
      }
      if (line.startsWith('%%', i)) {
        inComment = true;
        i += 2;
        continue;
      }
      res += line[i++];
    }

    const touched = wasInComment || res !== line;
    // A line that only held comment text disappears entirely instead of
    // leaving a blank line that could split a list or paragraph.
    if (touched && res.trim() === '') continue;
    out.push(res);
  }
  return out.join('\n');
}
