// Laisse Node résoudre les imports sans extension des sources TypeScript.
//
// Node 24 retire les types tout seul, mais exige l'extension dans les imports
// (`'../resolve.ts'`), alors que Metro et TypeScript s'en passent — et que le
// code de l'app les omet partout. Ce crochet retente simplement avec `.ts`,
// pour les tests seulement.

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') || /\.[cm]?[jt]sx?$/.test(specifier)) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
}
