/** @type {import('prettier').Config} */
export default {
    quoteProps: 'as-needed',
    arrowParens: 'always',
    bracketSameLine: true,
    bracketSpacing: true,
    endOfLine: 'auto',
    htmlWhitespaceSensitivity: 'ignore',
    jsxSingleQuote: true,
    printWidth: 120,
    proseWrap: 'preserve',
    semi: true,
    singleAttributePerLine: false,
    singleQuote: true,
    tabWidth: 4,
    trailingComma: 'es5',
    useTabs: false,
    plugins: ['prettier-plugin-tailwindcss'],
};
